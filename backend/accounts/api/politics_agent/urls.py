# backend/accounts/api/politics_agent/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('stream/', views.politics_stream, name='politics-stream'),
    path('reset/', views.politics_reset, name='politics-reset'),
]