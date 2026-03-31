import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Promotor API helper (uses promotor_token)
const promotorApi = async <T>(endpoint: string, options: any = {}): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('promotor_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${endpoint}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Erro');
  return data as T;
};

// ===== PROMOTOR ROUTE HOOKS =====

export function usePromotorAgenda(filters?: { date_from?: string; date_to?: string }) {
  const params = new URLSearchParams();
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  const qs = params.toString();
  return useQuery({
    queryKey: ['promotor-agenda', qs],
    queryFn: () => promotorApi<any[]>(`/api/merch/promotor/agenda${qs ? `?${qs}` : ''}`),
  });
}

export function usePromotorRouteDetail(id?: string) {
  return useQuery({
    queryKey: ['promotor-route', id],
    queryFn: () => promotorApi<any>(`/api/merch/promotor/routes/${id}`),
    enabled: !!id,
  });
}

export function usePromotorCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => promotorApi<any>(`/api/merch/promotor/routes/${id}/checkin`, { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotor-agenda'] }); qc.invalidateQueries({ queryKey: ['promotor-route'] }); },
  });
}

export function usePromotorCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => promotorApi<any>(`/api/merch/promotor/routes/${id}/checkout`, { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotor-agenda'] }); qc.invalidateQueries({ queryKey: ['promotor-route'] }); },
  });
}

export function usePromotorUpdateExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => promotorApi<any>(`/api/merch/promotor/executions/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorAddValidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, ...data }: any) => promotorApi<any>(`/api/merch/promotor/executions/${executionId}/validity`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorReportRupture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, ...data }: any) => promotorApi<any>(`/api/merch/promotor/executions/${executionId}/rupture`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorReportDamage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, ...data }: any) => promotorApi<any>(`/api/merch/promotor/executions/${executionId}/damage`, { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotor-route'] }); qc.invalidateQueries({ queryKey: ['promotor-damages'] }); },
  });
}

export function usePromotorReportDiscard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, ...data }: any) => promotorApi<any>(`/api/merch/promotor/executions/${executionId}/discard`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, ...data }: any) => promotorApi<any>(`/api/merch/promotor/routes/${routeId}/photos`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorDamages(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['promotor-damages', status],
    queryFn: () => promotorApi<any[]>(`/api/merch/promotor/damages${qs}`),
  });
}

export function usePromotorRequestReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => promotorApi<any>('/api/merch/promotor/return-requests', { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotor-damages'] }); },
  });
}

export function usePromotorUploadInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => promotorApi<any>('/api/merch/promotor/return-invoices', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-damages'] }),
  });
}

export function usePromotorPostpone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => promotorApi<any>('/api/merch/promotor/postpone', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorSetPointType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, catId, point_type }: { routeId: string; catId: string; point_type: string }) =>
      promotorApi<any>(`/api/merch/promotor/routes/${routeId}/categories/${catId}/point-type`, { method: 'POST', body: { point_type } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}

export function usePromotorCategoryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, catId, ...data }: { routeId: string; catId: string; photo_url: string; latitude?: number; longitude?: number }) =>
      promotorApi<any>(`/api/merch/promotor/routes/${routeId}/categories/${catId}/photo`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotor-route'] }),
  });
}
