"use client";

import { useState } from "react";
import ChatSidebar from "../../components/ui/chat-sidebar";
import ChatWindow from "../../components/ui/chat-window";
import Navbar from "../../components/ui/chat-navbar";

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);

  const startNewChat = () => {
    console.log("Starting new chat");
    // Add your new chat logic here
  };

  const handleToggleSidebar = (open) => {
    setIsSidebarOpen(open);
  };

  return (
    <main className="min-h-screen bg-[#ffffff]">
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

          {/* Chat Window Container with proper spacing */}
          <div className={`
            flex-1
            transition-all duration-300 
            p-4
            ${isSidebarOpen ? 'sm:ml-0' : 'sm:ml-20'}
            h-full
          `}>
            <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 w-full h-full flex flex-col">
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