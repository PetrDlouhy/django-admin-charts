from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class AdminChartsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "admin_tools_stats"
    verbose_name = _("Tools stats")
