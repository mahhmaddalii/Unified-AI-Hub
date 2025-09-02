from django.contrib import admin
from django.urls import path, include
from accounts.api.views import chat_view, upload_document, google_post_login

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.api.urls')),  
    path('chat/', chat_view),
    path('upload_document/', upload_document),

    # Google OAuth
    path('google/post-login/', google_post_login, name="google_post_login"),

    # allauth routes for login/logout/google callback
    path('accounts/', include('allauth.urls')),
]
