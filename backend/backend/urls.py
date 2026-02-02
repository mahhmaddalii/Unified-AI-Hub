from django.contrib import admin
from django.urls import path, include
from accounts.api.views import google_post_login

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.api.urls')),  
    

    # Google OAuth
    path('google/post-login/', google_post_login, name="google_post_login"),

    # allauth routes for login/logout/google callback
    path('accounts/', include('allauth.urls')),
]
