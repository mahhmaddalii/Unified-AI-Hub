"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { API_URL, checkActiveSession, setTokens } from "../../utils/auth";
import { getPendingBillingPlan } from "../../utils/billing";

export default function LoginForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const debug = (...args) => {
    if (typeof window !== "undefined") {
      console.log("[GoogleLogin]", ...args);
    }
  };

  // Check for Google auth callback on component mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const session = await checkActiveSession();
      if (!cancelled && session.isAuthenticated) {
        router.replace("/chat");
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access');
      const refreshToken = urlParams.get('refresh');
      const email = urlParams.get('email');
      const success = urlParams.get('success');
      
      if (success === 'true' && accessToken && refreshToken) {
        // Store tokens from Google OAuth
        setTokens({ 
          access: accessToken, 
          refresh: refreshToken 
        });
        const pendingBillingPlan = getPendingBillingPlan();
        setMessage(`✅ Google login successful! Welcome ${email}. Redirecting...`);
        
        // Clean up URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        setTimeout(() => router.push(pendingBillingPlan ? "/pricing" : "/chat"), 1000);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleGoogleTokenLogin = useCallback(async (accessToken) => {
    const session = await checkActiveSession();
    if (session.isAuthenticated) {
      router.replace("/chat");
      return;
    }

    debug("Received Google access token", {
      length: accessToken?.length,
      hasToken: !!accessToken
    });
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/google/token-login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      const data = await response.json();
      debug("Token login response", {
        status: response.status,
        ok: response.ok,
        keys: data ? Object.keys(data) : [],
        hasAccess: !!data?.access,
        hasRefresh: !!data?.refresh,
        hasKey: !!data?.key,
        detail: data?.detail || data?.error || null
      });

      if (response.ok && data.access && data.refresh) {
        setTokens({ access: data.access, refresh: data.refresh });
        const pendingBillingPlan = getPendingBillingPlan();
        setMessage("✅ Google login successful! Redirecting...");
        setTimeout(() => router.push(pendingBillingPlan ? "/pricing" : "/chat"), 800);
      } else {
        setError(data.detail || "Google login failed. Please try again.");
      }
    } catch (err) {
      console.error("Google token login error:", err);
      debug("Token login exception", { message: err?.message });
      setError("Google login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!googleClientId) return;

    const initClient = () => {
      if (!window.google?.accounts?.oauth2) return;
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "openid email profile",
        callback: (tokenResponse) => {
          debug("Google token response", {
            hasAccessToken: !!tokenResponse?.access_token,
            expiresIn: tokenResponse?.expires_in,
            error: tokenResponse?.error,
            errorDescription: tokenResponse?.error_description
          });
          if (tokenResponse?.access_token) {
            handleGoogleTokenLogin(tokenResponse.access_token);
          } else {
            setError("Google login failed. Please try again.");
          }
        },
      });
      debug("Google token client initialized");
      setTokenClient(client);
      setIsGoogleReady(true);
    };

    if (window.google?.accounts?.oauth2) {
      debug("Google Identity Services already loaded");
      initClient();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initClient;
    script.onerror = () => {
      debug("Failed to load Google Identity Services script");
      setError("Failed to load Google Sign-In.");
    };
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [googleClientId, handleGoogleTokenLogin]);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === "checkbox" ? checked : value 
    }));
  };

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      setError("Google Client ID is missing. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID.");
      return;
    }
    if (!tokenClient) {
      setError("Google Sign-In is still loading. Please try again.");
      return;
    }
    debug("Requesting Google access token");
    tokenClient.requestAccessToken({ prompt: "select_account" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const session = await checkActiveSession();
    if (session.isAuthenticated) {
      router.replace("/chat");
      return;
    }
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          remember: formData.remember
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTokens({ 
          access: data.access, 
          refresh: data.refresh,
          remember: formData.remember 
        });
        const pendingBillingPlan = getPendingBillingPlan();
        
        setMessage("✅ Login successful! Redirecting...");
        setTimeout(() => router.push(pendingBillingPlan ? "/pricing" : "/chat"), 1000);
      } else {
        setError(data.error || "Invalid credentials. Try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col text-center w-full">
        <h3 className="text-4xl font-extrabold text-gray-900 mb-3">Sign In</h3>
        <p className="text-gray-700 mb-6">Enter your email and password</p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={!isGoogleReady || isLoading}
          className="flex items-center justify-center w-full py-3 mb-6 text-sm font-medium text-gray-900 bg-gray-200 rounded-2xl hover:bg-gray-300 transition-all duration-300 animate-fade-in delay-200"
        >
          <img src="/logo-google.png" alt="Google" className="h-5 mr-2" />
          Continue with Google
        </button>

        <div className="flex items-center mb-6 animate-fade-in delay-300">
          <hr className="flex-grow border-gray-300" />
          <span className="mx-3 text-gray-500 text-sm">or</span>
          <hr className="flex-grow border-gray-300" />
        </div>

        <div className="text-left mb-4 animate-fade-in delay-400">
          <label htmlFor="email" className="block text-sm text-gray-900 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            required
           className="w-full px-5 py-3 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200 transition-all duration-300"
          />
        </div>

        <div className="text-left mb-4 relative animate-fade-in delay-500">
          <label htmlFor="password" className="block text-sm text-gray-900 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-5 py-3 pr-12 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200 transition-all duration-300"
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute top-9 right-4 text-gray-500 hover:text-gray-700 transition-colors duration-300"
          >
            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Success or Error Messages */}
        {message && <p className="text-green-600 text-sm mb-4 animate-fade-in">{message}</p>}
        {error && <p className="text-red-600 text-sm mb-4 animate-fade-in">{error}</p>}

        <div className="flex justify-between items-center text-sm mb-6 animate-fade-in delay-600">
          <label className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
              className="form-checkbox text-purple-600 transition-colors duration-300" 
            />
            <span className="text-gray-900">Remember me</span>
          </label>
          <Link href="/forgotpassword" className="text-purple-600 hover:underline transition-colors duration-300">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
        className="w-full py-3 text-white bg-purple-600 hover:bg-purple-700 rounded-2xl font-bold transition-all duration-300 animate-fade-in delay-700"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>

        <p className="text-sm text-gray-900 mt-6 animate-fade-in delay-800">
          Not registered yet?{" "}
          <Link href="/signup" className="font-bold text-gray-700 hover:underline transition-colors duration-300">
            Create an Account
          </Link>
        </p>
      </form>
    </div>
  );
}





