from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.test.client import RequestFactory


class BaseSuperuserAuthenticatedClient(TestCase):
    """Common Authentication"""

    fixtures = ["auth_user"]
    username = "admin"

    def setUp(self):
        """To create admin user"""
        self.client = Client()

        self.user = User.objects.get(username=self.username)
        self.client.force_login(self.user)

        self.factory = RequestFactory()


class BaseUserAuthenticatedClient(BaseSuperuserAuthenticatedClient):
    username = "user_1"


def assertContainsAny(
    self,
    response,
    texts,
    status_code=200,
    msg_prefix="",
    html=False,
):
    errors = []
    for text in texts:
        try:
            self.assertContains(
                response,
                text,
                status_code=status_code,
                msg_prefix=msg_prefix,
                html=html,
            )
            return
        except AssertionError as error:
            errors.append(str(error))

    self.fail(
        f"None of the {texts} were found in the response. "
        f"Assertion errors: {' | '.join(errors)}"
    )
