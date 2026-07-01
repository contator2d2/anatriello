import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Company {
  id: string;
  organization_id: string;
  name: string;
  trade_name?: string | null;
  cnpj?: string | null;
  logo_url?: string | null;
  color?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  punch_facial_required: boolean;
  punch_gps_required: boolean;
  active_employees?: number;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'holding.selectedCompanyId';

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Company[]>('/api/companies', { auth: true });
      setCompanies(data || []);
      if (!selectedId && data && data.length) {
        setSelectedIdState(data[0].id);
        localStorage.setItem(STORAGE_KEY, data[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar empresas');
    } finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const create = async (data: Partial<Company>) => {
    const created = await api<Company>('/api/companies', { method: 'POST', body: data, auth: true });
    await refresh();
    return created;
  };

  const update = async (id: string, data: Partial<Company>) => {
    const updated = await api<Company>(`/api/companies/${id}`, { method: 'PUT', body: data, auth: true });
    await refresh();
    return updated;
  };

  const remove = async (id: string) => {
    await api(`/api/companies/${id}`, { method: 'DELETE', auth: true });
    await refresh();
  };

  return { companies, loading, refresh, create, update, remove, selectedId, setSelectedId };
}
