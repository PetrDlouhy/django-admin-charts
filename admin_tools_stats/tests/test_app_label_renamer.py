#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from copy import copy, deepcopy

from django.contrib import admin
from django.test import RequestFactory, TestCase

from admin_tools_stats.app_label_renamer import AppLabelRenamer
from admin_tools_stats.models import DashboardStats


class StringWithRealoadedTitleTests(TestCase):
    """The str subclass that carries the renamed title through the admin."""

    def setUp(self):
        self.string = AppLabelRenamer.StringWithRealoadedTitle("admin_tools_stats", "Admin Charts")

    def test_is_the_native_label(self):
        """It must still compare equal to the app label the admin looks up"""
        self.assertEqual(self.string, "admin_tools_stats")

    def test_title_is_the_readable_name(self):
        self.assertEqual(self.string.title(), "Admin Charts")

    def test_copy_keeps_the_title(self):
        """Django copies app labels around; a plain str copy would lose the title"""
        self.assertEqual(copy(self.string).title(), "Admin Charts")
        self.assertEqual(deepcopy(self.string).title(), "Admin Charts")


class RenameAppLabelTests(TestCase):
    def setUp(self):
        self.renamer = AppLabelRenamer(
            native_app_label="admin_tools_stats", app_label="Admin Charts"
        )
        self.calls = []

    def register(self, model, admin_class=None, **options):
        self.calls.append((model, admin_class))
        return "registered"

    def test_renames_the_label_of_a_single_model(self):
        """A bare model class - not a list - is accepted and gets the renamed label"""
        wrapped = self.renamer.rename_app_label(self.register)

        self.assertEqual(wrapped(DashboardStats), "registered")
        self.assertEqual(DashboardStats._meta.app_label.title(), "Admin Charts")

    def test_builds_a_model_admin_when_none_is_given(self):
        """Registering without an admin class still gets breadcrumbs renamed"""
        wrapped = self.renamer.rename_app_label(self.register)

        wrapped(DashboardStats)

        model, admin_class = self.calls[0]
        self.assertTrue(issubclass(admin_class, admin.ModelAdmin))
        self.assertEqual(admin_class.__name__, "DashboardStatsAdmin")

    def test_leaves_models_of_other_apps_alone(self):
        """Only models of the renamed app are touched"""
        from django.contrib.auth.models import User

        wrapped = self.renamer.rename_app_label(self.register)

        wrapped(User)

        self.assertEqual(User._meta.app_label, "auth")

    def test_renamed_breadcrumbs_pass_the_app_label(self):
        """The wrapped admin views get the readable label in extra_context"""
        wrapped = self.renamer.rename_app_label(self.register)
        seen = {}

        class DummyAdmin(admin.ModelAdmin):
            def add_view(inner_self, request, *args, **kwargs):
                seen.update(kwargs["extra_context"])
                return "added"

        wrapped(DashboardStats, DummyAdmin)

        self.assertEqual(DummyAdmin.add_view(None, None), "added")
        self.assertEqual(seen["app_label"], "Admin Charts")


class RenameAppIndexTests(TestCase):
    def setUp(self):
        self.renamer = AppLabelRenamer(
            native_app_label="admin_tools_stats", app_label="Admin Charts"
        )
        self.factory = RequestFactory()
        self.seen = {}

        def app_index(request, app_label, extra_context=None):
            self.seen["app_label"] = app_label
            return "index"

        self.wrapped = self.renamer.rename_app_index(app_index)

    def test_renames_the_own_app_index(self):
        request = self.factory.get("/admin/admin_tools_stats/")
        self.assertEqual(self.wrapped(request, "admin_tools_stats"), "index")
        self.assertEqual(self.seen["app_label"].title(), "Admin Charts")

    def test_leaves_other_app_indexes_alone(self):
        request = self.factory.get("/admin/auth/")
        self.assertEqual(self.wrapped(request, "auth"), "index")
        self.assertEqual(self.seen["app_label"], "auth")
