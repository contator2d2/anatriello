import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AuthorizedPromoter {
  id: string;
  name: string;
  cpf: string;
  phone?: string;
  photo_url?: string;
  status: string;
  agency_id: string;
  agency_name?: string;
  active_block_id?: string | null;
  active_block_reason?: string | null;
  active_block_at?: string | null;
}

export interface PdvPromoterBlock {
  id: string;
  supermarket_unit_id: string;
  agency_promoter_id: string;
  reason?: string;
  active: boolean;
  blocked_at: string;
  unblocked_at?: string | null;
  blocked_by_name?: string | null;
  unblocked_by_name?: string | null;
  unblock_reason?: string | null;
  promoter_name?: string;
  promoter_cpf?: string;
  agency_name?: string;
  unit_name?: string;
}

const buildHeaders = (extra?: Record<string, string>) => {
  const headers: Record<string, string> = { ...(extra || {}) };
  const t = localStorage.getItem('supermarket_auth_token');
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
};

export function useAuthorizedPromoters(unitId?: string, extraHeaders?: Record<string, string>) {
  return useQuery<AuthorizedPromoter[]>({
    queryKey: ['pdv-authorized-promoters', unitId],
    queryFn: () => api(`/api/pdv-blocks/authorized-promoters${unitId ? `?unit_id=${unitId}` : ''}`, {
      headers: buildHeaders(extraHeaders),
    }),
    enabled: !!unitId,
  });
}

export function usePdvBlocks(params?: { unitId?: string; active?: boolean }, extraHeaders?: Record<string, string>) {
  return useQuery<PdvPromoterBlock[]>({
    queryKey: ['pdv-blocks', params?.unitId, params?.active],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.unitId) qs.set('unit_id', params.unitId);
      if (params?.active !== undefined) qs.set('active', String(params.active));
      const q = qs.toString();
      return api(`/api/pdv-blocks/blocks${q ? '?' + q : ''}`, { headers: buildHeaders(extraHeaders) });
    },
  });
}

export function useBlockPromoter(extraHeaders?: Record<string, string>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { agency_promoter_id: string; reason: string; supermarket_unit_id?: string }) =>
      api(`/api/pdv-blocks/blocks`, { method: 'POST', body, headers: buildHeaders(extraHeaders) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdv-blocks'] });
      qc.invalidateQueries({ queryKey: ['pdv-authorized-promoters'] });
    },
  });
}

export function useUnblockPromoter(extraHeaders?: Record<string, string>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api(`/api/pdv-blocks/blocks/${id}/unblock`, {
        method: 'POST', body: { reason }, headers: buildHeaders(extraHeaders),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdv-blocks'] });
      qc.invalidateQueries({ queryKey: ['pdv-authorized-promoters'] });
    },
  });
}
