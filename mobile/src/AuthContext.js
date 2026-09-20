import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import api, { setAuthToken, setUnauthorizedHandler } from "./api";
import { closeSocket } from "./socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(async () => {
    closeSocket();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync("token").catch(() => {});
    await SecureStore.deleteItemAsync("user").catch(() => {});
  }, []);

  const persist = useCallback(async (data) => {
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data);
    await SecureStore.setItemAsync("token", data.token);
    await SecureStore.setItemAsync("user", JSON.stringify(data));
    return data;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    (async () => {
      try {
        const t = await SecureStore.getItemAsync("token");
        const u = await SecureStore.getItemAsync("user");
        if (t && u) {
          setAuthToken(t);
          setToken(t);
          setUser(JSON.parse(u));
          // re-validate so role / approval changes are picked up
          api
            .get("/auth/me")
            .then(({ data }) => setUser((prev) => ({ ...prev, ...data })))
            .catch(() => {});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clear]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser((prev) => ({ ...prev, ...data }));
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      refreshUser,
      logout: clear,
      login: async (identifier, password) => persist((await api.post("/auth/login", { identifier, password })).data),
      signup: async (payload) => persist((await api.post("/auth/signup", payload)).data),
      partnerSignup: async (payload) => persist((await api.post("/auth/partner/signup", payload)).data),
    }),
    [user, token, loading, refreshUser, clear, persist]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
