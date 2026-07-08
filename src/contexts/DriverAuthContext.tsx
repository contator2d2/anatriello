import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Driver { id: string; full_name: string; phone?: string; email?: string; cpf?: string; plate?: string; model?: string; }
interface Ctx { driver: Driver | null; token: string | null; loading: boolean; login: (login: string, password: string) => Promise<void>; logout: () => void; }

const DriverAuthContext = createContext<Ctx>({} as any);
export const useDriverAuth = () => useContext(DriverAuthContext);

const TOKEN_KEY = "smartroute_driver_token";
const DRIVER_KEY = "smartroute_driver";

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const d = localStorage.getItem(DRIVER_KEY);
    if (t) setToken(t);
    if (d) try { setDriver(JSON.parse(d)); } catch { /* noop */ }
    setLoading(false);
  }, []);

  const login = async (loginId: string, password: string) => {
    const res = await fetch("/api/smartroute/driver/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginId, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(DRIVER_KEY, JSON.stringify(data.driver));
    setToken(data.token); setDriver(data.driver);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DRIVER_KEY);
    setToken(null); setDriver(null);
  };

  return <DriverAuthContext.Provider value={{ driver, token, loading, login, logout }}>{children}</DriverAuthContext.Provider>;
}

export async function driverApi<T = any>(path: string, opts: Omit<RequestInit, "body"> & { body?: any } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body != null && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Erro") as Error & { data?: any; status?: number };
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}
