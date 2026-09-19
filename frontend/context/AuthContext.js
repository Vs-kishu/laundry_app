"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import api from "../lib/api";
import { closeSocket } from "../lib/socket";

const AuthContext = createContext(null);

export const roleHome = (role) => (role === "admin" ? "/admin" : role === "partner" ? "/partner" : "/book");

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const persist = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
    return data;
  };

  // Restore the session instantly from storage, then re-validate against the API so role /
  // partner-approval changes made by an admin show up without a fresh login.
  useEffect(() => {
    const stored = readStored();
    if (stored) setUser(stored);
    setLoading(false);

    if (stored && localStorage.getItem("token")) {
      api
        .get("/auth/me")
        .then(({ data }) => {
          const merged = { ...stored, ...data };
          localStorage.setItem("user", JSON.stringify(merged));
          setUser(merged);
        })
        .catch(() => {}); // a 401 is handled by the api interceptor
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser((prev) => {
      const merged = { ...prev, ...data };
      localStorage.setItem("user", JSON.stringify(merged));
      return merged;
    });
    return data;
  }, []);

  const login = async (identifier, password) => persist((await api.post("/auth/login", { identifier, password })).data);
  const signup = async (payload) => persist((await api.post("/auth/signup", payload)).data);
  const partnerSignup = async (payload) => persist((await api.post("/auth/partner/signup", payload)).data);

  const logout = (to = "/login") => {
    closeSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push(typeof to === "string" ? to : "/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, partnerSignup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// Page guard: sends signed-out users to /login (remembering where they were going) and
// users with the wrong role to their own home. Returns `ready` once the page may render.
export function useRequireRole(roles, loginPath = "/login") {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(roleHome(user.role));
  }, [loading, user, allowed, router, pathname, loginPath]);

  return { user, ready: !loading && allowed };
}
