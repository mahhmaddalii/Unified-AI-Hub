"use client";

export const FREE_MODEL_IDS = ["gpt-oss-120b", "models-router"];
export const FREE_MODEL_FALLBACK_ID = "models-router";
export const PRO_UPGRADE_ROUTE = "/pricing";
export const TOKEN_LIMIT_REACHED_MESSAGE = "Token limit reached. Please wait until subscription renewal.";

export const isPaidBilling = (billing) => Boolean(billing?.isPaid);
export const hasTokenLimitReached = (billing) => Boolean(billing?.isPaid && billing?.tokenLimitReached);
export const hasPaidTokenAccess = (billing) => isPaidBilling(billing) && !hasTokenLimitReached(billing);

export const isFreeModelId = (modelId) => FREE_MODEL_IDS.includes(modelId);

export const isProModelId = (modelId) => !isFreeModelId(modelId);

export const canUseModelId = (modelId, billing) => {
  if (!modelId) {
    return true;
  }
  return isFreeModelId(modelId) || hasPaidTokenAccess(billing);
};

export const sanitizeModelIdForBilling = (modelId, billing) => {
  if (canUseModelId(modelId, billing)) {
    return modelId;
  }
  return FREE_MODEL_FALLBACK_ID;
};

export const areAgentsLockedForBilling = (billing) => !isPaidBilling(billing);
export const areCustomAgentsLockedForBilling = (billing) => !hasPaidTokenAccess(billing);

const normalizePrompt = (text) => (text || "").trim().toLowerCase();

export const isCricketLiveUpdatePrompt = (text) => {
  const prompt = normalizePrompt(text);
  return /(live updates?|automatic updates?|send updates every minute|keep sending score|live score updates?)/.test(prompt);
};

export const isPoliticsLiveUpdatePrompt = (text) => {
  const prompt = normalizePrompt(text);
  return /(live politics news|live news updates? for|automatic news updates? for|keep sending news for|live updates? for|live news for)/.test(prompt);
};

export const canUseAgentForPrompt = (agent, billing, text) => {
  if (!agent) {
    return true;
  }

  if (!isPaidBilling(billing)) {
    return false;
  }

  if (!hasTokenLimitReached(billing)) {
    return true;
  }

  if (!agent.isBuiltIn) {
    return false;
  }

  if (agent.id === "builtin-cricket") {
    return isCricketLiveUpdatePrompt(text);
  }

  if (agent.id === "builtin-politics") {
    return isPoliticsLiveUpdatePrompt(text);
  }

  return false;
};

export const getAgentBillingBlockMessage = (agent, billing, text) => {
  if (!agent) {
    return "";
  }

  if (!isPaidBilling(billing)) {
    if (!agent.isBuiltIn) {
      return "Upgrade to Pro to use custom agents.";
    }
    return "Upgrade to Pro to use domain agents.";
  }

  if (!hasTokenLimitReached(billing)) {
    return "";
  }

  if (!agent.isBuiltIn) {
    return TOKEN_LIMIT_REACHED_MESSAGE;
  }

  if (agent.id === "builtin-cricket" && isCricketLiveUpdatePrompt(text)) {
    return "";
  }

  if (agent.id === "builtin-politics" && isPoliticsLiveUpdatePrompt(text)) {
    return "";
  }

  return TOKEN_LIMIT_REACHED_MESSAGE;
};
