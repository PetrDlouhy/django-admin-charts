import calendar
import csv
import logging
from collections import OrderedDict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from datetime_truncate import truncate
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpRequest, HttpResponse
from django.views.generic import TemplateView, View

from .models import (
    DashboardStats,
    Interval,
    get_charts_timezone,
    has_full_chart_access,
    truncate_ceiling,
)


logger = logging.getLogger(__name__)

GENERIC_CHART_ERROR = "This chart could not be calculated. The error has been logged."

CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


class InvalidChartParameter(ValueError):
    """A chart-data request named a field the chart is not configured to expose.

    The data views aggregate ``select_box_operation_field`` straight from the
    query string. Without this guard any viewer of a ``show_to_users`` chart -
    including a non-staff user - could point the aggregate at an arbitrary field
    (``select_box_operation=Max&select_box_operation_field=<related>__email``)
    and read values out of rows the chart is only meant to count.
    """


class AdminChartsView(TemplateView):
    template_name = "admin_tools_stats/admin_charts.js"


interval_dateformat_map_bar_chart = {
    "years": ("%Y", "%Y"),
    "quarters": ("%b %Y", "%b"),
    "months": ("%b %Y", "%b"),
    "weeks": ("%a %d %b %Y", "%W"),
    "days": ("%a %d %b %Y", "%a"),
    "hours": ("%a %d %b %Y %H:%S", "%H"),
}

interval_dateformat_map = {
    "years": ("%Y", "%Y"),
    "quarters": ("%b %Y", "%b %Y"),
    "months": ("%b %Y", "%b %Y"),
    "weeks": ("%W (%d %b %Y)", "%W"),
    "days": ("%a %d %b %Y", "%d %b %Y"),
    "hours": ("%a %d %b %Y %H:%S", "%H"),
}


def get_dateformat(interval: Interval, chart_type):
    if chart_type == "discreteBarChart":
        return interval_dateformat_map_bar_chart[interval.value]
    return interval_dateformat_map[interval.value]


def remove_multiple_keys(in_dict, entries_to_remove):
    for k in entries_to_remove:
        in_dict.pop(k, None)


def escape_csv_formula(cell):
    """Keep a spreadsheet from running a CSV cell as a formula (CSV injection).

    The CSV echoes query-string parameters and series labels from the data;
    Excel, LibreOffice and Google Sheets evaluate a cell starting with one of
    ``CSV_FORMULA_PREFIXES``. The leading apostrophe (OWASP's advice) shows it
    as text. Only strings are touched: numbers, negative ones included, stay numbers.
    """
    if isinstance(cell, str) and cell.startswith(CSV_FORMULA_PREFIXES):
        return "'" + cell
    return cell


def json_serializable_value(value):
    """Make a single aggregated y value safe for the chart's JSON serialization.

    ``Sum``/``Avg`` over a ``DecimalField`` return ``Decimal``, which
    ``python-nvd3`` cannot serialize: it does a plain ``json.dumps()`` on the
    series, and the stdlib encoder has no rule for ``Decimal``. The failure
    happens while the template renders, i.e. outside the ``try`` block that
    turns data errors into a readable chart error, so it surfaces as a 500.
    """
    if not value:
        return 0
    if isinstance(value, Decimal):
        return float(value)
    return value


class ChartDataMixin:
    def check_chart_permission(
        self, dashboard_stats: DashboardStats, user: Union[User, AnonymousUser]
    ) -> bool:
        return (
            user.has_perm("admin_tools_stats.view_dashboardstats") or dashboard_stats.show_to_users
        )

    def check_operation_field(self, request: HttpRequest, dashboard_stats: DashboardStats) -> None:
        """Reject an aggregation field the chart is not configured to expose.

        Only the chart's own operation field(s) - or the empty "divide all"
        choice - may drive the aggregate; anything else would leak data from
        the aggregated rows (see ``InvalidChartParameter``).
        """
        operation_field = request.GET.get("select_box_operation_field")
        if operation_field and operation_field not in dashboard_stats.get_operations_list():
            raise InvalidChartParameter(
                f"Operation field {operation_field!r} is not configured for this chart."
            )

    def get_chart_series_data(
        self,
        request: HttpRequest,
        dashboard_stats: DashboardStats,
        interval: Optional[Interval] = None,
    ) -> Dict[str, Any]:
        self.check_operation_field(request, dashboard_stats)
        configuration: Dict[str, Union[str, List[str]]] = {
            item: request.GET[item] for item in request.GET
        }
        remove_multiple_keys(configuration, ["csrfmiddlewaretoken", "_", "graph_key"])
        if not has_full_chart_access(request.user):
            # the cache is shared and a recalculation runs the full chart query
            remove_multiple_keys(configuration, ["reload", "reload_all"])

        selected_interval: Interval = Interval(
            configuration.pop("select_box_interval", interval) or dashboard_stats.default_time_scale
        )
        operation = configuration.pop(
            "select_box_operation", dashboard_stats.type_operation_field_name
        )
        if not isinstance(operation, str):
            operation = None
        operation_field = configuration.pop(
            "select_box_operation_field", dashboard_stats.operation_field_name
        )
        if not isinstance(operation_field, str):
            operation_field = None

        chart_type = configuration.pop("select_box_chart_type", dashboard_stats.default_chart_type)

        chart_tz = get_charts_timezone()
        time_since = datetime.strptime(str(configuration.pop("time_since")), "%Y-%m-%d")
        time_since = truncate(time_since, selected_interval.val())
        time_since = time_since.astimezone(chart_tz)

        time_until = datetime.strptime(str(configuration.pop("time_until")), "%Y-%m-%d")
        time_until = truncate_ceiling(time_until, selected_interval.val())
        time_until = time_until.astimezone(chart_tz)

        if time_since > time_until:
            raise ValueError("Time since is greater than time until")

        if dashboard_stats.cache_values:
            get_time_series = dashboard_stats.get_multi_time_series_cached
        else:
            get_time_series = dashboard_stats.get_multi_time_series

        series = get_time_series(
            configuration,
            time_since,
            time_until,
            selected_interval,
            operation,
            operation_field,
            request.user,
        )

        return {
            "series": series,
            "time_since": time_since,
            "time_until": time_until,
            "selected_interval": selected_interval,
            "chart_type": chart_type,
            "configuration": configuration,
        }


class ChartDataView(ChartDataMixin, TemplateView):
    template_name = "admin_tools_stats/chart_data.html"

    def get_context_data(
        self, *args, interval: Optional[Interval] = None, graph_key=None, **kwargs
    ):
        dashboard_stats = DashboardStats.objects.get(graph_key=graph_key)
        context = super().get_context_data(*args, **kwargs)

        if not self.check_chart_permission(dashboard_stats, self.request.user):
            context["error"] = (
                "You have no permission to view this chart. "
                "Check if you are logged in and have permission "
                "'admin_tools_stats | dashboard stats | Can view dashboard stats'"
            )
            context["graph_title"] = dashboard_stats.graph_title
            context["graph_key"] = graph_key
            return context

        try:
            chart_data = self.get_chart_series_data(self.request, dashboard_stats, interval)
        except Exception as e:
            show_details = has_full_chart_access(self.request.user)
            if show_details and "debug" in self.request.GET:
                raise
            logger.exception(e)
            # the exception text can carry the schema or SQL; an invalid
            # parameter only echoes the viewer's own request
            if show_details or isinstance(e, InvalidChartParameter):
                context["error"] = str(e)
            else:
                context["error"] = GENERIC_CHART_ERROR
            context["graph_title"] = dashboard_stats.graph_title
            context["graph_key"] = graph_key
            return context

        series = chart_data["series"]
        selected_interval = chart_data["selected_interval"]
        context["chart_type"] = chart_data["chart_type"]

        ydata_serie: Dict[str, List[Union[int, float]]] = {}
        names = {}
        xdata = []
        serie_i_map: Dict[str, int] = OrderedDict()
        for date in sorted(
            series.keys(),
            key=lambda d: datetime(d.year, d.month, d.day, getattr(d, "hour", 0)),
        ):
            # the wall-clock bucket serialized as if it were UTC; the chart
            # template shifts each x by the browser's own offset, so the point
            # renders on the intended calendar day in any browser timezone
            # (previously time.mktime tied this to the *server* timezone)
            xdata.append(int(calendar.timegm(date.timetuple()) * 1000))
            for key, value in series[date].items():
                if key not in serie_i_map:
                    serie_i_map[key] = len(serie_i_map)
                y_key = "y%i" % serie_i_map[key]
                if y_key not in ydata_serie:
                    ydata_serie[y_key] = []
                    names["name%i" % serie_i_map[key]] = str(key)
                ydata_serie[y_key].append(json_serializable_value(value))

        context["extra"] = {
            "x_is_date": True,
            "tag_script_js": False,
        }

        if dashboard_stats.y_axis_format:
            context["extra"]["y_axis_format"] = dashboard_stats.y_axis_format

        if context["chart_type"] == "stackedAreaChart":
            context["extra"]["use_interactive_guideline"] = True

        tooltip_date_format, context["extra"]["x_axis_format"] = get_dateformat(
            selected_interval, context["chart_type"]
        )

        extra_serie = {
            "tooltip": {"y_start": "", "y_end": ""},
            "date_format": tooltip_date_format,
        }

        context["values"] = {
            "x": xdata,
            "name1": selected_interval,
            **ydata_serie,
            **names,
            "extra1": extra_serie,
        }

        context["chart_container"] = "chart_container_" + graph_key
        context["graph_key"] = graph_key
        return context


class ChartDataCSVView(ChartDataMixin, View):
    def get(self, request, graph_key=None):
        dashboard_stats = DashboardStats.objects.get(graph_key=graph_key)

        if not self.check_chart_permission(dashboard_stats, request.user):
            return HttpResponse("Permission denied", status=403)

        try:
            chart_data = self.get_chart_series_data(request, dashboard_stats)
        except InvalidChartParameter as e:
            return HttpResponse(str(e), status=400, content_type="text/plain")
        series = chart_data["series"]
        time_since = chart_data["time_since"]
        time_until = chart_data["time_until"]
        selected_interval = chart_data["selected_interval"]
        chart_type = chart_data["chart_type"]
        configuration = chart_data["configuration"]

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="{graph_key}_{time_since.strftime("%Y%m%d")}_'
            f'{time_until.strftime("%Y%m%d")}.csv"'
        )

        csv_writer = csv.writer(response)

        def writerow(row):
            csv_writer.writerow([escape_csv_formula(cell) for cell in row])

        settings_labels = [
            "Graph Key",
            "Graph Title",
            "Model",
            "Date Field",
            "Time Since",
            "Time Until",
            "Interval",
            "Chart Type",
            "Operation",
            "Operation Field",
        ]
        settings_values = [
            dashboard_stats.graph_key,
            dashboard_stats.graph_title,
            f"{dashboard_stats.model_app_name}.{dashboard_stats.model_name}",
            dashboard_stats.date_field_name,
            time_since.strftime("%Y-%m-%d %H:%M:%S"),
            time_until.strftime("%Y-%m-%d %H:%M:%S"),
            selected_interval.value,
            chart_type,
            request.GET.get(
                "select_box_operation", dashboard_stats.type_operation_field_name or ""
            ),
            request.GET.get(
                "select_box_operation_field", dashboard_stats.operation_field_name or ""
            ),
        ]

        for key, value in configuration.items():
            settings_labels.append(key)
            settings_values.append(str(value) if value else "")

        writerow(settings_labels)
        writerow(settings_values)

        serie_keys = set()
        for date_data in series.values():
            serie_keys.update(date_data.keys())
        serie_keys = [key for key in serie_keys if key is not None]
        serie_keys = sorted(serie_keys, key=str)

        header = ["Date"] + [str(key) for key in serie_keys]
        writerow(header)

        for date in sorted(
            series.keys(),
            key=lambda d: datetime(d.year, d.month, d.day, getattr(d, "hour", 0)),
        ):
            date_str = date.strftime("%Y-%m-%d %H:%M:%S")
            row = [date_str]
            for key in serie_keys:
                value = series[date].get(key, 0)
                row.append(value if value else 0)
            writerow(row)

        return response


class ChartsMixin:
    def get_charts_query(self):
        query = DashboardStats.objects.order_by("graph_title").all()
        if not self.request.user.has_perm("admin_tools_stats.view_dashboardstats"):
            query = query.filter(show_to_users=True)
        return query


class AnalyticsView(LoginRequiredMixin, ChartsMixin, TemplateView):
    def get_template_names(self):
        if self.request.user.has_perm("admin_tools_stats.view_dashboardstats"):
            return "admin_tools_stats/analytics.html"
        return "admin_tools_stats/analytics_user.html"

    def get_context_data(self, *args, **kwargs):
        context_data = super().get_context_data(*args, **kwargs)
        context_data["nonuser_charts"] = self.get_charts_query().filter(show_to_users=False)
        context_data["charts"] = self.get_charts_query()
        return context_data


class AnalyticsChartView(LoginRequiredMixin, ChartsMixin, TemplateView):
    template_name = "admin_tools_stats/analytics_chart.html"

    def get_context_data(self, *args, graph_key=None, **kwargs):
        context_data = super().get_context_data(*args, **kwargs)
        context_data["chart"] = self.get_charts_query().get(graph_key=graph_key)
        return context_data
