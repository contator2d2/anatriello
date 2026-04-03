import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AgencyUser {
  id: string;
  agency_id: string;
  email: string;
  name: string;
  role: string;
  agency_name?: string;
  organization_id?: string;
}

interface AgencyAuthContextType {
  user: AgencyUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AgencyAuthContext = createContext<AgencyAuthContextType | undefined>(undefined);

const AGENCY_TOKEN_KEY = 'agency_auth_token';

export const AgencyAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AgencyUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem(AGENCY_TOKEN_KEY);
      if (token) {
        try {
          const data = await api<{ user: AgencyUser }>('/api/access-control/agency-auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(data.user);
        } catch {
          localStorage.removeItem(AGENCY_TOKEN_KEY);
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api<{ user: AgencyUser; token: string }>('/api/access-control/agency-auth/login', {
      method: 'POST',
      body: { email, password },
    });
    localStorage.setItem(AGENCY_TOKEN_KEY, data.token);
    setUser(data.user);
    toast({ title: 'Login realizado com sucesso!' });
  };

  const logout = () => {
    localStorage.removeItem(AGENCY_TOKEN_KEY);
    setUser(null);
    toast({ title: 'Logout realizado' });
  };

  return (
    <AgencyAuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AgencyAuthContext.Provider>
  );
};

export const useAgencyAuth = () => {
  const context = useContext(AgencyAuthContext);
  if (!context) throw new Error('useAgencyAuth must be used within AgencyAuthProvider');
  return context;
};
