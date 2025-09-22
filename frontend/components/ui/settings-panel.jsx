"use client";

import { useState, useEffect } from "react";
import {
  Cog6ToothIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  LanguageIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  XMarkIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";

const SettingsPanel = ({ isOpen, onClose, settingsCategory, setSettingsCategory }) => {
  const [isMobile, setIsMobile] = useState(false);
  
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-full md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {isMobile && settingsCategory && (
              <button
                onClick={() => setSettingsCategory("")}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Settings Sidebar - Hidden on mobile when a category is selected */}
          {(!isMobile || !settingsCategory) && (
            <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 p-4 overflow-y-auto">
              <div className="space-y-2">
                <button
                  onClick={() => setSettingsCategory("general")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    settingsCategory === "general"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  <span>General</span>
                </button>
                
                <button
                  onClick={() => setSettingsCategory("appearance")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    settingsCategory === "appearance"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <MoonIcon className="w-5 h-5" />
                  <span>Appearance</span>
                </button>
                
                <button
                  onClick={() => setSettingsCategory("notifications")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    settingsCategory === "notifications"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <BellIcon className="w-5 h-5" />
                  <span>Notifications</span>
                </button>
                
                <button
                  onClick={() => setSettingsCategory("language")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    settingsCategory === "language"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <LanguageIcon className="w-5 h-5" />
                  <span>Language & Region</span>
                </button>
                
                <button
                  onClick={() => setSettingsCategory("privacy")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    settingsCategory === "privacy"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ShieldCheckIcon className="w-5 h-5" />
                  <span>Privacy & Security</span>
                </button>
                
                <button
                  onClick={() => setSettingsCategory("about")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    settingsCategory === "about"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <InformationCircleIcon className="w-5 h-5" />
                  <span>About</span>
                </button>
              </div>
            </div>
          )}
          
          {/* Settings Content */}
          {(settingsCategory || !isMobile) && (
            <div className="w-full md:flex-1 p-4 md:p-6 overflow-y-auto">
              {settingsCategory === "general" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800">General Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Model</label>
                      <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option>GPT-4o</option>
                        <option>GPT-4</option>
                        <option>Claude 2</option>
                        <option>Gemini Pro</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                      <input type="range" min="0" max="1" step="0.1" className="w-full" />
                      <div className="text-xs text-gray-500 mt-1">Higher values make output more random, lower values more deterministic</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Auto-expand Input</label>
                        <p className="text-sm text-gray-500">Automatically expand input field as you type</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {settingsCategory === "appearance" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800">Appearance</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-purple-500 rounded-xl p-4 flex flex-col items-center cursor-pointer">
                          <div className="flex items-center gap-2 mb-2">
                            <SunIcon className="w-5 h-5" />
                            <span>Light</span>
                          </div>
                          <div className="w-full h-20 bg-gray-100 rounded-lg border"></div>
                        </div>
                        
                        <div className="border-2 border-gray-300 rounded-xl p-4 flex flex-col items-center cursor-pointer hover:border-purple-400 transition-colors">
                          <div className="flex items-center gap-2 mb-2">
                            <MoonIcon className="w-5 h-5" />
                            <span>Dark</span>
                          </div>
                          <div className="w-full h-20 bg-gray-800 rounded-lg border"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
                      <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option>Small</option>
                        <option>Medium</option>
                        <option>Large</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Compact Mode</label>
                        <p className="text-sm text-gray-500">Reduce padding for a more compact interface</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {settingsCategory === "notifications" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800">Notification Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Notifications</label>
                        <p className="text-sm text-gray-500">Receive emails about your account activity</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Push Notifications</label>
                        <p className="text-sm text-gray-500">Receive browser notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sound Effects</label>
                        <p className="text-sm text-gray-500">Play sounds for certain actions</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {settingsCategory === "language" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800">Language & Region</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                      <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                        <option>German</option>
                        <option>Japanese</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                      <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option>MM/DD/YYYY</option>
                        <option>DD/MM/YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone</label>
                      <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option>Eastern Time (ET)</option>
                        <option>Central Time (CT)</option>
                        <option>Mountain Time (MT)</option>
                        <option>Pacific Time (PT)</option>
                        <option>UTC</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              
              {settingsCategory === "privacy" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800">Privacy & Security</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Collection</label>
                        <p className="text-sm text-gray-500">Allow us to collect anonymous usage data to improve our service</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search History</label>
                        <p className="text-sm text-gray-500">Save your search history to provide better suggestions</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Auto-delete Chats</label>
                      <select className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option>Never</option>
                        <option>After 30 days</option>
                        <option>After 7 days</option>
                        <option>After 24 hours</option>
                      </select>
                    </div>
                    
                    <button className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors">
                      Delete All My Data
                    </button>
                  </div>
                </div>
              )}
              
              {settingsCategory === "about" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800">About</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h4 className="font-medium text-gray-800 mb-2">App Version</h4>
                      <p className="text-gray-600">1.2.0 (Build 2024.03)</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h4 className="font-medium text-gray-800 mb-2">Terms of Service</h4>
                      <p className="text-gray-600">By using this application, you agree to our Terms of Service and Privacy Policy.</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <h4 className="font-medium text-gray-800 mb-2">Open Source Licenses</h4>
                      <p className="text-gray-600">This application uses several open source libraries. Click to view licenses.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                        Send Feedback
                      </button>
                      <button className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors">
                        Check for Updates
                    </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer with action buttons */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;