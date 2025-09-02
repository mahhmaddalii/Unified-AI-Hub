"use client";

import Image from "next/image";
import Navbar from "../components/ui/chat-navbar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    // Check if user has a theme preference saved
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save theme preference
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleGetStarted = () => {
    router.push("/login");
  };

  const handleSignUp = () => {
    router.push("/signup");
  };

  const handlePricing = () => {
    router.push("/pricing");
  };

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 transition-colors duration-300">
      {/* Navbar */}
      <Navbar />

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-24 right-4 z-10 p-3 rounded-full bg-white dark:bg-gray-700 shadow-md hover:shadow-lg transition-all duration-300"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 极速加速器 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
        )}
      </button>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-20 px-6 sm:px-12">
        <div className="animate-float">
          <Image
            src="/logo.png"
            alt="Unified AI Hub Logo"
            width={96}
            height={96}
            className="w-20 h-20 sm:w-24 sm:h-24 mb-6 dark:filter dark:brightness-125"
            priority
          />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight animate-fade-in">
          Unified AI Hub
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl animate-fade-in delay-100">
          Your one-stop platform for multiple AI models, intelligent chatbots,
          and personal data analysis — built for students, professionals, and
          innovators.
        </p>
        <div className="mt-8 flex gap-4 animate-fade-in delay-200">
          <button
            onClick={handleGetStarted}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-2xl text-sm sm:text-base font-medium shadow-lg transition-transform hover:scale-105"
          >
            Get Started
          </button>
          <button 
            onClick={handlePricing}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl text-sm sm:text-base font-medium transition-transform hover:scale-105"
          >
            View Pricing
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 sm:px-12 bg-white dark:bg-gray-800 rounded-t-3xl shadow-inner">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12 animate-fade-in">
          Why Choose Unified AI Hub?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {[
            {
              title: "Multi-AI Integration",
              description: "Access GPT, Gemini, Claude, Llama, and more in one seamless platform.",
              icon: "🤖"
            },
            {
              title: "Intelligent Chatbots",
              description: "Domain-specific chatbots for university, cricket, politics, and more.",
              icon: "💬"
            },
            {
              title: "Personal Data Analyst",
              description: "Upload PDFs, CSVs, or reports and get instant smart insights.",
              icon: "📊"
            }
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/30 p-6 rounded-2xl shadow hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100 + 300}ms` }}
            >
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 sm:px-12 bg-gradient-to-br from-purple-50 to-white dark:from-gray-800 dark:to-gray-900">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          By The Numbers
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { number: "10K+", label: "Active Users" },
            { number: "99.9%", label: "Uptime" },
            { number: "5+", label: "AI Models" },
            { number: "24/7", label: "Support" }
          ].map((stat, index) => (
            <div
              key={index}
              className="text-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100 + 500}ms` }}
            >
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">{stat.number}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 px-6 sm:px-12 bg-white dark:bg-gray-800">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          Perfect For
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[
            {
              icon: "🎓",
              title: "Students & Researchers",
              description: "Accelerate your academic work with AI-powered research assistance and data analysis."
            },
            {
              icon: "💼",
              title: "Professionals",
              description: "Enhance productivity with specialized chatbots and data analysis tools for your industry."
            },
            {
              icon: "👨‍💻",
              title: "Developers & Innovators",
              description: "Build and experiment with multiple AI models through a unified API interface."
            },
            {
              icon: "👥",
              title: "Teams & Organizations",
              description: "Collaborate efficiently with shared AI resources and centralized data analysis."
            }
          ].map((useCase, index) => (
            <div
              key={index}
              className="flex items-start p-6 bg-gradient-to-br from-purple-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${index * 100 + 700}ms` }}
            >
              <div className="text-2xl mr-4">{useCase.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{useCase.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{useCase.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      {/* CTA Section */}
<section className="py-16 px-6 sm:px-12 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white">
  <div className="max-w-4xl mx-auto text-center">
    <h2 className="text-2xl sm:text-3xl font-bold mb-6 animate-fade-in">Ready to Get Started?</h2>
    <p className="text-lg mb-8 max-w-2xl mx-auto animate-fade-in delay-100">
      Join thousands of users who are already transforming their work with Unified AI Hub.
    </p>
    <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in delay-200">
      <button 
        onClick={handleGetStarted}
        className="px-8 py-3 bg-white text-purple-600 hover:bg-gray-100 font-medium rounded-2xl shadow-lg transition-all duration-300 hover:scale-105 transform"
      >
        Login Now
      </button>
    </div>
    <p className="text-sm mt-6 text-purple-200">
      No credit card required • Start exploring AI features instantly
    </p>
  </div>
</section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <div className="flex items-center mb-4 md:mb-0">
              <Image
                src="/logo.png"
                alt="Unified AI Hub Logo"
                width={32}
                height={32}
                className="w-8 h-8 mr-2 dark:filter dark:brightness-125"
              />
              <span className="font-medium text-gray-700 dark:text-gray-300">Unified AI Hub</span>
            </div>
            <div className="flex gap-6 mb-4 md:mb-0">
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition">Privacy</a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition">Terms</a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition">Support</a>
            </div>
          </div>
          <p>© {new Date().getFullYear()} Unified AI Hub. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}