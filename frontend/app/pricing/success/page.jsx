"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "../../../components/auth/auth-context";
import { API_URL, fetchWithAuth } from "../../../utils/auth";
import {
  clearPendingBillingPlan,
  setBillingCache,
} from "../../../utils/billing";

const MAX_VERIFY_ATTEMPTS = 12;
const VERIFY_RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    let cancelled = false;

    const verifyCheckout = async () => {
      if (!sessionId) {
        setState({
          loading: false,
          error: "Missing Stripe id.",
          billing: null,
        });
        return;
      }

      for (let attempt = 0; attempt < MAX_VERIFY_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetchWithAuth(
            `${API_URL}/api/billing/verify-session/?session_id=${encodeURIComponent(sessionId)}`,
            {
              method: "GET",
              suppressUnauthorizedRedirect: true,
            },
          );
          const data = await response.json();
          const hasAttemptsRemaining = attempt < MAX_VERIFY_ATTEMPTS - 1;

          if (response.status === 401) {
            if (hasAttemptsRemaining) {
              await sleep(VERIFY_RETRY_DELAY_MS);
              continue;
            }
            throw new Error(
              "Your session is still loading. Please wait a moment and try again.",
            );
          }

          // Stripe can finish the redirect before the subscription is fully
          // queryable, so keep polling for a short window instead of failing.
          if (response.status === 202 && data?.pending) {
            if (data?.billing) {
              setBillingCache(data.billing);
            }
            if (hasAttemptsRemaining) {
              await sleep(VERIFY_RETRY_DELAY_MS);
              continue;
            }
            throw new Error(
              data?.message || "Stripe is still processing this subscription.",
            );
          }

          if (!response.ok) {
            throw new Error(
              data?.error || "Unable to verify your Stripe checkout session.",
            );
          }

          if (data?.billing) {
            setBillingCache(data.billing);
          }
          clearPendingBillingPlan();
          await refreshUser();
          if (!cancelled) {
            setState({
              loading: false,
              error: "",
              billing: data?.billing || null,
            });
          }
          return;
        } catch (error) {
          if (attempt < MAX_VERIFY_ATTEMPTS - 1) {
            await sleep(VERIFY_RETRY_DELAY_MS);
            continue;
          }
          console.error("Stripe checkout verification failed:", error);
          if (!cancelled) {
            setState({
              loading: false,
              error:
                error.message ||
                "Unable to verify your Stripe checkout session.",
              billing: null,
            });
          }
          return;
        }
      }
    };

    verifyCheckout();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, sessionId]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16 flex items-center justify-center">
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Main card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center relative overflow-hidden">
          {/* Purple-to-green top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-emerald-500" />

          {state.loading ? (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Confirming your subscription with Stripe...
              </p>
            </>
          ) : state.error ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-7 h-7 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-red-500 mb-2">
                Verification failed
              </p>
              <h1 className="text-xl font-semibold text-gray-900 mb-3">
                Something went wrong
              </h1>
              <p className="text-sm text-gray-500 mb-6">{state.error}</p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 transition-colors"
              >
                Back to pricing
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-7 h-7 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 mb-2">
                Payment confirmed
              </p>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                You're now on Pro
              </h1>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Your subscription is active. You have full access to paid chat
                models, custom agents, and domain agents.
              </p>

              {/* Order summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">
                  Order summary
                </p>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium text-gray-900">Pro Monthly</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">
                    $19.99 / month
                  </span>
                </div>
                {state.billing?.currentPeriodEnd && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Next billing date</span>
                      <span className="font-medium text-gray-900">
                        {new Date(
                          state.billing.currentPeriodEnd,
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Link
                  href="/chat"
                  className="flex-1 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors text-center"
                >
                  Go to chat
                </Link>
                <Link
                  href="/pricing"
                  className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors text-center"
                >
                  View pricing
                </Link>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                A receipt has been sent to your email.{" "}
                <span className="text-purple-600 font-medium">
                  You're ready to go.
                </span>
              </p>
            </>
          )}
        </div>

        {/* What's included — only show on success */}
        {!state.loading && !state.error && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">
              What's included in Pro
            </p>
            {[
              "Paid chat models",
              "Custom AI agents",
              "Live cricket & politics agents",
              "Comsats agent",
            ].map((f) => (
              <div
                key={f}
                className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-3 h-3 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>
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
            <h1 className="text-3xl font-bold text-gray-900">
              Stripe Checkout Result
            </h1>
            <p className="mt-6 text-gray-600">
              Loading your checkout result...
            </p>
          </div>
        </main>
      }
    >
      <PricingSuccessContent />
    </Suspense>
  );
}
