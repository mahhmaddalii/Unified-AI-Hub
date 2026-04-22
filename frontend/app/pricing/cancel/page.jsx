"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearPendingStripeCheckout,
  hasPendingStripeCheckout,
} from "../../../utils/billing";

export default function PricingCancelPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (!hasPendingStripeCheckout()) {
      router.replace("/pricing");
      return;
    }

    clearPendingStripeCheckout();
    setIsRedirecting(false);
  }, [router]);

  if (isRedirecting) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16 flex items-center justify-center">
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200" />

          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Checkout cancelled</p>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No charge was made</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Your checkout session was cancelled and nothing was billed. Your account remains on the Free plan.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">Current plan</p>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Plan</span>
              <span className="font-medium text-gray-900 px-3">Free</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500">Active</span>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Link href="/pricing" className="flex-1 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors text-center">
              See Pro plan
            </Link>
            <Link href="/chat" className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors text-center">
              Go to chat
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Changed your mind?{" "}
            <Link href="/pricing" className="text-purple-600 hover:underline">Upgrade any time</Link>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">What you're missing on Free</p>
          {[
            ["Free Models access", "Free", "Limited"],
            ["Pro Models access", "Pro only"],
            ["Custom AI agents", "Pro only", null],
            ["Live agents (Cricket, Politics)", "Pro only", null],
          ].map(([feat, free, pro]) => (
            <div key={feat} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{feat}</span>
              <div className="flex items-center gap-2">
                {pro && <span className="text-xs text-gray-300">{pro}</span>}
                <span className="text-xs font-medium text-gray-400 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200">{free}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
