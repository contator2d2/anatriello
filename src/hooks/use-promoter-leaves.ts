import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const getAgencyHeaders = () => {
  const token = localStorage.getItem('agency_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export interface PromoterLeave {
  id: string;
  promoter_id: string;
  promoter_name?: string;
  promoter_cpf?: string;
  promoter_type?: string;
  agency_id: string;
  reason: 'doenca' | 'ferias' | 'falta' | 'desligamento' | 'outro';
  start_date: string;
  end_date?: string | null;
  substitute_promoter_id?: string | null;
  substitute_name?: string | null;
  substitute_type?: string | null;
  notes?: string | null;
  status: 'active' | 'closed';
  visits_reassigned?: number;
  created_at: string;
}

export const LEAVE_REASONS: Record<string, string> = {
  doenca: 'Doença',
  ferias: 'Férias',
  falta: 'Falta',
  desligamento: 'Desligamento',
  outro: 'Outro',
};

export function usePromoterLeaves(filters?: { agency_id?: string; active?: boolean; promoter_id?: string }) {
  return useQuery<PromoterLeave[]>({
    queryKey: ['promoter-leaves', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.agency_id) params.append('agency_id', filters.agency_id);
      if (filters?.active) params.append('active', 'true');
      if (filters?.promoter_id) params.append('promoter_id', filters.promoter_id);
      const qs = params.toString();
      return api(`/api/promoter-leaves${qs ? '?' + qs : ''}`, { headers: getAgencyHeaders() });
    },
  });
}

export function useAvailableSubstitutes(agencyId?: string, startDate?: string, endDate?: string) {
  return useQuery<any[]>({
    queryKey: ['available-substitutes', agencyId, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (agencyId) params.append('agency_id', agencyId);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      return api(`/api/promoter-leaves/available-substitutes?${params}`, { headers: getAgencyHeaders() });
    },
    enabled: !!agencyId,
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PromoterLeave>) =>
      api<PromoterLeave>('/api/promoter-leaves', { method: 'POST', body, headers: getAgencyHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promoter-leaves'] });
      qc.invalidateQueries({ queryKey: ['agency-visit-requests-summary'] });
    },
  });
}

export function useUpdateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<PromoterLeave>) =>
      api(`/api/promoter-leaves/${id}`, { method: 'PUT', body, headers: getAgencyHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promoter-leaves'] }),
  });
}

export function useDeleteLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/promoter-leaves/${id}`, { method: 'DELETE', headers: getAgencyHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promoter-leaves'] }),
  });
}
