"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ChatSidebar from "../../components/chat/chat-sidebar";
import ChatWindow from "../../components/chat/chat-window";
import Navbar from "../../components/chat/chat-navbar";
import AgentDashboard from "../../components/agents/adashboard";
import { AgentProvider, useAgents } from "../../components/agents/AgentContext";
import { ToastContainer } from 'react-toastify';
import { toastContainerProps, toastStyles, showToast } from '../../utils/toast';
import { AuthProvider, useAuth } from "../../components/auth/auth-context";
import { API_URL, fetchWithAuth } from "../../utils/auth";
import {
  areAgentsLockedForBilling,
  areCustomAgentsLockedForBilling,
  hasTokenLimitReached,
  TOKEN_LIMIT_REACHED_MESSAGE,
} from "../../utils/plan-access";

const API_BASE_URL = API_URL;

// Inner component that uses AgentContext
function ChatPageContent() {
  const router = useRouter();
  const { user, loading: userLoading, refreshBilling } = useAuth();
  const billing = user?.billing || null;
  const agentsLocked = !userLoading && areAgentsLockedForBilling(billing);

  // ========== GET AGENT STATE FROM CONTEXT ONLY ==========
  const {
    selectedAgent: contextSelectedAgent,
    setSelectedAgent: contextSetSelectedAgent,
    setEditingAgent: contextSetEditingAgent,
    setIsCreatingAgent: contextSetIsCreatingAgent,
    ensureCustomAgentUsesBackendId,
    allAgents  // ← ADD THIS LINE
  } = useAgents();

  // ========== CHAT-RELATED STATE ONLY ==========
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [chatMessages, setChatMessages] = useState({});
  const [loadingChats, setLoadingChats] = useState(new Set());
  const [showAgentDashboard, setShowAgentDashboard] = useState(false);

  const latestActiveChatId = useRef(null);
  const pendingAIMessages = useRef(new Map());
  const agentChatIdsRef = useRef(new Map());
  const pendingAgentSelectionRef = useRef(null);

  const loadPersistedChats = useCallback(async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/chat/conversations/`, {
      method: "GET",
    });
    if (!response.ok) {
      return;
    }

    const data = await response.json().catch(() => null);
    const persistedChats = [];
    const nextMessages = {};
    agentChatIdsRef.current = new Map();

    for (const conversation of data?.conversations || []) {
      persistedChats.push({
        id: conversation.id,
        name: conversation.name,
        lastActive: conversation.lastActive,
        agentId: conversation.agentId || null,
      });
      nextMessages[conversation.id] = conversation.messages || [];
      if (conversation.agentId) {
        agentChatIdsRef.current.set(conversation.agentId, conversation.id);
      }
    }

    setChats(persistedChats);
    setChatMessages(nextMessages);
  }, []);

  useEffect(() => {
    // Inject custom toast styles
    const style = document.createElement('style');
    style.textContent = toastStyles;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    if (userLoading || !user) return;
    loadPersistedChats();
  }, [loadPersistedChats, user, userLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const gmailConnected = params.get("gmail_connected");
    const gmailMessage = params.get("gmail_message");

    if (!gmailConnected) return;

    if (gmailConnected === "true") {
      showToast.success(gmailMessage || "Gmail connected successfully.");
    } else {
      showToast.error(gmailMessage || "Failed to connect Gmail.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    latestActiveChatId.current = activeChatId;
  }, [activeChatId]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 🟢 CRITICAL FIX: Sync selectedAgent when activeChatId changes to an agent chat
  useEffect(() => {
    if (activeChatId) {
      const activeChat = chats.find(chat => chat.id === activeChatId);

      if (pendingAgentSelectionRef.current) {
        if (activeChat?.agentId === pendingAgentSelectionRef.current) {
          pendingAgentSelectionRef.current = null;
        } else {
          return;
        }
      }

      if (activeChat?.agentId) {
        const agent = allAgents.find(a => a.id === activeChat.agentId);
        // Only set if it's a different agent or not set at all
        if (agent && (!contextSelectedAgent || contextSelectedAgent.id !== agent.id)) {
          console.log("🔄 Syncing agent for chat:", activeChatId, "agent:", agent.name);
          contextSetSelectedAgent(agent);
        }
      }
    }
  }, [activeChatId, chats, allAgents, contextSelectedAgent, contextSetSelectedAgent]);

  // ========== CHAT HANDLERS ==========

  const handleDeleteChat = useCallback(async (chatId) => {
    const deletedChat = chats.find((chat) => chat.id === chatId);
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/chat/conversations/${chatId}/`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }

    if (chatId === activeChatId) {
      setActiveChatId(null);
      latestActiveChatId.current = null;
      setHasPrompt(false);
      contextSetSelectedAgent(null); // Use context setter
    }

    setLoadingChats(prev => {
      const newSet = new Set(prev);
      newSet.delete(chatId);
      return newSet;
    });

    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);

    setChatMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[chatId];
      return newMessages;
    });
    if (deletedChat?.agentId) {
      agentChatIdsRef.current.delete(deletedChat.agentId);
    }
  }, [activeChatId, chats, contextSetSelectedAgent]);

  const setChatLoading = useCallback((chatId, isLoading) => {
    setLoadingChats(prev => {
      const newSet = new Set(prev);
      if (isLoading) {
        newSet.add(chatId);
      } else {
        newSet.delete(chatId);
      }
      return newSet;
    });
  }, []);

  const isChatLoading = useCallback((chatId) => {
    return loadingChats.has(chatId);
  }, [loadingChats]);

  const addMessageToChat = useCallback((chatId, message) => {
    setChatMessages(prev => {
      const current = prev[chatId] || [];

      // Prefer realAssistantId if present (from background), else fall back to id
      const targetId = message.realAssistantId || message.id;

      const existingIndex = current.findIndex(m => (m.realAssistantId || m.id) === targetId);

      if (existingIndex !== -1) {
        const existing = current[existingIndex];

        // Skip if completely identical (prevents unnecessary re-renders)
        if (existing.text === message.text && existing.image === message.image) {
          return prev;
        }

        // Merge update into existing message
        const updated = [...current];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...message,
          id: targetId,              // ensure final ID is consistent
          realAssistantId: undefined // clean up temp field
        };
        return { ...prev, [chatId]: updated };
      }

      // New message (use real ID if provided)
      const finalMessage = {
        ...message,
        id: targetId,
        realAssistantId: undefined // clean up
      };
      return { ...prev, [chatId]: [...current, finalMessage] };
    });
  }, []);

  // ────────────────────────────────────────────────
  // NEW: Stable chat for agents
  // ────────────────────────────────────────────────
  const createBackendChat = useCallback(async (payload = {}) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/chat/create/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to create chat: ${response.status}`);
    }

    const data = await response.json();
    return data.chat_id;
  }, []);

  const fetchOrCreateAgentChatId = useCallback(async (agentId) => {
    const cachedChatId = agentChatIdsRef.current.get(agentId);
    if (cachedChatId && chats.some((chat) => chat.id === cachedChatId)) {
      return { chatId: cachedChatId, isNew: false };
    }
    if (cachedChatId) {
      agentChatIdsRef.current.delete(agentId);
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/custom_agents/get-or-create-chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ agent_id: agentId })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 403) {
        await refreshBilling();
      }
      throw new Error(data?.error || `Failed to create custom agent chat: ${response.status}`);
    }
    agentChatIdsRef.current.set(agentId, data.chat_id);
    return {
      chatId: data.chat_id,
      isNew: data.is_new
    };
  }, [chats, refreshBilling]);

  const getOrCreateAgentChat = useCallback(async (agent) => {
    if (!agent) return null;

    if (!agent.isBuiltIn && agent.status !== 'active') {
      showToast.warning(`${agent.name} is deactivated. Please activate it first.`);
      return null;
    }

    if (!agent.isBuiltIn && areCustomAgentsLockedForBilling(billing)) {
      const message = billing?.isPaid
        ? TOKEN_LIMIT_REACHED_MESSAGE
        : "Custom agents are available on Pro. Upgrade to continue.";
      if (billing?.isPaid) {
        await refreshBilling();
        showToast.info(message);
      } else {
        showToast.info(message);
        router.push("/pricing");
      }
      return null;
    }

    if (agent.id === "builtin-comsats" && hasTokenLimitReached(billing)) {
      await refreshBilling();
      showToast.info(TOKEN_LIMIT_REACHED_MESSAGE);
      return null;
    }

    const existingChat = chats.find(chat => chat.agentId === agent.id);
    if (existingChat) {
      agentChatIdsRef.current.set(agent.id, existingChat.id);
      return existingChat;
    }

    let chatId;
    let isNew = false;

    if (agent.isBuiltIn) {
      chatId = agentChatIdsRef.current.get(agent.id);
      if (chatId && !chats.some((chat) => chat.id === chatId)) {
        agentChatIdsRef.current.delete(agent.id);
        chatId = null;
      }
      if (!chatId) {
        chatId = await createBackendChat({
          agent_id: agent.id,
          conversation_type: "domain_agent",
          title: agent.name,
        });
        agentChatIdsRef.current.set(agent.id, chatId);
        isNew = true;
      }
    } else {
      const result = await fetchOrCreateAgentChatId(agent.id);
      chatId = result.chatId;
      isNew = result.isNew;
    }

    const newChat = {
      id: chatId,
      name: agent.name,
      lastActive: "Just now",
      agentId: agent.id
    };

    setChats(prev => (
      prev.some(chat => chat.id === chatId)
        ? prev
        : [newChat, ...prev]
    ));
    setChatMessages(prev => (
      prev[chatId]
        ? prev
        : {
            ...prev,
            [chatId]: []
          }
    ));

    if (isNew) {
      showToast.success(`Started new chat with ${agent.name}`);
    }

    return newChat;
  }, [billing, chats, createBackendChat, fetchOrCreateAgentChatId, refreshBilling, router]);

  const createNewChat = useCallback(async (firstMessage, agentId = null) => {
    const newChatId = await createBackendChat();
    const agent = agentId ? contextSelectedAgent : null;
    const chatName = agent
      ? agent.name
      : "New Chat";

    const newChat = {
      id: newChatId,
      name: chatName,
      lastActive: "Just now",
      agentId: agentId
    };

    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    latestActiveChatId.current = newChatId;
    setHasPrompt(true);
    setShowAgentDashboard(false);

    setChatMessages(prev => ({
      ...prev,
      [newChatId]: [firstMessage]
    }));

    return newChatId;
  }, [contextSelectedAgent, createBackendChat]);

  const handleSelectChat = useCallback((chatId) => {
    pendingAgentSelectionRef.current = null;
    const selectedChat = chats.find(chat => chat.id === chatId);

    // Handle agent selection based on chat type
    if (selectedChat?.agentId) {
      // This is an agent chat - find and select the agent
      const agent = allAgents.find(a => a.id === selectedChat.agentId);

      if (agent) {
        // Check if agent is active (skip check for built-in agents)
        if (!agent.isBuiltIn && agent.status !== 'active') {
          // Agent is deactivated - show warning and don't select the chat
          showToast.error(`${agent.name} is deactivated. Please activate it first to continue this chat.`);
          return; // Don't proceed with chat selection
        }

        // Agent is active - select it
        contextSetSelectedAgent(agent);
        agentChatIdsRef.current.set(agent.id, chatId);

      } else {
        contextSetSelectedAgent(null);
      }
    } else {
      // This is a normal chat - CLEAR agent selection
      contextSetSelectedAgent(null);
    }

    // Existing code continues...
    setActiveChatId(chatId);
    latestActiveChatId.current = chatId;
    const hasMessages = chatMessages[chatId]?.length > 0;
    setHasPrompt(hasMessages);
    setShowAgentDashboard(false);

    if (pendingAIMessages.current.size > 0) {
      setChatMessages(prev => {
        const currentMessages = prev[chatId] || [];
        const pendingMessages = Array.from(pendingAIMessages.current.values());

        const newMessages = pendingMessages.filter(pendingMsg =>
          !currentMessages.some(existingMsg => existingMsg.id === pendingMsg.id)
        );

        const newState = {
          ...prev,
          [chatId]: [...currentMessages, ...newMessages]
        };

        pendingAIMessages.current.clear();
        return newState;
      });
    }
  }, [chatMessages, chats, contextSetSelectedAgent, allAgents]); // Added allAgents to dependencies

  // ========== AGENT EVENT HANDLERS ==========

  const handleAgentSelect = useCallback(async (agent) => {
    if (agentsLocked) {
      showToast.info("AI agents are available on Pro. Upgrade to continue.");
      router.push("/pricing");
      return;
    }

    try {
      pendingAgentSelectionRef.current = agent?.id || null;
      let resolvedAgent = agent;

      if (agent && !agent.isBuiltIn) {
        const migratedAgent = await ensureCustomAgentUsesBackendId(agent);
        if (migratedAgent) {
          resolvedAgent = migratedAgent;
          pendingAgentSelectionRef.current = migratedAgent.id;
          setChats((prev) => prev.map((chat) => (
            chat.agentId === agent.id
              ? {
                  ...chat,
                  agentId: migratedAgent.id
                }
              : chat
          )));

          if (agentChatIdsRef.current.has(agent.id)) {
            const existingChatId = agentChatIdsRef.current.get(agent.id);
            agentChatIdsRef.current.delete(agent.id);
            agentChatIdsRef.current.set(migratedAgent.id, existingChatId);
          }
        }
      }

      // Use context setter
      contextSetSelectedAgent(resolvedAgent);

      if (isMobile) {
        setShowAgentDashboard(true);
        return;
      }

      const agentChat = await getOrCreateAgentChat(resolvedAgent);
      if (agentChat) {
        pendingAgentSelectionRef.current = agentChat.agentId || resolvedAgent.id;
        setActiveChatId(agentChat.id);
        latestActiveChatId.current = agentChat.id;
        setHasPrompt((chatMessages[agentChat.id] || []).length > 0);
        setShowAgentDashboard(false);

        if (pendingAIMessages.current.size > 0) {
          setChatMessages(prev => {
            const currentMessages = prev[agentChat.id] || [];
            const pendingMessages = Array.from(pendingAIMessages.current.values());

            const newMessages = pendingMessages.filter(pendingMsg =>
              !currentMessages.some(existingMsg => existingMsg.id === pendingMsg.id)
            );

            pendingAIMessages.current.clear();
            return {
              ...prev,
              [agentChat.id]: [...currentMessages, ...newMessages]
            };
          });
        }
      }
    } catch (error) {
      pendingAgentSelectionRef.current = null;
      console.error("Failed to open agent chat:", error);
      if ((error?.message || "") === TOKEN_LIMIT_REACHED_MESSAGE) {
        showToast.info(error.message);
      } else {
        showToast.error(error?.message || `Unable to open chat for ${agent.name}.`);
      }
    }
  }, [agentsLocked, chatMessages, contextSetSelectedAgent, ensureCustomAgentUsesBackendId, getOrCreateAgentChat, isMobile, router]);

  const handleAgentCreated = useCallback((newAgent) => {
    console.log("Agent created in parent:", newAgent);
    // Context already handles selection
  }, []);

  const handleAgentUpdated = useCallback((agentId, updates) => {
    console.log("Agent updated in parent:", agentId, updates);
    // Context handles the update
  }, []);

  const handleAgentDeleted = useCallback((agentId) => {
    console.log("Agent deleted in parent:", agentId);
    // Context handles deletion
  }, []);

  const handleAgentStatusToggled = useCallback((agentId) => {
    console.log("Agent status toggled in parent:", agentId);
    // Context handles status toggle
  }, []);

  const handleEditAgent = useCallback((agent) => {
    console.log("Edit agent requested from sidebar:", agent.name);

    // Use context setters
    contextSetEditingAgent(agent);
    contextSetSelectedAgent(agent);

    // Open dashboard (modal will be triggered by context's isCreatingAgent)
    setShowAgentDashboard(true);

    // This will trigger the modal in AgentDashboard
    contextSetIsCreatingAgent(true);
  }, [contextSetEditingAgent, contextSetSelectedAgent, contextSetIsCreatingAgent]);

  // ========== OTHER HANDLERS ==========

  const handleAgentsButtonClick = useCallback((openCreateModal = false) => {
    if (agentsLocked) {
      showToast.info("Custom and domain agents are available on Pro. Upgrade to continue.");
      router.push("/pricing");
      return;
    }

    console.log("📱 PAGE: Agents button clicked, openCreateModal:", openCreateModal);

    setShowAgentDashboard(true);

    if (isMobile) {
      setIsSidebarOpen(false);
    }

    if (openCreateModal) {
      // Clear any existing editing agent and open create modal
      contextSetEditingAgent(null);
      contextSetIsCreatingAgent(true);
    }
  }, [agentsLocked, contextSetEditingAgent, contextSetIsCreatingAgent, isMobile, router]);

  const prepareNewChat = useCallback(() => {
    console.log("💬 PAGE: Preparing new chat");

    pendingAgentSelectionRef.current = null;
    setActiveChatId(null);
    latestActiveChatId.current = null;
    setHasPrompt(false);
    contextSetSelectedAgent(null);
    setShowAgentDashboard(false);
    contextSetEditingAgent(null);
  }, [contextSetSelectedAgent, contextSetEditingAgent]);

  const handleToggleSidebar = useCallback((open) => {
    setIsSidebarOpen(open);
  }, []);

  const handleNewMessage = useCallback(async (message) => {
    const targetChatId = message.chatId || latestActiveChatId.current;

    // 🟢 NEW: Get the current chat and check if it belongs to a deactivated agent
    const currentChat = chats.find(chat => chat.id === targetChatId);

    // 🟢 NEW: If this is an agent chat, verify the agent is still active
    if (currentChat?.agentId) {
      const agent = allAgents.find(a => a.id === currentChat.agentId);
      if (agent && !agent.isBuiltIn && agent.status !== 'active') {
        // Agent is deactivated - block message and show warning
        showToast.error(`${agent.name} has been deactivated. You cannot continue this chat.`);
        return { chatId: null, setLoading: false };
      }
    }

    if (message.role === "assistant" && !targetChatId) {
      console.warn("No chatId for assistant message:", message);
      return { chatId: null, setLoading: false };
    }

    if (message.role === "user") {
      // ─── Agent mode - use stable chat ───
      if (contextSelectedAgent) {
        if (agentsLocked) {
          showToast.info("AI agents are available on Pro. Upgrade to continue.");
          router.push("/pricing");
          return { chatId: null, setLoading: false };
        }

        // 🟢 NEW: Check if the selected agent is active
        if (!contextSelectedAgent.isBuiltIn && contextSelectedAgent.status !== 'active') {
          showToast.error(`${contextSelectedAgent.name} is deactivated. Please activate it first.`);
          return { chatId: null, setLoading: false };
        }

        const agentChat = await getOrCreateAgentChat(contextSelectedAgent);

        // 🟢 NEW: If getOrCreateAgentChat returns null (agent inactive), stop
        if (!agentChat) {
          return { chatId: null, setLoading: false };
        }

        const finalChatId = agentChat.id;

        setActiveChatId(finalChatId);
        latestActiveChatId.current = finalChatId;
        setHasPrompt(true);
        setShowAgentDashboard(false);

        addMessageToChat(finalChatId, message);
        setChats(prev => prev.map(chat =>
          chat.id === finalChatId
            ? { ...chat, lastActive: "Just now" }
            : chat
        ));
        setChatLoading(finalChatId, true);

        return { chatId: finalChatId, setLoading: true };
      }
      // ─── Normal chat mode ───
      else {
        if (!targetChatId) {
          const newChatId = await createNewChat(message);
          latestActiveChatId.current = newChatId;
          setChatLoading(newChatId, true);
          return { chatId: newChatId, setLoading: true };
        } else {
          addMessageToChat(targetChatId, message);
          setHasPrompt(true);
          setChats(prev => prev.map(chat =>
            chat.id === targetChatId
              ? { ...chat, lastActive: "Just now" }
              : chat
          ));
          setChatLoading(targetChatId, true);
          return { chatId: targetChatId, setLoading: true };
        }
      }
    }

    if (message.role === "assistant") {
      if (targetChatId) {
        const existingMessages = chatMessages[targetChatId] || [];
        const messageExists = existingMessages.some(m => m.id === message.id);

        if (!messageExists) {
          addMessageToChat(targetChatId, message);
          setChats(prev => prev.map(chat =>
            chat.id === targetChatId
              ? { ...chat, lastActive: "Just now" }
              : chat
          ));
        } else {
          addMessageToChat(targetChatId, message);
        }

        setChatLoading(targetChatId, false);
      } else {
        pendingAIMessages.current.set(message.id, message);
      }
    }

    if (message.title) {
      setChats(prev => prev.map(chat =>
        chat.id === targetChatId
          ? { ...chat, name: message.title }
          : chat
      ));
    }

    return { chatId: targetChatId, setLoading: false };
  }, [
    createNewChat,
    addMessageToChat,
    agentsLocked,
    chatMessages,
    setChatLoading,
    contextSelectedAgent,
    chats,
    getOrCreateAgentChat,
    allAgents,
    router
  ]);

  const updateChats = useCallback(async (newChats) => {
    const currentById = new Map(chats.map((chat) => [chat.id, chat]));
    for (const chat of newChats) {
      const existing = currentById.get(chat.id);
      if (existing && existing.name !== chat.name) {
        try {
          await fetchWithAuth(`${API_BASE_URL}/api/chat/conversations/${chat.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ title: chat.name }),
          });
        } catch (error) {
          console.error("Failed to rename conversation:", error);
        }
      }
    }

    setChats(newChats);

    if (activeChatId && !newChats.find(chat => chat.id === activeChatId)) {
      setActiveChatId(null);
      latestActiveChatId.current = null;
      setHasPrompt(false);
      contextSetSelectedAgent(null);

      setChatLoading(activeChatId, false);

      setChatMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[activeChatId];
        return newMessages;
      });
    }
  }, [activeChatId, chats, contextSetSelectedAgent, setChatLoading]);

  // ========== RENDER ==========

  if (userLoading || !user) {
    return null;
  }

  return (
    <main className="h-screen bg-white">
      <div className="flex flex-col h-full overflow-hidden">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => handleToggleSidebar(!isSidebarOpen)}
          hasUserSentPrompt={hasPrompt}
          onNewChat={prepareNewChat}
        />

        <div className="flex flex-1 overflow-hidden h-[93vh]">
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
              onSelectChat={handleSelectChat}
              activeChatId={activeChatId}
              chats={chats}
              onChatsUpdate={updateChats}
              onDeleteChat={handleDeleteChat}
              onNewChat={prepareNewChat}
              onAgentsButtonClick={handleAgentsButtonClick}
              onEditAgent={handleEditAgent}
              selectedAgent={contextSelectedAgent}
              onSelectAgent={handleAgentSelect}
            />
          </div>

          {/* Main Content */}
          <div className={`
  flex-1 overflow-hidden
  transition-all duration-300 
  ${isSidebarOpen && isMobile ? 'opacity-30' : 'opacity-100'}
  ${!isSidebarOpen && !isMobile ? 'md:ml-20' : 'md:ml-0'}
`}>
            <div className="h-full m-2 md:m-4 flex flex-col">
              <div className="bg-white rounded-xl md:rounded-3xl shadow-md md:shadow-xl flex flex-col h-[87vh] overflow-hidden">
                {showAgentDashboard ? (
                  <div className="flex-1 h-full overflow-y-auto scrollbar-thin scrollbar-no-arrows">
                    <AgentDashboard
                      initialActiveChats={chats}
                      selectedAgent={contextSelectedAgent}
                      onSelectAgent={handleAgentSelect}
                      onCreateAgent={handleAgentCreated}
                      onUpdateAgent={handleAgentUpdated}
                      onDeleteAgent={handleAgentDeleted}
                      onToggleAgentStatus={handleAgentStatusToggled}
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden p-1 md:p-2">
                    <ChatWindow
                      onFirstMessage={() => setHasPrompt(true)}
                      isSidebarOpen={isSidebarOpen}
                      chatId={activeChatId}
                      messages={activeChatId ? (chatMessages[activeChatId] || []) : []}
                      onNewMessage={handleNewMessage}
                      hasActiveChat={!!activeChatId}
                      isLoading={activeChatId ? isChatLoading(activeChatId) : false}
                      onSetLoading={(loading) => activeChatId && setChatLoading(activeChatId, loading)}
                      selectedAgent={contextSelectedAgent}
                      // key={activeChatId}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}

// Main page wrapper
export default function ChatPage() {
  return (
    <AuthProvider>
      <AgentProvider>
        {/* ✅ REPLACE the old ToastContainer with this single line */}
        <ToastContainer {...toastContainerProps} />
        <ChatPageContent />
      </AgentProvider>
    </AuthProvider>
  );
}
