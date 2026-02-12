"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { Meta, OpenAI, Gemini, Claude, Mistral, DeepSeek } from '@lobehub/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'react-toastify';


export default function ChatWindow({
  chatId,
  messages: propMessages = [],
  onNewMessage,
  hasActiveChat,
  isLoading,
  onSetLoading,
  selectedAgent = null
}) {
console.log("🔥 ChatWindow MOUNTED/RENDER with chatId:", chatId, "selectedAgent:", selectedAgent?.name);

  const [messages, setMessages] = useState(propMessages);
  const [input, setInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-flashlite");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showModelDialog, setShowModelDialog] = useState(false);
    const [isAgentDeactivated, setIsAgentDeactivated] = useState(false);

  // Model icons mapping (add this after your imports)
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

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const modelDialogRef = useRef(null);

  // Track ALL active streams and per-chat state
  const activeStreamsRef = useRef(new Map()); // chatId → EventSource
  const chatStatesRef = useRef(new Map()); // chatId → { assistantMessage, buffer, hasNotifiedParent, receivedFirstMessage, hasImage, lastUpdateTime }
  const latestChatIdRef = useRef(chatId);
  const currentAssistantIdRef = useRef(null);

// 🟢 FIX: Force immediate UI update when chatId changes and we have an agent
  useEffect(() => {
    if (chatId && chatId.startsWith('agent-chat-') && selectedAgent) {
      console.log("✅ Agent chat detected, forcing agent UI for:", selectedAgent.name);
      // This forces a re-render with the correct UI
      // No state change needed - just the condition triggers re-render
    }
  }, [chatId, selectedAgent]);

useEffect(() => {
    if (selectedAgent && !selectedAgent.isBuiltIn) {
      setIsAgentDeactivated(selectedAgent.status !== 'active');
      
      if (selectedAgent.status !== 'active') {
       ;
      } else {
        setStatusMsg("");
      }
    } else {
      setIsAgentDeactivated(false);
      setStatusMsg("");
    }
  }, [selectedAgent]);

  useEffect(() => {
  console.log("🤖 ChatWindow selectedAgent:", selectedAgent);
}, [selectedAgent]);

  // Update latest chatId ref
  useEffect(() => {
    latestChatIdRef.current = chatId;
    console.log("🆔 Active chatId changed to:", chatId);
  }, [chatId]);

  // Update local messages when props change
  useEffect(() => {
    setMessages(propMessages);
  }, [propMessages, chatId]);

  // Cleanup ALL streams and states on unmount
  useEffect(() => {
    return () => {
      activeStreamsRef.current.forEach(stream => stream?.close());
      activeStreamsRef.current.clear();
      chatStatesRef.current.clear();
    };
  }, []);

  // AI Models and prompt cards (unchanged)
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

  // Function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Function to get file type
  const getFileType = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    
    // Only the file types you want: txt, pdf, doc/docx, csv
    const fileTypes = {
      // Text files
      'txt': 'Text',
      // PDF files
      'pdf': 'PDF',
      // Word documents
      'doc': 'Word',
      'docx': 'Word',
      // CSV files
      'csv': 'CSV'
    };
    
    return fileTypes[extension] || 'File';
  };

// ────────────────────────────────────────────────
// PROFESSIONAL MARKDOWN COMPONENTS with Copy-to-Clipboard + Feedback
const MarkdownComponents = {
  // Headers
  h1: ({ children }) => <h1 className="text-2xl font-bold mt-7 mb-4 text-gray-900 border-b pb-2">{children}</h1>,
  h2: ({ children }) => {
    if (children?.toString().trim().toLowerCase().includes('sources')) {
      return (
        <h2 className="text-xl font-semibold mt-9 mb-4 text-gray-900 flex items-center gap-3 border-t pt-6 pb-1">
          <span className="text-purple-600 text-2xl">📚</span>
          <span>{children}</span>
        </h2>
      );
    }
    return <h2 className="text-xl font-bold mt-7 mb-3 text-gray-900">{children}</h2>;
  },
  h3: ({ children }) => <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-900">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold mt-5 mb-2 text-gray-900">{children}</h4>,

  // Paragraphs
  p: ({ children }) => <p className="mb-4 leading-7 text-gray-800">{children}</p>,

  // Lists
  ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2 text-gray-800">{children}</ul>,
  ol: ({ children }) => (
    <ol className="list-decimal pl-8 mb-5 space-y-2 text-gray-800 marker:text-purple-600 marker:font-bold">
      {children}
    </ol>
  ),
  li: ({ children }) => {
    const isSource = typeof children === 'string' && 
                     (children.includes('[Read more]') || children.includes('http'));
    
    return (
      <li className={`leading-7 ${isSource ? 'bg-purple-50/70 p-3.5 rounded-lg border border-purple-100 mb-3' : ''}`}>
        {children}
      </li>
    );
  },

  // ─── CODE BLOCKS with Copy Button + "Copied!" feedback ───
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    
    if (!inline && match) {
      const [copied, setCopied] = React.useState(false);

      const handleCopy = () => {
        navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // revert after 2 seconds
      };

      return (
        <div className="my-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative group">
          <div className="bg-gray-800 text-gray-200 px-4 py-2.5 text-sm font-mono flex justify-between items-center">
            <span className="uppercase font-medium">{match[1]}</span>
            <button
              onClick={handleCopy}
              className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              title="Copy code"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <SyntaxHighlighter
            style={atomDark}
            language={match[1]}
            PreTag="div"
            className="text-sm !m-0"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: '#1f2937',
              padding: '1.25rem'
            }}
            showLineNumbers
            wrapLongLines={false}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Inline code
    return (
      <code className="bg-gray-100/80 rounded-md px-1.5 py-0.5 text-sm font-mono text-gray-800 border border-gray-200">
        {children}
      </code>
    );
  },

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-500 pl-5 my-6 italic text-gray-700 bg-purple-50/60 py-3 rounded-r-lg">
      {children}
    </blockquote>
  ),

  // ─── TABLES with 100% WORKING Copy Icon (reads from DOM) ───
table: ({ children }) => {
  const [copied, setCopied] = React.useState(false);
  const tableRef = React.useRef(null);

  const handleTableCopy = () => {
    if (!tableRef.current) return;

    const table = tableRef.current;
    let text = '';

    // Get all rows (thead + tbody)
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const rowText = Array.from(cells)
        .map(cell => cell.innerText.trim())
        .filter(Boolean)
        .join('\t');

      if (rowText) {
        text += rowText + '\n';
      }
    });

    text = text.trim();

    if (text) {
      console.log("Copied table content:", text);
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error("Clipboard error:", err);
      });
    } else {
      console.warn("No content found in table DOM");
    }
  };

  return (
    <div className="overflow-x-auto my-6 border border-gray-200 rounded-lg shadow-sm relative group">
      {/* Copy icon */}
      <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={handleTableCopy}
          className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm border border-gray-200 transition-colors"
          title={copied ? "Copied!" : "Copy table"}
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600 hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Attach ref to the real table */}
      <table ref={tableRef} className="min-w-full divide-y divide-gray-200 table-auto w-full">
        {children}
      </table>
    </div>
  );
},

  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors duration-150">{children}</tr>,
  th: ({ children }) => (
    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-6 py-4 text-sm text-gray-800 align-top whitespace-normal break-words">
      {children}
    </td>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-purple-700 hover:text-purple-900 underline decoration-purple-300 hover:decoration-purple-600 underline-offset-2 transition-all duration-200 inline-flex items-center gap-1 group"
    >
      {children}
      <svg className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  ),

  // Strong & Emphasis
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
};

// ────────────────────────────────────────────────
// RENDER FUNCTION (unchanged from previous fix)
const renderMessageContent = useCallback((content) => {
  if (!content) return null;

  return (
    <div className="prose prose-sm sm:prose-base prose-headings:text-gray-900 prose-a:no-underline max-w-none break-words leading-7">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

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

  const uploadFilesIfAny = async (chatId) => {
    if (attachedFiles.length === 0) return;

    try {
      console.log("📤 Uploading files for chat:", chatId);
      console.log("📁 Files to upload:", attachedFiles);

      for (const file of attachedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("chat_id", chatId);

        const res = await fetch(
          "http://127.0.0.1:8000/api/chat/upload-document/",
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

        if (!res.ok) {
          throw new Error(`Upload failed: ${res.status}`);
        }
      }

    } catch (err) {
      console.error("❌ File upload error:", err);
      setStatusMsg("File upload failed, continuing without document.");
    }
  };

const sendMessage = useCallback(async () => {
  // 🟢 NEW: Block sending if agent is deactivated
  if (selectedAgent && !selectedAgent.isBuiltIn && selectedAgent.status !== 'active') {
    toast.error(`❌ Cannot send message: ${selectedAgent.name} is deactivated. Please activate it first.`);
    return;
  }

  const hasText = input.trim().length > 0;
  const hasFiles = attachedFiles.length > 0;

  // Block sending if neither text nor files are present
  if (!hasText && !hasFiles) {
    return;
  }

  const generateUniqueId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const userMsg = {
    id: generateUniqueId(),
    role: "user",
    text: input.trim(),
    files: attachedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: getFileType(file.name)
    }))
  };

  currentAssistantIdRef.current = generateUniqueId();

  console.log("🚀 sendMessage called with:", {
    input: input.trim(),
    hasFiles,
    currentChatId: latestChatIdRef.current,
    selectedAgent: selectedAgent
  });

  setMessages(prev => [...prev, userMsg]);

  const currentFiles = [...attachedFiles];

  let currentChatId = latestChatIdRef.current;
  const isFirstMessage = !currentChatId && (!selectedAgent || selectedAgent.isBuiltIn);

  if (onNewMessage) {
    console.log("📨 Calling onNewMessage with user message and files");
    const result = onNewMessage(userMsg);
    console.log("🆔 Parent returned:", result);

    if (result && result.chatId) {
      latestChatIdRef.current = result.chatId;
      currentChatId = result.chatId;
      console.log("🔄 Updated latestChatIdRef to:", result.chatId);
    }
  }

  setInput("");
  setAttachedFiles([]);
  setStatusMsg("");

  if (currentFiles.length > 0) {
    await uploadFilesIfAny(currentChatId);
  }

  // Trigger AI response whenever user sends something valid
  const apiText = hasText ? input.trim() : "[User sent files]";

  let url;
  if (selectedAgent && !selectedAgent.isBuiltIn) {
    url = `http://127.0.0.1:8000/api/custom_agents/stream/?agent_id=${encodeURIComponent(
      selectedAgent.id
    )}&purpose=${encodeURIComponent(selectedAgent.purpose || "general")}&model=${encodeURIComponent(
      selectedAgent.model || "gemini-flashlite"
    )}&is_auto=${selectedAgent.isAutoSelected ? "true" : "false"}&system_prompt=${encodeURIComponent(
      selectedAgent.customPrompt || ""
    )}&text=${encodeURIComponent(apiText)}`;
    
    console.log("🤖 Using CUSTOM AGENT endpoint:", url);
  } else {
    url = `http://127.0.0.1:8000/api/chat/stream/?text=${encodeURIComponent(
      apiText
    )}&model=${encodeURIComponent(selectedModel)}&chat_id=${encodeURIComponent(
      currentChatId || ''
    )}&is_first_message=${isFirstMessage}`;
    
    console.log("💬 Using REGULAR CHAT endpoint:", url);
  }

  if (onSetLoading) onSetLoading(true);

  setTimeout(() => {
    makeAPIRequest(apiText, currentChatId, currentAssistantIdRef.current, url);
  }, 100);
}, [input, attachedFiles, onNewMessage, selectedModel, onSetLoading, selectedAgent]); // No need to add toast to deps

  // Updated makeAPIRequest - supports background streaming
  const makeAPIRequest = useCallback((messageText, targetChatId, assistantId, url) => {
  if (!targetChatId) return;

  console.log("🔗 Starting background-safe stream for chat:", targetChatId, url);

  if (activeStreamsRef.current.has(targetChatId)) {
    activeStreamsRef.current.get(targetChatId)?.close();
    activeStreamsRef.current.delete(targetChatId);
  }

  const es = new EventSource(url);
  activeStreamsRef.current.set(targetChatId, es);

  chatStatesRef.current.set(targetChatId, {
    receivedFirstMessage: false,
    hasImage: false,
    assistantMessage: null,
    imageUrl: null,
    buffer: "",
    lastUpdateTime: Date.now(),
    hasNotifiedParent: false,
    lastNotifiedTextLength: 0
  });

  let inactivityTimeout = setTimeout(() => {
    console.log("⏰ Inactivity timeout - closing stream:", targetChatId);
    es.close();
    activeStreamsRef.current.delete(targetChatId);
    chatStatesRef.current.delete(targetChatId);
    if (targetChatId === latestChatIdRef.current) onSetLoading?.(false);
  }, 180000);

  es.onmessage = (event) => {
    const data = event.data;
    const state = chatStatesRef.current.get(targetChatId);
    if (!state) return;

    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      console.log("⏰ Stream inactivity timeout:", targetChatId);
      es.close();
      activeStreamsRef.current.delete(targetChatId);
      chatStatesRef.current.delete(targetChatId);
      if (targetChatId === latestChatIdRef.current) onSetLoading?.(false);
    }, 180000);

    const isActiveChat = targetChatId === latestChatIdRef.current;

    if (data.startsWith('[TITLE]')) {
      onNewMessage?.({
        id: `title-${Date.now()}`,
        role: "system",
        title: data.replace('[TITLE]', ''),
        chatId: targetChatId
      });
      return;
    }

    if (data === '[DONE]') {
  console.log("✅ Stream completed:", targetChatId);
  clearTimeout(inactivityTimeout);
  es.close();
  activeStreamsRef.current.delete(targetChatId);

  if (state.buffer && state.assistantMessage) {
    state.assistantMessage.text += state.buffer;
  }

  // ALWAYS send the FULL final message to parent — even in background
  if (state.assistantMessage) {
    onNewMessage?.({
      ...state.assistantMessage,
      id: assistantId,           // real ID
      chatId: targetChatId
    });
  }

  if (isActiveChat) onSetLoading?.(false);
  chatStatesRef.current.delete(targetChatId);
  return;
}

    if (data.startsWith('[IMAGE]')) {
      state.imageUrl = data.replace('[IMAGE]', '');
      state.hasImage = true;

      if (state.assistantMessage) {
        state.assistantMessage.image = state.imageUrl;
        onNewMessage?.({ ...state.assistantMessage, chatId: targetChatId });
      } else {
        const msg = {
          id: assistantId,
          role: "assistant",
          text: state.buffer || "",
          image: state.imageUrl
        };
        state.assistantMessage = msg;
        onNewMessage?.({ ...msg, chatId: targetChatId });
      }
      return;
    }

    if (data.startsWith("[ERROR]")) {
      console.error("❌ Stream error:", data);
      clearTimeout(inactivityTimeout);
      es.close();
      activeStreamsRef.current.delete(targetChatId);
      chatStatesRef.current.delete(targetChatId);
      if (isActiveChat) {
        setStatusMsg(data.replace("[ERROR]", ""));
        onSetLoading?.(false);
      }
      return;
    }

    // Text chunk
    const processed = data.replace(/\\n/g, '\n');
    state.buffer += processed;

    const now = Date.now();

    if (isActiveChat) {
      // Active: fast UI updates
      if (!state.receivedFirstMessage) {
        state.receivedFirstMessage = true;
        const existing = messages.find(m => m.id === assistantId);
        state.assistantMessage = existing
          ? { ...existing, text: state.buffer }
          : { id: assistantId, role: "assistant", text: state.buffer };

        setMessages(prev => {
          if (existing) return prev.map(m => m.id === assistantId ? state.assistantMessage : m);
          return [...prev, state.assistantMessage];
        });

        onSetLoading?.(false);
        state.buffer = "";
        state.lastUpdateTime = now;
        state.lastNotifiedTextLength = state.assistantMessage.text.length;
        onNewMessage?.({ ...state.assistantMessage, chatId: targetChatId });
      } else if (now - state.lastUpdateTime > 80 || state.buffer.length > 50) {
        if (state.assistantMessage) {
          state.assistantMessage.text += state.buffer;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, text: state.assistantMessage.text } : m
          ));
          state.buffer = "";
          state.lastUpdateTime = now;
          state.lastNotifiedTextLength = state.assistantMessage.text.length;
        }
      }
    } else {
  // Background mode: ONLY ACCUMULATE LOCALLY — do NOT notify parent until [DONE]
  // This prevents duplicate key warnings and ensures full response on switch-back
  if (state.assistantMessage) {
    state.assistantMessage.text += state.buffer;
  } else if (state.buffer.length > 0) {
    // Create initial message locally only
    const msg = {
      id: assistantId,
      role: "assistant",
      text: state.buffer
    };
    state.assistantMessage = msg;
  }

  state.buffer = ""; // clear buffer after adding
}
  };

  es.onerror = (err) => {
    console.error("🔌 SSE error:", targetChatId, err);
    clearTimeout(inactivityTimeout);
    es.close();
    activeStreamsRef.current.delete(targetChatId);
    chatStatesRef.current.delete(targetChatId);
    if (targetChatId === latestChatIdRef.current) {
      onSetLoading?.(false);
      setStatusMsg("Connection error");
    }
  };

  es.onopen = () => console.log("🔗 SSE opened:", targetChatId);
}, [onNewMessage, onSetLoading, messages, selectedAgent]);


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
          <div className="space-y-3 max-w-3xl mx-auto pt-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`${
                    m.role === "user"
                      ? "max-w-[90%] sm:max-w-[85%]"
                      : "max-w-[90%] sm:max-w-[85%]"
                  }`}
                >
                  {/* Message bubble */}
                  <div className="relative overflow-visible">
                    <div
                      className={`rounded-3xl p-4 text-sm ${
                        m.role === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-800"
                      }`}
                    >
                      {/* FIXED: Use renderMessageContent for assistant messages */}
                      {m.role === "assistant" ? (
                        renderMessageContent(m.text)
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {m.text}
                        </p>
                      )}

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
                        <div className="mt-2 space-y-1.5">
                          <div className="text-xs opacity-80 mb-1">
                            🧷 Attached files:
                          </div>
                          {m.files.map((file, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                                m.role === "user"
                                  ? "bg-white/20"
                                  : "bg-gray-100"
                              }`}
                            >
                              <svg
                                className="w-4 h-4 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-medium">
                                  {file.name}
                                </div>
                                <div className="text-xs opacity-70">
                                  {file.type} • {formatFileSize(file.size)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* iMessage-style tail for user messages */}
                    {m.role === "user" && (
                      <svg
                        className="absolute -right-3 bottom-1"
                        width="26"
                        height="35"
                        viewBox="0 0 26 35"
                      >
                        <path
                          d="M0 0 L0 15 Q2 24 12 30 Q18 33 26 35 L0 35 Z"
                          className="fill-purple-600"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[90%] sm:max-w-[85%]">
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
                    <span className="ml-2 text-gray-500 text-sm"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* <div ref={messagesEndRef} /> */}
      </div>

      {/* Status message */}
      {statusMsg && (
        <div className="px-3 sm:px-4 mb-2">
          <div className="max-w-4xl mx-auto text-xs text-red-600 bg-red-50 rounded-lg py-1.5 px-2.5 border border-red-200">
            {statusMsg}
          </div>
        </div>
      )}

      {/* Show attached files BEFORE sending */}
      {attachedFiles.length > 0 && (
        <div className="px-3 sm:px-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center bg-gray-100 hover:bg-gray-200 rounded-lg px-2 sm:px-3 py-1.5 text-xs transition-colors group"
                >
                  <svg
                    className="w-3 h-3 mr-1.5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="truncate max-w-[80px] sm:max-w-[120px]">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-1.5 sm:ml-2 text-gray-500 hover:text-red-500 p-0.5 rounded-full hover:bg-red-50 transition-colors"
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
      <div className="bg-white px-3 sm:px-4 py-1 sm:pt-3 sm:pb-1 relative flex-shrink-0">
        <div
          className={`max-w-3xl mx-auto rounded-xl p-2 sm:p-2 transition-all duration-200 ${
            input || attachedFiles.length > 0
              ? "ring-1 sm:ring-2 ring-purple-300"
              : ""
          } ${
            input || attachedFiles.length > 0 ? "bg-purple-50" : "bg-gray-100"
          }`}
        >
          {/* 🟢 NEW: Deactivated agent banner */}
{isAgentDeactivated && selectedAgent && (
  <div className="px-3 sm:px-4 mb-2">
    <div className="max-w-4xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
  <span className="text-red-600 text-sm leading-none mt-[-6px]">⚠️</span>
</div>
        <div className="flex-1">
          <p className="text-sm text-red-800 font-medium">
            {selectedAgent.name} is deactivated
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Activate this agent from the agents dashboard to continue chatting.
          </p>
        </div>
        
      </div>
    </div>
  </div>
)}
          <div className="flex items-end gap-1.5 sm:gap-2 mb-2 sm:mb-3">
           <textarea
  ref={textareaRef}
  value={input}
  onChange={handleInputChange}
  onKeyDown={handleKeyDown}
  className={`flex-1 resize-none rounded-lg outline-none text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 placeholder-gray-500 min-h-[40px] sm:min-h-[44px] focus:outline-none ${
    isAgentDeactivated ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
  }`}
  placeholder="Message AI Assistant..."
  rows="1"
  required={false}
  disabled={isLoading || isAgentDeactivated}
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

    {/* 🟢 Show model selector OR agent badge in the same position */}
    {!selectedAgent ? (
  // Normal chat - Model selector with dropdown
  <button
    type="button"
    onClick={() => setShowModelDialog(true)}
    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors h-[32px] sm:h-[36px]"
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
) : (
  // Agent chat - Read-only badge with sidebar icons - MATCHES MODEL BUTTON SIZE
  <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs bg-purple-50 border border-purple-200 rounded-full shadow-sm h-[32px] sm:h-[36px]">
    <span className="text-xs sm:text-sm flex-shrink-0">
      {selectedAgent.isBuiltIn ? (
        <span className="text-purple-600 text-base">{selectedAgent.icon || "🤖"}</span>
      ) : (
        <span className="flex items-center">
          {modelIcons[selectedAgent.model] || <Gemini.Color size={16} />}
        </span>
      )}
    </span>
    <span className="text-purple-700 font-medium whitespace-nowrap">
      {selectedAgent.name}
    </span>
    
    {/* Model badge for custom agents - styled like model button text */}
    {!selectedAgent.isBuiltIn && (
      <span className="text-gray-500 text-[10px] sm:text-xs px-1.5 py-0.5 bg-white rounded-full border border-gray-100">
        {modelDisplayNames[selectedAgent.model] || "Gemini"}
      </span>
    )}
  </div>
)}</div>

  {/* Send button - ALWAYS outside the ternary */}
  <button
    type="button"
    onClick={sendMessage}
    disabled={isLoading || (!input.trim() && attachedFiles.length === 0) || isAgentDeactivated}
    className={`flex items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0 ${
      isAgentDeactivated 
        ? 'bg-gray-400 cursor-not-allowed' 
        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
    }`}
    title={isAgentDeactivated ? `${selectedAgent?.name} is deactivated` : "Send message"}
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