from django.db import models


class TestKid(models.Model):
    """
    Model class Kid of family app
    """

    happy = models.BooleanField()
    name = models.CharField(max_length=30)
    age = models.IntegerField()
    height = models.IntegerField(null=True)
    bio = models.TextField()
    wanted_games_qtd = models.BigIntegerField()
    pocket_money = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    birthday = models.DateField(null=True)
    appointment = models.DateTimeField(null=True)
    author = models.ForeignKey(
        "auth.User", on_delete=models.CASCADE, default=None, null=True, blank=True
    )
