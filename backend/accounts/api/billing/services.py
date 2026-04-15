from datetime import datetime, timezone as dt_timezone

import requests
from django.conf import settings
from django.utils import timezone

from accounts.models import BillingProfile

STRIPE_API_BASE = "https://api.stripe.com/v1"
ACTIVE_BILLING_STATUSES = {"active", "trialing"}


class StripeServiceError(Exception):
    pass


class StripePendingError(StripeServiceError):
    pass


def stripe_is_configured():
    return bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_PRO_MONTHLY_PRICE_ID)


def get_or_create_billing_profile(user):
    profile, _ = BillingProfile.objects.get_or_create(user=user)
    return profile


def stripe_request(method, path, data=None, params=None):
    if not settings.STRIPE_SECRET_KEY:
        raise StripeServiceError("Stripe is not configured yet.")

    response = requests.request(
        method=method,
        url=f"{STRIPE_API_BASE}{path}",
        headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
        data=data,
        params=params,
        timeout=20,
    )

    if response.ok:
        return response.json()

    try:
        payload = response.json()
        error_message = payload.get("error", {}).get("message") or response.text
    except ValueError:
        error_message = response.text
    raise StripeServiceError(error_message or "Stripe request failed.")


def stripe_timestamp_to_datetime(timestamp):
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=dt_timezone.utc)


def billing_snapshot(profile):
    return {
        "plan": profile.plan_name,
        "status": profile.billing_status,
        "interval": profile.billing_interval,
        "selectedPlan": profile.billing_source or "monthly",
        "isPaid": profile.is_paid,
        "currentPeriodEnd": profile.current_period_end.isoformat() if profile.current_period_end else None,
        "stripeCustomerId": profile.stripe_customer_id or None,
        "stripeSubscriptionId": profile.stripe_subscription_id or None,
        "lastVerifiedAt": profile.last_verified_at.isoformat() if profile.last_verified_at else None,
    }


def session_belongs_to_user(session, user, profile):
    session_customer_id = (session.get("customer") or "").strip()
    profile_customer_id = (profile.stripe_customer_id or "").strip()
    session_client_reference = str(session.get("client_reference_id") or "").strip()
    session_customer_email = (session.get("customer_email") or "").strip().lower()
    session_metadata = session.get("metadata") or {}
    metadata_user_id = str(session_metadata.get("user_id") or "").strip()
    user_email = (user.email or "").strip().lower()
    user_id = str(user.id)

    # Prefer app-controlled identifiers over customer-id equality because
    # Stripe can still complete a valid checkout even when the session's
    # customer id differs from the one we previously stored locally.
    if session_client_reference and session_client_reference == user_id:
        return True
    if metadata_user_id and metadata_user_id == user_id:
        return True
    if session_customer_email and user_email and session_customer_email == user_email:
        return True
    if profile_customer_id and session_customer_id and profile_customer_id == session_customer_id:
        return True
    return False


def _apply_subscription_to_profile(profile, subscription, selected_plan=None):
    items = ((subscription or {}).get("items") or {}).get("data") or []
    first_item = items[0] if items else {}
    price = first_item.get("price") or {}
    recurring = price.get("recurring") or {}
    metadata = subscription.get("metadata") or {}
    current_period_end = subscription.get("current_period_end")
    status = subscription.get("status") or "free"

    profile.stripe_subscription_id = subscription.get("id", profile.stripe_subscription_id)
    profile.billing_interval = recurring.get("interval") or "month"
    profile.billing_status = status
    profile.current_period_end = stripe_timestamp_to_datetime(current_period_end)
    profile.last_verified_at = timezone.now()

    if selected_plan:
        profile.billing_source = selected_plan
    elif metadata.get("selected_ui_plan"):
        profile.billing_source = metadata["selected_ui_plan"]

    profile.plan_name = "pro" if status in ACTIVE_BILLING_STATUSES else "free"
    profile.save(update_fields=[
        "stripe_subscription_id",
        "billing_interval",
        "billing_status",
        "current_period_end",
        "last_verified_at",
        "billing_source",
        "plan_name",
        "updated_at",
    ])
    return profile


def ensure_stripe_customer(profile, user):
    if profile.stripe_customer_id:
        return profile.stripe_customer_id

    customer = stripe_request(
        "POST",
        "/customers",
        data={
            "email": user.email,
            "name": f"{user.first_name} {user.last_name}".strip() or user.email,
            "metadata[user_id]": str(user.id),
        },
    )
    profile.stripe_customer_id = customer.get("id", "")
    profile.last_verified_at = timezone.now()
    profile.save(update_fields=["stripe_customer_id", "last_verified_at", "updated_at"])
    return profile.stripe_customer_id


def sync_subscription_from_stripe(profile):
    if not stripe_is_configured():
        return profile

    if profile.stripe_subscription_id:
        subscription = stripe_request("GET", f"/subscriptions/{profile.stripe_subscription_id}")
        return _apply_subscription_to_profile(profile, subscription)

    if not profile.stripe_customer_id:
        return profile

    # Some successful checkouts reach us before we have stored the final
    # subscription id locally, so recover the newest usable subscription
    # directly from Stripe using the saved customer id.
    subscriptions = stripe_request(
        "GET",
        "/subscriptions",
        params={
            "customer": profile.stripe_customer_id,
            "status": "all",
            "limit": 5,
        },
    ).get("data", [])

    for subscription in subscriptions:
        if subscription.get("status") == "incomplete_expired":
            continue
        return _apply_subscription_to_profile(profile, subscription)

    return profile


def get_billing_snapshot_for_user(user, sync_remote=False):
    profile = get_or_create_billing_profile(user)
    if sync_remote:
        try:
            sync_subscription_from_stripe(profile)
        except StripeServiceError:
            pass
    return billing_snapshot(profile)


def find_subscription_for_checkout_session(session, user):
    subscription = session.get("subscription")
    if isinstance(subscription, dict):
        return subscription
    if subscription:
        return stripe_request("GET", f"/subscriptions/{subscription}")

    customer_id = session.get("customer")
    if not customer_id:
        return None

    subscriptions = stripe_request(
        "GET",
        "/subscriptions",
        params={
            "customer": customer_id,
            "status": "all",
            "limit": 10,
        },
    ).get("data", [])

    for candidate in subscriptions:
        metadata = candidate.get("metadata") or {}
        if metadata.get("user_id") == str(user.id):
            return candidate

    session_created = session.get("created")
    if session_created:
        # Fallback for the short window where Stripe has created the
        # subscription but has not expanded it onto the Checkout Session yet.
        for candidate in subscriptions:
            created = candidate.get("created")
            if created and abs(created - session_created) <= 300:
                return candidate

    return subscriptions[0] if subscriptions else None


def verify_checkout_session_and_sync(profile, user, session_id):
    session = stripe_request(
        "GET",
        f"/checkout/sessions/{session_id}",
        params={
            "expand[]": ["subscription"],
        },
    )

    if session.get("mode") != "subscription":
        raise StripeServiceError("This checkout session is not a subscription.")
    if session.get("status") != "complete":
        raise StripePendingError("Checkout is still completing. Please wait a moment.")

    customer_id = session.get("customer") or profile.stripe_customer_id
    if not session_belongs_to_user(session, user, profile):
        raise StripeServiceError("This checkout session does not belong to the current user.")

    subscription = find_subscription_for_checkout_session(session, user)
    if not subscription:
        raise StripePendingError("Stripe is still preparing the subscription. Please wait a moment.")

    subscription_status = subscription.get("status") or "incomplete"
    if subscription_status in {"incomplete", "trialing"} and session.get("payment_status") != "paid":
        raise StripePendingError("Payment is still being processed. Please wait a moment.")
    if subscription_status == "incomplete_expired":
        raise StripeServiceError("The subscription payment expired before it could be completed.")

    selected_plan = (session.get("metadata") or {}).get("selected_ui_plan") or profile.billing_source or "monthly"

    profile.stripe_checkout_session_id = session.get("id", session_id)
    profile.stripe_customer_id = customer_id or ""
    profile.billing_source = selected_plan
    profile.last_verified_at = timezone.now()
    profile.save(update_fields=[
        "stripe_checkout_session_id",
        "stripe_customer_id",
        "billing_source",
        "last_verified_at",
        "updated_at",
    ])
    _apply_subscription_to_profile(profile, subscription, selected_plan=selected_plan)
    return session, profile
