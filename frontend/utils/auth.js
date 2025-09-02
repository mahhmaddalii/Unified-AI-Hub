// frontend/utils/auth.js

export const API_URL = "http://127.0.0.1:8000"; // Django backend

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

// Remove tokens
export const logoutUser = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("rememberMe");
  window.location.href = "/login";
};

// Fetch with automatic token refresh
export const fetchWithAuth = async (url, options = {}) => {
  let token = getAccessToken();
  
  if (!options.headers) {
    options.headers = {};
  }
  
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let res = await fetch(url, options);

  // If access token expired
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      logoutUser();
      return res;
    }

    // Request new access token
    const refreshRes = await fetch(`${API_URL}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setTokens({ access: data.access, refresh: refreshToken });
      token = data.access;

      // Retry original request with new token
      options.headers.Authorization = `Bearer ${token}`;
      res = await fetch(url, options);
    } else {
      logoutUser();
    }
  }

  return res;
};