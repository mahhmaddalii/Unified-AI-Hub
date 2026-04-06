from django.urls import path
from . import views

urlpatterns = [
    path('stream/', views.cricket_stream, name='cricket-stream'),
    path('reset/', views.cricket_reset, name='cricket-reset'),
]