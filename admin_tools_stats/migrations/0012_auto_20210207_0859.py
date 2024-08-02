# Generated by Django 3.1.6 on 2021-02-07 07:59

import multiselectfield.db.fields
from django.conf import settings
from django.db import migrations, models
from django.db.models import JSONField


class Migration(migrations.Migration):
    dependencies = [
        ("admin_tools_stats", "0011_auto_20210204_1206"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboardstats",
            name="allowed_type_operation_field_name",
            field=multiselectfield.db.fields.MultiSelectField(
                blank=True,
                choices=[
                    ("Count", "Count"),
                    ("Sum", "Sum"),
                    ("Avg", "Avgerage"),
                    ("AvgCountPerInstance", "Avgerage count per active model instance"),
                    ("Max", "Max"),
                    ("Min", "Min"),
                    ("StdDev", "StdDev"),
                    ("Variance", "Variance"),
                ],
                help_text="choose the type operation what you want to aggregate, ex. Sum",
                max_length=1000,
                null=True,
                verbose_name="Choose Type operation",
            ),
        ),
        migrations.AlterField(
            model_name="dashboardstats",
            name="allowed_time_scales",
            field=multiselectfield.db.fields.MultiSelectField(
                choices=[
                    ("hours", "Hours"),
                    ("days", "Days"),
                    ("weeks", "Weeks"),
                    ("months", "Months"),
                    ("years", "Years"),
                ],
                default=("hours", "days", "weeks", "months", "years"),
                max_length=1000,
                verbose_name="Allowed time scales",
            ),
        ),
        migrations.AlterField(
            model_name="dashboardstatscriteria",
            name="criteria_dynamic_mapping",
            field=JSONField(
                blank=True,
                help_text='a JSON dictionary with records in two following possible formats:<br/>"key_value": "name"<br/>"key": [value, "name"]<br/>use blank key for no filter<br/>Example:<br/><pre>{<br/>  "": [null, "All"],<br/>  "True": [true, "True"],<br/>  "False": [false, "False"]<br/>}</pre><br/>Left blank to exploit all choices of CharField with choices',
                null=True,
                verbose_name="dynamic criteria / value",
            ),
        ),
        migrations.AlterField(
            model_name="dashboardstatscriteria",
            name="criteria_fix_mapping",
            field=JSONField(
                blank=True,
                help_text="a JSON dictionary of key-value pairs that will be used for the criteria",
                null=True,
                verbose_name="fixed criteria / value",
            ),
        ),
    ]
