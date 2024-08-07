# Generated by Django 2.2.6 on 2019-10-07 07:50

from django.conf import settings
from django.db import migrations, models
from django.db.models import JSONField


class Migration(migrations.Migration):
    dependencies = [
        ("admin_tools_stats", "0002_auto_20190920_1058"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboardstats",
            name="default_chart_type",
            field=models.CharField(
                choices=[
                    ("discreteBarChart", "Bar"),
                    ("lineChart", "Line"),
                    ("multiBarChart", "Multi Bar"),
                    ("pieChart", "Pie"),
                    ("stackedAreaChart", "Stacked Area"),
                    ("multiBarHorizontalChart", "Multi Bar Horizontal"),
                    ("linePlusBarChart", "Line Plus Bar"),
                    ("scatterChart", "Scatter"),
                    ("cumulativeLineChart", "Cumulative Line"),
                    ("lineWithFocusChart", "Line With Focus"),
                ],
                default="discreteBarChart",
                max_length=90,
                verbose_name="Default chart type",
            ),
        ),
        migrations.AddField(
            model_name="dashboardstats",
            name="default_time_period",
            field=models.PositiveIntegerField(
                default=31, help_text="Number of days", verbose_name="Default period"
            ),
        ),
        migrations.AddField(
            model_name="dashboardstats",
            name="default_time_scale",
            field=models.CharField(
                choices=[
                    ("hours", "Hours"),
                    ("days", "Days"),
                    ("weeks", "Weeks"),
                    ("months", "Months"),
                    ("years", "Years"),
                ],
                default="days",
                max_length=90,
                verbose_name="Default time scale",
            ),
        ),
        migrations.AddField(
            model_name="dashboardstatscriteria",
            name="use_as",
            field=models.CharField(
                choices=[
                    ("chart_filter", "Chart filter"),
                    ("multiple_series", "Multiple series"),
                ],
                default="chart_filter",
                max_length=90,
                verbose_name="Use dynamic criteria as",
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
    ]
