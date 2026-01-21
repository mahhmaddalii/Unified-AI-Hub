"use client";

import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import AgentCard from './agentcard';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useAgents } from "./AgentContext";
import {
  PlusIcon,
  SparklesIcon,
  UsersIcon,
  LockClosedIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";

// Dynamically import the modal
const CreateAgentModal = dynamic(() => import('./CreateAgentModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>
  )
});

export default function AgentDashboard({
  initialActiveChats,
  selectedAgent: externalSelectedAgent,
  onSelectAgent,
  onCreateAgent,
  onUpdateAgent,
  onDeleteAgent,
  onToggleAgentStatus,
  // showCreateModal,
  // onCloseCreateModal,
  // editingAgent: externalEditingAgent
}) {
  const {
    agents,
    allAgents,
    selectedAgent: contextSelectedAgent,
    editingAgent: contextEditingAgent,
    isCreatingAgent,
    setSelectedAgent,
    setEditingAgent,
    setIsCreatingAgent,
    createAgent: contextCreateAgent,
    updateAgent: contextUpdateAgent,
    deleteAgent: contextDeleteAgent,
    toggleAgentStatus: contextToggleAgentStatus,
    stats
  } = useAgents();

  // Use context or external props
  const selectedAgent = contextSelectedAgent;
  const editingAgent = contextEditingAgent;

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    agentId: null,
    agentName: "",
    chatCount: 0
  });

  // Reset editing agent when showCreateModal changes from external
  // useEffect(() => {
  //   if (showCreateModal && !isCreatingAgent) {
  //     console.log("External create modal triggered - clearing editing agent");
  //     setEditingAgent(null);
  //     setIsCreatingAgent(true);
  //   }
  // }, [showCreateModal, isCreatingAgent, setEditingAgent, setIsCreatingAgent]);

  const handleSelectAgent = (agent) => {
    console.log("=== AGENT SELECTION ===");
    console.log("Agent selected:", agent.name);
    
    // Update context
    setSelectedAgent(agent);
    
    // Call parent's handler to switch to chat
    if (onSelectAgent && typeof onSelectAgent === 'function') {
      console.log("Calling onSelectAgent to switch to chat...");
      onSelectAgent(agent);
    }
  };

  const handleEditAgent = (agent) => {
    console.log("Editing agent:", agent.name);
    setEditingAgent(agent);
    setIsCreatingAgent(true);
  };

  const handleCreateNewAgent = () => {
  console.log("🆕 Creating new agent - FORCE clearing editing state");
  
  // Force clear ALL editing states
  setEditingAgent(null); // Clear context
  
  // Also clear any external editing agent if prop exists
  if (setEditingAgent) {
    setEditingAgent(null);
  }
  
  setIsCreatingAgent(true);
};

  const handleDeleteAgent = (agentId) => {
    const agentToDelete = allAgents.find(a => a.id === agentId);
    
    if (agentToDelete?.isBuiltIn) {
      alert("Built-in agents cannot be deleted");
      return;
    }
    
    setDeleteModal({
      isOpen: true,
      agentId,
      agentName: agentToDelete?.name || '',
      chatCount: 0
    });
  };

  const confirmDeleteAgent = () => {
    const { agentId } = deleteModal;
    if (!agentId) return;
    
    // Delete from context
    contextDeleteAgent(agentId);
    
    // Notify parent if needed
    if (onDeleteAgent && typeof onDeleteAgent === 'function') {
      onDeleteAgent(agentId);
    }
    
    setDeleteModal({
      isOpen: false,
      agentId: null,
      agentName: "",
      chatCount: 0
    });
  };

  const handleAgentSubmit = (firstParam, secondParam) => {
    console.log("handleAgentSubmit called with:", { firstParam, secondParam });
    
    let agentId, agentData;
    
    // Determine which parameter is which
    if (typeof firstParam === 'string' && firstParam.startsWith('agent-')) {
      // firstParam is agentId, secondParam is agentData
      agentId = firstParam;
      agentData = secondParam;
    } else {
      // Only one parameter was passed (old format)
      agentData = firstParam;
      agentId = editingAgent?.id;
    }
    
    console.log("Resolved - agentId:", agentId, "agentData:", agentData);
    console.log("Is edit mode?", !!editingAgent);
    
    if (agentId && agentData && editingAgent) {
      console.log("Updating agent:", agentId);
      // Update in context
      contextUpdateAgent(agentId, agentData);
      
      // Notify parent
      if (onUpdateAgent && typeof onUpdateAgent === 'function') {
        onUpdateAgent(agentId, agentData);
      }
    } else if (agentData && !editingAgent) {
      console.log("Creating new agent (no editingAgent)");
      // Create in context
      const newAgent = contextCreateAgent(agentData);
      
      // Notify parent
      if (onCreateAgent && typeof onCreateAgent === 'function') {
        onCreateAgent(newAgent);
      }
    }
    
    setIsCreatingAgent(false);
    setEditingAgent(null);
  };

  const handleToggleAgentStatus = (agentId) => {
    console.log("Toggling agent status:", agentId);
    
    // Toggle in context
    contextToggleAgentStatus(agentId);
    
    // Notify parent if needed
    if (onToggleAgentStatus && typeof onToggleAgentStatus === 'function') {
      onToggleAgentStatus(agentId);
    }
  };

  const handleCloseModal = () => {
  console.log("🔴 Closing modal - clearing ALL agent states");
  
  // Clear editing agent when modal closes
  setEditingAgent(null);
  setIsCreatingAgent(false);
  
  // No need to call onCloseCreateModal anymore
  // if (onCloseCreateModal && typeof onCloseCreateModal === 'function') {
  //   onCloseCreateModal();
  // }
};

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with stats */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Agents Dashboard</h1>
            <p className="text-sm text-gray-500">Manage and interact with your AI assistants</p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center px-3 py-2 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-lg min-w-[80px]">
              <div className="flex items-center gap-1.5 mb-1">
                <BuildingLibraryIcon className="h-4 w-4 text-blue-500" />
                <span className="font-bold text-gray-900 text-base">{stats.builtInAgents}</span>
              </div>
              <span className="text-xs text-blue-600 font-medium">Built-in</span>
            </div>

            <div className="flex flex-col items-center justify-center px-3 py-2 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-lg min-w-[80px]">
              <div className="flex items-center gap-1.5 mb-1">
                <UsersIcon className="h-4 w-4 text-purple-500" />
                <span className="font-bold text-gray-900 text-base">{stats.totalAgents}</span>
              </div>
              <span className="text-xs text-purple-600 font-medium">Custom</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-base">{stats.activeAgents}</span>
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Built-in Agents */}
        {agents.builtIn.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <LockClosedIcon className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Built-in Agents</h2>
              <span className="text-xs text-gray-500 ml-2">
                (Pre-configured, one chat per agent)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.builtIn.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent?.id === agent.id}
                  onSelect={handleSelectAgent}
                  onDelete={handleDeleteAgent}
                  onToggle={handleToggleAgentStatus}
                  onEdit={handleEditAgent}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom Agents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Your Custom Agents</h2>
              <p className="text-sm text-gray-500">Create and manage your own AI assistants</p>
            </div>
            <span className="text-sm text-gray-500">
              {agents.custom.length} agent{agents.custom.length !== 1 ? 's' : ''}
            </span>
          </div>

          {agents.custom.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-2xl bg-gradient-to-br from-gray-50/50 to-white">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <SparklesIcon className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">No custom agents yet</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                Create your first custom AI assistant with specific capabilities
              </p>
              <button
                onClick={handleCreateNewAgent}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow"
              >
                Create Your First Agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.custom.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent?.id === agent.id}
                  onSelect={handleSelectAgent}
                  onDelete={handleDeleteAgent}
                  onToggle={handleToggleAgentStatus}
                  onEdit={handleEditAgent}
                />
              ))}

              {/* Add New Agent Card */}
              <div
                onClick={handleCreateNewAgent}
                className="group relative bg-gradient-to-br from-gray-50 to-white border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer transition-all duration-200 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-50 hover:to-indigo-50 flex flex-col items-center justify-center min-h-[200px]"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:from-purple-200 group-hover:to-indigo-200 transition-colors shadow-sm">
                  <PlusIcon className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Create New Agent</h3>
                <p className="text-sm text-gray-500 text-center">
                  Add a custom AI assistant with specific capabilities
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Agent Modal */}
      {isCreatingAgent && (
        <CreateAgentModal
          isOpen={isCreatingAgent}
          onClose={handleCloseModal}
          onCreateAgent={handleAgentSubmit}
          onUpdateAgent={handleAgentSubmit}
          editingAgent={editingAgent}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDeleteAgent}
        agentName={deleteModal.agentName}
        chatCount={deleteModal.chatCount}
        message={`Are you sure you want to delete "${deleteModal.agentName}"?`}
      />
    </div>
  );
}