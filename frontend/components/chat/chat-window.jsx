"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";
import Image from "next/image";
import { OpenAI, Gemini, Claude, Mistral, DeepSeek } from '@lobehub/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'react-toastify';
import { useNotifications } from '../../utils/useNotifications';
import rehypeRaw from 'rehype-raw';
import { MODEL_OPTIONS, getDefaultModelId, subscribeDefaultModel } from "../../utils/model-preferences";
import { API_URL, fetchWithAuth, getAccessToken } from "../../utils/auth";
import { useAuth } from "../auth/auth-context";
import {
  canUseAgentForPrompt,
  canUseModelId,
  getAgentBillingBlockMessage,
  hasTokenLimitReached,
  isProModelId,
  sanitizeModelIdForBilling,
  TOKEN_LIMIT_REACHED_MESSAGE,
} from "../../utils/plan-access";

export default function ChatWindow({
  chatId,
  messages: propMessages = [],
  onNewMessage,
  hasActiveChat,
  isLoading,
  onSetLoading,
  selectedAgent = null
}) {
  const router = useRouter();
  const { user, loading: userLoading, refreshBilling } = useAuth();
  const billing = user?.billing || null;
  

  const [messages, setMessages] = useState(propMessages);
  const [input, setInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => getDefaultModelId());
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [isAgentDeactivated, setIsAgentDeactivated] = useState(false);
  const [isLiveUpdatesActive, setIsLiveUpdatesActive] = useState(false);
  const [isStoppingUpdates, setIsStoppingUpdates] = useState(false);
  const [isSendingDraftEmail, setIsSendingDraftEmail] = useState(false);

  // Browser notifications (tab badge + sound) — zero effect on stream logic
  const { notifyMessage, clearNotifications } = useNotifications();

  const modelIcons = {
    "auto": <SparklesIcon className="w-4 h-4 text-purple-600" />,
    "gemini-flashlite": <Gemini.Color size={16} />,
    "deepseek-chat": <DeepSeek.Color size={16} />,
    "claude-3 haiku": <Claude.Color size={16} />,
    "gpt5-nano": <OpenAI size={16} />,
    
    "mistral nemo": <Mistral.Color size={16} />,
  };

  const modelDisplayNames = {
    "auto": "Auto",    
    "gemini-flashlite": "Gemini",
    "deepseek-chat": "DeepSeek",
    "claude-3 haiku": "Claude",
    "gpt5-nano": "GPT-5",
    
    "mistral nemo": "Mistral",
  };


  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const modelDialogRef = useRef(null);
  const chatModelMapRef = useRef(new Map());
  const draftModelRef = useRef(null);

  // These refs survive re-renders but NOT remounts.
  // Since page.jsx uses key={activeChatId}, ChatWindow remounts on every switch.
  // We move stream/state tracking to module-level so they survive remounts.
  const activeStreamsRef = useRef(new Map());
  const chatStatesRef = useRef(new Map());
  const latestChatIdRef = useRef(chatId);
  const prevChatIdRef = useRef(chatId);
  const currentAssistantIdRef = useRef(null);
  const draftManualRef = useRef(false);

  // ─────────────────────────────────────────────────────────────
  // Built-in domain agents now send chat_id only.
  // Backend resolves and owns the actual thread/session identifier.
  // ─────────────────────────────────────────────────────────────

  const buildComsatsUrl = useCallback((text, chatIdForRequest) => {
  const encodedChatId = encodeURIComponent(chatIdForRequest || '');
  const accessToken = encodeURIComponent(getAccessToken() || '');
  return `http://127.0.0.1:8000/api/comsats_agent/stream/?text=${encodeURIComponent(text)}&chat_id=${encodedChatId}&access_token=${accessToken}`;
  }, []);

  const buildCricketUrl = useCallback((text, chatIdForRequest) => {
    const encodedChatId = encodeURIComponent(chatIdForRequest || '');
    const accessToken = encodeURIComponent(getAccessToken() || '');
    return `http://127.0.0.1:8000/api/cricket_agent/stream/?text=${encodeURIComponent(text)}&chat_id=${encodedChatId}&access_token=${accessToken}`;
  }, []);

  const buildPoliticsUrl = useCallback((text, chatIdForRequest) => {
    const encodedChatId = encodeURIComponent(chatIdForRequest || '');
    const accessToken = encodeURIComponent(getAccessToken() || '');
    return `http://127.0.0.1:8000/api/politics_agent/stream/?text=${encodeURIComponent(text)}&chat_id=${encodedChatId}&access_token=${accessToken}`;
  }, []);

  const redirectToPricingForModel = useCallback((modelId) => {
    if (hasTokenLimitReached(billing)) {
      toast.info(TOKEN_LIMIT_REACHED_MESSAGE);
      refreshBilling();
      setShowModelDialog(false);
      return;
    }

    const model = MODEL_OPTIONS.find((option) => option.id === modelId);
    const modelName = model?.name || "This model";
    toast.info(`${modelName} is available on Pro. Upgrade to continue.`);
    setShowModelDialog(false);
    router.push("/pricing");
  }, [billing, refreshBilling, router]);

  // Send stop signal to backend — fire and forget
  const sendStopSignalToBackend = useCallback((chatIdToStop, chatState) => {
    if (!chatState?.hasLiveUpdates) return;

    console.log("🛑 Sending stop signal to backend for chat:", chatIdToStop);

    const activeAgentId = chatState.liveUpdateAgent?.id;
    const url = activeAgentId === 'builtin-politics'
      ? buildPoliticsUrl('stop', chatIdToStop)
      : buildCricketUrl('stop', chatIdToStop);

    const es = new EventSource(url);
    es.onmessage = (event) => {
      if (event.data === '[DONE]' || event.data.includes('stopped')) {
        es.close();
      }
    };
    es.onerror = () => es.close();
    setTimeout(() => es.close(), 5000);
  }, [buildCricketUrl, buildPoliticsUrl]);

  // Flush in-progress assistant message to parent before switching away
  const flushChatStateToParent = useCallback((chatIdToFlush) => {
    const state = chatStatesRef.current.get(chatIdToFlush);
    if (!state) return;

    if (state.buffer && state.assistantMessage) {
      state.assistantMessage.text += state.buffer;
      state.buffer = "";
    }

    if (state.assistantMessage && state.assistantMessage.text) {
      console.log("💾 Flushing assistant message to parent for chat:", chatIdToFlush);
      onNewMessage?.({
        ...state.assistantMessage,
        chatId: chatIdToFlush
      });
    }
  }, [onNewMessage]);

  useEffect(() => {
    if (chatId && selectedAgent && !selectedAgent.isBuiltIn) {
      console.log("✅ Agent chat detected, forcing agent UI for:", selectedAgent.name);
    }
  }, [chatId, selectedAgent]);

  useEffect(() => {
    if (selectedAgent && !selectedAgent.isBuiltIn) {
      setIsAgentDeactivated(selectedAgent.status !== 'active');
      if (selectedAgent.status === 'active') setStatusMsg("");
    } else {
      setIsAgentDeactivated(false);
      setStatusMsg("");
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (selectedAgent) return;

    if (!chatId) {
      const defaultId = getDefaultModelId();
      draftModelRef.current = defaultId;
      draftManualRef.current = false;
      setSelectedModel(defaultId);
      return;
    }

    const existing = chatModelMapRef.current.get(chatId);
    if (existing) {
      setSelectedModel(existing);
      return;
    }

    const initialModel = draftModelRef.current || getDefaultModelId();
    chatModelMapRef.current.set(chatId, initialModel);
    setSelectedModel(initialModel);
  }, [chatId, selectedAgent]);

  useEffect(() => {
    if (userLoading) return;
    if (selectedAgent) return;

    const sanitizedModelId = sanitizeModelIdForBilling(selectedModel, billing);
    if (sanitizedModelId !== selectedModel) {
      setSelectedModel(sanitizedModelId);

      if (chatId) {
        chatModelMapRef.current.set(chatId, sanitizedModelId);
      } else {
        draftModelRef.current = sanitizedModelId;
        draftManualRef.current = false;
      }
    }
  }, [billing, chatId, selectedAgent, selectedModel, userLoading]);

  useEffect(() => {
    const unsubscribe = subscribeDefaultModel((modelId) => {
      if (selectedAgent) return;
      if (chatId) return;
      if (draftManualRef.current) return;
      draftModelRef.current = modelId;
      setSelectedModel(modelId);
    });
    return unsubscribe;
  }, [chatId, selectedAgent]);

  useEffect(() => {
    console.log("🤖 ChatWindow selectedAgent:", selectedAgent);
  }, [selectedAgent]);

  // Clear notification badge when user returns to this chat tab
  useEffect(() => {
    clearNotifications();
  }, [chatId, clearNotifications]);

  useEffect(() => {
    latestChatIdRef.current = chatId;
    console.log("🆔 Active chatId changed to:", chatId);
  }, [chatId]);

  useEffect(() => {
    setMessages(prev => propMessages.map(message => {
      const existing = prev.find(prevMessage => prevMessage.id === message.id);
      return existing
        ? {
            ...message,
            emailDraft: existing.emailDraft ?? message.emailDraft,
            emailDraftReady: existing.emailDraftReady ?? message.emailDraftReady,
            emailDraftDismissed: existing.emailDraftDismissed ?? message.emailDraftDismissed,
            emailSent: existing.emailSent ?? message.emailSent,
          }
        : message;
    }));
  }, [propMessages, chatId]);

  // ─────────────────────────────────────────────────────────────
  // On chatId change: flush, stop backend, close EventSource.
  // NOTE: Because page.jsx uses key={activeChatId}, ChatWindow
  // fully remounts on switch — this effect only fires within
  // a single mount lifecycle. The real fix for cross-mount
  // cleanup is in page.jsx (remove the key prop or lift refs).
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const prevChatId = prevChatIdRef.current;

    if (prevChatId && prevChatId !== chatId) {
      console.log(`Switching from chat ${prevChatId} to ${chatId}`);

      const prevState = chatStatesRef.current.get(prevChatId);

      if (prevState?.hasLiveUpdates) {
        // ── LIVE UPDATES: stop backend loop + close EventSource ──
        console.log("🛑 Live updates active on switch — stopping backend for:", prevChatId);
        sendStopSignalToBackend(prevChatId, prevState);

        // Flush whatever was buffered before closing
        flushChatStateToParent(prevChatId);

        if (activeStreamsRef.current.has(prevChatId)) {
          activeStreamsRef.current.get(prevChatId)?.close();
          activeStreamsRef.current.delete(prevChatId);
        }

        chatStatesRef.current.delete(prevChatId);
      } else {
        // ── NORMAL / CUSTOM AGENT STREAM: let it run in background ──
        // Don't close the EventSource — makeAPIRequest already handles
        // background mode (isActiveChat = false) and accumulates text
        // into state.assistantMessage without touching the UI.
        // The stream will self-terminate on [DONE] or [ERROR].
        console.log("🔄 Normal stream switching to background for:", prevChatId);

        // Flush the current buffer into assistantMessage so background
        // accumulation starts from the correct position
        if (prevState?.buffer && prevState?.assistantMessage) {
          prevState.assistantMessage.text += prevState.buffer;
          prevState.buffer = "";
        }
        // Don't delete chatStatesRef — the stream is still using it
      }

      setIsLiveUpdatesActive(false);
      setIsStoppingUpdates(false);
    }

    prevChatIdRef.current = chatId;
  }, [chatId, flushChatStateToParent, sendStopSignalToBackend]);

  // ─────────────────────────────────────────────────────────────
  // On MOUNT: check if this chat had live updates active
  // (handles the remount-on-switch case from key={activeChatId})
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // When we mount with a chatId, check if there's an orphaned stream
    // from a previous mount that we need to stop
    if (chatId && activeStreamsRef.current.has(chatId)) {
      const orphanedState = chatStatesRef.current.get(chatId);
      if (orphanedState?.hasLiveUpdates) {
        // Don't stop — this is us returning to a chat that had live updates.
        // The stream was already closed on unmount. Just reset the UI.
        setIsLiveUpdatesActive(false);
      }
    }

    // On unmount (actual page navigation / tab close)
    return () => {
      const currentChatId = latestChatIdRef.current;
      if (!currentChatId) return;

      const state = chatStatesRef.current.get(currentChatId);

      // Only forcefully stop live updates — they must not outlive the page.
      // Normal background streams are allowed to finish naturally;
      // the browser will close the connection when the page unloads anyway.
      if (state?.hasLiveUpdates) {
        flushChatStateToParent(currentChatId);
        sendStopSignalToBackend(currentChatId, state);
        if (activeStreamsRef.current.has(currentChatId)) {
          activeStreamsRef.current.get(currentChatId)?.close();
          activeStreamsRef.current.delete(currentChatId);
        }
        chatStatesRef.current.delete(currentChatId);
      }
      // For non-live streams: don't close — let [DONE] terminate them naturally.
    };
  }, []); // Empty deps — only runs on mount/unmount

  const aiModels = MODEL_OPTIONS;
  const EMAIL_DRAFT_TAG = "[EMAIL_DRAFT]";

  const extractEmailDraft = useCallback((rawText, existingDraft = null) => {
    if (typeof rawText !== "string") {
      return { displayText: rawText, emailDraft: existingDraft };
    }

    const parseVisibleDraft = (text) => {
      const normalized = text.replace(/\*\*/g, "").trim();
      const match = normalized.match(
        /(?:^|\n)(?:to|recipient)\s*:\s*(?<recipient>[^\n]+)\n+subject\s*:\s*(?<subject>[^\n]+)\n+body\s*:\s*(?<body>.+)$/is
      );
      if (!match?.groups) return null;

      const recipient_email = (match.groups.recipient || "").trim();
      const subject = (match.groups.subject || "").trim();
      let body = (match.groups.body || "").trim();

      body = body.replace(/\n{1,2}does this .*$/is, "").trim();
      body = body.replace(/\n{1,2}reply\s+["“”']?(yes|send).*$/is, "").trim();

      if (!recipient_email || !subject || !body) return null;
      if (!recipient_email.toLowerCase().includes("@cuilahore.edu.pk")) return null;

      return { recipient_email, subject, body };
    };

    const markerIndex = rawText.indexOf(EMAIL_DRAFT_TAG);
    if (markerIndex === -1) {
      return { displayText: rawText, emailDraft: parseVisibleDraft(rawText) || existingDraft };
    }

    const displayText = rawText.slice(0, markerIndex).trimEnd();
    const payloadText = rawText.slice(markerIndex + EMAIL_DRAFT_TAG.length).trim();

    let emailDraft = existingDraft;
    if (payloadText) {
      try {
        const parsed = JSON.parse(payloadText);
        if (parsed?.recipient_email && parsed?.subject && parsed?.body) {
          emailDraft = parsed;
        }
      } catch {
        // Ignore incomplete JSON until the stream finishes.
      }
    }

    return { displayText, emailDraft: emailDraft || parseVisibleDraft(displayText) };
  }, []);

  const dismissPendingDrafts = useCallback(() => {
    const updates = [];
    setMessages(prev => prev.map(message => {
      if (message.role === "assistant" && message.emailDraft && !message.emailSent && !message.emailDraftDismissed) {
        const updated = { ...message, emailDraftDismissed: true };
        updates.push(updated);
        return updated;
      }
      return message;
    }));
    updates.forEach(updated => onNewMessage?.({ ...updated, chatId: latestChatIdRef.current || chatId }));
  }, [chatId, onNewMessage]);

  const handleSendDraftEmail = useCallback(async (messageId, emailDraft) => {
    if (!emailDraft || isSendingDraftEmail) return;

    setIsSendingDraftEmail(true);
    setStatusMsg("");

    try {
      const response = await fetchWithAuth(`${API_URL}/api/comsats_agent/send-email/`, {
        method: "POST",
        body: JSON.stringify(emailDraft),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data?.requires_gmail_connect && data?.connect_url) {
          window.open(data.connect_url, "_self");
          return;
        }
        throw new Error(data?.error || "Unable to send email right now.");
      }

      let updatedMessage = null;
      setMessages(prev => prev.map(message => {
        if (message.id === messageId) {
          updatedMessage = { ...message, emailSent: true, emailDraftDismissed: true };
          return updatedMessage;
        }
        return message;
      }));
      if (updatedMessage) {
        onNewMessage?.({ ...updatedMessage, chatId: latestChatIdRef.current || chatId });
      }
      toast.success(data?.message || "Email sent successfully.");
    } catch (error) {
      console.error("Failed to send drafted email:", error);
      const message = error.message || "Unable to send email right now.";
      setStatusMsg(message);
      toast.error(message);
    } finally {
      setIsSendingDraftEmail(false);
    }
  }, [isSendingDraftEmail]);

  const promptCards = [
    { title: "Explain concepts", prompt: "Explain quantum computing in simple terms", icon: "🧠" },
    { title: "Debug code", prompt: "Help me debug this Python function", icon: "🐛" },
    { title: "Creative ideas", prompt: "Generate creative ideas for a new mobile app", icon: "💡" },
    { title: "Summarize content", prompt: "Summarize the key points from this article", icon: "📝" },
  ];

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    const fileTypes = { 'txt': 'Text', 'pdf': 'PDF', 'doc': 'Word', 'docx': 'Word', 'csv': 'CSV' };
    return fileTypes[extension] || 'File';
  };

  const MarkdownComponents = {
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
    p: ({ children }) => <p className="mb-4 leading-7 text-gray-800">{children}</p>,
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
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      if (!inline && match) {
        const [copied, setCopied] = React.useState(false);
        const handleCopy = () => {
          navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };
        return (
          <div className="my-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative group">
            <div className="bg-gray-800 text-gray-200 px-4 py-2.5 text-sm font-mono flex justify-between items-center">
              <span className="uppercase font-medium">{match[1]}</span>
              <button onClick={handleCopy} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5" title="Copy code">
                {copied ? (<><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Copied!</span></>) : (<><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>Copy</span></>)}
              </button>
            </div>
            <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" className="text-sm !m-0" customStyle={{ margin: 0, borderRadius: 0, background: '#1f2937', padding: '1.25rem' }} showLineNumbers wrapLongLines={false} {...props}>
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        );
      }
      return <code className="bg-gray-100/80 rounded-md px-1.5 py-0.5 text-sm font-mono text-gray-800 border border-gray-200">{children}</code>;
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-purple-500 pl-5 my-6 italic text-gray-700 bg-purple-50/60 py-3 rounded-r-lg">{children}</blockquote>
    ),
    table: ({ children }) => {
      const [copied, setCopied] = React.useState(false);
      const tableRef = React.useRef(null);
      const handleTableCopy = () => {
        if (!tableRef.current) return;
        let text = '';
        tableRef.current.querySelectorAll('tr').forEach(row => {
          const rowText = Array.from(row.querySelectorAll('th, td')).map(c => c.innerText.trim()).filter(Boolean).join('\t');
          if (rowText) text += rowText + '\n';
        });
        if (text.trim()) navigator.clipboard.writeText(text.trim()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
      };
      return (
        <div className="overflow-x-auto my-6 border border-gray-200 rounded-lg shadow-sm relative group">
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button onClick={handleTableCopy} className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm border border-gray-200 transition-colors" title={copied ? "Copied!" : "Copy table"}>
              {copied ? <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
            </button>
          </div>
          <table ref={tableRef} className="min-w-full divide-y divide-gray-200 table-auto w-full">{children}</table>
        </div>
      );
    },
    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
    tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors duration-150">{children}</tr>,
    th: ({ children }) => <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50">{children}</th>,
    td: ({ children }) => <td className="px-6 py-4 text-sm text-gray-800 align-top whitespace-normal break-words">{children}</td>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:text-purple-900 underline decoration-purple-300 hover:decoration-purple-600 underline-offset-2 transition-all duration-200 inline-flex items-center gap-1 group">
        {children}
        <svg className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
      </a>
    ),
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
  };

  const renderMessageContent = useCallback((content) => {
    if (!content) return null;
    return (
      <div className="prose prose-sm sm:prose-base prose-headings:text-gray-900 prose-a:no-underline max-w-none break-words leading-7">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={MarkdownComponents}>{content}</ReactMarkdown>
      </div>
    );
  }, []);

  useEffect(() => {
    if (!hasActiveChat || messages.length === 0) return;
    scrollToBottom();
  }, [messages.length, isLoading, hasActiveChat]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = isInputExpanded ? 300 : 120;
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${Math.max(scrollHeight, 24)}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [input, isInputExpanded]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelDialogRef.current && !modelDialogRef.current.contains(event.target)) setShowModelDialog(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function scrollToBottom() {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const showWelcomeScreen = !hasActiveChat || messages.length === 0;

  const uploadFilesIfAny = async (chatId) => {
    if (attachedFiles.length === 0) return;
    try {
      for (const file of attachedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("chat_id", chatId);
        const res = await fetch("http://127.0.0.1:8000/api/chat/upload-document/", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      }
    } catch (err) {
      console.error("❌ File upload error:", err);
      setStatusMsg("File upload failed, continuing without document.");
    }
  };

  const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const handleStopUpdates = useCallback(() => {
  if (isStoppingUpdates) return;
  console.log("🛑 Stop button clicked");
  setIsStoppingUpdates(true);

  const currentChatId = latestChatIdRef.current;
  const currentState = chatStatesRef.current.get(currentChatId);

  const liveUpdateChatId = currentState?.liveUpdateThreadId || currentChatId || '';

  let url;

  if (selectedAgent?.id === 'builtin-cricket') {
    url = buildCricketUrl('stop', liveUpdateChatId);
  } 
  else if (selectedAgent?.id === 'builtin-politics') {
    url = buildPoliticsUrl('stop', liveUpdateChatId);
  } 
  else {
    const accessToken = encodeURIComponent(getAccessToken() || '');
    url = `http://127.0.0.1:8000/api/chat/stream/?text=stop&model=${encodeURIComponent(selectedModel)}&chat_id=${encodeURIComponent(currentChatId || '')}&access_token=${accessToken}`;
  }

  if (onSetLoading) onSetLoading(true);

  const stopResponseId = generateUniqueId();
  const es = new EventSource(url);
  let fullStopMessage = "";

  es.onmessage = (event) => {
    const data = event.data;
    if (data === '[DONE]') {
      es.close();
      if (onSetLoading) onSetLoading(false);
      setIsLiveUpdatesActive(false);
      setIsStoppingUpdates(false);
      const state = chatStatesRef.current.get(currentChatId);
      if (state) state.hasLiveUpdates = false;
      return;
    }
    if (data.startsWith("[ERROR]")) {
      es.close();
      if (onSetLoading) onSetLoading(false);
      setIsStoppingUpdates(false);
      return;
    }
    const processed = data.replace(/\\n/g, '\n');
    fullStopMessage += processed + " ";
    setMessages(prev => {
      const existing = prev.find(m => m.id === stopResponseId);
      if (existing) return prev.map(m => m.id === stopResponseId ? { ...m, text: fullStopMessage } : m);
      return [...prev, { id: stopResponseId, role: "assistant", text: fullStopMessage }];
    });
  };

  es.onerror = () => {
    es.close();
    if (onSetLoading) onSetLoading(false);
    setIsLiveUpdatesActive(false);
    setIsStoppingUpdates(false);
  };
}, [selectedAgent, selectedModel, onSetLoading, isStoppingUpdates, buildCricketUrl, buildPoliticsUrl]);

  const sendMessage = useCallback(async () => {
    try {
      if (selectedAgent && !selectedAgent.isBuiltIn && selectedAgent.status !== 'active') {
        toast.error(`Cannot send message: ${selectedAgent.name} is deactivated. Please activate it first.`);
        return;
      }

      const rawInput = input.trim();
      const agentBlockMessage = getAgentBillingBlockMessage(selectedAgent, billing, rawInput);
      if (agentBlockMessage) {
        setStatusMsg(agentBlockMessage);
        if (agentBlockMessage === TOKEN_LIMIT_REACHED_MESSAGE) {
          toast.info(agentBlockMessage);
          await refreshBilling();
        } else {
          toast.info(agentBlockMessage);
          router.push("/pricing");
        }
        return;
      }

      if (!selectedAgent && !canUseModelId(selectedModel, billing)) {
        redirectToPricingForModel(selectedModel);
        return;
      }

      const hasText = rawInput.length > 0;
      const hasFiles = attachedFiles.length > 0;
      if (!hasText && !hasFiles) return;
      dismissPendingDrafts();

      const userMsgId = generateUniqueId();
        const userMsg = {
          id: userMsgId,
          role: "user",
          text: rawInput,
          files: attachedFiles.map(file => ({ name: file.name, size: file.size, type: getFileType(file.name) }))
        };

      currentAssistantIdRef.current = generateUniqueId();
      setMessages(prev => [...prev, userMsg]);
      const currentFiles = [...attachedFiles];

      let currentChatId = latestChatIdRef.current;
      const isFirstMessage = !currentChatId && (!selectedAgent || selectedAgent.isBuiltIn);

      if (onNewMessage) {
        const result = await onNewMessage(userMsg);
        if (result && result.chatId) {
          latestChatIdRef.current = result.chatId;
          currentChatId = result.chatId;
        }
      }

      if (!currentChatId) {
        setStatusMsg("Unable to start chat right now.");
        return;
      }

      setInput("");
      setAttachedFiles([]);
      setStatusMsg("");

      if (currentFiles.length > 0) await uploadFilesIfAny(currentChatId);

        const apiText = hasText ? rawInput : "[User sent files]";
        const shouldRefreshBillingAfterResponse = Boolean(
          (selectedAgent && canUseAgentForPrompt(selectedAgent, billing, apiText)) ||
          (!selectedAgent && isProModelId(selectedModel))
        );

      let url;
      if (selectedAgent && !selectedAgent.isBuiltIn) {
        const accessToken = encodeURIComponent(getAccessToken() || '');
        url = `http://127.0.0.1:8000/api/custom_agents/stream/?chat_id=${encodeURIComponent(currentChatId)}&agent_id=${encodeURIComponent(selectedAgent.id)}&purpose=${encodeURIComponent(selectedAgent.purpose || "general")}&model=${encodeURIComponent(selectedAgent.model || "gemini-flashlite")}&is_auto=${selectedAgent.isAutoSelected ? "true" : "false"}&system_prompt=${encodeURIComponent(selectedAgent.customPrompt || "")}&text=${encodeURIComponent(apiText)}&access_token=${accessToken}`;
      } else if (selectedAgent?.id === 'builtin-cricket') {
        url = buildCricketUrl(apiText, currentChatId);
      } else if (selectedAgent?.id === 'builtin-politics') {
        url = buildPoliticsUrl(apiText, currentChatId);
      } else if (selectedAgent?.id === 'builtin-comsats') {
        url = buildComsatsUrl(apiText, currentChatId);
      } else {
        const accessToken = encodeURIComponent(getAccessToken() || '');
        url = `http://127.0.0.1:8000/api/chat/stream/?text=${encodeURIComponent(apiText)}&model=${encodeURIComponent(selectedModel)}&chat_id=${encodeURIComponent(currentChatId || '')}&is_first_message=${isFirstMessage}&access_token=${accessToken}`;
      }

        if (onSetLoading) onSetLoading(true);
        setTimeout(() => { makeAPIRequest(apiText, currentChatId, currentAssistantIdRef.current, url, shouldRefreshBillingAfterResponse); }, 100);
      } catch (error) {
        console.error("Failed to start chat:", error);
        setStatusMsg("Unable to start chat right now.");
        onSetLoading?.(false);
      }
    }, [attachedFiles, billing, buildComsatsUrl, buildCricketUrl, buildPoliticsUrl, dismissPendingDrafts, input, onNewMessage, onSetLoading, redirectToPricingForModel, refreshBilling, router, selectedAgent, selectedModel]);

  const makeAPIRequest = useCallback((messageText, targetChatId, assistantId, url, shouldRefreshBillingAfterResponse = false) => {
    if (!targetChatId) return;

    console.log("🔗 Starting stream for chat:", targetChatId, url);

    if (activeStreamsRef.current.has(targetChatId)) {
      activeStreamsRef.current.get(targetChatId)?.close();
      activeStreamsRef.current.delete(targetChatId);
    }

    const es = new EventSource(url);
    activeStreamsRef.current.set(targetChatId, es);

    const chatIdMatch = url.match(/chat_id=([^&]*)/);
    const usedChatId = chatIdMatch ? decodeURIComponent(chatIdMatch[1]) : targetChatId;

    chatStatesRef.current.set(targetChatId, {
      receivedFirstMessage: false,
      hasImage: false,
      assistantMessage: null,
      assistantRawText: "",
      imageUrl: null,
      buffer: "",
      lastUpdateTime: Date.now(),
      hasNotifiedParent: false,
      lastNotifiedTextLength: 0,
      hasLiveUpdates: false,
      liveUpdateAgent: null,
      liveUpdateModel: null,
      liveUpdateThreadId: usedChatId,
      detectedStart: false,
      detectedStop: false,
      lastNotifBlockText: null,
    });

    let inactivityTimeout = setTimeout(() => {
      console.log("⏰ Stream inactivity timeout:", targetChatId);
      flushChatStateToParent(targetChatId);
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
        flushChatStateToParent(targetChatId);
        es.close();
        activeStreamsRef.current.delete(targetChatId);
        chatStatesRef.current.delete(targetChatId);
        if (targetChatId === latestChatIdRef.current) onSetLoading?.(false);
      }, 180000);

      const isActiveChat = targetChatId === latestChatIdRef.current;

      if (data.startsWith('[TITLE]')) {
        onNewMessage?.({ id: `title-${Date.now()}`, role: "system", title: data.replace('[TITLE]', ''), chatId: targetChatId });
        return;
      }

      if (data === '[DONE]') {
        console.log("✅ Stream completed:", targetChatId);
        clearTimeout(inactivityTimeout);
        es.close();
        activeStreamsRef.current.delete(targetChatId);

        if (state.buffer && state.assistantMessage) {
          state.assistantRawText += state.buffer;
          const parsed = extractEmailDraft(state.assistantRawText, state.assistantMessage.emailDraft);
          state.assistantMessage.text = parsed.displayText;
          if (parsed.emailDraft) {
            state.assistantMessage.emailDraft = parsed.emailDraft;
          }
          state.buffer = "";
        }

        if (state.assistantMessage) {
          if (state.assistantMessage.emailDraft) {
            state.assistantMessage.emailDraftReady = true;
          }
          // Always notify parent so background completions are saved to chatMessages
          onNewMessage?.({ ...state.assistantMessage, id: assistantId, chatId: targetChatId });
          if (isActiveChat) {
            setMessages(prev => prev.map(m => (
              m.id === assistantId
                ? {
                    ...m,
                    text: state.assistantMessage.text,
                    emailDraft: state.assistantMessage.emailDraft,
                    emailDraftReady: state.assistantMessage.emailDraftReady,
                  }
                : m
            )));
          }
        }

        // Always clear loading — even for background chats (clears the spinner dot in sidebar)
        onSetLoading?.(false);
        chatStatesRef.current.delete(targetChatId);
        if (shouldRefreshBillingAfterResponse) {
          refreshBilling();
        }
        return;
      }

      if (data.startsWith('[IMAGE]')) {
        state.imageUrl = data.replace('[IMAGE]', '');
        state.hasImage = true;
        if (state.assistantMessage) {
          state.assistantMessage.image = state.imageUrl;
          onNewMessage?.({ ...state.assistantMessage, chatId: targetChatId });
        } else {
          const msg = { id: assistantId, role: "assistant", text: state.buffer || "", image: state.imageUrl };
          state.assistantMessage = msg;
          onNewMessage?.({ ...msg, chatId: targetChatId });
        }
        return;
      }

      if (data.startsWith("[ERROR]")) {
        const errorMessage = data.replace("[ERROR]", "");
        console.error("❌ Stream error:", data);
        clearTimeout(inactivityTimeout);
        flushChatStateToParent(targetChatId);
        es.close();
        activeStreamsRef.current.delete(targetChatId);
        chatStatesRef.current.delete(targetChatId);
        if (errorMessage === TOKEN_LIMIT_REACHED_MESSAGE) {
          toast.info(errorMessage);
          refreshBilling();
        } else if (errorMessage.toLowerCase().includes("upgrade to pro")) {
          toast.info(errorMessage);
          router.push("/pricing");
        } else if (isActiveChat) {
          toast.error(errorMessage);
        }
        if (isActiveChat) { setStatusMsg(errorMessage); onSetLoading?.(false); }
        return;
      }

      const processed = data.replace(/\\n/g, '\n');
      state.buffer += ' ' + processed;

      // Live updates detection
      // ── Live Updates Detection (Cricket + Politics) ──
      const fullSoFar = (state.assistantMessage?.text || '') + state.buffer;
      const normalizedFull = fullSoFar.replace(/\s+/g, ' ').trim().toLowerCase();

      if (!state.detectedStart) {
        // Cricket
        if (normalizedFull.includes("starting live updates for") || normalizedFull.includes("--- 🔴 live update")) {
          console.log("🔴 Cricket live updates detected - activating Stop button");
          setIsLiveUpdatesActive(true);
          state.hasLiveUpdates = true;
          state.liveUpdateAgent = selectedAgent ? { id: selectedAgent.id, isBuiltIn: selectedAgent.isBuiltIn } : null;
          state.liveUpdateModel = selectedModel;
          state.detectedStart = true;
        }

        // Politics
        if (normalizedFull.includes("starting live politics news") || 
            normalizedFull.includes("latest politics update") || 
            normalizedFull.includes("politics news updates for") ||
            normalizedFull.includes("live politics news updates")) {
          console.log("📰 Politics live news detected - activating Stop button");
          setIsLiveUpdatesActive(true);
          state.hasLiveUpdates = true;
          state.liveUpdateAgent = selectedAgent ? { id: selectedAgent.id, isBuiltIn: selectedAgent.isBuiltIn } : null;
          state.liveUpdateModel = selectedModel;
          state.detectedStart = true;
        }
      }

      if (!state.detectedStop) {
        if (normalizedFull.includes("live updates stopped") || 
            normalizedFull.includes("politics news updates stopped")) {
          console.log("🛑 Stop detected - deactivating Stop button");
          setIsLiveUpdatesActive(false);
          state.hasLiveUpdates = false;
          state.detectedStop = true;
        }
      }

      const now = Date.now();

      if (isActiveChat) {
        if (!state.receivedFirstMessage) {
          state.receivedFirstMessage = true;
          const existing = messages.find(m => m.id === assistantId);
          state.assistantRawText = state.buffer;
          const parsed = extractEmailDraft(state.assistantRawText, existing?.emailDraft);
          state.assistantMessage = existing
            ? {
                ...existing,
                text: parsed.displayText,
                emailDraft: parsed.emailDraft ?? existing.emailDraft,
                emailDraftReady: false,
              }
            : {
                id: assistantId,
                role: "assistant",
                text: parsed.displayText,
                emailDraft: parsed.emailDraft,
                emailDraftReady: false,
                emailDraftDismissed: false,
                emailSent: false,
              };

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
            state.assistantRawText += state.buffer;
            const parsed = extractEmailDraft(state.assistantRawText, state.assistantMessage.emailDraft);
            state.assistantMessage.text = parsed.displayText;
            if (parsed.emailDraft) {
              state.assistantMessage.emailDraft = parsed.emailDraft;
            }
            setMessages(prev => prev.map(m => (
              m.id === assistantId
                ? {
                    ...m,
                    text: state.assistantMessage.text,
                    emailDraft: state.assistantMessage.emailDraft,
                    emailDraftReady: false,
                  }
                : m
            )));
            state.buffer = "";
            state.lastUpdateTime = now;
            state.lastNotifiedTextLength = state.assistantMessage.text.length;
          }
        }
      } else {
        // Background mode — chat is not currently visible
        if (state.assistantMessage) {
          state.assistantRawText += state.buffer;
          const parsed = extractEmailDraft(state.assistantRawText, state.assistantMessage.emailDraft);
          state.assistantMessage.text = parsed.displayText;
          if (parsed.emailDraft) {
            state.assistantMessage.emailDraft = parsed.emailDraft;
          }
        } else if (state.buffer.length > 0) {
          state.assistantRawText = state.buffer;
          const parsed = extractEmailDraft(state.assistantRawText);
          state.assistantMessage = {
            id: assistantId,
            role: "assistant",
            text: parsed.displayText,
            emailDraft: parsed.emailDraft,
            emailDraftReady: false,
            emailDraftDismissed: false,
            emailSent: false,
          };
        }
        state.buffer = "";
      }

      // ── NOTIFY: once per live update block, once per second for regular msgs ─
      // For live updates: detect when a NEW block header arrives (🔴 or 📰),
      // notify exactly once for that block, then suppress until next header.
      // For regular messages: throttle to once per second as before.
      if (state.hasLiveUpdates) {
        // Detect a new update block by looking for block header tokens in the
        // most recent buffer chunk (not the full text, to avoid re-triggering)
        const recentChunk = state.buffer || processed || "";
        const isNewBlock = (
          recentChunk.includes("LIVE UPDATE") ||
          recentChunk.includes("FIRST UPDATE") ||
          recentChunk.includes("📰 FIRST") ||
          recentChunk.includes("🔴 LIVE")
        );
        if (isNewBlock && !state.lastNotifBlockText?.includes(recentChunk)) {
          state.lastNotifBlockText = recentChunk;
          notifyMessage(
            selectedAgent?.name || "AI Assistant",
            state.assistantMessage?.text || "",
            true
          );
        }
      } else {
        // Regular message — throttle to once per second
        const lastNotifKey = `lastNotifTime_${targetChatId}`;
        const lastNotifTime = state[lastNotifKey] || 0;
        if (now - lastNotifTime > 1000) {
          state[lastNotifKey] = now;
          notifyMessage(
            selectedAgent?.name || "AI Assistant",
            state.assistantMessage?.text || "",
            false
          );
        }
      }
    };

    es.onerror = (err) => {
      console.error("🔌 SSE error:", targetChatId, err);
      clearTimeout(inactivityTimeout);
      flushChatStateToParent(targetChatId);
      es.close();
      activeStreamsRef.current.delete(targetChatId);
      chatStatesRef.current.delete(targetChatId);
      if (targetChatId === latestChatIdRef.current) { onSetLoading?.(false); setStatusMsg("Connection error"); }
    };

    es.onopen = () => console.log("🔗 SSE opened:", targetChatId);
  }, [extractEmailDraft, flushChatStateToParent, messages, notifyMessage, onNewMessage, onSetLoading, refreshBilling, router, selectedAgent, selectedModel]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !isLiveUpdatesActive && !isSendingDraftEmail) sendMessage();
    }
  }, [isLoading, isLiveUpdatesActive, isSendingDraftEmail, sendMessage]);

  const handlePromptClick = useCallback((prompt) => {
    setInput(prompt);
    setTimeout(() => { textareaRef.current?.focus(); setIsInputExpanded(true); }, 10);
  }, []);

  const handleInputChange = useCallback((e) => { setInput(e.target.value); }, []);
  const toggleInputExpansion = useCallback(() => { setIsInputExpanded(!isInputExpanded); setTimeout(() => textareaRef.current?.focus(), 10); }, [isInputExpanded]);
  const handleAttachClick = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleFileSelect = useCallback((e) => { const files = Array.from(e.target.files); if (files.length > 0) setAttachedFiles(prev => [...prev, ...files]); e.target.value = ''; }, []);
  const removeFile = useCallback((index) => { setAttachedFiles(prev => prev.filter((_, i) => i !== index)); }, []);
  const handleModelSelect = useCallback((modelId) => {
    if (!canUseModelId(modelId, billing)) {
      redirectToPricingForModel(modelId);
      return;
    }

    setSelectedModel(modelId);

    if (!selectedAgent) {
      if (chatId) {
        chatModelMapRef.current.set(chatId, modelId);
      } else {
        draftModelRef.current = modelId;
        draftManualRef.current = true;
      }
    }

    setShowModelDialog(false);
  }, [billing, chatId, redirectToPricingForModel, selectedAgent]);
  const getCurrentModel = useCallback(() => (
    aiModels.find(model => model.id === selectedModel) ||
    aiModels.find(model => model.id === getDefaultModelId()) ||
    aiModels[0]
  ), [selectedModel]);

return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 px-2 py-1 md:px-4 ${
        messages.length > 0 ? "scrollbar-thin overflow-y-auto" : "overflow-hidden"
      }`}
      >
        {showWelcomeScreen ? (
          // Welcome screen
          <div className="flex flex-col items-center justify-center h-full px-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-2xl px-2 sm:px-4">
              {promptCards.map((card, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-2.5 sm:p-3 cursor-pointer hover:border-purple-300 transition-colors text-left"
                  onClick={() => handlePromptClick(card.prompt)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base sm:text-lg flex-shrink-0">{card.icon}</span>
                    <div className="text-left min-w-0 flex-1">
                      <h3 className="font-medium text-gray-800 mb-1 text-xs sm:text-sm">{card.title}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{card.prompt}</p>
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
              <div key={m.id}>
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={m.role === "user" ? "max-w-[90%] sm:max-w-[85%]" : "max-w-[90%] sm:max-w-[85%]"}>
                    <div className="relative overflow-visible">
                      <div
                        className={`rounded-3xl p-4 text-sm ${
                          m.role === "user"
                            ? "bg-purple-600 text-white"
                            : "bg-white text-gray-800"
                        }`}
                      >
                        {m.role === "assistant" ? renderMessageContent(m.text) : <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                        {m.image && (
                          <div className="mt-3 relative group">
                            <img src={m.image} alt="Generated Image" className="rounded-lg max-w-full border border-gray-200 shadow-sm" />
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
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {m.role === "assistant" && m.emailDraft && m.emailDraftReady && !m.emailDraftDismissed && !m.emailSent && (
                          <div className="mt-4 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSendDraftEmail(m.id, m.emailDraft)}
                              disabled={isSendingDraftEmail}
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                isSendingDraftEmail
                                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                  : "bg-purple-600 text-white hover:bg-purple-700"
                              }`}
                            >
                              <span>Send Email</span>
                            </button>
                            <span className="text-xs text-gray-500">
                              {isSendingDraftEmail ? "Sending email..." : "Send this drafted email immediately."}
                            </span>
                          </div>
                        )}
                        {m.role === "assistant" && m.emailSent && (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">
                            <span>Email sent successfully.</span>
                          </div>
                        )}
                        {m.files && m.files.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <div className="text-xs opacity-80 mb-1">🧷 Attached files:</div>
                            {m.files.map((file, idx) => (
                              <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${m.role === "user" ? "bg-white/20" : "bg-gray-100"}`}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-medium">{file.name}</div>
                                  <div className="text-xs opacity-70">{file.type} • {formatFileSize(file.size)}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
                      {m.role === "user" && (
                        <svg className="absolute -right-3 bottom-1" width="26" height="35" viewBox="0 0 26 35">
                          <path d="M0 0 L0 15 Q2 24 12 30 Q18 33 26 35 L0 35 Z" className="fill-purple-600" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Stop Live Updates Button */}
            {isLiveUpdatesActive && (
              <div className="flex justify-center mt-3 mb-1">
                <button
                  onClick={handleStopUpdates}
                  disabled={isStoppingUpdates}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 
                    bg-red-500 hover:bg-red-600 
                    text-white text-sm font-medium rounded-md 
                    shadow-sm transition-all duration-200 
                    focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1
                    ${isStoppingUpdates ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}
                  `}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Stop</span>
                </button>
              </div>
            )}

            {isLoading && !isLiveUpdatesActive && (
              <div className="flex justify-start">
                <div className="max-w-[90%] sm:max-w-[85%]">
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <span className="ml-2 text-gray-500 text-sm"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
                  <svg className="w-3 h-3 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate max-w-[80px] sm:max-w-[120px]">{file.name}</span>
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

      {/* Input area - DISABLED during live updates */}
      <div className="bg-white px-3 sm:px-4 py-1 sm:pt-3 sm:pb-1 relative flex-shrink-0">
        <div
          className={`max-w-3xl mx-auto rounded-xl p-2 sm:p-2 transition-all duration-200 ${
            input || attachedFiles.length > 0
              ? "ring-1 sm:ring-2 ring-purple-300"
              : ""
          } ${
            input || attachedFiles.length > 0 ? "bg-purple-50" : "bg-gray-100"
          } ${isLiveUpdatesActive ? 'opacity-50' : ''}`}
        >
          {isAgentDeactivated && selectedAgent && (
            <div className="px-3 sm:px-4 mb-2">
              <div className="max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 text-sm leading-none mt-[-6px]">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">{selectedAgent.name} is deactivated</p>
                    <p className="text-xs text-red-600 mt-0.5">Activate this agent from the agents dashboard to continue chatting.</p>
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
              className={`flex-1 resize-none rounded-lg outline-none text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 placeholder-gray-500 min-h-[40px] sm:min-h-[44px] focus:outline-none scrollbar-thin ${
                isAgentDeactivated || isLiveUpdatesActive ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
              }`}
              placeholder={isLiveUpdatesActive ? "Live updates in progress... (click Stop button above)" : "Message AI Assistant..."}
              rows="1"
              disabled={isLoading || isAgentDeactivated || isLiveUpdatesActive || isSendingDraftEmail}
            />

          <button
              type="button"
              onClick={toggleInputExpansion}
              className={`hidden xs:flex flex-shrink-0 p-1.5 sm:p-2 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors ${
                isLiveUpdatesActive ? 'opacity-50 pointer-events-none' : ''
              }`}
              title={isInputExpanded ? "Collapse" : "Expand"}
              disabled={isLiveUpdatesActive}
            >
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {isInputExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                )}
              </svg>
            </button>    
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={handleAttachClick}
                className={`p-1.5 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-colors ${
                  isLiveUpdatesActive ? 'opacity-50 pointer-events-none' : ''
                }`}
                title="Attach files"
                disabled={isLiveUpdatesActive || isSendingDraftEmail}
              >
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple disabled={isLiveUpdatesActive || isSendingDraftEmail} />

              {!selectedAgent ? (
                <button
                  type="button"
                  onClick={() => setShowModelDialog(true)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors h-[32px] sm:h-[36px] ${
                    isLiveUpdatesActive ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  title="Change AI model"
                  disabled={isLiveUpdatesActive || isSendingDraftEmail}
                >
                  <span className="text-xs sm:text-sm flex-shrink-0">{getCurrentModel()?.icon}</span>
                  <span className="hidden sm:inline truncate max-w-[80px] lg:max-w-none">{getCurrentModel()?.name}</span>
                  <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs bg-purple-50 border border-purple-200 rounded-full shadow-sm h-[32px] sm:h-[36px]">
                  <span className="text-xs sm:text-sm flex-shrink-0">
                    {selectedAgent.isBuiltIn ? (
                      <span className="text-purple-600 text-base">{selectedAgent.icon || "🤖"}</span>
                    ) : (
                      <span className="flex items-center">{modelIcons[selectedAgent.model] || <Gemini.Color size={16} />}</span>
                    )}
                  </span>
                  <span className="text-purple-700 font-medium whitespace-nowrap">{selectedAgent.name}</span>
                  {!selectedAgent.isBuiltIn && (
                    <span className="text-gray-500 text-[10px] sm:text-xs px-1.5 py-0.5 bg-white rounded-full border border-gray-100">
                      {modelDisplayNames[selectedAgent.model] || "Gemini"}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && attachedFiles.length === 0) || isAgentDeactivated || isLiveUpdatesActive || isSendingDraftEmail}
              className={`flex items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0 ${
                isAgentDeactivated || isLiveUpdatesActive || isSendingDraftEmail
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
              }`}
              title={isSendingDraftEmail ? "Sending drafted email..." : (isLiveUpdatesActive ? "Live updates in progress" : (isAgentDeactivated ? `${selectedAgent?.name} is deactivated` : "Send message"))}
            >
              <Image src="/send.png" alt="Send" width={14} height={14} className="brightness-0 invert sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Live updates indicator */}
        {isLiveUpdatesActive && (
          <div className="max-w-3xl mx-auto mt-2 text-xs text-purple-600 bg-purple-50 rounded-lg py-2 px-3 border border-purple-200 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
            <span>Live updates are active. Click the Stop button above to end updates.</span>
          </div>
        )}
      </div>

      {/* Model selection dialog */}
      {showModelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-transparent bg-opacity-50" onClick={() => setShowModelDialog(false)}>
          <div
            ref={modelDialogRef}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 sm:p-6 w-[85%] max-w-xs sm:w-full sm:max-w-md md:max-w-lg max-h-[60vh] sm:max-h-[80vh] relative"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Select AI Model</h3>
              <button onClick={() => setShowModelDialog(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1" aria-label="Close">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto scrollbar-thin max-h-[calc(75vh-120px)] sm:max-h-[calc(70vh-120px)] pr-1 sm:pr-2">
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
                    <span className="flex-shrink-0 text-lg sm:text-xl">{model.icon}</span>
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <div className="flex w-full items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm truncate text-left">{model.name}</span>
                        {isProModelId(model.id) && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                            Pro
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 truncate w-full text-left">{model.description}</span>
                    </div>
                    {selectedModel === model.id && (
                      <span className="flex-shrink-0 text-purple-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-gray-100">
              <button onClick={() => setShowModelDialog(false)} className="w-full py-2 sm:py-2.5 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
