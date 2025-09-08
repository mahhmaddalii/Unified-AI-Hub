"use client";

import { useState, useEffect } from "react";
import ChatSidebar from "../../components/ui/chat-sidebar";
import ChatWindow from "../../components/ui/chat-window";
import Navbar from "../../components/ui/chat-navbar";

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const startNewChat = () => {
    console.log("Starting new chat");
    // Add your new chat logic here
  };

  const handleToggleSidebar = (open) => {
    setIsSidebarOpen(open);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="flex flex-col h-screen">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => handleToggleSidebar(!isSidebarOpen)}
          hasUserSentPrompt={hasPrompt}
          onNewChat={startNewChat}
        />

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className={`
            ${isSidebarOpen ? 'block' : 'hidden'} 
            sm:block 
            transition-all duration-300
            h-full
          `}>
            <ChatSidebar 
              isOpen={isSidebarOpen}
              onToggle={handleToggleSidebar}
            />
          </div>

          {/* Chat Window Container - UPDATED WITH MARGIN */}
          <div className={`
            flex-1
            transition-all duration-300 
            p-4 md:p-5
            ${isSidebarOpen && isMobile ? 'opacity-30' : 'opacity-100'}
            h-full
            w-full
            ${!isSidebarOpen && !isMobile ? 'md:ml-20' : 'md:ml-0'}
          `}>
            <div className="bg-white rounded-xl md:rounded-3xl shadow-md md:shadow-xl p-4 md:p-6 w-full h-full flex flex-col">
              <ChatWindow 
                onFirstMessage={() => setHasPrompt(true)}
                isSidebarOpen={isSidebarOpen}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}