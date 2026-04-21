from django.urls import path

from . import views

urlpatterns = [
    path("create-checkout-session/", views.create_checkout_session, name="create_checkout_session"),
    path("verify-session/", views.verify_checkout_session, name="verify_checkout_session"),
    path("status/", views.billing_status, name="billing_status"),
]
