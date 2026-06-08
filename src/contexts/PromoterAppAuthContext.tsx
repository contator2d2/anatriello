import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PromoterAppUser {
  id: string;
  agency_promoter_id: string;
  name: string;
  cpf: string;
  agency_name?: string;
  photo_url?: string;
  status?: string;
}

interface PromoterAppAuthCtx {
  user: PromoterAppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (cpf: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<PromoterAppAuthCtx | undefined>(undefined);
const TOKEN_KEY = 'promoter_app_token';
const USER_KEY = 'promoter_app_user';

export const PromoterAppAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PromoterAppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refresh = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setUser(null); return; }
    try {
      const d = await api<{ user: PromoterAppUser }>('/api/promoter-app/me');
      setUser(d.user);
      localStorage.setItem(USER_KEY, JSON.stringify(d.user));
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      const cached = localStorage.getItem(USER_KEY);
      if (cached) try { setUser(JSON.parse(cached)); } catch {}
      await refresh();
      setIsLoading(false);
    })();

    // Inject PWA manifest for promoter app
    const linkId = 'promoter-app-manifest';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'manifest';
      link.href = '/promoter-app-manifest.webmanifest';
      document.head.appendChild(link);
      const theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#0f172a';
      theme.id = 'promoter-app-theme';
      document.head.appendChild(theme);
    }
  }, []);

  const login = async (cpf: string, password: string) => {
    const d = await api<{ token: string; user: PromoterAppUser }>('/api/promoter-app/login', {
      method: 'POST', body: { cpf, password }, auth: false,
    });
    localStorage.setItem(TOKEN_KEY, d.token);
    localStorage.setItem(USER_KEY, JSON.stringify(d.user));
    setUser(d.user);
    toast({ title: `Olá, ${d.user.name.split(' ')[0]}!` });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export const usePromoterAppAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePromoterAppAuth must be inside PromoterAppAuthProvider');
  return c;
};
