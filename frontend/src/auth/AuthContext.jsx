import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setBooting(false);
      return undefined;
    }
    api
      .get("/auth/me")
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, [logout]);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("talenthub:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("talenthub:unauthorized", handleUnauthorized);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const response = await api.post(
      "/auth/login",
      { email, password },
      { auth: false },
    );
    setToken(response.access_token);
    setUser(response.user);
    return response.user;
  }, []);

  const register = useCallback(async (payload) => {
    const response = await api.post("/auth/register", payload, { auth: false });
    setToken(response.access_token);
    setUser(response.user);
    return response.user;
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.get("/auth/me");
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, register, logout, refreshUser }),
    [user, booting, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function dashboardPath(role) {
  if (role === "recruiter") return "/recruiter";
  if (role === "admin") return "/admin";
  return "/candidate";
}
