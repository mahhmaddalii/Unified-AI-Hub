"use client";

export const FREE_MODEL_IDS = ["gpt-oss-120b", "models-router"];
export const FREE_MODEL_FALLBACK_ID = "models-router";
export const PRO_UPGRADE_ROUTE = "/pricing";

export const isPaidBilling = (billing) => Boolean(billing?.isPaid);

export const isFreeModelId = (modelId) => FREE_MODEL_IDS.includes(modelId);

export const isProModelId = (modelId) => !isFreeModelId(modelId);

export const canUseModelId = (modelId, billing) => {
  if (!modelId) {
    return true;
  }
  return isPaidBilling(billing) || isFreeModelId(modelId);
};

export const sanitizeModelIdForBilling = (modelId, billing) => {
  if (canUseModelId(modelId, billing)) {
    return modelId;
  }
  return FREE_MODEL_FALLBACK_ID;
};

export const areAgentsLockedForBilling = (billing) => !isPaidBilling(billing);
