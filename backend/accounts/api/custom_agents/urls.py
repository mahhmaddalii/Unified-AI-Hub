from django.urls import path
from . import views

urlpatterns = [
    path('stream/', views.custom_agent_chat_view, name='custom-agent-chat-stream'),
    path('upload-document/', views.custom_agent_upload_document, name='custom-agent-upload-document'),
]