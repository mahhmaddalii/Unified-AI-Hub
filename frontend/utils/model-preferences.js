import { DeepSeek, OpenAI, Gemini, Claude, Mistral, Meta } from '@lobehub/icons';
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";
import ArrowsRightLeftIcon from "@heroicons/react/24/outline/ArrowsRightLeftIcon";

const STORAGE_KEY = "defaultModelId";
export const DEFAULT_MODEL_ID = "gemini-flashlite";

export const MODEL_OPTIONS = [
  { id: "auto", name: "Auto", description: "Automatically choose the best model for each message", icon: <SparklesIcon className="w-6 h-6 text-purple-600" />, tier: "pro" },
  { id: "models-router", name: "Models Router", description: "Randomly selects free models supporting required features", icon: <ArrowsRightLeftIcon className="w-6 h-6 text-purple-600" />, tier: "free" },
  { id: "deepseek-chat", name: "DeepSeek Chat", description: "Best for general conversation", icon: <DeepSeek.Color size={20} />, tier: "pro" },
  { id: "claude-3 haiku", name: "Claude 3", description: "Helpful for creative writing", icon: <Claude.Color size={20} />, tier: "pro" },
  { id: "gpt5-nano", name: "GPT-5 Nano", description: "Good for complex reasoning", icon: <OpenAI size={20} />, tier: "pro" },
  { id: "gpt-oss-120b", name: "GPT-Oss ", description: "Open-weight OpenAI model for reasoning, agents, production use", icon: <OpenAI size={20} />, tier: "free" },
  { id: "gemini-flashlite", name: "Gemini Pro", description: "Great for multimodal tasks", icon: <Gemini.Color size={20} />, tier: "pro" },
  { id: "gemini-2.5-flash-image", name: "Gemini 2.5 Flash", description: "Image generation & preview", icon: <Gemini.Color size={20} />, tier: "pro" },
  { id: "llama guard 4", name: "Llama 3", description: "Open-source alternative", icon: <Meta size={20} />, tier: "pro" },
  { id: "mistral nemo", name: "Mistral", description: "Efficient and fast", icon: <Mistral.Color size={20} />, tier: "pro" },
];

export const getDefaultModelId = () => {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && MODEL_OPTIONS.some((model) => model.id === stored)) {
    return stored;
  }
  return DEFAULT_MODEL_ID;
};

export const setDefaultModelId = (modelId) => {
  if (typeof window === "undefined") return;
  if (!MODEL_OPTIONS.some((model) => model.id === modelId)) return;
  localStorage.setItem(STORAGE_KEY, modelId);
  window.dispatchEvent(new CustomEvent("default-model-changed", { detail: modelId }));
};

export const subscribeDefaultModel = (callback) => {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (event) => {
    callback(event.detail);
  };

  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      callback(event.newValue);
    }
  };

  window.addEventListener("default-model-changed", handleCustomEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("default-model-changed", handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
};
