"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { Meta, OpenAI, Gemini, Claude, Mistral, DeepSeek } from '@lobehub/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

  // Custom components for ReactMarkdown
  const MarkdownComponents = {
    // Headers
    h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900 border-b pb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900">{children}</h2>,
    h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900">{children}</h3>,
    h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2 text-gray-900">{children}</h4>,
    
    // Paragraphs
    p: ({ children }) => <p className="mb-4 leading-relaxed text-gray-800">{children}</p>,
    
    // Lists
    ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-1 text-gray-800">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-1 text-gray-800">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    
    // Code blocks
    code: ({ node, inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        return (
          <div className="my-4 rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-800 text-gray-200 px-4 py-2 text-sm font-mono flex justify-between items-center">
              <span className="uppercase">{language}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                }}
                className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="overflow-x-auto">
              <SyntaxHighlighter
                style={atomDark}
                language={language}
                PreTag="div"
                className="text-sm !m-0"
                customStyle={{ 
                  margin: 0, 
                  borderRadius: 0,
                  background: '#1f2937'
                }}
                showLineNumbers={true}
                wrapLongLines={false}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      } else if (inline) {
        return (
          <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-gray-800 border border-gray-300">
            {children}
          </code>
        );
      } else {
        // For code blocks without language specification
        return (
          <div className="my-4 rounded-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-800 text-gray-200 px-4 py-2 text-sm font-mono">
              Code
            </div>
            <div className="overflow-x-auto">
              <pre className="bg-gray-900 text-gray-100 p-4 text-sm font-mono m-0">
                <code>{children}</code>
              </pre>
            </div>
          </div>
        );
      }
    },
    
    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-purple-500 pl-4 my-4 italic text-gray-600 bg-purple-50 py-2 rounded-r">
        {children}
      </blockquote>
    ),
    
    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>,
    td: ({ children }) => <td className="px-4 py-3 text-sm text-gray-800">{children}</td>,
    
    // Links
    a: ({ href, children }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-purple-600 hover:text-purple-800 underline"
      >
        {children}
      </a>
    ),
    
    // Strong/Bold
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    
    // Emphasis/Italic
    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
  };

  // Function to render formatted message content
  const renderMessageContent = useCallback((content) => {
    if (!content) return null;

    // Custom markdown parser that handles inline code and bold text
    const parseMarkdown = (text) => {
      const lines = text.split('\n');
      const elements = [];
      let codeBlockIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip empty lines
        if (line.trim() === '') {
          elements.push(<br key={`br-${i}`} />);
          continue;
        }
        
        // Check for headers
        if (line.startsWith('# ')) {
          elements.push(<h1 key={`h1-${i}`} className="text-2xl font-bold mt-6 mb-4 text-gray-900 border-b pb-2">{parseInlineText(line.substring(2))}</h1>);
        } else if (line.startsWith('## ')) {
          elements.push(<h2 key={`h2-${i}`} className="text-xl font-bold mt-5 mb-3 text-gray-900">{parseInlineText(line.substring(3))}</h2>);
        } else if (line.startsWith('### ')) {
          elements.push(<h3 key={`h3-${i}`} className="text-lg font-semibold mt-4 mb-2 text-gray-900">{parseInlineText(line.substring(4))}</h3>);
        } else if (line.startsWith('#### ')) {
          elements.push(<h4 key={`h4-${i}`} className="text-base font-semibold mt-3 mb-2 text-gray-900">{parseInlineText(line.substring(5))}</h4>);
        } 
        // Check for code blocks
        else if (line.startsWith('```')) {
          const language = line.substring(3).trim();
          let codeContent = '';
          i++;
          
          while (i < lines.length && !lines[i].startsWith('```')) {
            codeContent += lines[i] + '\n';
            i++;
          }
          
          const currentIndex = codeBlockIndex;
          codeBlockIndex++;
          
          elements.push(
            <div key={`code-${currentIndex}`} className="my-4 rounded-lg overflow-hidden border border-gray-800 shadow-lg">
              <div className="bg-gray-900 text-gray-200 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300 font-mono">
                    {language.toUpperCase() || 'CODE'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(codeContent.trim());
                    // Create a temporary state for copied feedback
                    const btn = document.querySelector(`[data-code-index="${currentIndex}"]`);
                    if (btn) {
                      const originalText = btn.innerHTML;
                      btn.innerHTML = '<span class="flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Copied!</span></span>';
                      setTimeout(() => {
                        btn.innerHTML = originalText;
                      }, 2000);
                    }
                  }}
                  data-code-index={currentIndex}
                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-md transition-all duration-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
              <div className="relative">
                <SyntaxHighlighter
                  style={atomDark}
                  language={language.toLowerCase()}
                  PreTag="div"
                  className="text-sm !m-0"
                  customStyle={{ 
                    margin: 0,
                    padding: '1.25rem',
                    background: '#111827',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  }}
                  showLineNumbers={true}
                  lineNumberStyle={{
                    color: '#6B7280',
                    minWidth: '3em',
                    paddingRight: '1em',
                    textAlign: 'right',
                    userSelect: 'none'
                  }}
                  wrapLines={true}
                  lineProps={{
                    style: {
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }
                  }}
                >
                  {codeContent.trim()}
                </SyntaxHighlighter>
              </div>
            </div>
          );
        }
        // Regular text with inline formatting
        else {
          elements.push(
            <div key={`p-${i}`} className="mb-4 leading-relaxed text-gray-800">
              {parseInlineText(line)}
            </div>
          );
        }
      }
      
      return elements;
    };

    // Helper function to parse inline formatting (bold, code, etc.)
    const parseInlineText = (text) => {
      const parts = [];
      let lastIndex = 0;
      
      // Process bold text (**bold**)
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let match;
      
      // First collect all matches
      const matches = [];
      while ((match = boldRegex.exec(text)) !== null) {
        matches.push({
          type: 'bold',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1]
        });
      }
      
      // Also collect inline code matches (`code`)
      const codeRegex = /`([^`]+)`/g;
      while ((match = codeRegex.exec(text)) !== null) {
        matches.push({
          type: 'code',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1]
        });
      }
      
      // Sort matches by start position
      matches.sort((a, b) => a.start - b.start);
      
      // Process text with matches
      let currentIndex = 0;
      
      for (const match of matches) {
        // Add text before match
        if (match.start > currentIndex) {
          parts.push(text.substring(currentIndex, match.start));
        }
        
        // Add the match content
        if (match.type === 'bold') {
          parts.push(
            <strong key={`bold-${match.start}`} className="font-semibold text-gray-900">
              {match.content}
            </strong>
          );
        } else if (match.type === 'code') {
          parts.push(
            <code key={`code-${match.start}`} className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-gray-800 border border-gray-300">
              {match.content}
            </code>
          );
        }
        
        currentIndex = match.end;
      }
      
      // Add remaining text
      if (currentIndex < text.length) {
        parts.push(text.substring(currentIndex));
      }
      
      // If no matches were found, return the original text
      if (matches.length === 0) {
        return text;
      }
      
      return parts;
    };
    
    return (
      <div className="markdown-content">
        {parseMarkdown(content)}
      </div>
    );
  }, []);

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
    // Allow sending messages with only files (no text)
    if (!input.trim() && attachedFiles.length === 0) return;

    const generateUniqueId = () =>
      `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create a user message with files attached
    const userMsg = {
      id: generateUniqueId(),
      role: "user",
      text: input.trim(),
      files: attachedFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: getFileType(file.name) // Add file type
      }))
    };

    // Generate and store assistant ID in ref
    currentAssistantIdRef.current = generateUniqueId();

    console.log("🚀 sendMessage called with:", {
      input: input.trim(),
      hasFiles: attachedFiles.length > 0,
      hasActiveChat: !!latestChatIdRef.current,
      currentChatId: latestChatIdRef.current
    });

    console.log("👤 Sending user message with files:", userMsg.files);

    // Update local state
    setMessages(prev => [...prev, userMsg]);
    
    // Store current files before clearing
    const currentFiles = [...attachedFiles];
    
    // Notify parent about USER message and get the chatId
    let currentChatId = latestChatIdRef.current;
    const isFirstMessage = !currentChatId; // Check if this is the first message
    
    if (onNewMessage) {
      console.log("📨 Calling onNewMessage with user message and files");
      const result = onNewMessage(userMsg);
      console.log("🆔 Parent returned:", result);
      
      // Handle the new return format
      if (result && result.chatId) {
        latestChatIdRef.current = result.chatId;
        currentChatId = result.chatId;
        console.log("🔄 Updated latestChatIdRef to:", result.chatId);
      }
    }
    
    // Clear input and attached files
    setInput("");
    setAttachedFiles([]);
    setStatusMsg("");

    // Use the latest chatId after parent has processed the message
    console.log("🌐 Final chatId for API call:", currentChatId);
    
    // Upload files BEFORE streaming message
    if (currentFiles.length > 0) {
      await uploadFilesIfAny(currentChatId);
    }
    
    // Only make API call if there's text or this is the first message
    if (input.trim() || isFirstMessage) {
      // Add is_first_message parameter to the API URL
      const url = `http://127.0.0.1:8000/api/chat/stream/?text=${encodeURIComponent(
        userMsg.text || "[User sent files]"
      )}&model=${encodeURIComponent(selectedModel)}&chat_id=${encodeURIComponent(currentChatId || '')}&is_first_message=${isFirstMessage}`;

      console.log("🔗 Making API call to:", url);

      // Set loading state
      if (onSetLoading) onSetLoading(true);

      // Add a small delay to ensure the chat is properly created before making the API call
      setTimeout(() => {
        makeAPIRequest(userMsg.text || "[User sent files]", currentChatId, currentAssistantIdRef.current, url);
      }, 100);
    } else {
      // If no text but we have files, just update loading state
      if (onSetLoading) onSetLoading(false);
    }
  }, [input, attachedFiles, onNewMessage, selectedModel, onSetLoading]);

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

    // Increase timeout to 2 minutes for longer responses
    const timeoutId = setTimeout(() => {
      if (!receivedFirstMessage && !hasImage) {
        console.log("⏰ Request timeout for chat:", chatId);
        es.close();
        currentStreamRef.current = null;
        if (onSetLoading) onSetLoading(false);
        setStatusMsg("Request timeout. The response is taking longer than expected.");
      }
    }, 120000); // 2 minutes instead of 30 seconds

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
      
      // Reset timeout timer every time we receive data
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
        clearTimeout(timeoutId);
        
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
        clearTimeout(timeoutId);
        return;
      }

      if (data.startsWith("[ERROR]")) {
        console.error("❌ Stream error:", data);
        es.close();
        currentStreamRef.current = null;
        setStatusMsg(data.replace("[ERROR]", ""));
        if (onSetLoading) onSetLoading(false);
        clearTimeout(timeoutId);
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

      // Reset timeout after processing each message
      clearTimeout(timeoutId);
      setTimeout(() => {
        if (!receivedFirstMessage && !hasImage) {
          console.log("⏰ Request timeout for chat:", chatId);
          es.close();
          currentStreamRef.current = null;
          if (onSetLoading) onSetLoading(false);
          setStatusMsg("Request timeout. The response is taking longer than expected.");
        }
      }, 120000);
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
          <div className="space-y-3 max-w-3xl mx-auto pt-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`${m.role === "user" ? "max-w-[90%] sm:max-w-[85%]" : "max-w-[90%] sm:max-w-[85%]"}`}
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
                    <span className="ml-2 text-gray-500 text-sm">
                      
                    </span>
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
            input || attachedFiles.length > 0 ? "ring-1 sm:ring-2 ring-purple-300" : ""
          } ${input || attachedFiles.length > 0 ? "bg-purple-50" : "bg-gray-100"}`}
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
              required={false} // Not required since files can be sent without text
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