#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from datetime import datetime, timezone
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils.timezone import now
from model_bakery import baker

from admin_tools_stats.models import CachedValue


class RecalculateChartsTests(TestCase):
    def setUp(self):
        self.stats = baker.make(
            "DashboardStats",
            date_field_name="date_joined",
            graph_title="Users chart",
            model_name="User",
            model_app_name="auth",
            graph_key="user_graph",
            type_operation_field_name="Count",
            operation_field_name="id",
            cache_values=True,
            show_to_users=False,
        )
        self.superuser = baker.make(
            "User",
            username="admin",
            is_superuser=True,
            date_joined=datetime(2020, 1, 1, tzinfo=timezone.utc),
        )

    def call(self, *args, **options):
        out = StringIO()
        call_command("recalculate_charts", *args, stdout=out, **options)
        return out.getvalue()

    def test_recalculate(self):
        """The command caches the chart values"""
        baker.make("User", date_joined=datetime(2020, 1, 2, tzinfo=timezone.utc))
        output = self.call("--time-ranges", "days")
        self.assertIn("user_graph", output)
        self.assertIn("Recalculation took", output)
        self.assertTrue(CachedValue.objects.filter(stats=self.stats).exists())

    def test_dry_run(self):
        """--dry-run reports what would be recalculated without caching anything"""
        output = self.call("--time-ranges", "days", "--dry-run")
        self.assertIn("user_graph", output)
        self.assertFalse(CachedValue.objects.exists())

    def test_explicit_user(self):
        """--user selects who the charts are calculated as"""
        baker.make("User", username="staffer", is_superuser=True)
        self.call("--time-ranges", "days", "--user", "staffer")
        self.assertTrue(CachedValue.objects.filter(stats=self.stats).exists())

    def test_unknown_user(self):
        """--user with an unknown username fails with a clear message"""
        with self.assertRaises(CommandError) as error:
            self.call("--time-ranges", "days", "--user", "nobody")
        self.assertEqual(str(error.exception), "User 'nobody' does not exist")

    def test_no_superuser(self):
        """Without a superuser the command says what to do instead of failing obscurely"""
        User.objects.filter(is_superuser=True).delete()
        with self.assertRaises(CommandError) as error:
            self.call("--time-ranges", "days")
        self.assertEqual(
            str(error.exception),
            "No superuser found to calculate the charts as, pass --user <username>",
        )

    def test_graph_key_selects_charts(self):
        """A graph_key argument limits the run to that chart"""
        other = baker.make(
            "DashboardStats",
            date_field_name="date_joined",
            graph_title="Other chart",
            model_name="User",
            model_app_name="auth",
            graph_key="other_graph",
            cache_values=True,
            show_to_users=False,
        )
        self.call("--time-ranges", "days", "user_graph")
        self.assertTrue(CachedValue.objects.filter(stats=self.stats).exists())
        self.assertFalse(CachedValue.objects.filter(stats=other).exists())

    def test_recalculates_per_criteria(self):
        """Charts with criteria are recalculated per multiple-series choice and filter"""
        criteria = baker.make(
            "DashboardStatsCriteria",
            criteria_name="active",
            dynamic_criteria_field_name="is_active",
        )
        baker.make(
            "CriteriaToStatsM2M",
            criteria=criteria,
            stats=self.stats,
            use_as="chart_filter",
            default_option="True",
        )
        multi = baker.make(
            "CriteriaToStatsM2M",
            criteria=criteria,
            stats=self.stats,
            use_as="multiple_series",
            recalculate=True,
        )
        baker.make("User", date_joined=datetime(2020, 1, 2, tzinfo=timezone.utc))

        output = self.call("--time-ranges", "days")

        self.assertIn(str(multi), output)
        self.assertTrue(
            CachedValue.objects.filter(
                stats=self.stats, multiple_series_choice=multi.criteria
            ).exists()
        )

    def test_defaults_to_the_charts_own_time_scales(self):
        """Without --time-ranges the chart's allowed time scales are used"""
        self.stats.allowed_time_scales = ["days"]
        self.stats.save()
        baker.make("User", date_joined=now())

        # time_since is always counted back from now, so only a --time-until
        # near today leaves a non-empty range
        output = self.call("--time-until", now().strftime("%Y-%m-%d"))

        self.assertIn("in days", output)
        self.assertTrue(CachedValue.objects.filter(stats=self.stats, time_scale="days").exists())

    def test_exclude(self):
        """--exclude skips the listed charts"""
        output = self.call("--time-ranges", "days", "--exclude", "user_graph")
        self.assertNotIn("user_graph", output)
        self.assertFalse(CachedValue.objects.exists())
