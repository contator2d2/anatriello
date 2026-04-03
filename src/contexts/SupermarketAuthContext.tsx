import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SupermarketUser {
  id: string;
  supermarket_unit_id: string;
  network_id?: string;
  email: string;
  name: string;
  role: string;
  unit_name?: string;
  network_name?: string;
  can_view_all_network?: boolean;
  organization_id?: string;
}

interface SupermarketAuthContextType {
  user: SupermarketUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SupermarketAuthContext = createContext<SupermarketAuthContextType | undefined>(undefined);
const TOKEN_KEY = 'supermarket_auth_token';

export const SupermarketAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupermarketUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const data = await api<{ user: SupermarketUser }>('/api/access-control/supermarket-auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
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
    const data = await api<{ user: SupermarketUser; token: string }>('/api/access-control/supermarket-auth/login', {
      method: 'POST',
      body: { email, password },
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
    <SupermarketAuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </SupermarketAuthContext.Provider>
  );
};

export const useSupermarketAuth = () => {
  const ctx = useContext(SupermarketAuthContext);
  if (!ctx) throw new Error('useSupermarketAuth must be used within SupermarketAuthProvider');
  return ctx;
};
