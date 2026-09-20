import axios from "axios";
import { API_URL } from "./config";

// The AuthContext keeps these in sync with secure storage.
let token = null;
let onUnauthorized = () => {};
export const setAuthToken = (t) => {
  token = t;
};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/signup") || url.includes("/auth/partner/signup");
    if (error.response?.status === 401 && token && !isAuthCall) onUnauthorized();
    return Promise.reject(error);
  }
);

export const errMsg = (err, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.message ||
  (err?.code === "ERR_NETWORK" || err?.message === "Network Error"
    ? `Can't reach the server at ${API_URL}. Is the backend running and on the same Wi-Fi?`
    : fallback);

export default api;
