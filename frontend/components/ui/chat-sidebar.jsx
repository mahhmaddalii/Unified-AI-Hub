"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import {
  PlusIcon,
  ChatBubbleOvalLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  ShareIcon,
  TrashIcon,
  ArrowRightStartOnRectangleIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import SettingsPanel from "./settings-panel";

export default function ChatSidebar({ isOpen, onToggle, onSelectChat, activeChatId, chats = [], onChatsUpdate, onDeleteChat, onNewChat}) {
  const [activeTab, setActiveTab] = useState("chats");
  
  const [isMobile, setIsMobile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState("general");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);
  const [renamingChat, setRenamingChat] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRefs = useRef({});
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // User profile data
  const [userProfile, setUserProfile] = useState({
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    plan: "Pro",
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeMenu !== null && menuRefs.current[activeMenu] &&
        !menuRefs.current[activeMenu].contains(event.target)) {
        setActiveMenu(null);
      }

      // Close profile modal when clicking outside
      if (showProfileModal && modalRef.current && !modalRef.current.contains(event.target)) {
        setShowProfileModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenu, showProfileModal]);

  // Focus input when renaming
  useEffect(() => {
    if (renamingChat !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingChat]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when sidebar is open on mobile (EXACTLY like original)
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isMobile]);

  // In ChatSidebar component, update the addChat function:
const addChat = () => {
  if (onNewChat) {
    // Use the new prepareNewChat function
    onNewChat();
  } else {
    // Fallback to original behavior
    const newChat = {
      id: uuidv4(),
      name: `New Chat ${chats.length + 1}`,
      lastActive: "Just now"
    };
    
    const updatedChats = [newChat, ...chats];
    if (onChatsUpdate) onChatsUpdate(updatedChats);
  }

  if (isMobile) onToggle(false);
};

  const deleteChat = (chatId) => {
  // Use the callback for chat deletion
  if (onDeleteChat) {
    onDeleteChat(chatId);
  } else {
    // Fallback to original behavior if no callback provided
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    if (onChatsUpdate) onChatsUpdate(updatedChats);
    
    // Clear active chat if we're deleting it
    if (chatId === activeChatId && onSelectChat) {
      onSelectChat(null);
    }
  }
  
  setActiveMenu(null);
};

  const renameChat = (chatId, newName) => {
    if (newName.trim()) {
      const updatedChats = chats.map(chat =>
        chat.id === chatId ? { ...chat, name: newName.trim() } : chat
      );
      if (onChatsUpdate) onChatsUpdate(updatedChats);
    }
    setRenamingChat(null);
    setActiveMenu(null);
    setRenameValue("");
  };

  const shareChat = (chatId) => {
    const chat = chats.find(c => c.id === chatId);
    if (navigator.share) {
      navigator.share({
        title: `Chat: ${chat.name}`,
        text: `Check out this chat: ${chat.name}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      console.log("Chat link copied to clipboard!");
    }
    setActiveMenu(null);
  };

  const handleRenameStart = (chatId, currentName) => {
    setRenamingChat(chatId);
    setRenameValue(currentName);
    setActiveMenu(null);
  };

  const handleRenameKeyPress = (e, chatId) => {
    if (e.key === "Enter") {
      renameChat(chatId, renameValue);
    } else if (e.key === "Escape") {
      setRenamingChat(null);
      setRenameValue("");
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSettingsClick = () => {
    setShowProfileModal(false);
    setShowSettings(true);
  };

  const handleUpgradePlan = () => {
    setShowProfileModal(false);
    console.log("Upgrade plan clicked");
  };

  const handleHelp = () => {
    setShowProfileModal(false);
    console.log("Help clicked");
  };

  const handleLogout = () => {
    setShowProfileModal(false);
    console.log("Logout clicked");
  };

  const profileMenuItems = [
    {
      icon: Cog6ToothIcon,
      label: "Settings",
      action: handleSettingsClick,
      color: "text-gray-700"
    },
    {
      icon: SparklesIcon,
      label: "Upgrade Plan",
      action: handleUpgradePlan,
      color: "text-purple-600"
    },
    {
      icon: QuestionMarkCircleIcon,
      label: "Help & Support",
      action: handleHelp,
      color: "text-gray-700"
    },
    {
      icon: ArrowRightStartOnRectangleIcon,
      label: "Logout",
      action: handleLogout,
      color: "text-red-600"
    },
  ];

  return (
    <>
      {/* Icon Bar - EXACTLY like original behavior: only shown when sidebar is closed on desktop */}
      {!isOpen && !isMobile && (
        <div className="hidden sm:flex flex-col items-center bg-white rounded-2xl shadow-lg p-3 w-16 border border-gray-100 fixed left-6 top-1/2 transform -translate-y-1/2 z-30">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={addChat}
              className="p-2 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-all shadow-sm"
              title="New Chat"
            >
              <PlusIcon className="w-5 h-5 text-purple-600" />
            </button>

            <button
              onClick={() => {
                setActiveTab("chats");
                onToggle(true);
              }}
              className="p-2 rounded-xl hover:bg-gray-50 transition-all"
              title="Chats"
            >
              <ChatBubbleOvalLeftIcon className="w-5 h-5 text-gray-600" />
            </button>

            <button
              onClick={() => {
                setActiveTab("agents");
                onToggle(true);
              }}
              className="p-2 rounded-xl hover:bg-gray-50 transition-all"
              title="Agents"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

          <div className="mt-auto pt-4">
            <button
              onClick={() => {
                setActiveTab("profile");
                onToggle(true);
              }}
              className="p-2 rounded-xl hover:bg-gray-50 transition-all"
              title="Profile"
            >
              <UserIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => onToggle(true)}
            className="p-2 rounded-xl hover:bg-gray-50 transition-all w-full flex justify-center mt-3"
            title="Expand sidebar"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Main Sidebar Content - shown when open (drawer style) - ADJUSTED PADDING */}
      {isOpen && (
        <div className="bg-white h-[calc(100vh-6.7rem)] my-4 ml-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col w-72 z-30 relative">
          <div className="flex flex-col h-full p-4">
            {/* Header with search functionality */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 capitalize">
                {activeTab}
              </h3>
              <div className="flex items-center gap-2">
                {activeTab === "chats" && (
                  <>
                    {showSearch ? (
                      <div className="flex items-center bg-gray-50 rounded-xl px-2 py-1.5 transition-all duration-200">
                        <input
                          type="text"
                          placeholder="Search chats..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-transparent outline-none text-sm w-32 placeholder-gray-400"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            setShowSearch(false);
                            setSearchQuery("");
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSearch(true)}
                        className="p-1.5 rounded-xl hover:bg-gray-50 transition-all"
                        title="Search"
                      >
                        <svg
                          className="w-5 h-5 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                          />
                        </svg>
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => onToggle(false)}
                  className="p-1.5 rounded-xl hover:bg-gray-50 transition-all"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-3 p-1 bg-gray-50 rounded-xl">
              {["chats", "agents"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-1 justify-center ${
                    activeTab === tab
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "chats" ? (
                    <ChatBubbleOvalLeftIcon className="w-4 h-4" />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto">
              {activeTab === "chats" && (
                <div className="space-y-1.5">
                  <button
                    onClick={addChat}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 text-purple-700 rounded-xl hover:from-purple-100 hover:to-blue-100 transition-all duration-200 group shadow-sm"
                  >
                    <div className="p-1 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                      <PlusIcon className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="font-medium text-sm">New Chat</span>
                  </button>

                  <div className="space-y-1 mt-3">
                    {isLoading
                      ? Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded-xl animate-pulse bg-gray-50"
                          >
                            <div className="space-y-1.5">
                              <div className="h-3.5 bg-gray-200 rounded w-32"></div>
                              <div className="h-2.5 bg-gray-200 rounded w-20"></div>
                            </div>
                            <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
                          </div>
                        ))
                      : (searchQuery ? filteredChats : chats).map((chat) => (
                          <div
                            key={chat.id}
                            onClick={() => {
                              if (onSelectChat) onSelectChat(chat.id);
                              if (isMobile) onToggle(false);
                            }}
                            className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                              chat.id === activeChatId
                                ? "bg-purple-100 border border-purple-200"
                                : "hover:bg-gray-50 border border-transparent hover:border-gray-100"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                {renamingChat === chat.id ? (
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) =>
                                      setRenameValue(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      handleRenameKeyPress(e, chat.id)
                                    }
                                    onBlur={() =>
                                      renameChat(chat.id, renameValue)
                                    }
                                    className="w-full bg-transparent outline-none text-gray-800 font-medium border-b border-purple-300 pb-1 text-sm"
                                  />
                                ) : (
                                  <>
                                    <div className="font-medium text-gray-800 truncate text-sm">
                                      {chat.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {chat.lastActive}
                                    </div>
                                  </>
                                )}
                              </div>

                              <div
                                className="relative"
                                ref={(el) => (menuRefs.current[chat.id] = el)}
                              >
                                <button
                                  onClick={() =>
                                    setActiveMenu(
                                      activeMenu === chat.id ? null : chat.id
                                    )
                                  }
                                  className={`p-1 rounded-lg ${
                                    isMobile
                                      ? "opacity-100"
                                      : "opacity-0 group-hover:opacity-100"
                                  } hover:bg-gray-200 transition-all duration-200 ml-1`}
                                >
                                  <svg
                                    className="w-4 h-4 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                                    />
                                  </svg>
                                </button>

                                {activeMenu === chat.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[140px] animate-in fade-in-0 zoom-in-95">
                                    <button
                                      onClick={() =>
                                        handleRenameStart(chat.id, chat.name)
                                      }
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <PencilSquareIcon className="w-4 h-4" />
                                      Rename
                                    </button>
                                    <button
                                      onClick={() => shareChat(chat.id)}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <ShareIcon className="w-4 h-4" />
                                      Share
                                    </button>
                                    <button
                                      onClick={() => deleteChat(chat.id)}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                    {searchQuery &&
                      filteredChats.length === 0 &&
                      !isLoading && (
                        <div className="text-center py-4 text-gray-400">
                          <svg
                            className="w-10 h-10 mx-auto mb-2 opacity-50"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                            />
                          </svg>
                          <p className="text-sm">
                            No chats found matching "{searchQuery}"
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {activeTab === "agents" && (
                <div className="text-center py-8 text-gray-400">
                  <svg
                    className="w-14 h-14 mx-auto mb-3 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm">No agents configured yet</p>
                  <button className="mt-2 px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 transition-colors">
                    Create your first agent
                  </button>
                </div>
              )}
            </div>

            {/* Profile Section */}
            <div className="pt-3 border-t border-gray-200 mt-auto relative">
              <button
                onClick={() => setShowProfileModal((prev) => !prev)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-all duration-200 text-left ${
                  showProfileModal
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`p-1 rounded-lg ${
                    showProfileModal ? "bg-white" : "bg-gray-100"
                  }`}
                >
                  <UserIcon
                    className={`w-4 h-4 ${
                      showProfileModal ? "text-purple-600" : "text-gray-600"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm truncate">
                    {userProfile.name}
                  </div>
                  <div className="text-gray-500 text-xs truncate">
                    {userProfile.email}
                  </div>
                </div>
              </button>

              {/* Profile Menu Box - Positioned absolutely above the button */}
              {showProfileModal && (
                <div
                  ref={modalRef}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 animate-in fade-in-0 zoom-in-95"
                >
                  <div className="p-1.5">
                    {profileMenuItems.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          item.action();
                          setShowProfileModal(false); // Close menu when an item is clicked
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200 text-left"
                      >
                        <div
                          className={`p-1 rounded-lg ${
                            item.color === "text-red-600"
                              ? "bg-red-50"
                              : item.color === "text-purple-600"
                              ? "bg-purple-50"
                              : "bg-gray-100"
                          }`}
                        >
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                        </div>
                        <span className={`font-medium text-sm ${item.color}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay - CORRECTLY PLACED outside main sidebar */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-transparent z-20 md:hidden"
          onClick={() => onToggle(false)}
        />
      )}

      {/* Settings Panel - CORRECTLY PLACED outside main sidebar */}
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