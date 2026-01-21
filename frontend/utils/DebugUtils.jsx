"use client";

import { useEffect } from "react";

// Debug hook to log all props and state changes
export function useDebug(name, value) {
  useEffect(() => {
    console.log(`[DEBUG ${name}]`, value);
  }, [name, value]);
}

// Debug component to show current state
export function DebugPanel({ title, data }) {
  return (
    <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs z-50 max-w-xs">
      <div className="font-bold mb-2">🔍 {title}</div>
      <pre className="whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}