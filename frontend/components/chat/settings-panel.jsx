"use client";

import { useState, useEffect, useRef } from "react";
import {
  XMarkIcon,
  Cog6ToothIcon,
  BellIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
  ChevronRightIcon,
  TrashIcon,
  UserIcon,
  SparklesIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/auth-context";
import { DEFAULT_MODEL_ID, MODEL_OPTIONS, getDefaultModelId, setDefaultModelId, subscribeDefaultModel } from "../../utils/model-preferences";
import { showToast } from "../../utils/toast";
import { canUseModelId, hasTokenLimitReached, isProModelId, sanitizeModelIdForBilling, TOKEN_LIMIT_REACHED_MESSAGE } from "../../utils/plan-access";

export const SettingsPanel = ({ isOpen, onClose, initialSection = "general" }) => {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [searchHistory, setSearchHistory] = useState(true);
  const [defaultModelId, setDefaultModelIdState] = useState(() => getDefaultModelId());
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef(null);
  const { user, loading: userLoading, refreshBilling } = useAuth();
  
  const router = useRouter();

  // Update activeSection when initialSection prop changes
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setModelMenuOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeDefaultModel((modelId) => {
      setDefaultModelIdState(modelId);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handleClickOutside = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelMenuOpen]);

  const displayName = user?.name || (userLoading ? "Loading..." : "User");
  const displayEmail = user?.email || "";
  const avatarUrl = user?.avatarUrl || null;
  const billing = user?.billing || null;
  const isPaid = Boolean(billing?.isPaid);
  const planLabel = isPaid ? "Pro Plan" : "Free Plan";
  const selectedModel = MODEL_OPTIONS.find((model) => model.id === defaultModelId) ||
    MODEL_OPTIONS.find((model) => model.id === DEFAULT_MODEL_ID) ||
    MODEL_OPTIONS[0];

  useEffect(() => {
    if (userLoading) return;

    const sanitizedModelId = sanitizeModelIdForBilling(defaultModelId, billing);
    if (sanitizedModelId !== defaultModelId) {
      setDefaultModelId(sanitizedModelId);
      setDefaultModelIdState(sanitizedModelId);
    }
  }, [billing, defaultModelId, userLoading]);

  if (!isOpen) return null;

  const getInitials = (nameValue, emailValue) => {
    const safeName = (nameValue || "").trim();
    if (safeName) {
      const parts = safeName.split(" ").filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    if (emailValue) return emailValue.slice(0, 2).toUpperCase();
    return "U";
  };

  const initials = getInitials(displayName, displayEmail);

  const sections = [
    { id: "general", icon: Cog6ToothIcon, title: "General" },
    { id: "notifications", icon: BellIcon, title: "Notifications" },
    { id: "privacy", icon: ShieldCheckIcon, title: "Privacy" },
    { id: "help", icon: QuestionMarkCircleIcon, title: "Help & Support" },
  ];

  const handleUpgradePlan = () => {
    onClose();
    router.push('/pricing'); // Change this to your actual pricing page route
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      console.log("Deleting account...");
      // Add your account deletion logic here
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-transparent z-40"
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <div className="fixed right-0 top-4 bottom-4 w-80 bg-white rounded-2xl shadow-lg border border-gray-200 z-50 animate-in slide-in-from-right duration-200 overflow-visible mr-4">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Settings</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition-all"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full">
          {/* User Profile Section */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 text-sm truncate">
                  {displayName}
                </div>
                <div className="text-gray-500 text-xs truncate">
                  {displayEmail}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    {planLabel}
                  </span>
                  {!isPaid && (
                    <button 
                      onClick={handleUpgradePlan}
                      className="text-xs text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Settings Navigation */}
          <div className="flex-1 p-4">
            <div className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                    activeSection === section.id
                      ? "bg-purple-50 border border-purple-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${
                      activeSection === section.id ? "bg-white" : "bg-gray-100"
                    }`}>
                      <section.icon className={`w-4 h-4 ${
                        activeSection === section.id ? "text-purple-600" : "text-gray-600"
                      }`} />
                    </div>
                    <span className="font-medium text-sm">{section.title}</span>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>

            {/* Active Section Content */}
            <div className="mt-6 space-y-4">
              {activeSection === "general" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isPaid ? "Pro Plan Status" : "Plan Status"}
                        </label>
                        <p className="text-xs text-gray-500">
                          {isPaid
                            ? "Your paid access and monthly token balance."
                            : "You are currently on the free plan."}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isPaid
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {planLabel}
                      </span>
                    </div>

                    {isPaid && (
                      <div className="mt-3 space-y-2">
                        <div className={`rounded-lg border px-3 py-2 ${
                          billing?.tokenLimitReached
                            ? "border-amber-200 bg-amber-50"
                            : "border-blue-200 bg-blue-50"
                        }`}>
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-gray-600">Tokens used</span>
                            <span className="font-medium text-gray-900">
                              {billing?.tokenUsage?.total || 0} / {billing?.tokenQuota || 0}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                            <span className="text-gray-600">Available</span>
                            <span className="font-medium text-gray-900">
                              {billing?.tokenRemaining ?? 0}
                            </span>
                          </div>
                        </div>

                        {billing?.currentPeriodEnd && (
                          <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                            <span>Renewal date</span>
                            <span className="font-medium text-gray-900">
                              {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {billing?.tokenResetAt && (
                          <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                            <span>Token reset</span>
                            <span className="font-medium text-gray-900">
                              {new Date(billing.tokenResetAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Auto-save Chats
                      </label>
                      <p className="text-xs text-gray-500">Save conversations automatically</p>
                    </div>
                    <button
                      onClick={() => setAutoSave(!autoSave)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        autoSave ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        autoSave ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Model
                    </label>
                      <div className="relative" ref={modelMenuRef}>
                      <button
                        type="button"
                        onClick={() => setModelMenuOpen((open) => !open)}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 cursor-pointer hover:border-gray-300 transition-all flex items-center justify-between"
                        aria-expanded={modelMenuOpen}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">{selectedModel?.icon}</span>
                          <span>{selectedModel?.name}</span>
                        </span>
                        <svg className={`w-4 h-4 text-gray-500 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {modelMenuOpen && (
                        <div className="absolute z-10 w-full bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          <div className="py-1 max-h-60 overflow-y-auto scrollbar-thin">
                            {MODEL_OPTIONS.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  if (!canUseModelId(model.id, billing)) {
                                    setModelMenuOpen(false);
                                    if (hasTokenLimitReached(billing)) {
                                      showToast.info(TOKEN_LIMIT_REACHED_MESSAGE);
                                      refreshBilling();
                                    } else {
                                      onClose();
                                      router.push('/pricing');
                                    }
                                    return;
                                  }
                                  setDefaultModelId(model.id);
                                  setDefaultModelIdState(model.id);
                                  setModelMenuOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2 ${model.id === defaultModelId ? "bg-purple-50" : ""}`}
                              >
                                <span className="text-base">{model.icon}</span>
                                <span className="flex-1 text-left">{model.name}</span>
                                {isProModelId(model.id) && (
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                                    Pro
                                  </span>
                                )}
                                {model.id === defaultModelId && (
                                  <span className="text-purple-600">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}


              {activeSection === "notifications" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Push Notifications
                      </label>
                      <p className="text-xs text-gray-500">Browser notifications</p>
                    </div>
                    <button
                      onClick={() => setNotifications(!notifications)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        notifications ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        notifications ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              {activeSection === "privacy" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Save Search History
                      </label>
                      <p className="text-xs text-gray-500">Improve suggestions</p>
                    </div>
                    <button
                      onClick={() => setSearchHistory(!searchHistory)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        searchHistory ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        searchHistory ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  
                  <button className="w-full py-2.5 px-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
                    Clear Chat History
                  </button>
                  
                  <button 
                    onClick={handleDeleteAccount}
                    className="w-full py-2.5 px-4 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              )}

              {activeSection === "help" && (
                <div className="space-y-2">
                  <button className="w-full p-3 text-left bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-sm text-gray-800">Documentation</span>
                    <p className="text-xs text-gray-500 mt-1">Read guides and tutorials</p>
                  </button>
                  <button className="w-full p-3 text-left bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-sm text-gray-800">Contact Support</span>
                    <p className="text-xs text-gray-500 mt-1">Get help from our team</p>
                  </button>
                  <button className="w-full p-3 text-left bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-sm text-gray-800">Send Feedback</span>
                    <p className="text-xs text-gray-500 mt-1">Share your thoughts with us</p>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Version 1.2.0</span>
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;   




