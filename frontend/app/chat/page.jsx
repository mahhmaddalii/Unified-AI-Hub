"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import ChatSidebar from "../../components/ui/chat-sidebar";
import ChatWindow from "../../components/ui/chat-window";
import Navbar from "../../components/ui/chat-navbar";

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [chatMessages, setChatMessages] = useState({});
  const [loadingChats, setLoadingChats] = useState(new Set()); // Track which chats are loading
  
  const latestActiveChatId = useRef(null);
  const pendingAIMessages = useRef(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    latestActiveChatId.current = activeChatId;
    console.log("🔁 latestActiveChatId updated:", activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prepare for new chat - just set activeChatId to null to show welcome screen
  const prepareNewChat = useCallback(() => {
    console.log("🆕 Preparing new chat - setting activeChatId to null");
    setActiveChatId(null);
    latestActiveChatId.current = null;
    setHasPrompt(false);
  }, []);

  // Actually create chat and add to sidebar (called when first message is sent)
  const createNewChat = useCallback((firstMessage) => {
    const newChatId = uuidv4();
    const newChat = {
      id: newChatId,
      name: "New Chat", // Show "New Chat" as temporary title
      lastActive: "Just now"
    };
    
    console.log("🏗️ Creating new chat with ID:", newChatId);
    
    // Use functional updates to ensure proper order
    setChats(prev => {
      console.log("📋 Adding chat to sidebar:", newChatId);
      return [newChat, ...prev];
    });
    
    // Set as active chat - this should happen AFTER sidebar update
    setActiveChatId(newChatId);
    latestActiveChatId.current = newChatId;
    setHasPrompt(true);
    
    // Add the first message
    setChatMessages(prev => {
      console.log("💾 Storing first message in chat:", newChatId);
      return {
        ...prev,
        [newChatId]: [firstMessage]
      };
    });

    console.log("✅ Chat creation complete:", newChatId);
    return newChatId;
  }, []);

  const handleToggleSidebar = useCallback((open) => {
    setIsSidebarOpen(open);
  }, []);

  // Helper to add message to chat
  const addMessageToChat = useCallback((chatId, message) => {
    setChatMessages(prev => {
      const currentMessages = prev[chatId] || [];
      const messageIndex = currentMessages.findIndex(m => m.id === message.id);
      
      if (messageIndex > -1) {
        // Update existing message - preserve all properties
        const updatedMessages = [...currentMessages];
        updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], ...message };
        console.log("🔄 Updating existing message:", message.id);
        return { ...prev, [chatId]: updatedMessages };
      } else {
        // Add new message
        console.log("➕ Adding new message:", message.id);
        return { ...prev, [chatId]: [...currentMessages, message] };
      }
    });
  }, []);

  // Set loading state for a specific chat
  const setChatLoading = useCallback((chatId, isLoading) => {
    setLoadingChats(prev => {
      const newSet = new Set(prev);
      if (isLoading) {
        newSet.add(chatId);
      } else {
        newSet.delete(chatId);
      }
      console.log("🔄 Loading chats:", Array.from(newSet));
      return newSet;
    });
  }, []);

  // Check if a specific chat is loading
  const isChatLoading = useCallback((chatId) => {
    return loadingChats.has(chatId);
  }, [loadingChats]);

  // Process pending AI messages
  const processPendingAIMessages = useCallback((chatId) => {
    if (pendingAIMessages.current.size > 0) {
      console.log("🔄 Processing pending AI messages for chat:", chatId);
      setChatMessages(prev => {
        const currentMessages = prev[chatId] || [];
        const pendingMessages = Array.from(pendingAIMessages.current.values());
        
        // Filter out duplicates
        const newMessages = pendingMessages.filter(pendingMsg => 
          !currentMessages.some(existingMsg => existingMsg.id === pendingMsg.id)
        );
        
        const newState = { 
          ...prev, 
          [chatId]: [...currentMessages, ...newMessages] 
        };
        
        console.log("📥 Added", newMessages.length, "pending messages");
        pendingAIMessages.current.clear();
        return newState;
      });
    }
  }, []);

  // Handle new messages
  const handleNewMessage = useCallback((message) => {
    const currentChatId = latestActiveChatId.current;
    
    console.log("📨 PARENT: Handling message:", {
      role: message.role,
      id: message.id,
      currentChatId: currentChatId,
      hasActiveChat: !!currentChatId
    });
    
    if (message.role === "user") {
      // If no active chat exists (welcome screen), create one
      if (!currentChatId) {
        console.log("🚀 Creating new chat for first message");
        const newChatId = createNewChat(message);
        console.log("✅ Chat created, new activeChatId should be:", newChatId);
        
        // Update the ref immediately for the ChatWindow to use
        latestActiveChatId.current = newChatId;
        
        // Set loading state for the new chat
        setChatLoading(newChatId, true);
        
        // Return the chatId so ChatWindow can use it immediately
        return { chatId: newChatId, setLoading: true };
      } else {
        // Add message to existing chat
        console.log("➕ Adding message to existing chat:", currentChatId);
        addMessageToChat(currentChatId, message);
        setHasPrompt(true);
        setChats(prev => prev.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, lastActive: "Just now" }
            : chat
        ));
        
        // Set loading state for this chat
        setChatLoading(currentChatId, true);
        
        return { chatId: currentChatId, setLoading: true };
      }
    }
    
    // Handle AI messages - only add if it doesn't exist already
    if (message.role === "assistant") {
      if (currentChatId) {
        // Check if message already exists to prevent duplicates
        const existingMessages = chatMessages[currentChatId] || [];
        const messageExists = existingMessages.some(m => m.id === message.id);
        
        if (!messageExists) {
          console.log("🤖 Adding AI message to chat:", currentChatId, "Message ID:", message.id);
          addMessageToChat(currentChatId, message);
          
          // Update chat last active time
          setChats(prev => prev.map(chat => 
            chat.id === currentChatId 
              ? { ...chat, lastActive: "Just now" }
              : chat
          ));
        } else {
          console.log("🔄 AI message already exists, updating:", currentChatId, "Message ID:", message.id);
          // Update existing message
          addMessageToChat(currentChatId, message);
        }
        
        // Clear loading state when AI message is received
        setChatLoading(currentChatId, false);
      } else {
        console.log("⏳ Storing AI message temporarily - no chat yet");
        // Store AI message temporarily if no chat exists
        pendingAIMessages.current.set(message.id, message);
      }
    }
    
    // Handle title updates from the AI
    if (message.title) {
      console.log("🏷️ Updating chat title:", currentChatId, message.title);
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, name: message.title }
          : chat
      ));
    }
    
    // Always return the current chat ID
    return { chatId: currentChatId, setLoading: false };
  }, [createNewChat, addMessageToChat, chatMessages, setChatLoading]);

  // Update chats from sidebar
  const updateChats = useCallback((newChats) => {
    console.log("📋 Updating chats list");
    setChats(newChats);
    
    if (activeChatId && !newChats.find(chat => chat.id === activeChatId)) {
      console.log("🗑️ Active chat was deleted:", activeChatId);
      setActiveChatId(null);
      latestActiveChatId.current = null;
      setHasPrompt(false);
      
      // Clear loading state for deleted chat
      setChatLoading(activeChatId, false);
      
      setChatMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[activeChatId];
        return newMessages;
      });
    }
  }, [activeChatId, setChatLoading]);

  // Handle chat selection
  const handleSelectChat = useCallback((chatId) => {
    console.log("🎯 Selecting chat:", chatId);
    
    setActiveChatId(chatId);
    latestActiveChatId.current = chatId;
    const hasMessages = chatMessages[chatId]?.length > 0;
    setHasPrompt(hasMessages);
    
    // Process any pending messages for this chat
    if (pendingAIMessages.current.size > 0) {
      console.log("🔄 Processing pending AI messages for newly selected chat:", chatId);
      processPendingAIMessages(chatId);
    }
  }, [chatMessages, processPendingAIMessages]);

  // Handle chat deletion
  const handleDeleteChat = useCallback((chatId) => {
    console.log("🗑️ Deleting chat:", chatId);
    if (chatId === activeChatId) {
      setActiveChatId(null);
      latestActiveChatId.current = null;
      setHasPrompt(false);
    }
    
    // Clear loading state for deleted chat
    setChatLoading(chatId, false);
    
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);
    
    setChatMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[chatId];
      return newMessages;
    });
  }, [activeChatId, chats, setChatLoading]);

  // Process pending messages when activeChatId changes
  useEffect(() => {
    if (activeChatId && pendingAIMessages.current.size > 0) {
      console.log("🔄 Processing pending AI messages for chat:", activeChatId);
      processPendingAIMessages(activeChatId);
    }
  }, [activeChatId, processPendingAIMessages]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log("📊 State update:", {
      activeChatId,
      chatsCount: chats.length,
      chatMessagesCount: Object.keys(chatMessages).length,
      hasPrompt,
      loadingChats: Array.from(loadingChats)
    });
  }, [activeChatId, chats, chatMessages, hasPrompt, loadingChats]);

  return (
    <main className="min-h-screen bg-white">
      <div className="flex flex-col h-screen">
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
            />
          </div>

          {/* Chat Window */}
          <div className={`
            flex-1
            transition-all duration-300 
            p-4 md:p-5
            ${isSidebarOpen && isMobile ? 'opacity-30' : 'opacity-100'}
            h-full
            w-full
            ${!isSidebarOpen && !isMobile ? 'md:ml-20' : 'md:ml-0'}
          `}>
            <div className="bg-white rounded-xl md:rounded-3xl shadow-md md:shadow-xl p-1 md:p-2 w-full h-full flex flex-col overflow-hidden">
              <ChatWindow 
                onFirstMessage={() => setHasPrompt(true)}
                isSidebarOpen={isSidebarOpen}
                chatId={activeChatId}
                messages={activeChatId ? (chatMessages[activeChatId] || []) : []}
                onNewMessage={handleNewMessage}
                hasActiveChat={!!activeChatId}
                isLoading={activeChatId ? isChatLoading(activeChatId) : false}
                onSetLoading={(loading) => activeChatId && setChatLoading(activeChatId, loading)}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}