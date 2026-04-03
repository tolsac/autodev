from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Board, Column, Project


@receiver(post_save, sender=Project)
def create_board_for_project(sender, instance, created, **kwargs):
    if not created:
        return
    if Board.objects.filter(project=instance).exists():
        return
    board = Board.objects.create(project=instance)
    default_columns = [
        ("Backlog", "#6B7280"),
        ("To Refine", "#8B5CF6"),
        ("Ready", "#3B82F6"),
        ("In Progress", "#F59E0B"),
        ("Done", "#10B981"),
    ]
    Column.objects.bulk_create([
        Column(board=board, name=name, color=color, position=i)
        for i, (name, color) in enumerate(default_columns)
    ])
