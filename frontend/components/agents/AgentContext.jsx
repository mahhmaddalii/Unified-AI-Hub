"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, fetchWithAuth } from "../../utils/auth";
import { useAuth } from "../auth/auth-context";

const API_BASE_URL = API_URL;

const BUILT_IN_AGENTS = [
  {
    id: "builtin-comsats",
    name: "Comsats Assistant",
    status: "active",
    conversations: 0,
    satisfaction: 95,
    lastActive: "Never",
    isBuiltIn: true,
    icon: "🏢",
    description: "Official Comsats University assistant",
    purpose: "support",
    isAutoSelected: true,
  },
  {
    id: "builtin-cricket",
    name: "Cricket Expert",
    status: "active",
    conversations: 0,
    satisfaction: 92,
    lastActive: "Never",
    isBuiltIn: true,
    icon: "🏏",
    description: "Cricket knowledge and match analysis",
    purpose: "general",
    isAutoSelected: true,
  },
  {
    id: "builtin-politics",
    name: "Politics Analyst",
    status: "active",
    conversations: 0,
    satisfaction: 90,
    lastActive: "Never",
    isBuiltIn: true,
    icon: "⚖️",
    description: "Political analysis and current affairs",
    purpose: "research",
    isAutoSelected: true,
  },
];

const AgentContext = createContext();

export const useAgents = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgents must be used within an AgentProvider");
  }
  return context;
};

const cleanAgentData = (agent) => {
  if (!agent || typeof agent !== "object") {
    return null;
  }

  return {
    id: typeof agent.id === "string" ? agent.id : "",
    name: agent.name || "Unnamed Agent",
    purpose: agent.purpose || "general",
    model: agent.model || "gemini-flashlite",
    status: agent.status || "active",
    customPrompt: agent.customPrompt || "",
    isAutoSelected: agent.isAutoSelected !== undefined ? agent.isAutoSelected : true,
    isBuiltIn: !!agent.isBuiltIn,
    isEditable: agent.isEditable !== undefined ? agent.isEditable : !agent.isBuiltIn,
    lastActive: agent.lastActive || "Just now",
    conversations: agent.conversations || 0,
    satisfaction: agent.satisfaction || 95,
    createdAt: agent.createdAt || new Date().toISOString(),
    updatedAt: agent.updatedAt || new Date().toISOString(),
    description: agent.description || `${agent.name || "Agent"} Assistant`,
  };
};

export function AgentProvider({ children }) {
  const { user, loading: userLoading, refreshBilling } = useAuth();
  const [agents, setAgents] = useState({
    builtIn: BUILT_IN_AGENTS,
    custom: [],
  });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  const loadCustomAgents = useCallback(async () => {
    if (!user) {
      setAgents((prev) => ({ ...prev, custom: [] }));
      return;
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/custom_agents/`, {
      method: "GET",
    });
    if (!response.ok) {
      return;
    }

    const data = await response.json().catch(() => null);
    const nextCustomAgents = (data?.agents || []).map(cleanAgentData).filter(Boolean);
    setAgents((prev) => ({
      ...prev,
      custom: nextCustomAgents,
    }));
  }, [user]);

  useEffect(() => {
    if (userLoading) return;
    loadCustomAgents();
  }, [loadCustomAgents, userLoading]);

  const allAgents = useMemo(() => [...agents.builtIn, ...agents.custom], [agents.builtIn, agents.custom]);

  const ensureCustomAgentUsesBackendId = useCallback(async (agentOrId) => {
    const agentId = typeof agentOrId === "string" ? agentOrId : agentOrId?.id;
    if (!agentId) {
      return null;
    }
    return agents.custom.find((agent) => agent.id === agentId) || null;
  }, [agents.custom]);

  const createAgent = useCallback(async (agentData) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/custom_agents/`, {
      method: "POST",
      body: JSON.stringify(agentData),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 403) {
        await refreshBilling();
      }
      throw new Error(data?.error || `Failed to create agent: ${response.status}`);
    }

    const newAgent = cleanAgentData(data?.agent);
    if (!newAgent) {
      throw new Error("Backend did not return a valid agent.");
    }

    setAgents((prev) => ({
      ...prev,
      custom: [newAgent, ...prev.custom],
    }));
    setSelectedAgent(newAgent);
    return newAgent;
  }, [refreshBilling]);

  const updateAgent = useCallback(async (agentId, updates) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/custom_agents/${agentId}/`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 403) {
        await refreshBilling();
      }
      throw new Error(data?.error || `Failed to update agent: ${response.status}`);
    }

    const updatedAgent = cleanAgentData(data?.agent);
    if (!updatedAgent) {
      throw new Error("Backend did not return a valid updated agent.");
    }

    setAgents((prev) => ({
      ...prev,
      custom: prev.custom.map((agent) => (agent.id === agentId ? updatedAgent : agent)),
    }));
    setSelectedAgent((prev) => (prev?.id === agentId ? updatedAgent : prev));
    setEditingAgent((prev) => (prev?.id === agentId ? updatedAgent : prev));
    return updatedAgent;
  }, [refreshBilling]);

  const deleteAgent = useCallback(async (agentId) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/custom_agents/${agentId}/`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `Failed to delete agent: ${response.status}`);
    }

    setAgents((prev) => ({
      ...prev,
      custom: prev.custom.filter((agent) => agent.id !== agentId),
    }));
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(null);
    }
    if (editingAgent?.id === agentId) {
      setEditingAgent(null);
    }
  }, [editingAgent, selectedAgent]);

  const toggleAgentStatus = useCallback(async (agentId) => {
    const currentAgent = agents.custom.find((agent) => agent.id === agentId);
    if (!currentAgent) {
      return;
    }

    const nextStatus = currentAgent.status === "active" ? "inactive" : "active";
    const updatedAgent = await updateAgent(agentId, { status: nextStatus });
    return updatedAgent;
  }, [agents.custom, updateAgent]);

  const getAgentById = useCallback((agentId) => allAgents.find((agent) => agent.id === agentId), [allAgents]);

  const getAgentsByType = useCallback((type = "all") => {
    switch (type) {
      case "builtin":
        return agents.builtIn;
      case "custom":
        return agents.custom;
      default:
        return allAgents;
    }
  }, [agents.builtIn, agents.custom, allAgents]);

  const resetToDefault = useCallback(() => {
    setSelectedAgent(null);
    setEditingAgent(null);
    setIsCreatingAgent(false);
  }, []);

  const contextValue = useMemo(() => ({
    agents,
    allAgents,
    selectedAgent,
    editingAgent,
    isCreatingAgent,
    setSelectedAgent,
    setEditingAgent,
    setIsCreatingAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    ensureCustomAgentUsesBackendId,
    getAgentById,
    getAgentsByType,
    resetToDefault,
    refreshAgents: loadCustomAgents,
    stats: {
      totalAgents: agents.custom.length,
      activeAgents: agents.custom.filter((agent) => agent.status === "active").length,
      builtInAgents: agents.builtIn.length,
    },
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
    ensureCustomAgentUsesBackendId,
    getAgentById,
    getAgentsByType,
    resetToDefault,
    loadCustomAgents,
  ]);

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
}

export const agentUtils = {
  exportAgents: () => [],
  importAgents: () => false,
  clearAgents: () => {},
};
