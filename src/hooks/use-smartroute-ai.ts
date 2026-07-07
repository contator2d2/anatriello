import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/api/smartroute/ai';

export function useSRAISummary() {
  return useQuery<any>({ queryKey: ['sr-ai-summary'], queryFn: () => api(`${BASE}/summary`), refetchInterval: 60000 });
}

export function useSRAlerts(filters?: { resolved?: string; severity?: string; type?: string }) {
  const qs = new URLSearchParams(Object.entries(filters || {}).filter(([, v]) => v).map(([k, v]) => [k, String(v)])).toString();
  return useQuery<any[]>({ queryKey: ['sr-alerts', qs], queryFn: () => api(`${BASE}/alerts${qs ? `?${qs}` : ''}`), refetchInterval: 30000 });
}
export function useSRResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/alerts/${id}/resolve`, { method: 'POST', body: {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sr-alerts'] }); qc.invalidateQueries({ queryKey: ['sr-ai-summary'] }); },
  });
}
export function useSRDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-alerts'] }),
  });
}
export function useSRScanAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`${BASE}/alerts/scan`, { method: 'POST', body: {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sr-alerts'] }); qc.invalidateQueries({ queryKey: ['sr-ai-summary'] }); },
  });
}

export function useSRAnalyses(kind?: string) {
  const qs = kind ? `?kind=${kind}` : '';
  return useQuery<any[]>({ queryKey: ['sr-analyses', kind], queryFn: () => api(`${BASE}/analyses${qs}`) });
}
export function useSROcrBatchExpiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { image_url?: string; image_base64?: string; mime_type?: string; stop_id?: string; photo_id?: string }) =>
      api(`${BASE}/ocr/batch-expiry`, { method: 'POST', body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sr-analyses'] }); qc.invalidateQueries({ queryKey: ['sr-alerts'] }); },
  });
}
export function useSRShelfAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { image_url?: string; image_base64?: string; mime_type?: string; stop_id?: string; photo_id?: string; expected_brands?: string[] }) =>
      api(`${BASE}/analysis/shelf`, { method: 'POST', body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sr-analyses'] }); qc.invalidateQueries({ queryKey: ['sr-alerts'] }); },
  });
}

// ============ FASE 3 ============
export function useSROptimizeAdvanced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) => api(`/api/smartroute/ai/routes/${routeId}/optimize-advanced`, { method: 'POST', body: {} }),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['sr-route', id] }); qc.invalidateQueries({ queryKey: ['sr-routes'] }); },
  });
}

export function useSRAdvisorHistory() {
  return useQuery<any[]>({ queryKey: ['sr-advisor'], queryFn: () => api(`${BASE}/advisor/history`) });
}
export function useSRAdvisorAnalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { scope?: string; route_id?: string }) => api(`${BASE}/advisor/analyze`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-advisor'] }),
  });
}
export function useSRDeleteAdvisor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/advisor/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-advisor'] }),
  });
}
