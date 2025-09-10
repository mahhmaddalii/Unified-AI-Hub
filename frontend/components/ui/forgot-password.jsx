"use client";

import { useState } from "react";
import Link from "next/link";
import { API_URL } from "../../utils/auth.js";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      // FIXED: Changed from /forgot-password/ to /api/forgot-password/
      const response = await fetch(`${API_URL}/api/forgot-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "Password reset email has been sent to your inbox.");
      } else {
        // Show the same message regardless of whether email exists (for security)
        setMessage("If this email exists, a reset link has been sent.");
      }
    } catch (error) {
      console.error("Forgot Password error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col text-center w-full">
      <h3 className="text-4xl font-extrabold text-gray-900 mb-3">Forgot Password</h3>
      <p className="text-gray-700 mb-6">Enter your registered email</p>

      <div className="text-left mb-4 animate-fade-in delay-200">
        <label htmlFor="email" className="block text-sm text-gray-900 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-5 py-3 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200"
        />
      </div>

      {/* Success or Error Messages */}
      {message && <p className="text-green-600 text-sm mb-4">{message}</p>}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <div className="w-full flex justify-center">
      <button
        type="submit"
        disabled={isLoading}
      className="w-40 py-3 text-white bg-purple-600 hover:bg-purple-700 rounded-2xl font-bold transition-all duration-300 animate-fade-in delay-600"
        >
        {isLoading ? "Sending..." : "Send Reset Link"}
      </button>
</div>
      <p className="text-sm text-gray-900 mt-6 animate-fade-in delay-700">
        Move to login{" "}
        <Link href="/login" className="font-bold text-gray-700 hover:underline transition-colors duration-300">
          Sign In
        </Link>
      </p>
    </form>
  );
}