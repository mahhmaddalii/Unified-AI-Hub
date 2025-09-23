  "use client";

  import { useState, useEffect } from "react";
  import {
    PlusIcon,
    TrashIcon,
    ChatBubbleOvalLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UserIcon,
    Cog6ToothIcon,
  } from "@heroicons/react/24/outline";
  import SettingsPanel from "./settings-panel";

  export default function ChatSidebar({ isOpen, onToggle }) {
    const [activeTab, setActiveTab] = useState("chats");
    const [chats, setChats] = useState(["New Chat 1", "New Chat 2"]);
    const [isMobile, setIsMobile] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsCategory, setSettingsCategory] = useState("general");
    const [isLoading, setIsLoading] = useState(true); // Set to true initially for first load
    const [loadingChats, setLoadingChats] = useState(false);

    // Simulate initial loading
    useEffect(() => {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000); // Simulate 1 second initial load
      return () => clearTimeout(timer);
    }, []);

    const addChat = async () => {
      setLoadingChats(true);
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newChat = `New Chat ${chats.length + 1}`;
      setChats([...chats, newChat]);
      setLoadingChats(false);

      if (isMobile) onToggle(false);
    };

    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    const deleteChat = async (index) => {
      setLoadingChats(true);
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      setChats(chats.filter((_, i) => i !== index));
      setLoadingChats(false);
    };

    const filteredChats = chats.filter((chat) =>
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
                onClick={() => {
                  setActiveTab("chats");
                  onToggle(true);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Chats"
              >
                <ChatBubbleOvalLeftIcon className="w-5 h-5 text-gray-700" />
              </button>

              <button
                onClick={() => {
                  setActiveTab("agents");
                  onToggle(true);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Agents"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-gray-700"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"
                  />
                </svg>
              </button>
            </div>

            {/* Profile Button at Bottom of Icon Bar */}
            <div className="mt-auto pt-4">
              <button
                onClick={() => {
                  setActiveTab("profile");
                  onToggle(true);
                }}
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
        {/* Always show the New Chat button, only disable it during loading */}
        <button
          onClick={addChat}
          disabled={isLoading}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-5 h-5" />
          <span>New Chat</span>
        </button>
        
        {/* Search results or all chats */}
        <div className="space-y-1 mt-4">
          {isLoading ? (
            // Show skeleton loaders only during initial loading
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </div>
            ))
          ) : (
            // Show actual chats when not loading
            (searchQuery ? filteredChats : chats).map((chat, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <span className="text-gray-700 truncate">{chat}</span>
                <button
                  onClick={() => deleteChat(index)}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all duration-200"
                  disabled={isLoading}
                >
                  <TrashIcon className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))
          )}
          
          {/* No results message */}
          {searchQuery && filteredChats.length === 0 && !isLoading && (
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
                      <button 
                        onClick={() => setShowSettings(true)}
                        className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3"
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                        <span>Settings</span>
                      </button>
                      <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <span>Account Settings</span>
                      </button>
                      <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d={`M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.280c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z`}
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
    <span>Preferences</span>
  </button>
  <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors text-red-600 flex items-center gap-3">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
    <span>Logout</span>
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

  {/* Settings Panel */}
  {showSettings && (
    <SettingsPanel 
      isOpen={showSettings}
      onClose={() => setShowSettings(false)}
      settingsCategory={settingsCategory}
      setSettingsCategory={setSettingsCategory}
    />
  )}
  </>
  );
  }