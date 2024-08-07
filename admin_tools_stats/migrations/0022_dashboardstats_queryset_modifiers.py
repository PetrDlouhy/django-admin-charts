# Generated by Django 4.2.3 on 2023-10-12 11:26

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("admin_tools_stats", "0021_auto_20230210_1102"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboardstats",
            name="queryset_modifiers",
            field=models.JSONField(
                blank=True,
                help_text=(
                    "Additional queryset modifiers in JSON format:<br>"
                    "<pre>"
                    "[<br>"
                    '    {"filter": {"status": "active"}},<br>'
                    '    {"exclude": {"status": "deleted"}}<br>'
                    '    {"my_annotion_function": {}}<br>'
                    "]"
                    "</pre>"
                    "Ensure the format is a valid JSON array of objects."
                    "<br>"
                    "The format of the dict on each line is:"
                    "<br>"
                    '{"function_name": {"arg1": "value1", "arg2": "value2"}}'
                    "<br>"
                    "Where the arg/value pairs are the arguments to the function"
                    "that will be called on the queryset in order given by the list."
                ),
                null=True,
                verbose_name="Queryset modifiers",
            ),
        ),
        migrations.AlterField(
            model_name="dashboardstatscriteria",
            name="criteria_fix_mapping",
            field=models.JSONField(
                blank=True,
                help_text="DEPRECATED.<br>Use queryset modifiers instead<br>A JSON dictionary of key-value pairs that will be used for the criteria",
                null=True,
                verbose_name="fixed criteria / value",
            ),
        ),
    ]
