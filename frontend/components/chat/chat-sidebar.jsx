"use client";

import { useRouter } from "next/navigation";
import { createPortal } from 'react-dom';
import SettingsPanel from './settings-panel';
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAgents } from "../agents/AgentContext";
import { toast } from 'react-toastify'; 
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
  UserGroupIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

// Model icons mapping
import { DeepSeek, OpenAI, Gemini, Claude, Mistral } from '@lobehub/icons';

export default function UnifiedSidebar({
  isOpen,
  onToggle,
  onSelectChat,
  activeChatId,
  chats = [],
  onChatsUpdate,
  onDeleteChat,
  onNewChat,
  onAgentsButtonClick,
  onEditAgent,
  selectedAgent: externalSelectedAgent,
  onSelectAgent
}) {
  // Get agents from context
  const {
    agents,
    selectedAgent: contextSelectedAgent,
    setSelectedAgent,
    setEditingAgent,
    setIsCreatingAgent,
    deleteAgent: contextDeleteAgent,
    toggleAgentStatus: contextToggleAgentStatus
  } = useAgents();

  const [settingsInitialSection, setSettingsInitialSection] = useState("general");
  const [activeTab, setActiveTab] = useState("chats");
  const [isMobile, setIsMobile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);
  const [renamingChat, setRenamingChat] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRefs = useRef({});
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [dropdownOpenFor, setDropdownOpenFor] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingAgent, setPendingAgent] = useState(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const router = useRouter();
  const [activeBuiltInChats, setActiveBuiltInChats] = useState({});

  // Use selected agent from context or external prop
  const selectedAgent = contextSelectedAgent || externalSelectedAgent;

  // Model icons mapping
  const modelIcons = {
    "gemini-flashlite": <Gemini.Color size={16} />,
    "deepseek-chat": <DeepSeek.Color size={16} />,
    "claude-3 haiku": <Claude.Color size={16} />,
    "gpt5-nano": <OpenAI size={16} />,
    "gemini-2.5-flash-image": <Gemini.Color size={16} />,
    "mistral nemo": <Mistral.Color size={16} />,
  };

  // Model display names
  const modelDisplayNames = {
    "gemini-flashlite": "Gemini",
    "deepseek-chat": "DeepSeek",
    "claude-3 haiku": "Claude",
    "gpt5-nano": "GPT-5",
    "gemini-2.5-flash-image": "Gemini Vision",
    "mistral nemo": "Mistral",
  };

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

      if (dropdownOpenFor !== null) {
        const isThreeDotButton = event.target.closest('.agent-three-dot-button');
        const isDropdown = event.target.closest('.agent-dropdown-menu');
        if (!isThreeDotButton && !isDropdown) {
          setDropdownOpenFor(null);
        }
      }

      if (showProfileModal && modalRef.current && !modalRef.current.contains(event.target)) {
        setShowProfileModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenu, dropdownOpenFor, showProfileModal]);

  // Handle pending actions when dashboard opens
  useEffect(() => {
    if (activeTab === "agents" && pendingAction) {
      const timeoutId = setTimeout(() => {
        if (pendingAction === 'create') {
          setEditingAgent(null);
          setSelectedAgent(null);
          if (setIsCreatingAgent) {
            setIsCreatingAgent(true);
          }
        } else if (pendingAction === 'edit' && pendingAgent) {
          setEditingAgent(pendingAgent);
          setSelectedAgent(pendingAgent);
          if (setIsCreatingAgent) {
            setIsCreatingAgent(true);
          }
        }

        setPendingAction(null);
        setPendingAgent(null);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [activeTab, pendingAction, pendingAgent, setEditingAgent, setSelectedAgent, setIsCreatingAgent]);

  // Clear editingAgent when creating
  useEffect(() => {
    if (pendingAction === 'create') {
      setEditingAgent(null);
    }
  }, [pendingAction, setEditingAgent]);

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

  // Prevent body scroll when sidebar is open on mobile
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

  // Dropdown Portal Component
  const DropdownPortal = ({ children, isOpen }) => {
    if (!isOpen) return null;

    return createPortal(
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {children}
      </div>,
      document.body
    );
  };

  // Add new chat
  const addChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
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

  // Handle Create Custom Agent
  const handleCreateCustomAgent = () => {
    setEditingAgent(null);
    setPendingAction('create');
    setActiveTab("agents");

    if (onAgentsButtonClick) {
      onAgentsButtonClick(true);
    }

    if (isMobile) onToggle(false);
  };

  // Handle agent selection
  const handleSelectAgent = (agent) => {
  if (!agent.isBuiltIn && agent.status !== 'active') {
    toast.error(`❌ ${agent.name} is inactive. Please activate it first from the agent dashboard.`);
    return;
  }

    if (agent.isBuiltIn && activeBuiltInChats[agent.id]) {
      const existingChatId = activeBuiltInChats[agent.id];

      if (typeof window !== 'undefined') {
        const shouldSwitch = confirm(
          `${agent.name} already has an active chat. Would you like to switch to that chat?`
        );

        if (shouldSwitch && onSelectChat) {
          onSelectChat(existingChatId);
          if (isMobile) onToggle(false);
        }
      }
      return;
    }

    setPendingAction(null);
    setPendingAgent(null);
    setSelectedAgent(agent);
    setEditingAgent(null);

    if (onSelectAgent) {
      onSelectAgent(agent);
    }

    if (isMobile) onToggle(false);
  };

  // Handle three dot click for agent actions
  const handleThreeDotClick = (e, agentId) => {
    e.stopPropagation();

    const buttonRect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 80;

    let topPosition = buttonRect.bottom + 4;

    if (topPosition + dropdownHeight > viewportHeight - 20) {
      topPosition = buttonRect.top - dropdownHeight - 4;
    }

    setDropdownPosition({
      x: buttonRect.left,
      y: topPosition
    });

    const isOpening = dropdownOpenFor !== agentId;
    setDropdownOpenFor(isOpening ? agentId : null);
    setActiveMenu(isOpening ? agentId : null);
  };

  // Handle toggle agent status
  const handleToggleStatus = (agentId) => {
    contextToggleAgentStatus(agentId);
  };

  // Handle agent edit (from sidebar)
  const handleEditAgentClick = (agent, e) => {
  e.stopPropagation();
  
  if (agent.status === 'active') {
    toast.warning(`⚠️ "${agent.name}" is active. Please deactivate it first before editing.`);
    setDropdownOpenFor(null);
    setActiveMenu(null);
    return;
  }

    setDropdownOpenFor(null);
    setActiveMenu(null);
    setPendingAction('edit');
    setPendingAgent(agent);
    setActiveTab("agents");

    if (onAgentsButtonClick) {
      onAgentsButtonClick();
    }

    if (onEditAgent) {
      onEditAgent(agent);
    }

    if (isMobile) onToggle(false);
  };

  // Handle agent delete
  const handleDeleteAgent = (agentId) => {
    setDropdownOpenFor(null);
    setActiveMenu(null);
    contextDeleteAgent(agentId);

    if (selectedAgent?.id === agentId) {
      setSelectedAgent(null);
    }
  };

  const deleteChat = (chatId) => {
    if (onDeleteChat) {
      onDeleteChat(chatId);
    } else {
      const updatedChats = chats.filter(chat => chat.id !== chatId);
      if (onChatsUpdate) onChatsUpdate(updatedChats);

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

  // Filter chats based on search
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter agents based on search
  const filteredBuiltInAgents = agents.builtIn.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomAgents = agents.custom.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSettingsClick = () => {
    setShowProfileModal(false);
    setShowSettingsPanel(true);
  };

  const handleUpgradePlan = () => {
    setShowProfileModal(false);
    if (isMobile) onToggle(false);
    router.push('/pricing');
  };

  const handleHelp = () => {
    setShowProfileModal(false);
    setSettingsInitialSection("help");
    setShowSettingsPanel(true);
  };

  const handleLogout = () => {
    setShowProfileModal(false);
    console.log("Logout clicked");
  };

  const profileMenuItems = [
    {
      icon: Cog6ToothIcon,
      label: "Settings",
      action: () => {
        setShowProfileModal(false);
        setSettingsInitialSection("general");
        setShowSettingsPanel(true);
      },
      color: "text-gray-700"
    },
    {
      icon: SparklesIcon,
      label: "Upgrade Plan",
      action: () => {
        setShowProfileModal(false);
        if (isMobile) onToggle(false);
        router.push('/pricing');
      },
      color: "text-purple-600"
    },
    {
      icon: QuestionMarkCircleIcon,
      label: "Help & Support",
      action: () => {
        setShowProfileModal(false);
        setSettingsInitialSection("help");
        setShowSettingsPanel(true);
      },
      color: "text-gray-700"
    },
    {
      icon: ArrowRightStartOnRectangleIcon,
      label: "Logout",
      action: handleLogout,
      color: "text-red-600"
    },
  ];

  // Dropdown Menu Component
  const AgentDropdownMenu = ({ agent, onClose, onEdit, onDelete, onToggleStatus }) => {
    return (
      <div
        className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[10000] min-w-[140px] animate-in fade-in-0 zoom-in-95 pointer-events-auto agent-dropdown-menu"
        style={{
          left: `${dropdownPosition.x}px`,
          top: `${dropdownPosition.y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(agent.id);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 ${agent.status === 'active' ? 'text-orange-500' : 'text-green-500'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {agent.status === 'active' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            )}
          </svg>
          <span>{agent.status === 'active' ? 'Deactivate' : 'Activate'}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (agent.status === 'active') {
              toast.warning(`⚠️ "${agent.name}" is active. Please deactivate it first before editing.`);
              return;
            }
            onEdit(agent, e);
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${agent.status === 'active'
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-50'
            }`}
          disabled={agent.status === 'active'}
          title={agent.status === 'active' ? 'Deactivate agent first to edit' : 'Edit agent'}
        >
          <PencilSquareIcon className="w-3.5 h-3.5" />
          <span>Edit</span>
          {agent.status === 'active' && (
            <span className="text-[10px] text-orange-500 ml-auto">Deactivate first</span>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(agent.id);
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Icon Bar (Minimized State) */}
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
                if (onAgentsButtonClick) {
                  onAgentsButtonClick();
                }
              }}
              className="p-2 rounded-xl hover:bg-gray-50 transition-all"
              title="Agents"
            >
              <UserGroupIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="mt-auto pt-4">
            <button
              onClick={() => setShowSettingsPanel(true)}
              className="p-2 rounded-xl hover:bg-gray-50 transition-all"
              title="Settings"
            >
              <Cog6ToothIcon className="w-5 h-5 text-gray-600" />
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

      {/* Main Sidebar Content */}
      {isOpen && (
        <div className="bg-white h-[calc(100vh-6.7rem)] my-4 ml-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col w-72 z-30 relative">
          <div className="flex flex-col h-full p-4">
            {/* Header with search functionality */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 capitalize">
                {activeTab}
              </h3>
              <div className="flex items-center gap-2">
                {(activeTab === "chats" || activeTab === "agents") && (
                  <>
                    {showSearch ? (
                      <div className="flex items-center bg-gray-50 rounded-xl px-2 py-1.5 transition-all duration-200">
                        <input
                          type="text"
                          placeholder={`Search ${activeTab}...`}
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
                    if (tab === "agents" && onAgentsButtonClick) {
                      onAgentsButtonClick();
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-1 justify-center ${activeTab === tab
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  {tab === "chats" ? (
                    <ChatBubbleOvalLeftIcon className="w-4 h-4" />
                  ) : (
                    <UserGroupIcon className="w-4 h-4" />
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
                      : (searchQuery ? filteredChats : chats).map((chat) => {
                        const isAgentChat = chat.type === 'agent' || chat.agentId || chat.withAgent;

                        return (
                          <div
                            key={chat.id}
                            onClick={() => {
                              if (onSelectChat) onSelectChat(chat.id);
                              if (isMobile) onToggle(false);
                            }}
                            className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${chat.id === activeChatId
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
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => handleRenameKeyPress(e, chat.id)}
                                    onBlur={() => renameChat(chat.id, renameValue)}
                                    className="w-full bg-transparent outline-none text-gray-800 font-medium border-b border-purple-300 pb-1 text-sm"
                                  />
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <div className="font-medium text-gray-800 truncate text-sm">
                                        {chat.name}
                                      </div>
                                      {isAgentChat && (
  <span className="px-1.5 py-0.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
    <UserGroupIcon className="w-3 h-3" />
    <span>Agent</span>
    
    {/* 🟢 NEW: Show inactive badge if this agent chat belongs to a deactivated agent */}
    {(() => {
      // Find the agent for this chat
      const agent = agents?.custom?.find(a => a.id === chat.agentId) || 
                    agents?.builtIn?.find(a => a.id === chat.agentId);
      
      // If it's a custom agent and it's inactive, show badge
      if (agent && !agent.isBuiltIn && agent.status !== 'active') {
        return (
          <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded-full">
            Inactive
          </span>
        );
      }
      return null;
    })()}
  </span>
)}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(
                                      activeMenu === chat.id ? null : chat.id
                                    );
                                  }}
                                  className={`p-1 rounded-lg ${isMobile
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
                                    {/* Show Rename and Share ONLY for non-agent chats */}
                                    {!isAgentChat && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRenameStart(chat.id, chat.name);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <PencilSquareIcon className="w-4 h-4" />
                                          Rename
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            shareChat(chat.id);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <ShareIcon className="w-4 h-4" />
                                          Share
                                        </button>
                                      </>
                                    )}

                                    {/* Delete button shows for ALL chats */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChat(chat.id);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                      Delete Chat
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {searchQuery && filteredChats.length === 0 && !isLoading && (
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
                <div className="space-y-3">
                  {/* Create Agent Button - Compact */}
                  <button
                    onClick={handleCreateCustomAgent}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 text-purple-700 rounded-xl hover:from-purple-100 hover:to-indigo-100 transition-all duration-200 group shadow-sm"
                  >
                    <div className="p-1 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                      <PlusIcon className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="font-medium text-sm">Create Custom Agent</span>
                  </button>

                  {/* Built-in Agents - Compact */}
                  {(!searchQuery || filteredBuiltInAgents.length > 0) && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1 px-2">
                        <div className="flex items-center gap-1">
                          <LockClosedIcon className="w-3 h-3 text-gray-500" />
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Built-in
                          </span>
                        </div>
                        {!searchQuery && (
                          <span className="text-xs text-gray-500">
                            {agents.builtIn.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {(searchQuery ? filteredBuiltInAgents : agents.builtIn).map((agent) => {
                          const isSelected = selectedAgent?.id === agent.id;
                          const hasActiveChat = activeBuiltInChats[agent.id];

                          return (
                            <div
                              key={agent.id}
                              onClick={() => {
                                if (hasActiveChat) {
  toast.info(
    <div>
      <p className="mb-2 font-medium">{agent.name} already has an active chat.</p>
      <div className="flex gap-2 mt-2">
        <button 
          onClick={() => {
            onSelectChat(hasActiveChat);
            if (isMobile) onToggle(false);
            toast.dismiss();
          }}
          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
        >
          Switch to Chat
        </button>
        <button 
          onClick={() => toast.dismiss()}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>,
    {
      position: "top-center",
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      closeButton: false,
      icon: "💬"
    }
  );
  return;
}

                                handleSelectAgent(agent);
                              }}
                              className={`p-2 rounded-xl cursor-pointer transition-all duration-200 border relative ${isSelected
                                  ? "border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50"
                                  : hasActiveChat
                                    ? "border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50"
                                    : "border-none hover:border-purple-200 hover:bg-gray-50"
                                }`}
                            >
                              {/* Active chat indicator badge */}
                              {hasActiveChat && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                                  <ChatBubbleOvalLeftIcon className="w-3 h-3 text-white" />
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${isSelected
                                    ? "bg-gradient-to-br from-purple-200 to-blue-200"
                                    : hasActiveChat
                                      ? "bg-gradient-to-br from-blue-200 to-cyan-200"
                                      : "bg-gradient-to-br from-blue-100 to-blue-50"
                                  }`}>
                                  <span className="text-sm">
                                    {agent.icon || "🤖"}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <h4 className="font-medium text-gray-800 text-sm truncate">
                                        {agent.name}
                                      </h4>
                                      <LockClosedIcon className="w-3 h-3 text-gray-400" />
                                      {hasActiveChat && (
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                          Active Chat
                                        </span>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                                    )}
                                  </div>
                                  {/* Removed the model info section for built-in agents */}
                                  {/* You could optionally add a description or purpose here instead */}
                                  {agent.description && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                      {agent.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom Agents - Compact with Better Edit/Delete */}
                  {(!searchQuery || filteredCustomAgents.length > 0) && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-1 px-2">
                        <div className="flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3 text-purple-500" />
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Custom
                          </span>
                        </div>
                        {!searchQuery && (
                          <span className="text-xs text-gray-500">
                            {agents.custom.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {(searchQuery ? filteredCustomAgents : agents.custom).map((agent) => {
                          const isSelected = selectedAgent?.id === agent.id;
                          const modelIcon = modelIcons[agent.model] || modelIcons["gemini-flashlite"];
                          const modelName = modelDisplayNames[agent.model] || "Gemini";
                          const isActive = agent.status === 'active';

                          return (
                            <div
                              key={agent.id}
                              className={`group relative p-2 rounded-xl transition-all duration-200 border ${isSelected
                                  ? "border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50"
                                  : !isActive
                                    ? "border-gray-200 bg-gray-100"
                                    : "border-none hover:border-purple-200 hover:bg-gray-50"
                                } ${isActive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                            >
                              {/* Clickable area for selection */}
                              <div
                                onClick={() => {
                                  if (!isActive) {
                                    toast.error(`❌ ${agent.name} is inactive. Please activate it first.`);
                                    return;
                                  }
                                  handleSelectAgent(agent);
                                }}
                                className="flex items-center gap-2"
                              >
                                <div className={`p-1.5 rounded-lg ${isSelected
                                    ? "bg-gradient-to-br from-purple-200 to-pink-200"
                                    : !isActive
                                      ? "bg-gray-200"
                                      : "bg-gradient-to-br from-purple-100 to-pink-50"
                                  }`}>
                                  <UserGroupIcon className={`w-4 h-4 ${!isActive ? 'text-gray-500' : 'text-purple-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <h4 className={`font-medium text-sm truncate ${!isActive ? 'text-gray-500' : 'text-gray-800'
                                        }`}>
                                        {agent.name}
                                      </h4>
                                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                    </div>
                                    {isSelected && (
                                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <div className={`flex items-center gap-1 text-xs ${!isActive ? 'text-gray-500' : 'text-gray-600'
                                      }`}>
                                      {modelIcon}
                                      <span>{modelName}</span>
                                    </div>
                                    {isActive ? (
  <div className="w-2 h-2 rounded-full bg-green-500" title="Active" />
) : (
  <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded-full">
    Inactive
  </span>
)}
                                  </div>
                                </div>
                              </div>

                              {/* Action Menu for Custom Agents */}
                              {!agent.isBuiltIn && (
                                <div className="absolute right-1 top-1">
                                  <button
                                    onClick={(e) => handleThreeDotClick(e, agent.id)}
                                    className="p-1 rounded-md hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100 agent-three-dot-button"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5 text-gray-500"
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

                                  {dropdownOpenFor === agent.id && (
                                    <DropdownPortal isOpen={true}>
                                      <AgentDropdownMenu
                                        agent={agent}
                                        onClose={() => setDropdownOpenFor(null)}
                                        onEdit={handleEditAgentClick}
                                        onDelete={handleDeleteAgent}
                                        onToggleStatus={handleToggleStatus}
                                      />
                                    </DropdownPortal>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty States - Compact */}
                  {!searchQuery && agents.custom.length === 0 && agents.builtIn.length > 0 && (
                    <div className="text-center py-4 px-3 border border-dashed border-gray-300 rounded-xl bg-gradient-to-br from-gray-50/50 to-white">
                      <SparklesIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No custom agents yet</p>
                    </div>
                  )}

                  {!searchQuery && agents.custom.length === 0 && agents.builtIn.length === 0 && (
                    <div className="text-center py-4 px-3 border border-dashed border-gray-300 rounded-xl bg-gradient-to-br from-gray-50/50 to-white">
                      <UserGroupIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Create your first AI agent</p>
                    </div>
                  )}

                  {/* Search Empty State - Compact */}
                  {searchQuery && filteredBuiltInAgents.length === 0 && filteredCustomAgents.length === 0 && (
                    <div className="text-center py-4 px-3">
                      <svg
                        className="w-8 h-8 text-gray-300 mx-auto mb-2"
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
                      <p className="text-xs text-gray-500">No agents found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Section */}
            <div className="pt-3 border-t border-gray-200 mt-auto relative">
              <button
                onClick={() => setShowProfileModal((prev) => !prev)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-all duration-200 text-left ${showProfileModal
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <div
                  className={`p-1 rounded-lg ${showProfileModal ? "bg-white" : "bg-gray-100"
                    }`}
                >
                  <UserIcon
                    className={`w-4 h-4 ${showProfileModal ? "text-purple-600" : "text-gray-600"
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

              {/* Profile Menu Box */}
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
                          setShowProfileModal(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200 text-left"
                      >
                        <div
                          className={`p-1 rounded-lg ${item.color === "text-red-600"
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

      {/* Mobile Sidebar Overlay */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-transparent z-20 md:hidden"
          onClick={() => onToggle(false)}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => {
          setShowSettingsPanel(false);
          setSettingsInitialSection("general");
        }}
        initialSection={settingsInitialSection}
      />
    </>
  );
}