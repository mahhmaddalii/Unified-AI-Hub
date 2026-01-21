"use client";

import { useState, useEffect } from "react";
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

export const SettingsPanel = ({ isOpen, onClose, initialSection = "general" }) => {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [searchHistory, setSearchHistory] = useState(true);
  
  const router = useRouter();

  // Update activeSection when initialSection prop changes
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection, isOpen]);

  if (!isOpen) return null;

  const userProfile = {
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    plan: "Pro",
    avatar: "AJ",
  };

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
      <div className="fixed right-0 top-4 bottom-4 w-80 bg-white rounded-2xl shadow-lg border border-gray-200 z-50 animate-in slide-in-from-right duration-200 overflow-hidden mr-4">
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
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {userProfile.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 text-sm truncate">
                  {userProfile.name}
                </div>
                <div className="text-gray-500 text-xs truncate">
                  {userProfile.email}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    {userProfile.plan} Plan
                  </span>
                  <button 
                    onClick={handleUpgradePlan}
                    className="text-xs text-purple-600 hover:text-purple-700 hover:underline"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Navigation */}
          <div className="flex-1 overflow-y-auto p-4">
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
                    <div className="relative group">
  <div className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 cursor-pointer hover:border-gray-300 transition-all flex items-center justify-between">
    <span>Gemini Pro</span>
    <svg className="w-4 h-4 text-gray-500 transform group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </div>
  
  {/* Dropdown menu - appears on hover/click */}
  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
    <div className="py-1">
      <button className="w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2">
        <span className="text-base">🤖</span>
        <span>Gemini Pro</span>
      </button>
      <button className="w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2">
        <span className="text-base">⚡</span>
        <span>GPT-4</span>
      </button>
      <button className="w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2">
        <span className="text-base">🧠</span>
        <span>Claude 3</span>
      </button>
    </div>
  </div>
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