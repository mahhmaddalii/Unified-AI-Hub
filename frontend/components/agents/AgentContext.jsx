"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

// Default built-in agents (unchanged)
const BUILT_IN_AGENTS = [
  {
    id: "builtin-comsats",
    name: "Comsats Assistant",
    model: "deepseek-chat",
    status: "active",
    conversations: 0,
    satisfaction: 95,
    lastActive: "Never",
    isBuiltIn: true,
    icon: "🏢",
    description: "Official Comsats University assistant",
    purpose: "support",
    isAutoSelected: true
  },
  {
    id: "builtin-cricket",
    name: "Cricket Expert",
    model: "gpt5-nano",
    status: "active",
    conversations: 0,
    satisfaction: 92,
    lastActive: "Never",
    isBuiltIn: true,
    icon: "🏏",
    description: "Cricket knowledge and match analysis",
    purpose: "general",
    isAutoSelected: true
  },
  {
    id: "builtin-politics",
    name: "Politics Analyst",
    model: "claude-3 haiku",
    status: "active",
    conversations: 0,
    satisfaction: 90,
    lastActive: "Never",
    isBuiltIn: true,
    icon: "⚖️",
    description: "Political analysis and current affairs",
    purpose: "research",
    isAutoSelected: true
  }
];

// Default custom agents
const DEFAULT_CUSTOM_AGENTS = [
  {
    id: "agent-1",
    name: "Customer Support Bot",
    model: "deepseek-chat",
    purpose: "support",
    status: "active",
    conversations: 1245,
    satisfaction: 94,
    cost: 0.45,
    lastActive: "2 minutes ago",
    isBuiltIn: false,
    isAutoSelected: false,
    customPrompt: "Always respond in friendly tone",
    createdAt: new Date().toISOString()
  },
  {
    id: "agent-2",
    name: "Code Assistant",
    model: "gpt5-nano",
    purpose: "code",
    status: "active",
    conversations: 892,
    satisfaction: 96,
    cost: 0.38,
    lastActive: "5 minutes ago",
    isBuiltIn: false,
    isAutoSelected: false,
    customPrompt: "Specialize in Python programming",
    createdAt: new Date().toISOString()
  }
];

// Create context
const AgentContext = createContext();

// Custom hook for using agent context
export const useAgents = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgents must be used within an AgentProvider");
  }
  return context;
};

// Helper function to clean agent data
const cleanAgentData = (agent) => {
  if (!agent || typeof agent !== 'object') {
    return null;
  }
  
  // Remove any string-like properties that shouldn't be there
  const cleaned = { ...agent };
  
  // Ensure it has all required properties
  return {
    id: cleaned.id || `agent-${Date.now()}`,
    name: cleaned.name || "Unnamed Agent",
    purpose: cleaned.purpose || "general",
    model: cleaned.model || "gemini-flashlite",
    status: cleaned.status || "active",
    customPrompt: cleaned.customPrompt || "",
    isAutoSelected: cleaned.isAutoSelected !== undefined ? cleaned.isAutoSelected : true,
    isBuiltIn: !!cleaned.isBuiltIn,
    lastActive: cleaned.lastActive || "Just now",
    conversations: cleaned.conversations || 0,
    satisfaction: cleaned.satisfaction || 95,
    createdAt: cleaned.createdAt || new Date().toISOString(),
    updatedAt: cleaned.updatedAt || new Date().toISOString(),
    description: cleaned.description || `${cleaned.name || "Agent"} Assistant`
  };
};

// Main provider component
export function AgentProvider({ children, initialCustomAgents = [] }) {
  // Load agents from localStorage on initial render
  const [agents, setAgents] = useState(() => {
    if (typeof window === "undefined") {
      return {
        builtIn: BUILT_IN_AGENTS,
        custom: initialCustomAgents.length > 0 ? initialCustomAgents.map(cleanAgentData) : DEFAULT_CUSTOM_AGENTS
      };
    }
    
    try {
      const saved = localStorage.getItem("customAgents");
      if (saved) {
        const parsedCustomAgents = JSON.parse(saved);
        // Clean all agent data
        const cleanedAgents = parsedCustomAgents.map(cleanAgentData).filter(Boolean);
        return {
          builtIn: BUILT_IN_AGENTS,
          custom: cleanedAgents
        };
      } else {
        return {
          builtIn: BUILT_IN_AGENTS,
          custom: initialCustomAgents.length > 0 ? initialCustomAgents.map(cleanAgentData) : DEFAULT_CUSTOM_AGENTS
        };
      }
    } catch (error) {
      console.error("Error loading agents from localStorage:", error);
      return {
        builtIn: BUILT_IN_AGENTS,
        custom: DEFAULT_CUSTOM_AGENTS
      };
    }
  });

  // UI state
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Auto-save custom agents to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("customAgents", JSON.stringify(agents.custom));
      } catch (error) {
        console.error("Error saving agents to localStorage:", error);
      }
    }
  }, [agents.custom]);

  // Get all agents (built-in + custom)
  const allAgents = useMemo(() => {
    return [...agents.builtIn, ...agents.custom];
  }, [agents.builtIn, agents.custom]);

  // Create a new custom agent
  const createAgent = useCallback((agentData) => {
    const cleanedAgentData = cleanAgentData(agentData);
    if (!cleanedAgentData) return null;

    const newAgent = {
      ...cleanedAgentData,
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "active",
      createdAt: new Date().toISOString(),
      isBuiltIn: false
    };

    console.log("Creating new agent:", newAgent);

    setAgents(prev => ({
      ...prev,
      custom: [newAgent, ...prev.custom]
    }));

    // Auto-select the newly created agent
    setSelectedAgent(newAgent);

    return newAgent;
  }, []);

  // Update an existing agent - FIXED: Ensure proper update
  const updateAgent = useCallback((agentId, updates) => {
    console.log("Updating agent:", agentId, "with updates:", updates);
    
    // Clean the updates data
    const cleanedUpdates = cleanAgentData(updates);
    if (!cleanedUpdates) {
      console.error("Invalid updates data:", updates);
      return;
    }
    
    setAgents(prev => {
      // Find the agent to update
      const agentToUpdate = prev.custom.find(agent => agent.id === agentId);
      if (!agentToUpdate) {
        console.error("Agent not found for update:", agentId);
        return prev;
      }

      // Merge updates with existing agent data, but keep the original ID
      const updatedAgent = {
        ...agentToUpdate,
        ...cleanedUpdates,
        id: agentToUpdate.id, // Keep original ID
        lastActive: "Just now",
        updatedAt: new Date().toISOString()
      };

      console.log("Agent after update:", updatedAgent);

      // Return new state with updated agent
      return {
        ...prev,
        custom: prev.custom.map(agent => 
          agent.id === agentId ? updatedAgent : agent
        )
      };
    });

    // Update selected agent if it's the same
    if (selectedAgent?.id === agentId) {
      console.log("Updating selected agent:", agentId);
      const updatedSelectedAgent = cleanAgentData({ ...selectedAgent, ...cleanedUpdates });
      if (updatedSelectedAgent) {
        setSelectedAgent(updatedSelectedAgent);
      }
    }

    // Update editing agent if it's the same
    if (editingAgent?.id === agentId) {
      console.log("Updating editing agent:", agentId);
      const updatedEditingAgent = cleanAgentData({ ...editingAgent, ...cleanedUpdates });
      if (updatedEditingAgent) {
        setEditingAgent(updatedEditingAgent);
      }
    }
  }, [selectedAgent, editingAgent]);

  // Delete an agent
  const deleteAgent = useCallback((agentId) => {
    setAgents(prev => ({
      ...prev,
      custom: prev.custom.filter(agent => agent.id !== agentId)
    }));

    // Clear selected/editing if deleted
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(null);
    }
    if (editingAgent?.id === agentId) {
      setEditingAgent(null);
    }
  }, [selectedAgent, editingAgent]);

  // Toggle agent status
  const toggleAgentStatus = useCallback((agentId) => {
    setAgents(prev => ({
      ...prev,
      custom: prev.custom.map(agent => 
        agent.id === agentId 
          ? { 
              ...agent, 
              status: agent.status === 'active' ? 'inactive' : 'active',
              lastActive: "Just now"
            }
          : agent
      )
    }));

    // Update selected agent if it's the same
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(prev => ({
        ...prev,
        status: prev.status === 'active' ? 'inactive' : 'active',
        lastActive: "Just now"
      }));
    }
  }, [selectedAgent]);

  // Get agent by ID
  const getAgentById = useCallback((agentId) => {
    return allAgents.find(agent => agent.id === agentId);
  }, [allAgents]);

  // Get agents by type
  const getAgentsByType = useCallback((type = 'all') => {
    switch (type) {
      case 'builtin':
        return agents.builtIn;
      case 'custom':
        return agents.custom;
      case 'all':
      default:
        return allAgents;
    }
  }, [agents.builtIn, agents.custom, allAgents]);

  // Reset to default (for testing/development)
  const resetToDefault = useCallback(() => {
    setAgents({
      builtIn: BUILT_IN_AGENTS,
      custom: DEFAULT_CUSTOM_AGENTS
    });
    setSelectedAgent(null);
    setEditingAgent(null);
    
    if (typeof window !== "undefined") {
      localStorage.removeItem("customAgents");
    }
  }, []);

  // Context value
  const contextValue = useMemo(() => ({
    // State
    agents: agents,
    allAgents,
    selectedAgent,
    editingAgent,
    isCreatingAgent,
    
    // Setters
    setSelectedAgent,
    setEditingAgent,
    setIsCreatingAgent,
    
    // Actions
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    getAgentById,
    getAgentsByType,
    resetToDefault,
    
    // Stats
    stats: {
      totalAgents: agents.custom.length,
      activeAgents: agents.custom.filter(a => a.status === "active").length,
      builtInAgents: agents.builtIn.length
    }
  }), [
    agents,
    allAgents,
    selectedAgent,
    editingAgent,
    isCreatingAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    getAgentById,
    getAgentsByType,
    resetToDefault
  ]);

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
}

// Helper function to export/import agents
export const agentUtils = {
  exportAgents: () => {
    if (typeof window === "undefined") return null;
    const agents = localStorage.getItem("customAgents");
    return agents ? JSON.parse(agents) : [];
  },
  
  importAgents: (agentsData) => {
    if (typeof window === "undefined") return false;
    try {
      const parsed = Array.isArray(agentsData) ? agentsData : JSON.parse(agentsData);
      localStorage.setItem("customAgents", JSON.stringify(parsed));
      return true;
    } catch (error) {
      console.error("Error importing agents:", error);
      return false;
    }
  },
  
  clearAgents: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("customAgents");
  }
};