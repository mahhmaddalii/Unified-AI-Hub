// frontend/utils/auth.js

import { clearBillingCache } from "./billing";

export const API_URL = "http://127.0.0.1:8000"; // Django backend
const JSON_HEADERS = { "Content-Type": "application/json" };

// Save tokens to localStorage
export const setTokens = ({ access, refresh, remember = false }) => {
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
  if (remember) {
    localStorage.setItem("rememberMe", "true");
  }
};

// Get access token
export const getAccessToken = () => localStorage.getItem("accessToken");

// Get refresh token
export const getRefreshToken = () => localStorage.getItem("refreshToken");

export const refreshAccessToken = async ({ suppressUnauthorizedRedirect = false } = {}) => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    if (!suppressUnauthorizedRedirect) {
      logoutUser();
    }
    return null;
  }

  const refreshRes = await fetch(`${API_URL}/api/token/refresh/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!refreshRes.ok) {
    if (!suppressUnauthorizedRedirect) {
      logoutUser();
    }
    return null;
  }

  const data = await refreshRes.json();
  if (!data?.access) {
    if (!suppressUnauthorizedRedirect) {
      logoutUser();
    }
    return null;
  }

  // Django is configured to rotate refresh tokens, so keep Stripe success
  // and later API calls aligned with the freshest token pair.
  setTokens({ access: data.access, refresh: data.refresh || refreshToken });
  return data.access;
};

export const getValidAccessToken = async ({ suppressUnauthorizedRedirect = false } = {}) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    return accessToken;
  }
  return refreshAccessToken({ suppressUnauthorizedRedirect });
};

// Remove tokens
export const logoutUser = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("rememberMe");
  clearBillingCache();
  window.location.href = "/login";
};

// Fetch with automatic token refresh
export const fetchWithAuth = async (url, options = {}) => {
  const {
    suppressUnauthorizedRedirect = false,
    headers = {},
    ...fetchOptions
  } = options;
  let token = await getValidAccessToken({ suppressUnauthorizedRedirect });
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  const requestOptions = {
    ...fetchOptions,
    headers: {
      ...(isFormData ? {} : JSON_HEADERS),
      ...headers,
    },
  };

  if (token) {
    requestOptions.headers = {
      ...requestOptions.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  let res = await fetch(url, requestOptions);

  // Stripe success redirects can arrive before the latest access token is
  // available, so retry once after a silent refresh before giving up.
  if (res.status === 401) {
    token = await refreshAccessToken({ suppressUnauthorizedRedirect });
    if (token) {
      requestOptions.headers = {
        ...requestOptions.headers,
        Authorization: `Bearer ${token}`,
      };
      res = await fetch(url, requestOptions);
    } else if (!suppressUnauthorizedRedirect) {
      logoutUser();
    }
  }

  return res;
};

// Check if there is an active session without forcing a redirect.
export const checkActiveSession = async () => {
  const token = await getValidAccessToken({ suppressUnauthorizedRedirect: true });
  if (!token) {
    return { isAuthenticated: false, user: null };
  }

  try {
    const res = await fetch(`${API_URL}/api/me/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...JSON_HEADERS,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return { isAuthenticated: true, user: data };
    }
  } catch (err) {
    console.error("Active session check failed:", err);
  }

  return { isAuthenticated: false, user: null };
};
