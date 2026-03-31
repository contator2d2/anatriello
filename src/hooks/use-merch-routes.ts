import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ===== ADMIN HOOKS (Fase 4 - Rotas & Execução) =====

export function useMerchRoutes(filters?: {
  promoter_id?: string; brand_id?: string; pdv_id?: string;
  status?: string; date_from?: string; date_to?: string; supervisor_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.promoter_id) params.set('promoter_id', filters.promoter_id);
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.pdv_id) params.set('pdv_id', filters.pdv_id);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  if (filters?.supervisor_id) params.set('supervisor_id', filters.supervisor_id);
  const qs = params.toString();
  return useQuery({
    queryKey: ['merch-routes', qs],
    queryFn: () => api<any[]>(`/api/merch/routes${qs ? `?${qs}` : ''}`),
  });
}

export function useMerchRouteDetail(id?: string) {
  return useQuery({
    queryKey: ['merch-route', id],
    queryFn: () => api<any>(`/api/merch/routes/${id}`),
    enabled: !!id,
  });
}

export function useCreateMerchRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merch/routes', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-routes'] }),
  });
}

export function useUpdateMerchRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merch/routes/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merch-routes'] }); qc.invalidateQueries({ queryKey: ['merch-route'] }); },
  });
}

export function useDeleteMerchRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merch/routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-routes'] }),
  });
}

export function useDuplicateMerchRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merch/routes/${id}/duplicate`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-routes'] }),
  });
}

export function useLiveRoutes() {
  return useQuery({
    queryKey: ['merch-routes-live'],
    queryFn: () => api<any[]>('/api/merch/routes/live'),
    refetchInterval: 15000,
  });
}

// Brand Checklists
export function useBrandChecklists(brandId?: string) {
  const qs = brandId ? `?brand_id=${brandId}` : '';
  return useQuery({
    queryKey: ['brand-checklists', brandId],
    queryFn: () => api<any[]>(`/api/merch/brand-checklists${qs}`),
  });
}

export function useCreateBrandChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merch/brand-checklists', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-checklists'] }),
  });
}

export function useUpdateBrandChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merch/brand-checklists/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-checklists'] }),
  });
}

// Damages (admin)
export function useMerchDamages(filters?: { brand_id?: string; pdv_id?: string; product_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.pdv_id) params.set('pdv_id', filters.pdv_id);
  if (filters?.product_id) params.set('product_id', filters.product_id);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ['merch-damages', qs],
    queryFn: () => api<any[]>(`/api/merch/damages${qs ? `?${qs}` : ''}`),
  });
}

// Return Requests
export function useReturnRequests() {
  return useQuery({
    queryKey: ['return-requests'],
    queryFn: () => api<any[]>('/api/merch/return-requests'),
  });
}

// Photo Settings
export function usePhotoSettings() {
  return useQuery({
    queryKey: ['photo-settings'],
    queryFn: () => api<any[]>('/api/merch/photo-settings'),
  });
}

export function useCreatePhotoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merch/photo-settings', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photo-settings'] }),
  });
}

// Brand Promoters
export function useBrandPromoters(brandId?: string) {
  const qs = brandId ? `?brand_id=${brandId}` : '';
  return useQuery({
    queryKey: ['brand-promoters', brandId],
    queryFn: () => api<any[]>(`/api/merch/brand-promoters${qs}`),
    enabled: !!brandId,
  });
}

export function useCreateBrandPromoter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merch/brand-promoters', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-promoters'] }),
  });
}

export function useRouteAuditLogs(routeId?: string) {
  return useQuery({
    queryKey: ['route-audit', routeId],
    queryFn: () => api<any[]>(`/api/merch/routes/${routeId}/audit`),
    enabled: !!routeId,
  });
}

export function useContingencyPhotoUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, ...data }: any) => api<any>(`/api/merch/routes/${routeId}/contingency-photos`, { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merch-route'] }); qc.invalidateQueries({ queryKey: ['merch-routes'] }); },
  });
}

export function useAssignPromoter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, ...data }: any) => api<any>(`/api/merch/routes/${routeId}/assign-promoter`, { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merch-routes'] }); qc.invalidateQueries({ queryKey: ['merch-route'] }); },
  });
}

// Photo Book
export function usePhotoBook(filters?: { brand_id?: string; pdv_id?: string; date_from?: string; date_to?: string }) {
  const params = new URLSearchParams();
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.pdv_id) params.set('pdv_id', filters.pdv_id);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  const qs = params.toString();
  return useQuery({
    queryKey: ['photo-book', qs],
    queryFn: () => api<any[]>(`/api/merch/photo-book${qs ? `?${qs}` : ''}`),
  });
}

// Route Authors
export function useRouteAuthors(routeId?: string) {
  return useQuery({
    queryKey: ['route-authors', routeId],
    queryFn: () => api<any[]>(`/api/merch/routes/${routeId}/authors`),
    enabled: !!routeId,
  });
}

// Route Assignment History
export function useRouteAssignmentHistory(routeId?: string) {
  return useQuery({
    queryKey: ['route-assign-history', routeId],
    queryFn: () => api<any[]>(`/api/merch/routes/${routeId}/assignment-history`),
    enabled: !!routeId,
  });
}

// Promoters Team (admin)
export function useMerchPromoters() {
  return useQuery({
    queryKey: ['merch-promoters-team'],
    queryFn: () => api<any[]>('/api/merch/promoters-team'),
  });
}
