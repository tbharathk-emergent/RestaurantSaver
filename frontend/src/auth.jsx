import { createContext, useContext, useEffect, useState, useCallback } from "react";
import client from "@/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("rob_token");
    if (!token) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await client.get("/auth/me");
      setUser(data.user);
      setTenant(data.tenant);
    } catch (e) {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = (token, u, t) => {
    localStorage.setItem("rob_token", token);
    setUser(u);
    setTenant(t);
  };

  const logout = () => {
    localStorage.removeItem("rob_token");
    localStorage.removeItem("rob_user");
    setUser(null);
    setTenant(null);
    window.location.href = "/login";
  };

  return (
    <AuthCtx.Provider value={{ user, tenant, loading, login, logout, refresh, setTenant }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
