  "use client";

  import { useState, useEffect } from "react";
  import {
    PlusIcon,
    TrashIcon,
    ChatBubbleOvalLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserIcon,
  } from "@heroicons/react/24/outline";

  export default function ChatSidebar({ isOpen, onToggle }) {
    const [activeTab, setActiveTab] = useState("chats");
    const [chats, setChats] = useState(["New Chat 1", "New Chat 2"]);
    const [isMobile, setIsMobile] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const addChat = () => {
      const newChat = `New Chat ${chats.length + 1}`;
      setChats([...chats, newChat]);
      if (isMobile) onToggle(false);
    };

    const deleteChat = (index) => {
      setChats(chats.filter((_, i) => i !== index));
    };

    const filteredChats = chats.filter(chat => 
      chat.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <>
        {/* Icon Bar - only shown when sidebar is closed on desktop */}
        {!isOpen && !isMobile && (
          <div className="hidden sm:flex flex-col items-center bg-white rounded-xl shadow-sm p-2 w-14 border border-gray-200 fixed left-6 top-1/2 transform -translate-y-1/2 z-10">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={addChat}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="New Chat"
              >
                <PlusIcon className="w-5 h-5 text-gray-700" />
              </button>
              
              <button
                onClick={() => { setActiveTab("chats"); onToggle(true); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Chats"
              >
                <ChatBubbleOvalLeftIcon className="w-5 h-5 text-gray-700" />
              </button>

              <button
                onClick={() => { setActiveTab("agents"); onToggle(true); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Agents"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                </svg>
              </button>
            </div>

            {/* Profile Button at Bottom of Icon Bar */}
            <div className="mt-auto pt-4">
              <button
                onClick={() => { setActiveTab("profile"); onToggle(true); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Profile"
              >
                <UserIcon className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Collapse/Expand Button */}
            <button
              onClick={() => onToggle(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition w-full flex justify-center mt-3"
              title="Expand sidebar"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        )}
        
        {/* Main Sidebar Content - shown when open (drawer style) */}
        {isOpen && (
          <div className="bg-white h-[calc(100vh-8.7rem)] my-4 ml-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col w-72 z-30 relative">
            <div className="flex flex-col h-full p-4">
              {/* Header with search functionality */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800 capitalize">{activeTab}</h3>
                <div className="flex items-center gap-2">
                  {/* Search Icon/Input - Only shown for chats tab */}
                  {activeTab === "chats" && (
                    <>
                      {showSearch ? (
                        <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1">
                          <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent outline-none text-sm w-32"
                            autoFocus
                          />
                          <button 
                            onClick={() => {
                              setShowSearch(false);
                              setSearchQuery("");
                            }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSearch(true)}
                          className="p-1 rounded-lg hover:bg-gray-100 transition"
                          title="Search"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                  
                  {/* Close sidebar button */}
                  <button
                    onClick={() => onToggle(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 transition"
                  >
                    <ChevronLeftIcon className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-2 mb-4 border-b border-gray-200 pb-3">
                {/* Chats Tab */}
                <button
                  onClick={() => {
                    setActiveTab("chats");
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === "chats"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ChatBubbleOvalLeftIcon className="w-5 h-5" />
                  <span>Chats</span>
                </button>
                
                {/* Agents Tab */}
                <button
                  onClick={() => {
                    setActiveTab("agents");
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === "agents"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
                    />
                  </svg>
                  <span>Agents</span>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-grow overflow-y-auto">
                {activeTab === "chats" && (
                  <div className="space-y-2">
                    <button
                      onClick={addChat}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <PlusIcon className="w-5 h-5" />
                      <span>New Chat</span>
                    </button>
                    
                    {/* Search results or all chats */}
                    <div className="space-y-1 mt-4">
                      {(searchQuery ? filteredChats : chats).map((chat, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-gray-700 truncate">{chat}</span>
                          <button
                            onClick={() => deleteChat(index)}
                            className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      ))}
                      
                      {/* No results message */}
                      {searchQuery && filteredChats.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No chats found matching "{searchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === "agents" && (
                  <div className="text-center py-8 text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-12 h-12 mx-auto mb-3 text-gray-400"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
                      />
                    </svg>
                    <p>No agents yet</p>
                  </div>
                )}
                
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center py-4">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                        <UserIcon className="w-8 h-8 text-purple-600" />
                      </div>
                      <h4 className="font-medium text-gray-800">User Profile</h4>
                      <p className="text-sm text-gray-500">user@example.com</p>
                    </div>
                    <div className="space-y-2">
                      <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors">
                        Account Settings
                      </button>
                      <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors">
                        Preferences
                      </button>
                      <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors text-red-600">
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile button pinned at bottom */}
              <div className="pt-4 border-t border-gray-200 mt-auto">
                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                    activeTab === "profile"
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <UserIcon className="w-5 h-5" />
                  <span>Profile</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {isOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-transparent z-20"
            onClick={() => onToggle(false)}
          />
        )}
      </>
    );
  }