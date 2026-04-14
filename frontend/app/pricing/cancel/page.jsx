"use client";

import Link from "next/link";

export default function PricingCancelPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-xl">
        <h1 className="text-3xl font-bold text-gray-900">Checkout Cancelled</h1>
        <p className="mt-6 text-gray-600">
          No problem. Your account is still on the Free plan, and you can restart the Stripe test checkout any time.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/pricing"
            className="inline-flex rounded-xl bg-purple-600 px-5 py-3 text-white transition-colors hover:bg-purple-700"
          >
            Back to Pricing
          </Link>
          <Link
            href="/chat"
            className="inline-flex rounded-xl border border-gray-200 px-5 py-3 text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go to Chat
          </Link>
        </div>
      </div>
    </main>
  );
}
