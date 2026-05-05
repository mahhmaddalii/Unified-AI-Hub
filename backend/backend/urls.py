from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from accounts.api.views import google_post_login

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.api.urls')),  
    

    # Google OAuth
    path('google/post-login/', google_post_login, name="google_post_login"),

    # allauth routes for login/logout/google callback
    path('accounts/', include('allauth.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
