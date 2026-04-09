from django.urls import path
from . import views

urlpatterns = [
    path('stream/', views.comsats_stream, name='comsats-stream'),
    path('reset/', views.comsats_reset, name='comsats-reset'),
    path('gmail/callback/', views.gmail_callback, name='comsats-gmail-callback'),
]
