from django.urls import path
from .views import chat_view, upload_document

urlpatterns = [
    path('stream/', chat_view, name='chat_stream'),
    path('upload-document/', upload_document, name='upload_document'),
]
