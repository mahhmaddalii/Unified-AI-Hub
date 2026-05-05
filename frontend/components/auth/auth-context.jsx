"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, fetchWithAuth, getAccessToken, logoutUser } from "../../utils/auth";
import { clearBillingCache, setBillingCache } from "../../utils/billing";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyBillingSnapshot = useCallback((billing) => {
    setBillingCache(billing || null);
    setUser((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        billing: billing || null,
      };
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      clearBillingCache();
      setLoading(false);
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/api/me/`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        setBillingCache(data?.billing || null);
        setUser(data);
      } else if (res.status === 401) {
        logoutUser();
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBilling = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      applyBillingSnapshot(null);
      return null;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/api/billing/status/`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        const billing = data?.billing || null;
        applyBillingSnapshot(billing);
        return billing;
      }
      if (res.status === 401) {
        logoutUser();
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to refresh billing:", err);
    }

    return null;
  }, [applyBillingSnapshot]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    logoutUser();
    clearBillingCache();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    refreshUser,
    refreshBilling,
    applyBillingSnapshot,
    logout,
  }), [user, loading, refreshUser, refreshBilling, applyBillingSnapshot, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
