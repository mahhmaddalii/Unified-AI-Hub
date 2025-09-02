"use client";

import Image from "next/image";
import { ChevronRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar({ 
  hasUserSentPrompt, 
  onNewChat,
  isSidebarOpen,
  onToggleSidebar
}) {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleUpgradeClick = () => {
    router.push("/pricing");
  };

  return (
    <div className="w-full px-4 sm:px-6 py-4">
      <div className="flex justify-center">
        <div className="bg-white shadow-xl w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-7xl border-x border-b border-gray-200 rounded-b-3xl">
          <div className="flex items-center justify-between py-3 px-4 sm:px-6 relative">
            
            {/* Left Section with Logo + Toggle Button */}
            <div className="flex items-center gap-3">
              {/* Toggle Button - Only visible on mobile */}
              <div className="md:hidden">
                <button
                  onClick={onToggleSidebar}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <ChevronRightIcon
                    className={`w-5 h-5 text-gray-700 transition-all duration-300 ${
                      isSidebarOpen ? "transform rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Logo */}
              <Image
                src="/logo.png"
                alt="Logo"
                width={100}
                height={100}
                className="w-12 h-12 object-contain"
                priority
              />
            </div>

            {/* Centered Title */}
            <h1
              className={`text-lg font-semibold text-gray-900 mx-auto md:mx-0 md:absolute md:left-1/2 md:-translate-x-1/2 ${
                !isMobile ? "block" : isSidebarOpen ? "block" : "hidden"
              }`}
            >
              Unified AI Hub
            </h1>

            {/* Right Actions */}
            <div className="flex items-center gap-3 ml-auto">
              {hasUserSentPrompt && isMobile && (
                <button
                  onClick={onNewChat}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  <PlusIcon className="w-5 h-5 text-gray-700" />
                </button>
              )}
              <button 
                onClick={handleUpgradeClick}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-sm font-medium transition-colors"
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}