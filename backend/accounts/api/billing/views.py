from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .services import (
    StripeServiceError,
    billing_snapshot,
    ensure_stripe_customer,
    get_or_create_billing_profile,
    stripe_is_configured,
    stripe_request,
    sync_subscription_from_stripe,
    verify_checkout_session_and_sync,
)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    if not stripe_is_configured():
        return Response(
            {"error": "Stripe test mode is not configured yet."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    requested_plan = (request.data.get("plan") or "monthly").strip().lower()
    selected_plan = "yearly" if requested_plan == "yearly" else "monthly"

    profile = get_or_create_billing_profile(request.user)

    try:
        if profile.stripe_subscription_id:
            sync_subscription_from_stripe(profile)
    except StripeServiceError:
        pass

    if profile.is_paid:
        return Response(
            {
                "message": "Your Pro plan is already active.",
                "billing": billing_snapshot(profile),
            },
            status=status.HTTP_200_OK,
        )

    try:
        customer_id = ensure_stripe_customer(profile, request.user)
        session = stripe_request(
            "POST",
            "/checkout/sessions",
            data={
                "mode": "subscription",
                "customer": customer_id,
                "client_reference_id": str(request.user.id),
                "success_url": f"{settings.FRONTEND_APP_URL.rstrip('/')}/pricing/success?session_id={{CHECKOUT_SESSION_ID}}",
                "cancel_url": f"{settings.FRONTEND_APP_URL.rstrip('/')}/pricing/cancel",
                "line_items[0][price]": settings.STRIPE_PRO_MONTHLY_PRICE_ID,
                "line_items[0][quantity]": "1",
                "metadata[user_id]": str(request.user.id),
                "metadata[selected_ui_plan]": selected_plan,
                "metadata[billing_mode]": "monthly_only",
                "subscription_data[metadata][user_id]": str(request.user.id),
                "subscription_data[metadata][selected_ui_plan]": selected_plan,
                "subscription_data[metadata][billing_mode]": "monthly_only",
            },
        )
    except StripeServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    profile.stripe_checkout_session_id = session.get("id", "")
    profile.billing_source = selected_plan
    profile.save(update_fields=["stripe_checkout_session_id", "billing_source", "updated_at"])

    return Response(
        {
            "checkoutUrl": session.get("url"),
            "sessionId": session.get("id"),
            "billing": billing_snapshot(profile),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verify_checkout_session(request):
    session_id = (request.query_params.get("session_id") or "").strip()
    if not session_id:
        return Response({"error": "session_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    profile = get_or_create_billing_profile(request.user)

    try:
        _, profile = verify_checkout_session_and_sync(profile, request.user, session_id)
    except StripeServiceError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "message": "Checkout verified successfully.",
            "billing": billing_snapshot(profile),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_status(request):
    profile = get_or_create_billing_profile(request.user)

    try:
        sync_subscription_from_stripe(profile)
    except StripeServiceError:
        pass

    return Response({"billing": billing_snapshot(profile)})
