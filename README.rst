===================
Django admin charts
===================

:Description: Easily configurable charts statistics for ``django-admin`` and ``django-admin-tools``.
:Documentation: http://django-admin-charts.readthedocs.org/en/latest/

.. image:: https://github.com/PetrDlouhy/django-admin-charts/actions/workflows/main.yml/badge.svg?branch=master
    :target: https://github.com/PetrDlouhy/django-admin-charts/actions/workflows/main.yml

.. image:: https://img.shields.io/pypi/v/django-admin-charts.svg
  :target: https://pypi.python.org/pypi/django-admin-charts/
  :alt: Latest Version

.. image:: https://img.shields.io/pypi/dm/django-admin-charts.svg
  :target: https://pypi.python.org/pypi/django-admin-charts/
  :alt: Downloads

.. image:: https://img.shields.io/pypi/pyversions/django-admin-charts.svg
  :target: https://pypi.python.org/pypi/django-admin-charts/
  :alt: Supported Python versions

.. image:: https://img.shields.io/pypi/l/django-admin-charts.svg
  :target: https://pypi.python.org/pypi/django-admin-charts/
  :alt: License

.. inclusion-marker-do-not-remove

Create beautiful configurable charts from your models and display them on the ``django-admin`` index page or on ``django-admin-tools`` dashboard.
The charts are based on models and criterias defined through admin interface and some chart parameters are configurable in live view.

This is application is fork of `django-admin-tools-stats <https://github.com/areski/django-admin-tools-stats/>`_ which has been reworked to display all charts through Ajax and made work with plain ``django-admin``. The ``django-admin-tools`` are supported but not needed.

.. image:: https://github.com/PetrDlouhy/django-admin-charts/raw/master/docs/source/_static/stacked_area_chart.png
.. image:: https://github.com/PetrDlouhy/django-admin-charts/raw/master/docs/source/_static/bar_chart.png
.. image:: https://github.com/PetrDlouhy/django-admin-charts/raw/master/docs/source/_static/aoe_chart.png

============
Requirements
============

* ``Django>=2.0``
* ``Python>3.6``
* PostgreSQL (MySQL is experimental, other databases probably not working but PRs are welcome)
* ``simplejson`` for charts based on ``DecimalField`` values

=======
Warning
=======

The ``django-admin-charts`` application intended usage is mainly for system admins with access to Django admin interface.
The application is not intended to be used by untrusted users, as it is exposing some Django functionality to the user, especially in the chart configuration.

It has not been examined whether some malicious user with access to the charts could exploit the application to gain access to the system or data.


============
Installation
============

Install django-admin-charts with these commands:

    $ pip install django-admin-charts



Basic setup for ``django-admin``
--------------------------------

Add ``admin_tools_stats`` (the Django admin charts application) & ``django_nvd3`` into INSTALLED_APPS in settings.py:

.. code:: python

    INSTALLED_APPS = (
        'admin_tools_stats',  # this must be BEFORE 'admin_tools' and 'django.contrib.admin'
        'django_nvd3',
        ...
        'django.contrib.admin',
    )

Register chart views in your ``urls.py``:

.. code:: python

    from django.urls import include, path
    urlpatterns = [
        path('admin_tools_stats/', include('admin_tools_stats.urls')),
    ]

Ensure, you have ``default`` cache set up: https://docs.djangoproject.com/en/3.2/topics/cache/#memcached

Run migrations:

.. code:: sh

    $ python manage.py migrate

Open Django admin root and add your ``Dashboard Stats`` configuration:

.. image:: https://github.com/PetrDlouhy/django-admin-charts/raw/master/docs/source/_static/Sn%C3%ADmek%20obrazovky_2022-03-04_17-29-58.png
.. image:: https://github.com/PetrDlouhy/django-admin-charts/raw/master/docs/source/_static/Sn%C3%ADmek%20obrazovky_2022-03-04_17-31-16.png

Then the charts will appear on the root of Django admin page as well as on analytics page (``/admin_tools_stats/analytics/``).

==================
Configuring charts
==================

Every chart is one ``Dashboard Stats`` row. The fields that define what gets counted:

* ``model app name`` / ``model name`` - the model the chart aggregates, e.g. ``shop`` / ``Order``
* ``date field name`` - the ``DateField``/``DateTimeField`` the x-axis buckets by, e.g. ``created``
* ``operation field name`` - the field the operation aggregates, e.g. ``total_price``; leave empty
  for plain ``Count`` of rows
* ``type operation field name`` - the aggregation: ``Count``, ``Sum``, ``Avg``, ``Median``, ``Max``,
  ``Min``, ``StdDev``, ``Variance`` or ``AvgCountPerInstance``
* ``graph key`` - unique slug identifying the chart

Example - "orders per day": ``model name`` = ``Order``, ``date field name`` = ``created``, operation
``Count``. Example - "revenue per month": the same plus ``operation field name`` = ``total_price``
and operation ``Sum``.

Filtering and dividing by criteria
----------------------------------

A ``Dashboard Stats Criteria`` row describes one way to slice the model, and gets attached to a
chart in the *criteria* inline of the ``Dashboard Stats`` admin. The same criteria can be reused by
several charts. Its key field is ``dynamic criteria field name`` - a field path on the chart's
model, using ordinary ORM lookups:

* ``status`` - a plain field; every distinct value becomes a choice (model field ``choices``
  labels are used when defined)
* ``author__username`` - a related field path works too
* ``paid_at__isnull`` - an ``__isnull`` path gives a Blank/Non-blank choice pair
* leave the field empty and fill ``criteria dynamic mapping`` with JSON like
  ``{"": [null, "All"], "big": [["gold", "platinum"], "Big plans"]}`` to define custom
  buckets - each key maps to ``[database value or list of values, label]``

How the criteria behaves depends on the *use as* field of the attachment:

* **Chart filter** - renders as a select in the chart's toolbar; picking a value filters the
  whole chart
* **Multiple series** - divides the chart into one stacked serie per choice (the "Divide" select)

Example - the "stack by user" scenario: a ``Plan`` model with a ``user`` foreign key and a
``created`` date field. Create a criteria with ``dynamic criteria field name`` =
``user__username``, attach it to the chart with *use as* = ``Multiple series``, and every user
becomes one serie of the stacked chart.

Options on the attachment row:

* ``count limit`` - keep only the N largest choices as their own series and merge the rest into
  one ``other`` serie; essential for high-cardinality fields like users
* ``choices based on time range`` - compute the choices from rows in the displayed time range
  instead of all distinct values
* ``default option`` - the filter value preselected when the chart loads

Big tables
----------

For charts too slow to compute on every view, tick ``cache values``. Values are then served from
the ``CachedValue`` table and recomputed only for unfinished periods (the ``⟳`` toolbar button, or
``⟳ all`` to recalculate everything visible). The ``recalculate_charts`` management command
refreshes cached charts from cron.

======================
Special configurations
======================

Update from ``django-admin-tools-stats``
----------------------------------------

Uninstall ``django-admin-tools-stats``.

Follow ``django-admin-charts`` installation according to previous section. Especially pay attention to these steps:
- Move ``admin_tools_stats`` in ``INSTALLED_APPS`` before ``admin_tools`` and ``django.contrib.admin``.
- Configure ``urls.py``.

Change ``DashboardCharts`` to ``DashboardChart`` in dashboard definition (this is recomended even if dummy class is left for compatibility reasons).

Check any overridden template from ``admin_tools_stats`` or ``DashboardChart(s)`` class that might interfere with the changes.

Configure javascript libraries
----------------------------------------------------------

By default the nvd3/d3 libraries are taken from unpkg.
If you want to install those libraries on your own, you can set their path by following settings:

.. code:: python

   ADMIN_CHARTS_NVD3_JS_PATH = 'bow/nvd3/build/nv.d3.js'
   ADMIN_CHARTS_NVD3_CSS_PATH = 'bow/nvd3/build/nv.d3.css'
   ADMIN_CHARTS_D3_JS_PATH = 'bow/d3/d3.js'

The settings can accept either full path (with http...) or there can be static file path.
Note that versions ``nvd3==1.8.6`` and ``d3==3.3.13`` are the only tested to be working.


Installation of javascript libraries with ``django-bower``
----------------------------------------------------------

Add ``django-bower`` to INSTALLED_APPS in settings.py:

.. code:: python

    INSTALLED_APPS = (
        ...
        'djangobower'
    )

Add the following properties to you settings.py file:

.. code:: python

    # Specifie path to components root (you need to use absolute path)
    BOWER_COMPONENTS_ROOT = os.path.join(PROJECT_ROOT, 'components')


    BOWER_INSTALLED_APPS = (
        'd3#3.3.13',
        'nvd3#1.8.6',
    )

Add django-bower finder to your static file finders:

.. code:: python

    STATICFILES_FINDERS = (
        ...
        'djangobower.finders.BowerFinder',
    )

Run the following commands. These will download nvd3.js and its dependencies using bower and throw them in to you static folder for access by your application:

.. code:: sh

    $ python manage.py bower_install
    $ python manage.py collectstatic



Usage with ``django-admin-tools``
----------------------------------

Configure ``admin_tools``

Add following code to dashboard.py:

.. code:: python

    from admin_tools_stats.modules import DashboardChart, get_active_graph

    # append an app list module
    self.children.append(modules.AppList(
        _('Dashboard Stats Settings'),
        models=('admin_tools_stats.*', ),
    ))

    # Copy following code into your custom dashboard
    # append following code after recent actions module or
    # a link list module for "quick links"
    if context['request'].user.has_perm('admin_tools_stats.view_dashboardstats'):
            graph_list = get_active_graph()
        else:
            graph_list = []

    for i in graph_list:
        kwargs = {}
        kwargs['require_chart_jscss'] = True
        kwargs['graph_key'] = i.graph_key

        for key in context['request'].POST:
            if key.startswith('select_box_'):
                kwargs[key] = context['request'].POST[key]

        self.children.append(DashboardChart(**kwargs))


You may also need to add some includes to your template admin base, see an example on the demo project::

    demoproject/demoproject/templates/admin/base_site.html


============
Running demo
============

Run following commands:

.. code:: sh

   export DB_ENGINE='sqlite'
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py loaddata demoproject/fixtures/auth_user.json
   python manage.py loaddata demoproject/fixtures/test_data.json
   python manage.py bower install
   python manage.py runserver

And log in with username `admin` and password `admin` to the `localhost:8000/admin` site.

===========
Development
===========

Dependencies
------------

django-admin-charts is a django based application, the major requirements are:

- django-jsonfield
- django-nvd3
- django-bower


Running tests
-------------

Test can be run with:

.. code:: sh

    DB_ENGINE="postgres" coverage run ./manage.py test --keepdb


Contributing
------------

If you've found a bug, add a feature or improve django-admin-charts and
think it is useful then please consider contributing.
Patches, pull requests or just suggestions are always welcome!

Source code: http://github.com/PetrDlouhy/django-admin-charts

Bug tracker: https://github.com/PetrDlouhy/django-admin-charts/issues


Debugging charts
----------------

For chart data view (/admin_tools_stats/chart_data/payments/) the URL query
parameter `&debug=True` can be added, in order to get Django debug page or
Django debug toolbar.


Documentation
-------------

Documentation is available on 'Read the Docs':
http://readthedocs.org/docs/django-admin-charts/


License
-------

django-admin-charts is licensed under MIT, see ``MIT-LICENSE.txt``.
