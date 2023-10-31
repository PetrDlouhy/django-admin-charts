# Generated by Django 5.0a1 on 2023-10-30 20:11

import multiselectfield.db.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('admin_tools_stats', '0021_auto_20230210_1102'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='cachedvalue',
            options={'ordering': ('order',), 'verbose_name': 'Cached Value', 'verbose_name_plural': 'Stored Values'},
        ),
        migrations.AlterField(
            model_name='cachedvalue',
            name='operation',
            field=models.CharField(blank=True, choices=[('Count', 'Count'), ('Sum', 'Sum'), ('Avg', 'Average'), ('AvgCountPerInstance', 'Average count per active model instance'), ('Max', 'Max'), ('Min', 'Min'), ('StdDev', 'StdDev'), ('Variance', 'Variance')], max_length=90, null=True),
        ),
        migrations.AlterField(
            model_name='dashboardstats',
            name='allowed_type_operation_field_name',
            field=multiselectfield.db.fields.MultiSelectField(blank=True, choices=[('Count', 'Count'), ('Sum', 'Sum'), ('Avg', 'Average'), ('AvgCountPerInstance', 'Average count per active model instance'), ('Max', 'Max'), ('Min', 'Min'), ('StdDev', 'StdDev'), ('Variance', 'Variance')], help_text='More than one selected field will display chooser on the chart.', max_length=1000, null=True, verbose_name='Choose Type operation'),
        ),
        migrations.AlterField(
            model_name='dashboardstats',
            name='type_operation_field_name',
            field=models.CharField(blank=True, choices=[('Count', 'Count'), ('Sum', 'Sum'), ('Avg', 'Average'), ('AvgCountPerInstance', 'Average count per active model instance'), ('Max', 'Max'), ('Min', 'Min'), ('StdDev', 'StdDev'), ('Variance', 'Variance')], help_text='Choose the type operation what you want to aggregate.', max_length=90, null=True, verbose_name='Choose Type operation'),
        ),
        migrations.AlterField(
            model_name='dashboardstatscriteria',
            name='updated_date',
            field=models.DateTimeField(auto_now=True, verbose_name='updated_date'),
        ),
    ]
