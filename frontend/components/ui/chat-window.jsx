"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { Meta, OpenAI, Gemini, Claude, Mistral, DeepSeek } from '@lobehub/icons';

export default function ChatWindow({ 
  chatId, 
  messages: propMessages = [],
  onNewMessage,
  hasActiveChat,
  isLoading, // Loading state from parent
  onSetLoading // Callback to update loading state in parent
}) {
  const [messages, setMessages] = useState(propMessages);
  const [input, setInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-flashlite");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showModelDialog, setShowModelDialog] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const modelDialogRef = useRef(null);

  // Track current streaming connection PER CHAT
  const currentStreamRef = useRef(null);
  const latestChatIdRef = useRef(chatId);
  const currentAssistantIdRef = useRef(null);

  // Update the ref whenever chatId changes
  useEffect(() => {
    latestChatIdRef.current = chatId;
    console.log("🆔 chatId updated:", chatId);
    
    // Close any existing stream when chat changes
    if (currentStreamRef.current) {
      currentStreamRef.current.close();
      currentStreamRef.current = null;
    }
  }, [chatId]);

  // Update local messages when prop messages change
  useEffect(() => {
    setMessages(propMessages);
  }, [propMessages, chatId]);

  // Clean up streaming when component unmounts
  useEffect(() => {
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.close();
        currentStreamRef.current = null;
      }
    };
  }, []);

  // AI Models and prompt cards
  const aiModels = [
    { id: "deepseek-chat", name: "DeepSeek Chat", description: "Best for general conversation", icon: <DeepSeek.Color size={24} /> },
    { id: "claude-3 haiku", name: "Claude 3", description: "Helpful for creative writing", icon: <Claude.Color size={24} /> },
    { id: "gpt5-nano", name: "GPT-5 Nano", description: "Good for complex reasoning", icon: <OpenAI size={24} /> },
    { id: "gemini-flashlite", name: "Gemini Pro", description: "Great for multimodal tasks", icon: <Gemini.Color size={24} /> },
    { id: "gemini-2.5-flash-image", name: "Gemini 2.5 Flash", description: "Image generation & preview", icon: <Gemini.Color size={24} /> },
    { id: "llama guard 4", name: "Llama 3", description: "Open-source alternative", icon: <Meta size={24} /> },
    { id: "mistral nemo", name: "Mistral", description: "Efficient and fast", icon: <Mistral.Color size={24} /> },
  ];

  const promptCards = [
    { title: "Explain concepts", prompt: "Explain quantum computing in simple terms", icon: "🧠" },
    { title: "Debug code", prompt: "Help me debug this Python function", icon: "🐛" },
    { title: "Creative ideas", prompt: "Generate creative ideas for a new mobile app", icon: "💡" },
    { title: "Summarize content", prompt: "Summarize the key points from this article", icon: "📝" },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const baseHeight = 24;
      const maxHeight = isInputExpanded ? 300 : 120;

      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${Math.max(scrollHeight, baseHeight)}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [input, isInputExpanded]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDialogRef.current && !modelDialogRef.current.contains(event.target)) {
        setShowModelDialog(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const showWelcomeScreen = !hasActiveChat || messages.length === 0;

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;

    const generateUniqueId = () =>
      `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const userMsg = {
      id: generateUniqueId(),
      role: "user",
      text: input.trim(),
    };

    // Generate and store assistant ID in ref
    currentAssistantIdRef.current = generateUniqueId();

    console.log("🚀 sendMessage called with:", {
      input: input.trim(),
      hasActiveChat: !!latestChatIdRef.current,
      currentChatId: latestChatIdRef.current
    });

    console.log("👤 Sending user message, latestChatId:", latestChatIdRef.current);
    console.log("🤖 Generated assistant ID:", currentAssistantIdRef.current);

    // Update local state
    setMessages(prev => [...prev, userMsg]);
    
    // Notify parent about USER message and get the chatId
    let currentChatId = latestChatIdRef.current;
    const isFirstMessage = !currentChatId; // Check if this is the first message
    
    if (onNewMessage) {
      console.log("📨 Calling onNewMessage with user message");
      const result = onNewMessage(userMsg);
      console.log("🆔 Parent returned:", result);
      
      // Handle the new return format
      if (result && result.chatId) {
        latestChatIdRef.current = result.chatId;
        currentChatId = result.chatId;
        console.log("🔄 Updated latestChatIdRef to:", result.chatId);
      }
    }
    
    setInput("");
    setStatusMsg("");

    // Use the latest chatId after parent has processed the message
    console.log("🌐 Final chatId for API call:", currentChatId);
    
    // Add is_first_message parameter to the API URL
    const url = `http://127.0.0.1:8000/api/chat/stream/?text=${encodeURIComponent(
      userMsg.text
    )}&model=${encodeURIComponent(selectedModel)}&chat_id=${encodeURIComponent(currentChatId || '')}&is_first_message=${isFirstMessage}`;

    console.log("🔗 Making API call to:", url);

    // Set loading state
    if (onSetLoading) onSetLoading(true);

    // Add a small delay to ensure the chat is properly created before making the API call
    setTimeout(() => {
      makeAPIRequest(userMsg.text, currentChatId, currentAssistantIdRef.current, url);
    }, 100);
  }, [input, onNewMessage, selectedModel, onSetLoading]);

  // Separate function for making the API request
  const makeAPIRequest = useCallback((messageText, chatId, assistantId, url) => {
    // Check if the chat is still active before making the request
    if (chatId !== latestChatIdRef.current) {
      console.log("⚠️ Chat changed, aborting API request for old chat:", chatId);
      if (onSetLoading) onSetLoading(false);
      return;
    }

    console.log("🔗 Making API call to:", url);

    // Close any existing stream
    if (currentStreamRef.current) {
      currentStreamRef.current.close();
      currentStreamRef.current = null;
    }

    const es = new EventSource(url);
    currentStreamRef.current = es;
    
    let receivedFirstMessage = false;
    let hasImage = false;
    let assistantMessage = null;
    let imageUrl = null;
    let buffer = "";
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 50;
    let hasNotifiedParent = false;

    const timeoutId = setTimeout(() => {
      if (!receivedFirstMessage && !hasImage) {
        console.log("⏰ Request timeout for chat:", chatId);
        es.close();
        currentStreamRef.current = null;
        if (onSetLoading) onSetLoading(false);
        setStatusMsg("Request timeout. Please try again.");
      }
    }, 30000);

    es.onmessage = (event) => {
      const data = event.data;
      console.log("📥 Received SSE data for chat:", chatId, data.substring(0, 100));
      
      // Check if this message is still relevant for the current chat
      if (chatId !== latestChatIdRef.current) {
        console.log("🚫 Message not relevant - chat changed, closing stream");
        es.close();
        currentStreamRef.current = null;
        if (onSetLoading) onSetLoading(false);
        return;
      }
      
      clearTimeout(timeoutId);

      if (currentStreamRef.current !== es) {
        console.log("🚫 Stream no longer relevant");
        es.close();
        return;
      }

      // Handle title updates
      if (data.startsWith('[TITLE]')) {
        const title = data.replace('[TITLE]', '');
        console.log("🏷️ Received chat title:", title);
        
        // Notify parent about the title
        if (onNewMessage) {
          onNewMessage({
            id: `title-${Date.now()}`,
            role: "system",
            title: title
          });
        }
        return;
      }

      if (data === '[DONE]') {
        console.log("✅ Stream completed for chat:", chatId);
        es.close();
        currentStreamRef.current = null;
        if (onSetLoading) onSetLoading(false);
        
        // Final update with any remaining buffer
        if (buffer && assistantMessage) {
          assistantMessage.text += buffer;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantId 
              ? { ...msg, text: assistantMessage.text }
              : msg
          ));
          
          if (!hasNotifiedParent && onNewMessage) {
            onNewMessage(assistantMessage);
            hasNotifiedParent = true;
          }
        }
        
        return;
      }

      if (data.startsWith('[IMAGE]')) {
        imageUrl = data.replace('[IMAGE]', '');
        hasImage = true;
        
        if (assistantMessage) {
          const updatedMessage = { ...assistantMessage, image: imageUrl };
          setMessages(prev => prev.map(msg => 
            msg.id === assistantId ? updatedMessage : msg
          ));
          if (onNewMessage && !hasNotifiedParent) {
            onNewMessage(updatedMessage);
            hasNotifiedParent = true;
          }
        } else {
          const imageMsg = {
            id: assistantId,
            role: "assistant", 
            text: buffer || "",
            image: imageUrl
          };
          setMessages(prev => [...prev, imageMsg]);
          assistantMessage = imageMsg;
          if (onNewMessage && !hasNotifiedParent) {
            onNewMessage(imageMsg);
            hasNotifiedParent = true;
          }
        }
        
        // Clear loading when image is received
        if (onSetLoading) onSetLoading(false);
        return;
      }

      if (data.startsWith("[ERROR]")) {
        console.error("❌ Stream error:", data);
        es.close();
        currentStreamRef.current = null;
        setStatusMsg(data.replace("[ERROR]", ""));
        if (onSetLoading) onSetLoading(false);
        return;
      }

      const processedData = data.replace(/\\n/g, '\n');
      buffer += processedData;

      const now = Date.now();
      
      if (!receivedFirstMessage) {
        console.log("🎯 First message chunk received");
        receivedFirstMessage = true;
        
        assistantMessage = {
          id: assistantId,
          role: "assistant", 
          text: buffer
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Clear loading immediately when first message is received
        if (onSetLoading) onSetLoading(false);
        
        buffer = "";
        lastUpdateTime = now;
        
        if (onNewMessage && !hasNotifiedParent) {
          onNewMessage(assistantMessage);
          hasNotifiedParent = true;
        }
      } else if (now - lastUpdateTime > UPDATE_INTERVAL || buffer.length > 20) {
        if (assistantMessage) {
          assistantMessage.text += buffer;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantId 
              ? { ...msg, text: assistantMessage.text }
              : msg
          ));
          buffer = "";
          lastUpdateTime = now;
        }
      }
    };

    es.onerror = (err) => {
      console.error("🔌 SSE connection error:", err);
      clearTimeout(timeoutId);
      
      // Check if this error is still relevant for the current chat
      if (chatId !== latestChatIdRef.current) {
        console.log("🚫 Error not relevant - chat changed");
        es.close();
        return;
      }
      
      if (currentStreamRef.current === es) {
        // Finalize the assistant message if we have one
        if (assistantMessage && buffer) {
          assistantMessage.text += buffer;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantId 
              ? { ...msg, text: assistantMessage.text }
              : msg
          ));
          if (onNewMessage && !hasNotifiedParent) {
            onNewMessage(assistantMessage);
            hasNotifiedParent = true;
          }
        }
        
        if (!receivedFirstMessage && !hasImage) {
          if (onSetLoading) onSetLoading(false);
          setStatusMsg("Connection error. Please try again.");
        }
        
        currentStreamRef.current = null;
      }
      
      es.close();
    };

    es.onopen = () => {
      console.log("🔗 SSE connection opened successfully");
    };
  }, [selectedModel, onNewMessage, onSetLoading]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) sendMessage();
    }
  }, [isLoading, sendMessage]);

  const handlePromptClick = useCallback((prompt) => {
    setInput(prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
      setIsInputExpanded(true);
    }, 10);
  }, []);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const toggleInputExpansion = useCallback(() => {
    setIsInputExpanded(!isInputExpanded);
    setTimeout(() => textareaRef.current?.focus(), 10);
  }, [isInputExpanded]);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleModelSelect = useCallback((modelId) => {
    setSelectedModel(modelId);
    setShowModelDialog(false);
  }, []);

  const getCurrentModel = useCallback(() => {
    return aiModels.find(model => model.id === selectedModel);
  }, [selectedModel]);

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-2 py-1 md:px-4">
        {showWelcomeScreen ? (
          // Welcome screen with prompt cards
          <div className="flex flex-col items-center justify-center h-full px-2 overflow-y-auto">
            {/* Centered Logo and Title */}
            <div className="text-center mb-6 max-w-lg w-full px-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-full mb-4 shadow-lg mx-auto">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="App Logo"
                    fill
                    className="object-contain drop-shadow-sm"
                    sizes="32px"
                  />
                </div>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                How can I help you today?
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Choose a prompt or type your own message to get started
              </p>
            </div>

            {/* Prompt cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-2xl px-2 sm:px-4">
              {promptCards.map((card, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-2.5 sm:p-3 cursor-pointer hover:border-purple-300 transition-colors text-left"
                  onClick={() => handlePromptClick(card.prompt)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base sm:text-lg flex-shrink-0">
                      {card.icon}
                    </span>
                    <div className="text-left min-w-0 flex-1">
                      <h3 className="font-medium text-gray-800 mb-1 text-xs sm:text-sm">
                        {card.title}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {card.prompt}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Chat messages
          <div className="space-y-3 max-w-3xl mx-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  } max-w-[90%] sm:max-w-[85%]`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 ${
                      m.role === "user" ? "ml-2" : "mr-2"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                        m.role === "user"
                          ? "bg-gray-700 text-white"
                          : "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                      }`}
                    >
                      {m.role === "user" ? "You" : "AI"}
                    </div>
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`rounded-xl p-3 text-sm ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                        : "text-gray-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {m.text}
                    </p>

                    {m.image && (
                      <div className="mt-3 relative group">
                        <img
                          src={m.image}
                          alt="Generated Image"
                          className="rounded-lg max-w-full border border-gray-200 shadow-sm"
                        />
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(m.image);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "generated-image.png";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              window.URL.revokeObjectURL(url);
                            } catch (err) {
                              console.error("Image download failed:", err);
                              alert("Failed to download image.");
                            }
                          }}
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Download image"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-gray-700"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                            />
                          </svg>
                        </button>
                      </div>
                    )}

                    {m.files && m.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center text-xs bg-white/20 rounded px-2 py-1"
                          >
                            <span className="truncate">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[90%] sm:max-w-[85%]">
                  <div className="flex-shrink-0 mr-2">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
                      <span className="text-xs font-medium text-white">AI</span>
                    </div>
                  </div>
                  <div className="rounded-xl p-2.5 sm:p-3 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <span className="ml-2 text-gray-500 text-sm">
                        Thinking...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Status message */}
      {statusMsg && (
        <div className="px-3 sm:px-4 mb-2">
          <div className="max-w-4xl mx-auto text-xs text-red-600 bg-red-50 rounded-lg py-1.5 px-2.5 border border-red-200">
            {statusMsg}
          </div>
        </div>
      )}

      {/* Show attached files */}
      {attachedFiles.length > 0 && (
        <div className="px-3 sm:px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center bg-gray-100 rounded-lg px-2 sm:px-3 py-1 text-xs"
                >
                  <span className="truncate max-w-[80px] sm:max-w-[120px]">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-1 sm:ml-2 text-gray-500 hover:text-red-500 p-0.5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="bg-white px-3 sm:px-4 py-1 sm:pt-3 sm:pb-1 relative">
        <div
          className={`max-w-3xl mx-auto rounded-xl p-2 sm:p-2 transition-all duration-200 ${
            input ? "ring-1 sm:ring-2 ring-purple-300" : ""
          } ${input ? "bg-purple-50" : "bg-gray-100"}`}
        >
          <div className="flex items-end gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none rounded-lg outline-none text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 placeholder-gray-500 min-h-[40px] sm:min-h-[44px] focus:outline-none "
              placeholder="Message AI Assistant..."
              rows="1"
              required={attachedFiles.length === 0}
              disabled={isLoading}
            />

            <button
              type="button"
              onClick={toggleInputExpansion}
              className="hidden xs:flex flex-shrink-0 p-1.5 sm:p-2 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors"
              title={isInputExpanded ? "Collapse" : "Expand"}
            >
              <svg
                className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                {isInputExpanded ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 15l7-7 7 7"
                  />
                )}
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={handleAttachClick}
                className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors"
                title="Attach files"
              >
                <svg
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                multiple
              />

              <button
                type="button"
                onClick={() => setShowModelDialog(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                title="Change AI model"
              >
                <span className="text-xs sm:text-sm flex-shrink-0">
                  {getCurrentModel()?.icon}
                </span>
                <span className="hidden sm:inline truncate max-w-[80px] lg:max-w-none">
                  {getCurrentModel()?.name}
                </span>
                <svg
                  className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={sendMessage}
              disabled={
                isLoading || (!input.trim() && attachedFiles.length === 0)
              }
              className="flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white p-1.5 sm:p-2 rounded-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
              title="Send message"
            >
              <Image
                src="/send.png"
                alt="Send"
                width={14}
                height={14}
                className="brightness-0 invert sm:w-4 sm:h-4"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Model selection dialog */}
      {showModelDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-transparent bg-opacity-50"
          onClick={() => setShowModelDialog(false)}
        >
          <div
            ref={modelDialogRef}
            className="bg-white border border-gray-200 rounded-xl shadow-lg
    p-4 sm:p-6
    w-[85%] max-w-xs
    sm:w-full sm:max-w-md md:max-w-lg
    max-h-[60vh] sm:max-h-[80vh]
    overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow:
                "0 10px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Select AI Model
              </h3>
              <button
                onClick={() => setShowModelDialog(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="Close"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
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

            <div className="overflow-y-auto max-h-[calc(75vh-120px)] sm:max-h-[calc(70vh-120px)] pr-1 sm:pr-2">
              <div className="space-y-2 mb-4">
                {aiModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={`flex items-center gap-2 sm:gap-3 w-full p-2.5 sm:p-3 rounded-lg transition-all duration-200 ${
                      selectedModel === model.id
                        ? "bg-purple-50 border border-purple-200 shadow-sm"
                        : "border border-gray-200 hover:border-purple-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex-shrink-0 text-lg sm:text-xl">
                      {model.icon}
                    </span>
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <span className="font-medium text-gray-900 text-sm truncate w-full text-left">
                        {model.name}
                      </span>
                      <span className="text-xs text-gray-500 truncate w-full text-left">
                        {model.description}
                      </span>
                    </div>
                    {selectedModel === model.id && (
                      <span className="flex-shrink-0 text-purple-600">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowModelDialog(false)}
                className="w-full py-2 sm:py-2.5 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}