"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../auth/auth-context";
import Navbar from "../chat/chat-navbar";
import { API_URL, fetchWithAuth, getAccessToken } from "../../utils/auth";
import {
  clearPendingBillingPlan,
  getBillingCache,
  getPendingBillingPlan,
  setBillingCache,
  setPendingBillingPlan,
} from "../../utils/billing";

export default function PricingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [isYearly, setIsYearly] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [billing, setBilling] = useState(null);
  const [billingMessage, setBillingMessage] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const headingRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") || "light";
    const cachedBilling = getBillingCache();
    const pendingPlan = getPendingBillingPlan();

    document.documentElement.classList.toggle("dark", savedTheme === "dark");

    if (cachedBilling) {
      setBilling(cachedBilling);
    }
    if (pendingPlan === "yearly") {
      setIsYearly(true);
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user?.billing) {
      setBilling(user.billing);
      setBillingCache(user.billing);
    }
  }, [user]);

  useEffect(() => {
    const syncBilling = async () => {
      if (!getAccessToken()) return;

      try {
        const response = await fetchWithAuth(`${API_URL}/api/billing/status/`, { method: "GET" });
        if (!response.ok) return;

        const data = await response.json();
        if (data?.billing) {
          setBilling(data.billing);
          setBillingCache(data.billing);
          await refreshUser();
        }
      } catch (error) {
        console.error("Billing status sync failed:", error);
      }
    };

    syncBilling();
  }, [refreshUser]);

  const handleNavigation = (path) => {
    setIsRedirecting(true);
    setTimeout(() => {
      router.push(path);
    }, 100);
  };

  const handleBackToHome = () => handleNavigation("/");

  const plans = {
    monthly: { pro: 19.99 },
    yearly: { pro: 191.88 },
  };

  const proPlanFeatures = [
    "5,000 AI tokens per month",
    "5 custom chatbots",
    "Unlimited chat history",
    "Document upload support",
    "API access",
    "Priority support",
    "Early access to new features",
    "Custom branding options",
  ];

  const testimonials = [
    {
      id: 1,
      content: "The AI assistant helped me write code 3x faster. It's like having a senior developer by my side!",
      author: "Sarah Chen",
      role: "Software Engineer",
      emoji: "👩‍💻",
    },
    {
      id: 2,
      content: "I've integrated the API into our customer service platform. Response times improved by 65% instantly.",
      author: "Michael Torres",
      role: "Product Manager",
      emoji: "🚀",
    },
    {
      id: 3,
      content: "The document analysis feature saved my team 20 hours per week on research. Absolutely game-changing.",
      author: "Jessica Williams",
      role: "Research Lead",
      emoji: "📊",
    },
  ];

  const isPaid = Boolean(billing?.isPaid);
  const selectedPlan = isYearly ? "yearly" : "monthly";
  const proButtonLabel = isPaid
    ? "Pro Active"
    : isStartingCheckout
      ? "Redirecting..."
      : `Upgrade ${isYearly ? "Yearly" : "Monthly"}`;

  const handleUpgrade = async () => {
    setBillingMessage("");

    if (!getAccessToken()) {
      setPendingBillingPlan(selectedPlan);
      handleNavigation("/login");
      return;
    }

    setIsStartingCheckout(true);

    try {
      const response = await fetchWithAuth(`${API_URL}/api/billing/create-checkout-session/`, {
        method: "POST",
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to start Stripe checkout.");
      }

      if (data?.billing) {
        setBilling(data.billing);
        setBillingCache(data.billing);
      }

      if (data?.checkoutUrl) {
        clearPendingBillingPlan();
        window.location.href = data.checkoutUrl;
        return;
      }

      setBillingMessage(data?.message || "Your Pro plan is already active.");
    } catch (error) {
      console.error("Checkout start failed:", error);
      setBillingMessage(error.message || "Unable to start Stripe checkout.");
    } finally {
      setIsStartingCheckout(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!mounted) {
    return <div className="min-h-screen bg-white dark:bg-gray-900"></div>;
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 transition-colors duration-300">
      <Navbar />

      <div className="max-w-6xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-12">
          <button
            onClick={handleBackToHome}
            className="inline-flex items-center text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 mb-6 transition-all duration-300 hover:-translate-x-1 opacity-0 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>

          <h1
            ref={headingRef}
            className="text-4xl font-bold text-gray-900 dark:text-white mb-4 transform transition-all duration-700 ease-out opacity-0 translate-y-6"
            style={isVisible ? { opacity: 1, transform: "translateY(0)" } : {}}
          >
            Simple, Transparent Pricing
          </h1>
          <p
            className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto transform transition-all duration-700 ease-out opacity-0 translate-y-6 delay-150"
            style={isVisible ? { opacity: 1, transform: "translateY(0)" } : {}}
          >
            Choose the plan that works best for you. All plans include full access to our AI platform.
          </p>
          {billingMessage && (
            <div className="mt-4 inline-flex items-center rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm text-purple-700">
              {billingMessage}
            </div>
          )}
          {billing?.currentPeriodEnd && (
            <div className="mt-4 inline-flex items-center rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
              {isPaid ? "Pro access is active" : "Latest billing status loaded"} until{" "}
              {new Date(billing.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex justify-center mb-12 animate-fade-in delay-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden">
            <div
              className={`absolute top-1 bottom-1 rounded-lg bg-purple-100 dark:bg-purple-900 transition-all duration-300 ease-in-out ${
                isYearly ? "translate-x-full left-1 right-1" : "left-1 right-1"
              }`}
              style={{ width: "calc(50% - 8px)" }}
            />

            <div className="flex relative z-10">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-8 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                  !isYearly
                    ? "text-purple-700 dark:text-purple-200 font-semibold"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-8 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isYearly
                    ? "text-purple-700 dark:text-purple-200 font-semibold"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                Yearly{" "}
                <span className="ml-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full dark:bg-green-900 dark:text-green-200">
                  20% off
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 transition-all duration-500 hover:shadow-xl animate-fade-in-up delay-300">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free Plan</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Perfect for getting started</p>

            <div className="mb-8">
              <div className="flex items-end justify-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2 mb-1">forever</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start transition-all duration-300 hover:translate-x-1">
                <svg className="h-6 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">500 tokens per month</span>
              </li>
              <li className="flex items-start transition-all duration-300 hover:translate-x-1 delay-75">
                <svg className="h-6 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">1 chatbot</span>
              </li>
              <li className="flex items-start transition-all duration-300 hover:translate-x-1 delay-100">
                <svg className="h-6 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">10 stored chats</span>
              </li>
              <li className="flex items-start transition-all duration-300 hover:translate-x-1 delay-150">
                <svg className="h-6 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">Basic model access</span>
              </li>
            </ul>

            <button className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-all duration-300 hover:scale-[1.02]">
              {isPaid ? "Free Plan Available After Pro Ends" : "Current Plan"}
            </button>
          </div>

          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border-2 border-purple-500 transform transition-all duration-500 hover:scale-[1.02] animate-fade-in-up delay-400">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-bl-lg rounded-tr-xl animate-pulse">
              MOST POPULAR
            </div>

            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pro Plan</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Everything you need to maximize productivity</p>

              <div className="mb-8">
                <div className="flex items-end justify-center">
                  <span className="text-5xl font-bold text-gray-900 dark:text-white">
                    ${isYearly ? plans.yearly.pro : plans.monthly.pro}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2 mb-1">
                    {isYearly ? "/year" : "/month"}
                  </span>
                </div>
                {isYearly && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                    Equivalent to $15.99/month
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {proPlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start transition-all duration-300 hover:translate-x-1" style={{ transitionDelay: `${index * 50}ms` }}>
                    <svg className="h-6 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={isStartingCheckout}
                className={`w-full text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 transform shadow-lg hover:shadow-xl ${
                  isPaid
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:-translate-y-1"
                } ${isStartingCheckout ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {proButtonLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-16 animate-fade-in delay-500">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Why Users Love Pro</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl transition-all duration-500 hover:scale-105 hover:shadow-md animate-fade-in-up"
                style={{ animationDelay: `${index * 150 + 600}ms` }}
              >
                <div className="text-3xl mb-4">{testimonial.emoji}</div>
                <p className="text-gray-700 dark:text-gray-300 italic mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{testimonial.author}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 animate-fade-in delay-700">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Frequently Asked Questions</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What payment methods do you accept?</h4>
              <p className="text-gray-600 dark:text-gray-300">Stripe test mode accepts dummy cards for this local development flow.</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Can I cancel anytime?</h4>
              <p className="text-gray-600 dark:text-gray-300">Yes. This version focuses on local test activation, and cancel management can be added next.</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Is there a free trial?</h4>
              <p className="text-gray-600 dark:text-gray-300">The current flow is test mode only, so no real money is charged while you validate billing behavior.</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">How do renewals work?</h4>
              <p className="text-gray-600 dark:text-gray-300">Stripe stores the test payment method and reuses it for monthly renewals on the same subscription.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
