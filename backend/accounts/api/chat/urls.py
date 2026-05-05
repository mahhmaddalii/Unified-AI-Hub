from django.urls import path
from .views import chat_view, conversation_detail_view, conversations_view, create_chat_view, upload_document

urlpatterns = [
    path('create/', create_chat_view, name='chat_create'),
    path('conversations/', conversations_view, name='chat_conversations'),
    path('conversations/<uuid:conversation_id>/', conversation_detail_view, name='chat_conversation_detail'),
    path('stream/', chat_view, name='chat_stream'),
    path('upload-document/', upload_document, name='upload_document'),
]
