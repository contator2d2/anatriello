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

  return { incidents, isLoading, createIncident, respondIncident };
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
