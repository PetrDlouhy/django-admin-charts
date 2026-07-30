#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#
from django.db.models import Aggregate, FloatField
from django.db.utils import NotSupportedError


class Median(Aggregate):
    """Median of the values, i.e. the continuous 50th percentile.

    Implemented with the SQL:2003 ordered-set aggregate ``PERCENTILE_CONT``,
    which PostgreSQL and Oracle provide. MySQL and SQLite have no equivalent,
    so there the operation fails loudly instead of returning a wrong number.

    Unlike ``Avg``, the median is not skewed by a handful of extreme values,
    which is what usually makes it the more honest summary of amounts.
    """

    function = "PERCENTILE_CONT"
    name = "Median"
    template = "%(function)s(0.5) WITHIN GROUP (ORDER BY %(expressions)s)"
    output_field = FloatField()
    allow_distinct = False

    def _as_sql_unsupported(self, compiler, connection, **extra_context):
        raise NotSupportedError(
            "The Median operation needs the PERCENTILE_CONT ordered-set aggregate, "
            f"which {connection.display_name} does not support. "
            "Use Avg, or move the chart to PostgreSQL."
        )

    as_mysql = _as_sql_unsupported
    as_sqlite = _as_sql_unsupported
