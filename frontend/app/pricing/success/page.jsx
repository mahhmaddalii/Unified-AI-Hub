"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "../../../components/auth/auth-context";
import { API_URL, fetchWithAuth } from "../../../utils/auth";
import { clearPendingBillingPlan, setBillingCache } from "../../../utils/billing";

function PricingSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { refreshUser } = useAuth();
  const [state, setState] = useState({
    loading: true,
    error: "",
    billing: null,
  });

  useEffect(() => {
    const verifyCheckout = async () => {
      if (!sessionId) {
        setState({ loading: false, error: "Missing Stripe checkout session id.", billing: null });
        return;
      }

      try {
        const response = await fetchWithAuth(
          `${API_URL}/api/billing/verify-session/?session_id=${encodeURIComponent(sessionId)}`,
          { method: "GET" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Unable to verify your Stripe checkout session.");
        }

        if (data?.billing) {
          setBillingCache(data.billing);
        }
        clearPendingBillingPlan();
        await refreshUser();
        setState({ loading: false, error: "", billing: data?.billing || null });
      } catch (error) {
        console.error("Stripe checkout verification failed:", error);
        setState({
          loading: false,
          error: error.message || "Unable to verify your Stripe checkout session.",
          billing: null,
        });
      }
    };

    verifyCheckout();
  }, [refreshUser, sessionId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-purple-100 bg-white p-10 text-center shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">Stripe Checkout Result</h1>
        {state.loading && (
          <p className="mt-6 text-gray-600">Verifying your test subscription and syncing Pro access...</p>
        )}
        {!state.loading && state.error && (
          <>
            <p className="mt-6 text-red-600">{state.error}</p>
            <Link
              href="/pricing"
              className="mt-8 inline-flex rounded-xl bg-purple-600 px-5 py-3 text-white transition-colors hover:bg-purple-700"
            >
              Back to Pricing
            </Link>
          </>
        )}
        {!state.loading && !state.error && (
          <>
            <p className="mt-6 text-green-700">
              Pro access is active in test mode. Your Stripe dummy card is now attached to the monthly subscription.
            </p>
            {state.billing?.currentPeriodEnd && (
              <p className="mt-3 text-sm text-gray-600">
                Current monthly access ends on {new Date(state.billing.currentPeriodEnd).toLocaleString()}.
              </p>
            )}
            <div className="mt-8 flex justify-center gap-3">
              <Link
                href="/pricing"
                className="inline-flex rounded-xl border border-gray-200 px-5 py-3 text-gray-700 transition-colors hover:bg-gray-50"
              >
                View Pricing
              </Link>
              <Link
                href="/chat"
                className="inline-flex rounded-xl bg-purple-600 px-5 py-3 text-white transition-colors hover:bg-purple-700"
              >
                Go to Chat
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function PricingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100 px-6 py-16">
          <div className="mx-auto max-w-2xl rounded-3xl border border-purple-100 bg-white p-10 text-center shadow-xl">
            <h1 className="text-3xl font-bold text-gray-900">Stripe Checkout Result</h1>
            <p className="mt-6 text-gray-600">Loading your checkout result...</p>
          </div>
        </main>
      }
    >
      <PricingSuccessContent />
    </Suspense>
  );
}
