#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from django.test import TestCase
from django.test.utils import override_settings
from model_bakery import baker

from admin_tools_stats.templatetags.admin_chart_tags import static_or_path

from .utils import BaseSuperuserAuthenticatedClient


class StaticOrPathTests(TestCase):
    """The nvd3/d3 paths can be either a CDN URL or a path in the static files."""

    def test_url_is_used_as_is(self):
        self.assertEqual(
            static_or_path("https://unpkg.com/nvd3/build/nv.d3.min.js"),
            "https://unpkg.com/nvd3/build/nv.d3.min.js",
        )

    def test_path_is_resolved_through_staticfiles(self):
        self.assertEqual(
            static_or_path("nvd3/build/nv.d3.min.js"), "/static/nvd3/build/nv.d3.min.js"
        )


class ChartFormTemplateTests(BaseSuperuserAuthenticatedClient):
    """The reload-all button only makes sense for charts that cache their values."""

    def make_stats(self, **kwargs):
        return baker.make(
            "DashboardStats",
            graph_title="User chart",
            date_field_name="date_joined",
            model_name="User",
            model_app_name="auth",
            allowed_type_operation_field_name=[],
            **kwargs,
        )

    def get_chart_page(self, graph_key):
        return self.client.get(f"/admin_tools_stats/analytics/chart/{graph_key}/")

    @override_settings(STATIC_URL="/static/")
    def test_cached_chart_offers_reload_all(self):
        self.make_stats(graph_key="cached_graph", cache_values=True)
        response = self.get_chart_page("cached_graph")
        self.assertContains(response, 'id="reload_all"')

    @override_settings(STATIC_URL="/static/")
    def test_uncached_chart_has_no_reload_all(self):
        self.make_stats(graph_key="live_graph", cache_values=False)
        response = self.get_chart_page("live_graph")
        self.assertContains(response, 'id="reload"')
        self.assertNotContains(response, 'id="reload_all"')


class AssertContainsAnyTests(TestCase):
    """The test helper itself: it must fail loudly when nothing matches."""

    def test_reports_every_candidate_when_none_matches(self):
        from django.http import HttpResponse

        from .utils import assertContainsAny

        response = HttpResponse("nothing here")
        with self.assertRaises(AssertionError) as error:
            assertContainsAny(self, response, ("first", "second"))
        message = str(error.exception)
        self.assertIn("None of the ('first', 'second') were found", message)
        self.assertIn("Assertion errors:", message)
