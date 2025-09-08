"use client";

import { useEffect, useRef, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

export default function ChatWindow({ onFirstMessage, isSidebarOpen }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [hasFirstMessage, setHasFirstMessage] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState("deepseek-chat");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const modelDialogRef = useRef(null);

  // AI Models with more options
  const aiModels = [
    { id: "deepseek-chat", name: "DeepSeek Chat", description: "Best for general conversation", icon: "🚀" },
    { id: "deepseek-coder", name: "DeepSeek Coder", description: "Optimized for programming tasks", icon: "💻" },
    { id: "claude-3", name: "Claude 3", description: "Helpful for creative writing", icon: "📝" },
    { id: "gpt-4", name: "GPT-4", description: "Good for complex reasoning", icon: "🧠" },
    { id: "gemini-pro", name: "Gemini Pro", description: "Great for multimodal tasks", icon: "🔮" },
    { id: "llama-3", name: "Llama 3", description: "Open-source alternative", icon: "🦙" },
    { id: "mistral", name: "Mistral", description: "Efficient and fast", icon: "🌪️" },
  ];

  // Default prompt cards
  const promptCards = [
    { title: "Explain concepts", prompt: "Explain quantum computing in simple terms", icon: "🧠" },
    { title: "Debug code", prompt: "Help me debug this Python function", icon: "🐛" },
    { title: "Creative ideas", prompt: "Generate creative ideas for a new mobile app", icon: "💡" },
    { title: "Summarize content", prompt: "Summarize the key points from this article", icon: "📝" },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    // Auto-adjust textarea height based on content and expansion state
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

  // Close model dialog when clicking outside
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

  const sendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    setStatusMsg("");

    const userMsg = {
      id: Date.now(),
      role: "user",
      text: input.trim(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setMessages((m) => [...m, userMsg]);
    setInput("");
    setAttachedFiles([]);
    setLoading(true);
    setIsInputExpanded(false);

    if (!hasFirstMessage) {
      setHasFirstMessage(true);
      if (onFirstMessage) onFirstMessage();
    }

    try {
      const formData = new FormData();
      formData.append('messages', JSON.stringify([...messages, userMsg]));
      formData.append('model', selectedModel);

      attachedFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch("http://127.0.0.1:8000/api/chat/", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data?.reply) {
        const assistantMsg = { id: Date.now() + 1, role: "assistant", text: data.reply };
        setMessages((m) => [...m, assistantMsg]);
      } else {
        setStatusMsg(data?.error || "No response from server. Try again.");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setStatusMsg("Could not reach server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
    }
  };

  const handlePromptClick = (prompt) => {
    setInput(prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
      setIsInputExpanded(true);
    }, 10);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const toggleInputExpansion = () => {
    setIsInputExpanded(!isInputExpanded);
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAttachedFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    setShowModelDialog(false);
  };

  const getCurrentModel = () => {
    return aiModels.find(model => model.id === selectedModel);
  };


return (
  <div className="flex flex-col h-full w-full bg-white">
    {/* Messages Container */}
    <div className="flex-1 overflow-y-auto px-2 py-3 md:px-4">
      {!hasFirstMessage ? (
        // Welcome screen with prompt cards - UPDATED
        <div className="flex flex-col items-center justify-start h-full pt-8 pb-4 px-2 overflow-y-auto">
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">How can I help you today?</h2>
            <p className="text-sm text-gray-500">Choose a prompt or type your own message to get started</p>
          </div>
          
          {/* Prompt cards grid - LEFT ALIGNED CONTENT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-6 px-4">
            {promptCards.map((card, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-purple-300 transition-colors text-left" // Added text-left here
                onClick={() => handlePromptClick(card.prompt)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{card.icon}</span>
                  <div className="text-left"> {/* Added text-left container */}
                    <h3 className="font-medium text-gray-800 mb-1 text-sm">{card.title}</h3>
                    <p className="text-xs text-gray-600">{card.prompt}</p>
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
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex ${m.role === "user" ? "flex-row-reverse" : ""} max-w-[85%]`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 ${m.role === "user" ? "ml-2" : "mr-2"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${m.role === "user"
                        ? "bg-gray-700 text-white"
                        : "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
                      }`}>
                      {m.role === "user" ? "You" : "AI"}
                    </div>
                  </div>

                  {/* Message bubble */}
                  <div className={`rounded-xl p-3 text-sm ${m.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                      : "bg-gray-100 text-gray-800"
                    }`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {/* Show attached files */}
                    {m.files && m.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.files.map((file, index) => (
                          <div key={index} className="flex items-center text-xs bg-white/20 rounded px-2 py-1">
                            <span className="truncate">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%]">
                  <div className="flex-shrink-0 mr-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
                      <span className="text-xs font-medium text-white">AI</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-xl p-3 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <span className="ml-2 text-gray-500 text-sm">Thinking...</span>
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
        <div className="px-4 mb-2">
          <div className="max-w-3xl mx-auto text-xs text-red-600 bg-red-50 rounded-lg py-1.5 px-2.5 border border-red-200">
            {statusMsg}
          </div>
        </div>
      )}

      {/* Show attached files */}
{attachedFiles.length > 0 && (
  <div className="px-4 pb-2">
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap gap-2">
        {attachedFiles.map((file, index) => (
          <div key={index} className="flex items-center bg-gray-100 rounded-lg px-3 py-1 text-xs">
            <span className="truncate max-w-[120px]">{file.name}</span>
            <button
              onClick={() => removeFile(index)}
              className="ml-2 text-gray-500 hover:text-red-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{/* Model selection dialog */}
{showModelDialog && (
  <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
    <div
      ref={modelDialogRef}
      className="bg-white border border-gray-200 shadow-xl rounded-xl p-4 w-full max-w-sm max-h-[70vh] overflow-y-auto"
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose AI Model</h3>
      <div className="grid gap-2">
        {aiModels.map((model) => (
          <div
            key={model.id}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
              selectedModel === model.id
                ? "bg-purple-100 border border-purple-300"
                : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
            }`}
            onClick={() => handleModelSelect(model.id)}
          >
            <span className="text-xl mr-3">{model.icon}</span>
            <div>
              <div className="font-medium text-gray-800">{model.name}</div>
              <div className="text-xs text-gray-500">{model.description}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowModelDialog(false)}
        className="mt-4 w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
)}

{/* Input area - UNIFIED DESIGN WITH FOCUS EFFECTS */}
<div className="bg-white px-4 py-3">
  <div className={`max-w-3xl mx-auto rounded-xl p-3 transition-all duration-200 ${
    input ? 'ring-2 ring-purple-300' : ''
  } ${input ? 'bg-purple-50' : 'bg-gray-100'}`}>
    
    {/* Upper div: Text input with expand button */}
    <div className="flex items-end gap-2 mb-3">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="flex-1 resize-none rounded-lg outline-none text-sm py-2.5 px-3 placeholder-gray-500 min-h-[44px] focus:outline-none"
        placeholder="Message AI Assistant..."
        rows="1"
        required={attachedFiles.length === 0}
        disabled={loading}
      />
      
      {/* Expand button */}
      <button
        type="button"
        onClick={toggleInputExpansion}
        className="flex-shrink-0 p-2 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors"
        title={isInputExpanded ? "Collapse" : "Expand"}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {isInputExpanded ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          )}
        </svg>
      </button>
    </div>

    {/* Lower div: Feature buttons and send button */}
    <div className="flex items-center justify-between">
      {/* Left side controls */}
      <div className="flex items-center gap-1">
        {/* File attachment button */}
        <button
          type="button"
          onClick={handleAttachClick}
          className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors"
          title="Attach files"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />

        {/* Model selection button */}
        <button
          type="button"
          onClick={() => setShowModelDialog(true)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          title="Change AI model"
        >
          <span className="text-sm">{getCurrentModel()?.icon}</span>
          <span className="hidden sm:inline">{getCurrentModel()?.name}</span>
          <svg className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Send button */}
      <button
        type="button"
        onClick={sendMessage}
        disabled={loading || (!input.trim() && attachedFiles.length === 0)}
        className="flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white p-2 rounded-lg transition-all duration-200 disabled:opacity-50"
        title="Send message"
      >
        <Image
          src="/send.png"
          alt="Send"
          width={16}
          height={16}
          className="brightness-0 invert"
        />
      </button>
    </div>
  </div>
</div>
</div>
  );
}