import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface NetworkUser {
  id: string;
  network_id: string;
  network_name?: string;
  email: string;
  name: string;
  role: string;
  organization_id?: string;
}

interface NetworkAuthContextType {
  user: NetworkUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const NetworkAuthContext = createContext<NetworkAuthContextType | undefined>(undefined);
const TOKEN_KEY = 'network_auth_token';

export const NetworkAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<NetworkUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const data = await api<{ user: NetworkUser }>('/api/network-portal/me');
          setUser(data.user);
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    };
    check();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api<{ user: NetworkUser; token: string }>('/api/network-portal/login', {
      method: 'POST', body: { email, password }, auth: false,
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    toast({ title: 'Login realizado com sucesso!' });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    toast({ title: 'Logout realizado' });
  };

  return (
    <NetworkAuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </NetworkAuthContext.Provider>
  );
};

export const useNetworkAuth = () => {
  const ctx = useContext(NetworkAuthContext);
  if (!ctx) throw new Error('useNetworkAuth must be used within NetworkAuthProvider');
  return ctx;
};
