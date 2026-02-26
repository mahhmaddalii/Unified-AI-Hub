"use client";

import { useState, useEffect } from "react";
import { 
  XMarkIcon, 
  InformationCircleIcon, 
  SparklesIcon,
  UsersIcon, 
  ChevronDownIcon,
  CodeBracketIcon, 
  LightBulbIcon, 
  WrenchScrewdriverIcon, 
  BeakerIcon, 
  CameraIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";

// AI Models list
import { OpenAI, Gemini, Claude, Mistral, DeepSeek } from '@lobehub/icons';

const aiModels = [
  { 
    id: "deepseek-chat", 
    name: "DeepSeek Chat", 
    description: "Best for general conversation", 
    icon: <DeepSeek.Color size={20} />,
    color: "from-green-500 to-emerald-500"
  },
  { 
    id: "claude-3 haiku", 
    name: "Claude 3 Haiku", 
    description: "Helpful for creative writing", 
    icon: <Claude.Color size={20} />,
    color: "from-purple-500 to-violet-500"
  },
  { 
    id: "gpt5-nano", 
    name: "GPT-5 Nano", 
    description: "Good for complex reasoning", 
    icon: <OpenAI size={20} />,
    color: "from-indigo-500 to-blue-500"
  },
  { 
    id: "gemini-flashlite", 
    name: "Gemini Flash Lite", 
    description: "Great for general tasks", 
    icon: <Gemini.Color size={20} />,
    color: "from-blue-500 to-cyan-500"
  },
  
  { 
    id: "mistral nemo", 
    name: "Mistral Nemo", 
    description: "Efficient and fast", 
    icon: <Mistral.Color size={20} />,
    color: "from-orange-500 to-amber-500"
  },
];

const agentPurposes = [
  { 
    id: "general", 
    name: "General Assistant", 
    description: "General conversations and everyday tasks",
    iconComponent: <SparklesIcon className="h-5 w-5 text-blue-600" />,
    color: "bg-blue-100 text-blue-800",
    border: "border-blue-200",
    defaultModel: "gemini-flashlite"
  },
  { 
    id: "support", 
    name: "Customer Support", 
    description: "Customer service and support queries",
    iconComponent: <UsersIcon className="h-5 w-5 text-green-600" />,
    color: "bg-green-100 text-green-800",
    border: "border-green-200",
    defaultModel: "deepseek-chat"
  },
  { 
    id: "code", 
    name: "Code Assistant", 
    description: "Programming, debugging, and code generation",
    iconComponent: <CodeBracketIcon className="h-5 w-5 text-purple-600" />,
    color: "bg-purple-100 text-purple-800",
    border: "border-purple-200",
    defaultModel: "gpt5-nano"
  },
  { 
    id: "creative", 
    name: "Creative Writing", 
    description: "Creative writing, storytelling, and content creation",
    iconComponent: <LightBulbIcon className="h-5 w-5 text-pink-600" />,
    color: "bg-pink-100 text-pink-800",
    border: "border-pink-200",
    defaultModel: "claude-3 haiku"
  },
  { 
    id: "technical", 
    name: "Technical Expert", 
    description: "Technical documentation and complex problem solving",
    iconComponent: <WrenchScrewdriverIcon className="h-5 w-5 text-orange-600" />,
    color: "bg-orange-100 text-orange-800",
    border: "border-orange-200",
    defaultModel: "gpt5-nano"
  },
  { 
    id: "research", 
    name: "Research Assistant", 
    description: "Research, analysis, and data interpretation",
    iconComponent: <BeakerIcon className="h-5 w-5 text-amber-600" />,
    color: "bg-amber-100 text-amber-800",
    border: "border-amber-200",
    defaultModel: "claude-3 haiku"
  },
  
];

export default function CreateAgentModal({ 
  isOpen, 
  onClose, 
  onCreateAgent,
  onUpdateAgent,
  editingAgent = null
}) {
  // CRITICAL FIX: More robust edit mode detection
 const isEditMode = Boolean(
  editingAgent && 
  editingAgent.id && 
  editingAgent.name && 
  editingAgent.id.startsWith('agent-')
);

// ADD THIS SAFEGUARD - If modal just opened and editingAgent exists, 
// but we didn't explicitly trigger edit mode, clear it
const [forceCreateMode, setForceCreateMode] = useState(false);

useEffect(() => {
  if (isOpen && editingAgent) {
    console.log("🔍 Checking if editingAgent should be cleared...");
    // Check if this editingAgent was set recently (within last 2 seconds)
    // If not, it's probably stale and should be ignored
    const timer = setTimeout(() => {
      if (editingAgent && !forceCreateMode) {
        console.log("🔄 Stale editingAgent detected, forcing CREATE mode");
        setForceCreateMode(true);
      }
    }, 2000);
    
    return () => clearTimeout(timer);
  } else {
    setForceCreateMode(false);
  }
}, [isOpen, editingAgent, forceCreateMode]);

const finalIsEditMode = !forceCreateMode && isEditMode;

  
  
  const [newAgentData, setNewAgentData] = useState({
    name: "",
    purpose: "general",
    customPrompt: "",
    isAutoSelected: true,
    selectedModel: ""
  });

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log("CreateAgentModal Debug:", {
      isOpen,
      isEditMode,
      editingAgent: editingAgent?.name || 'null',
      editingAgentId: editingAgent?.id || 'null',
      newAgentData
    });
  }, [isOpen, isEditMode, editingAgent, newAgentData]);

  // Get the default model for a purpose
  const getDefaultModelForPurpose = (purposeId) => {
    const purpose = agentPurposes.find(p => p.id === purposeId);
    return purpose ? purpose.defaultModel : "gemini-flashlite";
  };

  // Initialize form data when editingAgent changes
  useEffect(() => {
    if (isEditMode && editingAgent) {
      console.log("DEBUG: Modal in EDIT mode with agent:", editingAgent.name);
      
      // Determine if agent was auto-selected
      const purposeDefaultModel = getDefaultModelForPurpose(editingAgent.purpose);
      const isAutoSelected = editingAgent.model === purposeDefaultModel && 
                            (editingAgent.isAutoSelected === undefined || editingAgent.isAutoSelected === true);
      
      setNewAgentData({
        name: editingAgent.name || "",
        purpose: editingAgent.purpose || "general",
        customPrompt: editingAgent.customPrompt || "",
        isAutoSelected: isAutoSelected,
        selectedModel: editingAgent.model || purposeDefaultModel
      });
    } else {
      // Reset for create mode
      console.log("DEBUG: Modal in CREATE mode");
      const defaultModel = getDefaultModelForPurpose("general");
      setNewAgentData({
        name: "",
        purpose: "general",
        customPrompt: "",
        isAutoSelected: true,
        selectedModel: defaultModel
      });
    }
    setIsModelDropdownOpen(false);
  }, [isEditMode, editingAgent, isOpen]);

  // Get selected purpose details
  const selectedPurpose = agentPurposes.find(p => p.id === newAgentData.purpose) || agentPurposes[0];
  
  // Get selected AI model details
  const selectedAIModel = aiModels.find(m => m.id === newAgentData.selectedModel);
  
  // Auto-select model based on purpose when isAutoSelected is true
  useEffect(() => {
    if (newAgentData.isAutoSelected && !isEditMode) {
      const autoModel = getDefaultModelForPurpose(newAgentData.purpose);
      setNewAgentData(prev => ({
        ...prev,
        selectedModel: autoModel
      }));
    }
  }, [newAgentData.isAutoSelected, newAgentData.purpose, isEditMode]);

  // FIXED: Clear and consistent submit handler
  const handleSubmit = async () => {
    if (!newAgentData.name.trim()) return;
    
    setIsSubmitting(true);

    try {
      const agentData = {
        name: newAgentData.name.trim(),
        purpose: newAgentData.purpose,
        model: newAgentData.selectedModel,
        customPrompt: newAgentData.customPrompt.trim(),
        isAutoSelected: newAgentData.isAutoSelected,
        description: `${newAgentData.name.trim()} - ${selectedPurpose.name} AI Assistant`
      };

      console.log("DEBUG: Submitting - isEditMode:", isEditMode, "agentId:", editingAgent?.id);

      if (isEditMode && editingAgent?.id) {
        // EDIT mode - pass agentId and agentData SEPARATELY
        if (typeof onUpdateAgent === 'function') {
          // Call with two separate parameters
          await onUpdateAgent(editingAgent.id, agentData);
        } else {
          console.error("onUpdateAgent is not a function!");
        }
      } else {
        // CREATE mode - pass only agentData
        if (typeof onCreateAgent === 'function') {
          // Call with single parameter
          await onCreateAgent(agentData);
        } else {
          console.error("onCreateAgent is not a function!");
        }
      }
      
      handleClose();
    } catch (error) {
      console.error("Error submitting agent:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    const defaultModel = getDefaultModelForPurpose("general");
    setNewAgentData({ 
      name: "", 
      purpose: "general", 
      customPrompt: "", 
      isAutoSelected: true,
      selectedModel: defaultModel 
    });
    setIsModelDropdownOpen(false);
    setIsSubmitting(false);
    onClose();
  };

  const handleAutoSelectToggle = () => {
    const newAutoSelectValue = !newAgentData.isAutoSelected;
    const purposeDefaultModel = getDefaultModelForPurpose(newAgentData.purpose);
    
    setNewAgentData(prev => ({
      ...prev,
      isAutoSelected: newAutoSelectValue,
      // If switching to auto-select, set model to default for current purpose
      selectedModel: newAutoSelectValue ? purposeDefaultModel : prev.selectedModel
    }));
    setIsModelDropdownOpen(false);
  };

  const handleModelSelect = (modelId) => {
    setNewAgentData(prev => ({
      ...prev,
      selectedModel: modelId,
      isAutoSelected: false // Switch to manual mode when user selects a model
    }));
    setIsModelDropdownOpen(false); 
  };

  const handlePurposeSelect = (purposeId) => {
    if (isEditMode) return; // Don't allow changing purpose in edit mode
    
    const purposeDefaultModel = getDefaultModelForPurpose(purposeId);
    
    setNewAgentData(prev => ({
      ...prev,
      purpose: purposeId,
      // If auto-select is on, update model to new purpose's default
      selectedModel: prev.isAutoSelected ? purposeDefaultModel : prev.selectedModel
    }));
  };

  // Handle Agent Name change
  const handleNameChange = (e) => {
    setNewAgentData(prev => ({ 
      ...prev, 
      name: e.target.value 
    }));
  };

  // Handle Custom Instructions change
  const handleCustomPromptChange = (e) => {
    setNewAgentData(prev => ({ 
      ...prev, 
      customPrompt: e.target.value.slice(0, 300) 
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={handleClose} />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 max-h-[90vh] overflow-y-auto scrollbar-thin"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="sticky top-0 bg-white z-10 p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {isEditMode ? `Edit "${editingAgent?.name}"` : "Create Custom AI Agent"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEditMode ? "Update your AI assistant configuration" : "Configure your specialized assistant"}
                </p>
                {/* Debug info - can remove in production */}
                <div className="text-xs text-gray-400 mt-1">
                  Status: {isEditMode ? `Editing (ID: ${editingAgent?.id})` : "Creating New"}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isSubmitting}
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              {/* Agent Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={newAgentData.name}
                  onChange={handleNameChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="e.g., Customer Support Bot"
                  autoFocus={!isEditMode}
                  disabled={isSubmitting}
                />
              </div>

              {/* Primary Purpose Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-700">
                    Primary Purpose
                  </label>
                  {isEditMode && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <InformationCircleIcon className="h-3 w-3" />
                      <span>Cannot change in edit mode</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {agentPurposes.map((purpose) => (
                    <button
                      key={purpose.id}
                      type="button"
                      onClick={() => handlePurposeSelect(purpose.id)}
                      className={`flex items-start gap-2 p-2 rounded-lg border transition-all text-left ${
                        newAgentData.purpose === purpose.id
                          ? `${purpose.color} ${purpose.border} border-2`
                          : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                      } ${isEditMode ? 'opacity-60 cursor-not-allowed' : isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      disabled={isEditMode || isSubmitting}
                    >
                      <div className={`w-8 h-8 ${purpose.color.replace('100', '200')} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        {purpose.iconComponent}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-xs">{purpose.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{purpose.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Model Selection Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-700">
                    AI Model Configuration
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {newAgentData.isAutoSelected ? "Auto-selected" : "Manual selection"}
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoSelectToggle}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                        newAgentData.isAutoSelected ? 'bg-purple-600' : 'bg-gray-300'
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={isSubmitting}
                    >
                      <span className="sr-only">Toggle auto-select</span>
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          newAgentData.isAutoSelected ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Auto-selected Model Info */}
                {newAgentData.isAutoSelected ? (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center">
                          <SparklesIcon className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-900">Auto-selected Model</div>
                          <div className="text-[10px] text-gray-600">
                            {aiModels.find(m => m.id === newAgentData.selectedModel)?.name || selectedPurpose.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700 font-medium">
                        Best for "{selectedPurpose.name}"
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      Model automatically selected based on purpose
                    </p>
                  </div>
                ) : (
                  /* Manual Model Selection - Dropdown Design */
                  <div className="space-y-3">
                    {/* Dropdown Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        disabled={isSubmitting}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {selectedAIModel ? (
                              <>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                                  {selectedAIModel.icon}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">
                                    {selectedAIModel.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {selectedAIModel.description}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-gray-400">Select an AI model...</div>
                            )}
                          </div>
                          <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      
                      {/* Dropdown Menu */}
                      {isModelDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 ">
                          <div className="p-2 space-y-1">
                            {aiModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  handleModelSelect(model.id);
                                }}
                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                                  newAgentData.selectedModel === model.id
                                    ? 'bg-gradient-to-r from-purple-50 to-indigo-50'
                                    : 'hover:bg-gray-50'
                                } ${isSubmitting ? 'cursor-not-allowed' : ''}`}
                                disabled={isSubmitting}
                              >
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                  {model.icon}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-900 text-sm">
                                      {model.name}
                                    </div>
                                    {newAgentData.selectedModel === model.id && (
                                      <CheckCircleIcon className="w-4 h-4 text-purple-600" />
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {model.description}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected Model Preview */}
                    {selectedAIModel && (
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                            {selectedAIModel.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium text-gray-900 text-sm">
                                {selectedAIModel.name}
                              </div>
                              <div className="text-[10px] px-2 py-0.5 bg-white border border-purple-200 rounded-full text-purple-700 font-medium">
                                Selected
                              </div>
                            </div>
                            <p className="text-xs text-gray-600">
                              {selectedAIModel.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <CheckCircleIcon className="w-3 h-3 text-green-500" />
                                <span>Manual selection</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Optional Prompt Injection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-700">
                    Custom Instructions (Optional)
                  </label>
                  <span className="text-[10px] text-gray-500">
                    {newAgentData.customPrompt.length}/300
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={newAgentData.customPrompt}
                    onChange={handleCustomPromptChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all min-h-[80px] resize-none disabled:opacity-50"
                    placeholder="Add specific instructions... Example: 'Always respond in friendly tone', 'Specialize in Python', 'Focus on e-commerce'"
                    rows={3}
                    disabled={isSubmitting}
                  />
                  <div className="absolute bottom-2 right-2 text-[10px] text-gray-400">
                    Optional
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6 pt-5 border-t border-gray-200">
              <button
                onClick={handleClose}
                className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!newAgentData.name.trim() || (!newAgentData.isAutoSelected && !newAgentData.selectedModel) || isSubmitting}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditMode ? 'Update Agent' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}