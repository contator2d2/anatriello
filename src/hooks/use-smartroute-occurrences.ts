// SmartRoute — Onda 4: Ocorrências & SLA
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OccStatus = 'aberta' | 'em_analise' | 'resolvida' | 'descartada';

export interface OccurrenceFilters {
  status?: OccStatus | '';
  type?: string;
  severity?: 'low' | 'medium' | 'high' | '';
  driver_id?: string;
  from?: string;
  to?: string;
  sla?: 'breached' | 'in_sla' | '';
  q?: string;
}

const qs = (f: OccurrenceFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export function useOccurrences(filters: OccurrenceFilters = {}) {
  return useQuery<any[]>({
    queryKey: ['sr-occurrences', filters],
    queryFn: () => api(`/api/smartroute/occurrences${qs(filters)}`),
    refetchInterval: 30_000,
  });
}

export function useOccurrence(id?: string) {
  return useQuery<any>({
    queryKey: ['sr-occurrence', id],
    queryFn: () => api(`/api/smartroute/occurrences/${id}`),
    enabled: !!id,
  });
}

export function useUpdateOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) =>
      api(`/api/smartroute/occurrences/${id}`, { method: 'PUT', body }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['sr-occurrences'] });
      qc.invalidateQueries({ queryKey: ['sr-occurrence', v.id] });
      qc.invalidateQueries({ queryKey: ['sr-sla-metrics'] });
    },
  });
}

export function useAddOccurrenceComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api(`/api/smartroute/occurrences/${id}/comments`, { method: 'POST', body: { body } }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['sr-occurrence', v.id] }),
  });
}

export function useRefreshSLA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/smartroute/occurrences/refresh-sla', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sr-occurrences'] });
      qc.invalidateQueries({ queryKey: ['sr-sla-metrics'] });
    },
  });
}

export function useSLAMetrics(days = 30) {
  return useQuery<any>({
    queryKey: ['sr-sla-metrics', days],
    queryFn: () => api(`/api/smartroute/sla-metrics?days=${days}`),
    refetchInterval: 60_000,
  });
}

// Catálogo de tipos
export function useOccurrenceTypes() {
  return useQuery<any[]>({
    queryKey: ['sr-occurrence-types'],
    queryFn: () => api('/api/smartroute/occurrence-types'),
  });
}
export function useSaveOccurrenceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: any) => t.id
      ? api(`/api/smartroute/occurrence-types/${t.id}`, { method: 'PUT', body: t })
      : api(`/api/smartroute/occurrence-types`, { method: 'POST', body: t }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-occurrence-types'] }),
  });
}
export function useDeleteOccurrenceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/smartroute/occurrence-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-occurrence-types'] }),
  });
}
