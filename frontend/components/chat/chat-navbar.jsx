"use client";

import Image from "next/image";
import { ChevronRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar({ 
  hasUserSentPrompt, 
  onNewChat,
  isSidebarOpen,
  onToggleSidebar
}) {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

  // Check if current page is home or pricing
  const isHomeOrPricing = pathname === "/" || pathname === "/pricing";

  return (
    <div className={`w-full px-4 sm:px-6 py-1 ${isHomeOrPricing ? "" : "bg-white"}`}>
      <div className="flex justify-center">
        <div className={`w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-7xl ${
          isHomeOrPricing 
            ? "bg-white shadow-xl border-x border-b border-gray-200 rounded-b-3xl" 
            : "bg-white"
        }`}>
          <div className="flex items-center justify-between py-3 px-4 sm:px-6 relative">
            
            {/* Left Section with Logo + Toggle Button */}
            <div className="flex items-center gap-2">
              {/* Toggle Button - Only visible on mobile AND not on home/pricing pages */}
              {!isHomeOrPricing && (
                <div className="md:hidden">
                  <button
                    onClick={onToggleSidebar}
                    className="p-1 rounded-lg hover:bg-gray-100 transition"
                  >
                    <ChevronRightIcon
                      className={`w-5 h-5 text-gray-700 transition-all duration-300 ${
                        isSidebarOpen ? "transform rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Logo */}
              <Image
                src="/logo.png"
                alt="Logo"
                width={100}
                height={100}
                className="w-10 h-10 object-contain"
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