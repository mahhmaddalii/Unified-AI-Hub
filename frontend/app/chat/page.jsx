"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import ChatSidebar from "../../components/chat/chat-sidebar";
import ChatWindow from "../../components/chat/chat-window";
import Navbar from "../../components/chat/chat-navbar";
import AgentDashboard from "../../components/agents/adashboard";
import { AgentProvider, useAgents } from "../../components/agents/AgentContext";

// Inner component that uses AgentContext
function ChatPageContent() {
  // ========== GET AGENT STATE FROM CONTEXT ONLY ==========
  const { 
    selectedAgent: contextSelectedAgent, 
    setSelectedAgent: contextSetSelectedAgent,
    setEditingAgent: contextSetEditingAgent,
    setIsCreatingAgent: contextSetIsCreatingAgent
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
  
  // ========== REMOVE THESE LINES ==========
  // const [selectedAgent, setSelectedAgent] = useState(null);
  // const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  // const [editingAgent, setEditingAgent] = useState(null);

  const latestActiveChatId = useRef(null);
  const pendingAIMessages = useRef(new Map());

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

  // ========== CHAT HANDLERS ==========

  const handleDeleteChat = useCallback((chatId) => {
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

  const createNewChat = useCallback((firstMessage, agentId = null) => {
    const newChatId = uuidv4();
    const agent = agentId ? contextSelectedAgent : null;
    const chatName = agent 
      ? `Chat with ${agent.name}`
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
  }, [contextSelectedAgent]); // Use contextSelectedAgent

  const handleSelectChat = useCallback((chatId) => {
    const selectedChat = chats.find(chat => chat.id === chatId);
    if (selectedChat?.agentId) {
      // Agent is managed by context, don't need to set here
    }
    
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
  }, [chatMessages, chats]);

  // ========== AGENT EVENT HANDLERS ==========
  
  const handleAgentSelect = useCallback((agent) => {
    // Use context setter
    contextSetSelectedAgent(agent);
    
    if (isMobile) {
      setShowAgentDashboard(true);
      return;
    }
    
    // Auto-redirect to chat for both built-in and custom agents
    if (agent.isBuiltIn) {
      const existingChat = chats.find(chat => chat.agentId === agent.id);
      if (existingChat) {
        handleSelectChat(existingChat.id);
        setShowAgentDashboard(false);
      } else {
        // Create a new chat for built-in agent
        const newChatId = uuidv4();
        const newChat = {
          id: newChatId,
          name: `Chat with ${agent.name}`,
          lastActive: "Just now",
          agentId: agent.id
        };
        
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChatId);
        latestActiveChatId.current = newChatId;
        setHasPrompt(false); // No messages yet
        setShowAgentDashboard(false);
        
        // Create empty messages for this chat
        setChatMessages(prev => ({
          ...prev,
          [newChatId]: []
        }));
      }
    } else {
      // For custom agents, always create new chat or use existing
      const existingChat = chats.find(chat => 
        chat.agentId === agent.id
      );
      
      if (existingChat) {
        handleSelectChat(existingChat.id);
        setShowAgentDashboard(false);
      } else {
        const newChatId = uuidv4();
        const newChat = {
          id: newChatId,
          name: `Chat with ${agent.name}`,
          lastActive: "Just now",
          agentId: agent.id
        };
        
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChatId);
        latestActiveChatId.current = newChatId;
        setHasPrompt(false); // No messages yet
        setShowAgentDashboard(false);
        
        // Create empty messages for this chat
        setChatMessages(prev => ({
          ...prev,
          [newChatId]: []
        }));
      }
    }
  }, [chats, isMobile, handleSelectChat, contextSetSelectedAgent]);  

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
  }, [isMobile, contextSetEditingAgent, contextSetIsCreatingAgent]);

  const prepareNewChat = useCallback(() => {
    console.log("💬 PAGE: Preparing new chat");
    
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

  const handleNewMessage = useCallback((message) => {
  const targetChatId = message.chatId || latestActiveChatId.current;

  if (message.role === "assistant" && !targetChatId) {
    console.warn("No chatId for assistant message:", message);
    return { chatId: null, setLoading: false };
  }

  if (message.role === "user") {
    if (contextSelectedAgent) {
      if (contextSelectedAgent.isBuiltIn) {
        const existingChat = chats.find(chat => chat.agentId === contextSelectedAgent.id);
        
        if (existingChat) {
          setActiveChatId(existingChat.id);
          latestActiveChatId.current = existingChat.id;
          setHasPrompt(true);
          setShowAgentDashboard(false);
          
          addMessageToChat(existingChat.id, message);
          setChats(prev => prev.map(chat => 
            chat.id === existingChat.id 
              ? { ...chat, lastActive: "Just now" }
              : chat
          ));
          
          setChatLoading(existingChat.id, true);
          return { chatId: existingChat.id, setLoading: true };
        } else {
          const newChatId = createNewChat(message, contextSelectedAgent.id);
          latestActiveChatId.current = newChatId;
          setChatLoading(newChatId, true);
          return { chatId: newChatId, setLoading: true };
        }
      } else {
        if (!targetChatId) {
          const newChatId = createNewChat(message, contextSelectedAgent.id);
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
    } else {
      if (!targetChatId) {
        const newChatId = createNewChat(message);
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
}, [createNewChat, addMessageToChat, chatMessages, setChatLoading, contextSelectedAgent, chats]);

  const updateChats = useCallback((newChats) => {
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
  }, [activeChatId, setChatLoading, contextSetSelectedAgent]);

  // ========== RENDER ==========

  return (
    <main className="h-screen bg-white">
      <div className="flex flex-col h-full overflow-hidden">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => handleToggleSidebar(!isSidebarOpen)}
          hasUserSentPrompt={hasPrompt}
          onNewChat={prepareNewChat}
        />

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
              <div className="bg-white rounded-xl md:rounded-3xl shadow-md md:shadow-xl h-full flex flex-col overflow-hidden">
                {showAgentDashboard ? (
                  <div className="flex-1 overflow-y-auto">
                                      
                    <AgentDashboard 
                      initialActiveChats={chats}
                      selectedAgent={contextSelectedAgent}
                      onSelectAgent={handleAgentSelect}
                      onCreateAgent={handleAgentCreated}
                      onUpdateAgent={handleAgentUpdated}
                      onDeleteAgent={handleAgentDeleted}
                      onToggleAgentStatus={handleAgentStatusToggled}
                      // REMOVED: No need to pass modal-related props
                      // The modal is controlled by AgentContext
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
    <AgentProvider>
      <ChatPageContent />
    </AgentProvider>
  );
}