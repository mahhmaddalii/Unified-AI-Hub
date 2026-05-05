from django.http import JsonResponse, StreamingHttpResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from accounts.api.billing.services import (
    get_or_create_billing_profile,
    maybe_sync_billing_profile,
    profile_has_paid_token_access,
)

FREE_MODEL_IDS = {"gpt-oss-120b", "models-router"}


def _authenticate_token(authenticator, raw_token):
    if not raw_token:
        return None

    try:
        validated = authenticator.get_validated_token(raw_token)
        return authenticator.get_user(validated)
    except (InvalidToken, TokenError, Exception):
        return None


def authenticate_request_user(request, allow_query_token=False):
    authenticator = JWTAuthentication()

    header = authenticator.get_header(request)
    if header:
        raw_header_token = authenticator.get_raw_token(header)
        user = _authenticate_token(authenticator, raw_header_token)
        if user:
            return user

    if allow_query_token:
        raw_query_token = (request.GET.get("access_token") or "").strip()
        user = _authenticate_token(authenticator, raw_query_token)
        if user:
            return user

    return None


def user_has_pro_access(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False

    profile = get_or_create_billing_profile(user)
    return profile.is_paid


def get_user_billing_profile(user, sync_remote=False):
    if not user or not getattr(user, "is_authenticated", False):
        return None

    profile = get_or_create_billing_profile(user)
    if sync_remote:
        try:
            profile = maybe_sync_billing_profile(profile, force=True)
        except Exception:
            pass
    else:
        profile = maybe_sync_billing_profile(profile, force=False)
    return profile


def user_has_paid_token_access(user, sync_remote=False):
    profile = get_user_billing_profile(user, sync_remote=sync_remote)
    if not profile:
        return False
    return profile_has_paid_token_access(profile)


def model_requires_pro(model_id):
    return (model_id or "").strip() not in FREE_MODEL_IDS


def json_auth_required_response():
    return JsonResponse({"error": "Authentication required."}, status=401)


def json_pro_required_response(message="Upgrade to Pro to use this feature."):
    return JsonResponse(
        {
            "error": message,
            "requires_pro": True,
            "redirect": "/pricing",
        },
        status=403,
    )


def json_token_limit_response(message="Token limit reached. Please wait until subscription renewal."):
    return JsonResponse(
        {
            "error": message,
            "token_limit_reached": True,
        },
        status=403,
    )


def sse_error_response(message):
    response = StreamingHttpResponse(
        [f"data: [ERROR]{message}\n\n", "data: [DONE]\n\n"],
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    response["Access-Control-Allow-Origin"] = "*"
    return response


def sse_token_limit_response(message="Token limit reached. Please wait until subscription renewal."):
    return sse_error_response(message)
