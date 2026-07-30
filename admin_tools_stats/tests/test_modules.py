#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from django.contrib.messages import get_messages
from django.contrib.messages.middleware import MessageMiddleware
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, TestCase
from model_bakery import baker

from admin_tools_stats.modules import DashboardChart, get_active_graph


class DashboardChartTests(TestCase):
    def setUp(self):
        self.stats = baker.make(
            "DashboardStats",
            graph_title="User chart",
            date_field_name="date_joined",
            model_name="User",
            model_app_name="auth",
            graph_key="user_graph",
        )
        get_active_graph()

    def make_request(self):
        request = RequestFactory().get("/admin/")
        SessionMiddleware(lambda r: None).process_request(request)
        MessageMiddleware(lambda r: None).process_request(request)
        return request

    def test_title_of_an_active_chart(self):
        chart = DashboardChart(graph_key="user_graph", require_chart_jscss=False)
        self.assertEqual(chart.title, "User chart")
        self.assertFalse(hasattr(chart, "error_message"))

    def test_missing_chart_is_reported_in_the_admin(self):
        """A dashboard configured with an unknown graph_key must not break the admin index"""
        chart = DashboardChart(graph_key="no_such_graph", require_chart_jscss=False)

        self.assertEqual(chart.title, "")
        request = self.make_request()
        chart.init_with_context({"request": request})

        messages = [str(m) for m in get_messages(request)]
        self.assertEqual(
            messages,
            [" dashboard: chart 'no_such_graph' does not exist or is not visible"],
        )

    def test_hidden_chart_is_reported_too(self):
        """is_visible=False charts are not in the active set either"""
        self.stats.is_visible = False
        self.stats.save()
        get_active_graph()

        chart = DashboardChart(graph_key="user_graph", require_chart_jscss=False)

        self.assertEqual(chart.title, "")
        self.assertEqual(chart.error_message, "chart 'user_graph' does not exist or is not visible")
