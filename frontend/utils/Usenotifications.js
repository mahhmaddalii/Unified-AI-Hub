"use client";

import { useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useNotifications
//
// Shows browser tab badge "(3) Unified AI Hub" + sound + browser popup
// whenever a message arrives while the browser tab is hidden.
//
// The chat-window calls notifyMessage() once per second (throttled there),
// so this hook just increments count, updates title, plays sound, and
// sends a popup on the first call per live-update session.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_TITLE = "Unified AI Hub";

// Module-level AudioContext so it survives re-renders
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      return null;
    }
  }
  return audioCtx;
}

function playNotificationSound(isLiveUpdate = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // Live update → single soft tick
  // Regular message → two-tone Facebook-style chime
  const notes = isLiveUpdate
    ? [{ freq: 880, start: 0, dur: 0.09, gain: 0.2 }]
    : [
        { freq: 523.25, start: 0,    dur: 0.18, gain: 0.28 }, // C5
        { freq: 659.25, start: 0.15, dur: 0.22, gain: 0.24 }, // E5
      ];

  notes.forEach(({ freq, start, dur, gain }) => {
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(0, now + start);
      gainNode.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    } catch (_) {}
  });
}

export function useNotifications() {
  const unreadCountRef = useRef(0);
  const liveSessionNotifiedRef = useRef(false); // popup shown for this live session?
  const isTabHiddenRef = useRef(false);

  // ── Sync tab visibility to ref ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Set initial value immediately
    isTabHiddenRef.current = document.hidden;

    const handleVisibilityChange = () => {
      isTabHiddenRef.current = document.hidden;
      // Reset live session notification flag when user comes back
      if (!document.hidden) {
        liveSessionNotifiedRef.current = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ── Title badge ───────────────────────────────────────────────────────────
  const updateTitleBadge = useCallback((count) => {
    if (typeof document === "undefined") return;
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
  }, []);

  // ── Browser popup notification ────────────────────────────────────────────
  const sendBrowserNotification = useCallback(async (title, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (_) {}
    }

    if (Notification.permission !== "granted") return;

    try {
      const n = new Notification(title, {
        body: (body || "You have a new message").substring(0, 120),
        icon: "/logo.png",
        badge: "/logo.png",
        tag: "ai-hub-message",
        renotify: true,
        silent: true,
      });
      setTimeout(() => n.close(), 6000);
    } catch (_) {}
  }, []);

  // ── Main API ──────────────────────────────────────────────────────────────
  // Called by chat-window once per second (throttled there).
  // Guards on isTabHiddenRef — only fires when browser tab is hidden.
  const notifyMessage = useCallback((chatTitle, previewText, isLiveUpdate = false) => {
    if (!isTabHiddenRef.current) return;

    unreadCountRef.current += 1;
    updateTitleBadge(unreadCountRef.current);

    // Sound: play on every call (already throttled to 1/sec by caller)
    playNotificationSound(isLiveUpdate);

    // Popup:
    // - Regular message: every call = each discrete background completion
    // - Live update: once per live session only (would be too spammy otherwise)
    const shouldPopup = isLiveUpdate ? !liveSessionNotifiedRef.current : true;

    if (shouldPopup) {
      if (isLiveUpdate) liveSessionNotifiedRef.current = true;

      const title = isLiveUpdate
        ? `🔴 Live Score Update — ${chatTitle}`
        : `💬 ${chatTitle} replied`;

      const preview = previewText
        ? previewText.replace(/#+\s*/g, "").trim().slice(-100)
        : "You have a new message";

      sendBrowserNotification(title, preview);
    }
  }, [updateTitleBadge, sendBrowserNotification]);

  // ── Clear badge + reset state ─────────────────────────────────────────────
  const clearNotifications = useCallback(() => {
    unreadCountRef.current = 0;
    liveSessionNotifiedRef.current = false;
    updateTitleBadge(0);
  }, [updateTitleBadge]);

  // Auto-clear when user returns to tab
  useEffect(() => {
    const handleReturn = () => {
      if (!document.hidden) clearNotifications();
    };
    document.addEventListener("visibilitychange", handleReturn);
    window.addEventListener("focus", handleReturn);
    return () => {
      document.removeEventListener("visibilitychange", handleReturn);
      window.removeEventListener("focus", handleReturn);
    };
  }, [clearNotifications]);

  return { notifyMessage, clearNotifications };
}