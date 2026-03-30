from django.urls import path
from . import views

urlpatterns = [
    path('get-or-create-chat/', views.get_or_create_custom_agent_chat_view, name='custom-agent-get-or-create-chat'),
    path('stream/', views.custom_agent_chat_view, name='custom-agent-chat-stream'),
    path('upload-document/', views.custom_agent_upload_document, name='custom-agent-upload-document'),
]
