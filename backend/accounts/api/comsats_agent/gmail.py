import base64
import os
from datetime import timedelta
from email.message import EmailMessage
from urllib.parse import urlencode

import requests
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils import timezone

from accounts.models import GmailOAuthCredential

GOOGLE_OAUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send"
OAUTH_SCOPES = [
    "openid",
    "email",
    "profile",
    GMAIL_SCOPE,
]
OAUTH_STATE_SIGNER = TimestampSigner(salt="comsats-gmail-oauth")


def _get_google_social_app():
    social_app = SocialApp.objects.filter(provider="google").first()
    if not social_app:
        raise RuntimeError("Google SocialApp is not configured in Django admin.")
    return social_app


def get_gmail_redirect_uri():
    return os.getenv(
        "GOOGLE_GMAIL_REDIRECT_URI",
        "http://127.0.0.1:8000/api/comsats_agent/gmail/callback/",
    )


def get_frontend_chat_redirect_url():
    return os.getenv("FRONTEND_CHAT_URL", "http://localhost:3000/chat")


def build_gmail_oauth_url(user):
    social_app = _get_google_social_app()
    state_value = OAUTH_STATE_SIGNER.sign(f"{user.pk}:{timezone.now().timestamp()}")
    params = {
        "client_id": social_app.client_id,
        "redirect_uri": get_gmail_redirect_uri(),
        "response_type": "code",
        "scope": " ".join(OAUTH_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state_value,
    }
    return f"{GOOGLE_OAUTH_BASE_URL}?{urlencode(params)}"


def resolve_user_from_state(state):
    from accounts.models import CustomUser

    try:
        unsigned = OAUTH_STATE_SIGNER.unsign(state, max_age=900)
    except SignatureExpired as exc:
        raise RuntimeError("Gmail connection link expired. Please try again.") from exc
    except BadSignature as exc:
        raise RuntimeError("Invalid Gmail connection state.") from exc

    user_id = unsigned.split(":", 1)[0]
    return CustomUser.objects.get(pk=user_id)


def _exchange_code_for_tokens(code):
    social_app = _get_google_social_app()
    response = requests.post(
        GOOGLE_OAUTH_TOKEN_URL,
        data={
            "code": code,
            "client_id": social_app.client_id,
            "client_secret": social_app.secret,
            "redirect_uri": get_gmail_redirect_uri(),
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    payload = response.json()
    if not response.ok:
        raise RuntimeError(payload.get("error_description") or payload.get("error") or "Google token exchange failed.")
    return payload


def _refresh_access_token(refresh_token):
    social_app = _get_google_social_app()
    response = requests.post(
        GOOGLE_OAUTH_TOKEN_URL,
        data={
            "client_id": social_app.client_id,
            "client_secret": social_app.secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    payload = response.json()
    if not response.ok:
        raise RuntimeError(payload.get("error_description") or payload.get("error") or "Google token refresh failed.")
    return payload


def _fetch_google_email(access_token):
    response = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    payload = response.json()
    if not response.ok:
        raise RuntimeError(payload.get("error", {}).get("message") or "Unable to fetch Google account details.")
    return payload.get("email")


def store_gmail_tokens_for_user(user, token_payload):
    refresh_token = token_payload.get("refresh_token")
    access_token = token_payload.get("access_token")
    expires_in = token_payload.get("expires_in", 3600)
    scope = token_payload.get("scope", " ".join(OAUTH_SCOPES))

    if not access_token:
        raise RuntimeError("Google did not return an access token.")

    google_email = _fetch_google_email(access_token)
    credential, _ = GmailOAuthCredential.objects.get_or_create(user=user)
    credential.google_email = google_email
    credential.access_token = access_token
    if refresh_token:
        credential.refresh_token = refresh_token
    credential.expires_at = timezone.now() + timedelta(seconds=int(expires_in))
    credential.scope = scope
    credential.save()
    return credential


def handle_gmail_oauth_callback(code, state):
    user = resolve_user_from_state(state)
    token_payload = _exchange_code_for_tokens(code)
    credential = store_gmail_tokens_for_user(user, token_payload)
    return user, credential


def get_valid_gmail_access_token(user):
    credential = getattr(user, "gmail_oauth_credential", None)
    if not credential or not credential.access_token:
        return None, None

    if credential.expires_at and credential.expires_at > timezone.now() + timedelta(seconds=60):
        return credential.access_token, credential

    if not credential.refresh_token:
        raise RuntimeError("Gmail connection expired. Please reconnect your Gmail account.")

    refreshed = _refresh_access_token(credential.refresh_token)
    credential.access_token = refreshed.get("access_token", credential.access_token)
    credential.expires_at = timezone.now() + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
    credential.scope = refreshed.get("scope", credential.scope)
    credential.save(update_fields=["access_token", "expires_at", "scope", "updated_at"])
    return credential.access_token, credential


def is_gmail_connected(user):
    credential = getattr(user, "gmail_oauth_credential", None)
    return bool(credential and (credential.refresh_token or credential.access_token))


def build_gmail_result_redirect(success, message):
    query = urlencode({
        "gmail_connected": "true" if success else "false",
        "gmail_message": message,
    })
    return f"{get_frontend_chat_redirect_url()}?{query}"


def send_gmail_email(user, recipient_email, subject, body):
    if not recipient_email or not recipient_email.lower().endswith("@cuilahore.edu.pk"):
        raise RuntimeError("Only official COMSATS email addresses are allowed for this tool.")

    access_token, credential = get_valid_gmail_access_token(user)
    if not access_token or not credential:
        raise RuntimeError("Gmail is not connected for this user.")

    email_message = EmailMessage()
    email_message["To"] = recipient_email
    email_message["From"] = credential.google_email or user.email
    email_message["Subject"] = subject
    email_message.set_content(body)

    raw_message = base64.urlsafe_b64encode(email_message.as_bytes()).decode("utf-8")
    response = requests.post(
        GMAIL_SEND_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"raw": raw_message},
        timeout=20,
    )
    payload = response.json()
    if not response.ok:
        raise RuntimeError(payload.get("error", {}).get("message") or "Failed to send Gmail message.")
    return payload
