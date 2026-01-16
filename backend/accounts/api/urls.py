from django.urls import include, path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('forgot-password/', views.forgot_password_view, name='forgot_password'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('google/post-login/', views.google_post_login, name='google_post_login'),
    path("accounts/", include("allauth.urls")),

    # Chat
    path('chat/', include('accounts.api.chat.urls')),
]
