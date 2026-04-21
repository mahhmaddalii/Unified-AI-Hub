const BILLING_CACHE_KEY = "billingSnapshot";
const PENDING_BILLING_PLAN_KEY = "pendingBillingPlan";

export const getBillingCache = () => {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(BILLING_CACHE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const setBillingCache = (billing) => {
  if (typeof window === "undefined") return;
  if (!billing) {
    localStorage.removeItem(BILLING_CACHE_KEY);
    return;
  }
  localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify(billing));
};

export const clearBillingCache = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BILLING_CACHE_KEY);
};

export const getPendingBillingPlan = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PENDING_BILLING_PLAN_KEY);
};

export const setPendingBillingPlan = (plan) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_BILLING_PLAN_KEY, plan);
};

export const clearPendingBillingPlan = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_BILLING_PLAN_KEY);
};
