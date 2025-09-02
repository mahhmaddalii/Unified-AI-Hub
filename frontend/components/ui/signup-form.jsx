"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL, setTokens } from "../../utils/auth.js";

export default function SignupForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Real-time password match validation
    let newErrors = { ...errors };
    if (name === "confirmPassword" || name === "password") {
      if (name === "confirmPassword" && value !== formData.password) {
        newErrors.confirmPassword = "Passwords do not match.";
      } else if (name === "password" && formData.confirmPassword !== value) {
        newErrors.confirmPassword = "Passwords do not match.";
      } else {
        delete newErrors.confirmPassword;
      }
    }
    setErrors(newErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setFormMessage({ type: "", text: "" });

    // Final password match check
    if (formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match.",
      }));
      setIsLoading(false);
      return;
    }

    try {
      // Use the correct endpoint and field names that match your serializer
      const response = await fetch(`${API_URL}/api/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,    // Matches your serializer field
          lastName: formData.lastName,      // Matches your serializer field
          email: formData.email,            // Matches your serializer field
          password: formData.password,      // Matches your serializer field
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store JWT tokens after successful signup
        if (data.access && data.refresh) {
          setTokens({ access: data.access, refresh: data.refresh });
        }

        setFormMessage({
          type: "success",
          text: "✅ Registration successful! Redirecting to chat...",
        });
        
        // Redirect to chat after successful signup
        setTimeout(() => {
          router.push("/chat");
        }, 1500);
      } else {
        // Handle different error formats from Django
        let errorMessage = "❌ Registration failed. Please try again.";
        
        if (data.error) {
          errorMessage = `❌ ${data.error}`;
        } else if (data.detail) {
          errorMessage = `❌ ${data.detail}`;
        } else if (typeof data === 'object') {
          // Handle Django serializer errors
          const firstError = Object.values(data)[0];
          if (Array.isArray(firstError)) {
            errorMessage = `❌ ${firstError[0]}`;
          } else if (typeof firstError === 'object') {
            errorMessage = `❌ ${Object.values(firstError)[0]}`;
          } else if (typeof firstError === 'string') {
            errorMessage = `❌ ${firstError}`;
          }
        }
        
        setFormMessage({
          type: "error",
          text: errorMessage,
        });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setFormMessage({
        type: "error",
        text: "❌ Network error. Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col text-center w-full">
      <h3 className="text-4xl font-extrabold text-gray-900 mb-3">Sign Up</h3>
      <p className="text-gray-700 mb-6">Create your new account</p>

      {/* First + Last Name */}
      <div className="flex gap-4 mb-4">
        <div className="w-1/2 text-left">
          <label htmlFor="firstName" className="block text-sm text-gray-900 mb-1">First Name:</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 text-sm bg-gray-100 rounded-xl outline-none focus:bg-gray-200"
          />
        </div>
        <div className="w-1/2 text-left">
          <label htmlFor="lastName" className="block text-sm text-gray-900 mb-1">Last Name:</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 text-sm bg-gray-100 rounded-xl outline-none focus:bg-gray-200"
          />
        </div>
      </div>

      {/* Email */}
      <div className="text-left mb-4">
        <label htmlFor="email" className="block text-sm text-gray-900 mb-1">Email:</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-5 py-3 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200"
        />
      </div>

      {/* Password */}
      <div className="text-left mb-4 relative">
        <label htmlFor="password" className="block text-sm text-gray-900 mb-1">Password:</label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter password"
          value={formData.password}
          onChange={handleChange}
          required
          minLength={8}
          className="w-full px-5 py-3 pr-12 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-9 text-sm text-gray-500"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {/* Confirm Password (frontend-only validation) */}
      <div className="text-left mb-4 relative">
        <label htmlFor="confirmPassword" className="block text-sm text-gray-900 mb-1">Confirm Password:</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Re-enter password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          minLength={8}
          className="w-full px-5 py-3 pr-12 text-sm text-gray-900 bg-gray-100 rounded-2xl outline-none focus:bg-gray-200"
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-4 top-9 text-sm text-gray-500"
        >
          {showConfirmPassword ? "Hide" : "Show"}
        </button>

        {errors.confirmPassword && (
          <p className="text-red-600 text-sm mt-2">{errors.confirmPassword}</p>
        )}
      </div>

      {/* Success or Error Message */}
      {formMessage.text && (
        <p
          className={`text-sm mb-4 ${
            formMessage.type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {formMessage.text}
        </p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 text-white bg-purple-600 hover:bg-purple-700 rounded-2xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Processing..." : "Sign Up"}
      </button>

      <p className="text-sm text-gray-900 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-gray-700 hover:underline">Sign In</Link>
      </p>
    </form>
  );
}