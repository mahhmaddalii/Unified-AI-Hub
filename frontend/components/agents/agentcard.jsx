"use client";

import { 
  Cog6ToothIcon, 
  TrashIcon, 
  LockClosedIcon,
  PencilSquareIcon // Add this import
} from "@heroicons/react/24/outline";
import { DeepSeek, OpenAI, Gemini, Claude, Mistral } from '@lobehub/icons';

export default function AgentCard({ 
  agent, 
  isSelected, 
  onSelect, 
  onDelete, 
  onToggle,
  onEdit // Add this prop for edit functionality
}) {
  // Default values if agent is undefined
  if (!agent) {
    console.log("AgentCard: No agent provided");
    return null;
  }

  // Safely get agent properties with defaults
  const agentName = agent.name || "Unnamed Agent";
  const agentPurpose = agent.purpose || "general";
  const agentModel = agent.model || "gemini-flashlite";
  const agentStatus = agent.status || "active";
  const isBuiltIn = agent.isBuiltIn || false;
  const agentIcon = agent.icon || "🤖";
  const agentDescription = agent.description || "AI Assistant";
  const isAutoSelected = agent.isAutoSelected !== undefined ? agent.isAutoSelected : true;

  // Model icons mapping
  const modelIcons = {
    "gemini-flashlite": <Gemini.Color size={20} />,
    "deepseek-chat": <DeepSeek.Color size={20} />,
    "claude-3 haiku": <Claude.Color size={20} />,
    "gpt5-nano": <OpenAI size={20} />,
    "gemini-2.5-flash-image": <Gemini.Color size={20} />,
    "mistral nemo": <Mistral.Color size={20} />,
  };

  // Model colors
  const modelColors = {
    "gemini-flashlite": "from-blue-500 to-cyan-500",
    "deepseek-chat": "from-green-500 to-emerald-500",
    "claude-3 haiku": "from-purple-500 to-violet-500",
    "gpt5-nano": "from-indigo-500 to-blue-500",
    "gemini-2.5-flash-image": "from-pink-500 to-rose-500",
    "mistral nemo": "from-orange-500 to-amber-500",
  };

  // Purpose styling with safer access
  const purposeStyles = {
    general: { icon: "💬", color: "bg-blue-100 text-blue-800", border: "border-blue-200" },
    support: { icon: "🛟", color: "bg-green-100 text-green-800", border: "border-green-200" },
    code: { icon: "💻", color: "bg-purple-100 text-purple-800", border: "border-purple-200" },
    creative: { icon: "🎨", color: "bg-pink-100 text-pink-800", border: "border-pink-200" },
    research: { icon: "🔬", color: "bg-orange-100 text-orange-800", border: "border-orange-200" },
    image: { icon: "🖼️", color: "bg-cyan-100 text-cyan-800", border: "border-cyan-200" },
  };

  const modelColor = modelColors[agentModel] || "from-blue-500 to-cyan-500";
  const modelIcon = modelIcons[agentModel] || <Gemini.Color size={20} />;
  const purposeStyle = purposeStyles[agentPurpose] || purposeStyles.general;
  
  // Safe string formatting for purpose display
  const purposeDisplay = agentPurpose && agentPurpose.charAt ? 
    agentPurpose.charAt(0).toUpperCase() + agentPurpose.slice(1) : 
    "General";
  
  // Safe string formatting for model display
  const modelDisplay = agentModel ? 
    agentModel.split('-')[0].charAt(0).toUpperCase() + agentModel.split('-')[0].slice(1) : 
    "Gemini";

  const handleCardClick = () => {
    onSelect?.(agent);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Just call the parent handler
    onDelete?.(agent.id);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Just call the parent handler
    onToggle?.(agent.id);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Call parent edit handler with agent data
    onEdit?.(agent);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected 
          ? 'border-transparent shadow-lg' 
          : isBuiltIn ? 'border-blue-200 hover:border-blue-300' : 'border-gray-200 hover:border-purple-300'
      } ${isBuiltIn ? 'bg-gradient-to-br from-blue-50/50 to-white' : ''}`}
    >
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-purple-400 rounded-xl blur opacity-20"></div>
          <div className="absolute inset-0 border border-blue-300/40 rounded-xl"></div>
          <div className="absolute inset-1 rounded-lg bg-gradient-to-br from-blue-50/20 to-purple-50/20"></div>
        </div>
      )}

      {/* Built-in Badge */}
      {isBuiltIn && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
            <LockClosedIcon className="h-3 w-3" />
            Built-in
          </div>
        </div>
      )}

      {/* Status Badge (for custom agents only) */}
      {!isBuiltIn && (
        <div className="absolute top-4 right-4">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            agentStatus === 'active' 
              ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200' 
              : 'bg-gray-100 text-gray-800 border border-gray-200'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              agentStatus === 'active' ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            {agentStatus === 'active' ? 'Active' : 'Inactive'}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform ${
          isBuiltIn 
            ? 'bg-gradient-to-br from-blue-100 to-cyan-100 text-2xl'
            : `bg-gradient-to-br ${modelColor}`
        }`}>
          {isBuiltIn ? agentIcon : agentName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{agentName}</h3>
          {!isBuiltIn && (
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-sm text-gray-600">
                {modelIcon}
                {modelDisplay}
              </span>
              {isAutoSelected && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  Auto
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description for built-in agents */}
      {isBuiltIn && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {agentDescription}
        </p>
      )}

      {/* Purpose Badge (for custom agents) or Chat Status (for built-in) */}
      {isBuiltIn ? (
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            Always Available
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${purposeStyle.color} border ${purposeStyle.border}`}>
            <span>{purposeStyle.icon}</span>
            {purposeDisplay}
          </span>
        </div>
      )}

      {/* Action Buttons - Only show for custom agents */}
      {!isBuiltIn && (
        <div className="flex items-center justify-end pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1">
            {/* Edit Button - Only shows when agent is inactive */}
            <button
              onClick={handleEditClick}
              className={`p-1.5 rounded-lg transition-colors ${
                agentStatus === 'active' 
                  ? 'text-gray-400 cursor-not-allowed opacity-50' 
                  : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
              title={agentStatus === 'active' ? 'Deactivate agent to edit' : 'Edit Agent'}
              disabled={agentStatus === 'active'}
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            
            <button
              onClick={handleToggleClick}
              className={`p-1.5 rounded-lg transition-colors ${
                agentStatus === 'active' 
                  ? 'text-green-600 hover:bg-green-50' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={agentStatus === 'active' ? 'Deactivate' : 'Activate'}
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}