from django.test import TestCase
from model_bakery import baker

from admin_tools_stats.forms import ChartSettingsForm


class ChartSettingsFormTests(TestCase):
    def test_operations_list(self):
        stats = baker.make(
            "DashboardStats",
            allowed_type_operation_field_name=["Sum", "Count"],
            operation_field_name="auth,user",
        )
        ch = ChartSettingsForm(stats)
        self.assertEqual(
            ch.fields["select_box_operation_field"].choices,
            [("", "(divide all)"), ("auth", "auth"), ("user", "user")],
        )

    def test_chart_filter_and_multiple_series_fields(self):
        """Criteria of the chart add a filter select and the "Divide" select"""
        stats = baker.make(
            "DashboardStats",
            model_name="User",
            model_app_name="auth",
            date_field_name="date_joined",
            allowed_type_operation_field_name=[],
        )
        criteria = baker.make(
            "DashboardStatsCriteria",
            criteria_name="active",
            dynamic_criteria_field_name="is_active",
        )
        chart_filter = baker.make(
            "CriteriaToStatsM2M",
            criteria=criteria,
            stats=stats,
            use_as="chart_filter",
            default_option="True",
        )
        multiple_series = baker.make(
            "CriteriaToStatsM2M",
            criteria=criteria,
            stats=stats,
            use_as="multiple_series",
        )

        ch = ChartSettingsForm(stats)

        filter_field = ch.fields[f"select_box_dynamic_{chart_filter.id}"]
        self.assertEqual(filter_field.label, "active")
        self.assertEqual(filter_field.initial, "True")
        self.assertEqual(
            filter_field.choices,
            [("", "-------"), ("", "All"), (True, "True"), (False, "False")],
        )
        self.assertEqual(filter_field.widget.attrs["class"], "chart-input")

        divide_field = ch.fields["select_box_multiple_series"]
        self.assertEqual(divide_field.label, "Divide")
        self.assertEqual(divide_field.choices, [("", "-------"), (multiple_series.id, "active")])
        self.assertIsNone(divide_field.initial)

    def test_multiple_series_initial_is_the_default_criteria(self):
        """The chart's default multiseries criteria preselects the "Divide" field"""
        stats = baker.make(
            "DashboardStats",
            model_name="User",
            model_app_name="auth",
            date_field_name="date_joined",
            allowed_type_operation_field_name=[],
        )
        criteria = baker.make(
            "DashboardStatsCriteria",
            criteria_name="active",
            dynamic_criteria_field_name="is_active",
        )
        multiple_series = baker.make(
            "CriteriaToStatsM2M",
            criteria=criteria,
            stats=stats,
            use_as="multiple_series",
        )
        stats.default_multiseries_criteria = multiple_series
        stats.save()

        ch = ChartSettingsForm(stats)

        self.assertEqual(ch.fields["select_box_multiple_series"].initial, multiple_series.id)

    def test_single_choice_selects_are_omitted(self):
        """Chooser fields only appear when there is something to choose from"""
        stats = baker.make(
            "DashboardStats",
            model_name="User",
            model_app_name="auth",
            date_field_name="date_joined",
            allowed_type_operation_field_name=[],
            allowed_time_scales=["days"],
            allowed_chart_types=["lineChart"],
        )

        ch = ChartSettingsForm(stats)

        self.assertNotIn("select_box_interval", ch.fields)
        self.assertNotIn("select_box_chart_type", ch.fields)
        self.assertNotIn("select_box_operation", ch.fields)

    def test_criteria_without_choices_adds_no_filter(self):
        """A criteria that resolves to no choices must not add an empty select"""
        stats = baker.make(
            "DashboardStats",
            model_name="User",
            model_app_name="auth",
            date_field_name="date_joined",
            allowed_type_operation_field_name=[],
        )
        criteria = baker.make(
            "DashboardStatsCriteria",
            criteria_name="nothing",
            dynamic_criteria_field_name="",
        )
        chart_filter = baker.make(
            "CriteriaToStatsM2M",
            criteria=criteria,
            stats=stats,
            use_as="chart_filter",
        )

        ch = ChartSettingsForm(stats)

        self.assertNotIn(f"select_box_dynamic_{chart_filter.id}", ch.fields)

    def test_chart_without_allowed_operations(self):
        """allowed_type_operation_field_name is nullable and has no default"""
        stats = baker.make(
            "DashboardStats",
            model_name="User",
            model_app_name="auth",
            date_field_name="date_joined",
        )
        self.assertIsNone(stats.allowed_type_operation_field_name)

        ch = ChartSettingsForm(stats)

        self.assertNotIn("select_box_operation", ch.fields)
        self.assertIn("time_since", ch.fields)
