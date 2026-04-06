from django.urls import path
from .views import chat_view, create_chat_view, upload_document

urlpatterns = [
    path('create/', create_chat_view, name='chat_create'),
    path('stream/', chat_view, name='chat_stream'),
    path('upload-document/', upload_document, name='upload_document'),
]
