import axios from "axios";
import { API_URL } from "./site";

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// Attach the JWT token to every request if the user is logged in
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// An expired/invalid token anywhere in the app sends the user back to login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/signup") || url.includes("/auth/partner/signup");
    if (typeof window !== "undefined" && error.response?.status === 401 && !isAuthCall && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login?expired=1";
    }
    return Promise.reject(error);
  }
);

export const errMsg = (err, fallback = "Something went wrong. Please try again.") => {
  const responseMessage = err?.response?.data?.message;
  if (responseMessage) return responseMessage;

  if (err?.code === "ECONNABORTED") {
    return "The server took too long to respond. Please try again in a moment.";
  }
  if (!err?.response) {
    return "Can't reach the backend. Check the API URL and backend deployment, then try again.";
  }
  if (err.response.status >= 500) {
    const requestId = err.response.data?.requestId;
    return `The backend returned an error (HTTP ${err.response.status}). Check the backend logs${requestId ? ` using request ID ${requestId}` : ""}.`;
  }
  return fallback;
};

export default api;
