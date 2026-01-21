from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from .views import signup_view

urlpatterns = [
    # JWT Token
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    # Custom Signup API
    path('signup/', signup_view, name='signup'),
    # Accounts & Social Login
    path('accounts/', include('allauth.urls')),
    path('dj-rest-auth/', include('dj_rest_auth.urls')),
    path('dj-rest-auth/registration/', include('dj_rest_auth.registration.urls')),
    path('dj-rest-auth/google/', include('allauth.socialaccount.providers.google.urls')),
    # Local APIs
    path('api/', include('accounts.api.urls')),
    path('api/', include('accounts.urls')),
    path("accounts/", include("accounts.urls")),
    # Admin
    path('admin/', admin.site.urls),
]
