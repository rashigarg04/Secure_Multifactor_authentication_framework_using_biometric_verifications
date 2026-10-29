import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setUser(null);
    setSession(null);
  }, []);

  /** Re-read the current user/session from the server (cookie based). */
  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setSession(data.session);
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [clear]);

  /** Store the result of a successful login / register / biometric verification. */
  const setAuth = useCallback(({ user: u, session: s }) => {
    setUser(u);
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }, [clear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The axios interceptor fires this when any protected call returns 401
  useEffect(() => {
    window.addEventListener("auth:expired", clear);
    return () => window.removeEventListener("auth:expired", clear);
  }, [clear]);

  const value = useMemo(
    () => ({ user, session, loading, refresh, setAuth, logout }),
    [user, session, loading, refresh, setAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}