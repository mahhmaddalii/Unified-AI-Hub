from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.mail import send_mail
from django.http import HttpResponseRedirect
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.shortcuts import redirect
from urllib.parse import urlencode
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import SignupSerializer
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.contrib.auth.decorators import login_required
from allauth.socialaccount.models import SocialAccount
from dj_rest_auth.registration.views import SocialLoginView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client

from accounts.api.billing.services import get_billing_snapshot_for_user


User = get_user_model()

# ---------- Signup ----------
@api_view(['POST'])
def signup_view(request):
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        return Response({
            'message': 'Signup successful!',
            'access': str(access),
            'refresh': str(refresh)
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------- Login ----------
@api_view(['POST'])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')
    remember = bool(request.data.get('remember'))

    user = authenticate(request, email=email, password=password)
    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    if remember:
        access.set_exp(lifetime=timedelta(days=1))
        refresh.set_exp(lifetime=timedelta(days=30))

    return Response({
        'message': 'Login successful',
        'access': str(access),
        'refresh': str(refresh),
    }, status=status.HTTP_200_OK)


# ---------- Forgot Password ----------
@api_view(['POST'])
def forgot_password_view(request):
    email = request.data.get('email')
    print(f"📧 Password reset requested for: {email}")
    
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        print(f" User found: {user.email}")
    except User.DoesNotExist:
        print(f" User not found with email: {email}")
        return Response({'message': 'If this email exists, a reset link has been sent.'})

    token_generator = PasswordResetTokenGenerator()
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = token_generator.make_token(user)
    reset_link = f"http://localhost:3000/reset-password?uid={uidb64}&token={token}"

    print(f" Generated reset link: {reset_link}")
    print(f" Attempting to send email from: {settings.DEFAULT_FROM_EMAIL}")
    print(f" Using email host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")

    try:
        send_mail(
            subject="Password Reset Request",
            message=f"Click this link to reset your password: {reset_link}\n\n"
                   f"This link will expire in 24 hours.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        print(f" Email sent successfully to: {email}")
        return Response({'message': 'Password reset email sent.'}, status=200)
    except Exception as e:
        print(f" EMAIL ERROR: {str(e)}")
        print(f" Email host: {settings.EMAIL_HOST}")
        print(f" Email port: {settings.EMAIL_PORT}")
        print(f" Email user: {settings.EMAIL_HOST_USER}")
        return Response({'error': f'Failed to send email. Please try again later.'}, status=500)


# ---------- Google OAuth ----------
@login_required
def google_post_login(request):
    """Return JWT tokens after successful Google login and redirect to frontend"""
    user = request.user
    refresh = RefreshToken.for_user(user)
    
    # Create token data
    token_data = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "email": user.email,
        "success": "true"
    }
    
    # Redirect back to frontend with tokens as URL parameters
    frontend_url = "http://localhost:3000/login"
    query_string = urlencode(token_data)
    redirect_url = f"{frontend_url}?{query_string}"
    
    return HttpResponseRedirect(redirect_url)


class GoogleTokenLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client


# ---------- Current User ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user

    name_parts = [user.first_name or "", user.last_name or ""]
    name = " ".join(part for part in name_parts if part).strip()

    avatar_url = None
    google_account = SocialAccount.objects.filter(user=user, provider="google").first()
    if google_account:
        extra = google_account.extra_data or {}
        avatar_url = extra.get("picture") or extra.get("avatar_url")
        if not name:
            google_name = extra.get("name")
            if not google_name:
                google_name = " ".join(
                    part for part in [extra.get("given_name"), extra.get("family_name")] if part
                ).strip()
            if google_name:
                name = google_name

    if not name:
        name = (user.email.split("@")[0] if user.email else "User")

    return Response({
        "name": name,
        "email": user.email,
        "avatarUrl": avatar_url,
        "billing": get_billing_snapshot_for_user(user, sync_remote=True),
    })













