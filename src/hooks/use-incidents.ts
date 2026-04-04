import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface Incident {
  id: string;
  organization_id: string;
  reported_by_unit_id?: string;
  reported_by_user_name?: string;
  agency_promoter_id?: string;
  agency_id?: string;
  promoter_name?: string;
  agency_name?: string;
  unit_name?: string;
  incident_type: string;
  severity: string;
  status: string;
  description?: string;
  incident_date: string;
  photo_urls?: string[];
  ai_classification?: {
    type?: string;
    severity?: string;
    impact?: string;
    risk?: string;
    summary?: string;
    keywords?: string[];
    analyzed_at?: string;
    tokens_used?: number;
  };
  created_at: string;
  updated_at: string;
  responses?: IncidentResponse[];
}

export interface IncidentResponse {
  id: string;
  incident_id: string;
  responder_type: string;
  responder_name?: string;
  message: string;
  attachment_urls?: string[];
  new_status?: string;
  created_at: string;
}

export interface AuthorizedContact {
  id: string;
  organization_id: string;
  unit_id: string;
  name: string;
  phone: string;
  role: string;
  permissions: string[];
  active: boolean;
  notes?: string;
  unit_name?: string;
  created_at: string;
  updated_at: string;
}

export function useIncidents(portal?: 'supermarket' | 'agency' | 'admin') {
  const qc = useQueryClient();

  const getHeaders = () => {
    if (portal === 'supermarket') {
      const t = localStorage.getItem('supermarket_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    if (portal === 'agency') {
      const t = localStorage.getItem('agency_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    return undefined; // admin uses default auth
  };

  const basePath = portal === 'supermarket'
    ? '/api/access-control/supermarket-portal/incidents'
    : portal === 'agency'
    ? '/api/access-control/agency/incidents'
    : '/api/access-control/incidents';

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', portal],
    queryFn: () => api<Incident[]>(basePath, { headers: getHeaders() }),
  });

  const createIncident = useMutation({
    mutationFn: (data: Partial<Incident>) =>
      api(basePath, { method: 'POST', body: data, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Ocorrência registrada');
    },
    onError: () => toast.error('Erro ao registrar ocorrência'),
  });

  const respondIncident = useMutation({
    mutationFn: ({ id, ...data }: { id: string; message: string; new_status?: string; responder_type: string; responder_name?: string }) =>
      api(`${basePath}/${id}/respond`, { method: 'POST', body: data, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Resposta enviada');
    },
    onError: () => toast.error('Erro ao responder'),
  });

  const analyzeIncident = useMutation({
    mutationFn: (id: string) => {
      const analyzePath = portal === 'supermarket'
        ? `/api/access-control/supermarket-portal/incidents/${id}/analyze`
        : portal === 'agency'
        ? `/api/access-control/agency/incidents/${id}/analyze`
        : `/api/access-control/incidents/${id}/analyze`;
      return api(analyzePath, { method: 'POST', headers: getHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Análise IA concluída');
    },
    onError: () => toast.error('Erro na análise IA'),
  });

  const analyzeBatch = useMutation({
    mutationFn: () =>
      api('/api/access-control/incidents/analyze-batch', { method: 'POST', headers: getHeaders() }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      toast.success(`${data?.analyzed || 0} ocorrências analisadas`);
    },
    onError: () => toast.error('Erro na análise em lote'),
  });

  return { incidents, isLoading, createIncident, respondIncident, analyzeIncident, analyzeBatch };
}

export function usePromoterScores(portal?: 'supermarket' | 'agency' | 'admin') {
  const getHeaders = () => {
    if (portal === 'supermarket') {
      const t = localStorage.getItem('supermarket_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    if (portal === 'agency') {
      const t = localStorage.getItem('agency_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    return undefined;
  };

  const basePath = portal === 'supermarket'
    ? '/api/access-control/supermarket-portal/scores'
    : portal === 'agency'
    ? '/api/access-control/agency/scores'
    : '/api/access-control/scores';

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['promoter-scores', portal],
    queryFn: () => api<any[]>(basePath, { headers: getHeaders() }),
  });

  return { scores, isLoading };
}

export function useDailySummary(portal?: 'supermarket' | 'agency' | 'admin') {
  const getHeaders = () => {
    if (portal === 'supermarket') {
      const t = localStorage.getItem('supermarket_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    if (portal === 'agency') {
      const t = localStorage.getItem('agency_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    return undefined;
  };

  const basePath = portal === 'supermarket'
    ? '/api/access-control/supermarket-portal/daily-summary'
    : portal === 'agency'
    ? '/api/access-control/agency/daily-summary'
    : '/api/access-control/daily-summary';

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['daily-summary', portal],
    queryFn: () => api<any>(basePath, { headers: getHeaders() }),
  });

  return { summary, isLoading, refetch };
}

export function useAuthorizedContacts(portal?: 'supermarket' | 'admin') {
  const qc = useQueryClient();

  const getHeaders = () => {
    if (portal === 'supermarket') {
      const t = localStorage.getItem('supermarket_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    return undefined;
  };

  const basePath = portal === 'supermarket'
    ? '/api/access-control/supermarket-portal/authorized-contacts'
    : '/api/access-control/authorized-contacts';

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['authorized-contacts', portal],
    queryFn: () => api<AuthorizedContact[]>(basePath, { headers: getHeaders() }),
  });

  const createContact = useMutation({
    mutationFn: (data: Partial<AuthorizedContact>) =>
      api(basePath, { method: 'POST', body: data, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authorized-contacts'] });
      toast.success('Contato adicionado');
    },
    onError: () => toast.error('Erro ao adicionar contato'),
  });

  const updateContact = useMutation({
    mutationFn: ({ id, ...data }: Partial<AuthorizedContact> & { id: string }) =>
      api(`${basePath}/${id}`, { method: 'PUT', body: data, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authorized-contacts'] });
      toast.success('Contato atualizado');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) =>
      api(`${basePath}/${id}`, { method: 'DELETE', headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authorized-contacts'] });
      toast.success('Contato removido');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  return { contacts, isLoading, createContact, updateContact, deleteContact };
}

export function useBehaviorAnalysis(portal?: 'agency' | 'admin') {
  const getHeaders = () => {
    if (portal === 'agency') {
      const t = localStorage.getItem('agency_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    return undefined;
  };

  const getBehavior = (promoterId: string) => {
    const basePath = portal === 'agency'
      ? `/api/access-control/agency/promoter-behavior/${promoterId}`
      : `/api/access-control/behavior/${promoterId}`;
    return api<any[]>(basePath, { headers: getHeaders() });
  };

  const analyzeBehavior = (promoterId: string) => {
    const basePath = portal === 'agency'
      ? `/api/access-control/agency/promoter-behavior/${promoterId}/analyze`
      : `/api/access-control/behavior/${promoterId}/analyze`;
    return api<any>(basePath, { method: 'POST', headers: getHeaders() });
  };

  return { getBehavior, analyzeBehavior };
}

export function useAssistantLog(portal?: 'supermarket' | 'admin') {
  const getHeaders = () => {
    if (portal === 'supermarket') {
      const t = localStorage.getItem('supermarket_auth_token');
      return t ? { Authorization: `Bearer ${t}` } : undefined;
    }
    return undefined;
  };

  const basePath = portal === 'supermarket'
    ? '/api/access-control/supermarket-portal/assistant-log'
    : '/api/access-control/assistant-log';

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['assistant-log', portal],
    queryFn: () => api<any[]>(basePath, { headers: getHeaders() }),
  });

  return { logs, isLoading };
}
