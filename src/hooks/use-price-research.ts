import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ===== Rules / Models =====
export function usePriceResearchRules(brandId?: string) {
  const params = brandId ? `?brand_id=${brandId}` : '';
  return useQuery({
    queryKey: ['price-research-rules', brandId],
    queryFn: () => api<any[]>(`/api/price-research/rules${params}`),
  });
}

export function useUpsertPriceResearchRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/rules', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-rules'] }),
  });
}

export function useDeletePriceResearchRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/price-research/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-rules'] }),
  });
}

// ===== Sharing =====
export function useShareRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shared }: { id: string; shared: boolean }) =>
      api<any>(`/api/price-research/rules/${id}/share`, { method: 'PUT', body: { shared } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-rules'] }),
  });
}

// ===== Validate execution =====
export function useValidateExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/price-research/executions/${id}/validate`, { method: 'PUT' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-research-executions'] });
      qc.invalidateQueries({ queryKey: ['price-research-rules'] });
    },
  });
}

// ===== Brand Results =====
export function useBrandResults(brandId?: string) {
  const params = brandId ? `?brand_id=${brandId}` : '';
  return useQuery({
    queryKey: ['price-research-brand-results', brandId],
    queryFn: () => api<any[]>(`/api/price-research/brand-results${params}`),
  });
}

export function useBrandResultDetail(ruleId?: string) {
  return useQuery({
    queryKey: ['price-research-brand-result', ruleId],
    queryFn: () => api<any>(`/api/price-research/brand-results/${ruleId}`),
    enabled: !!ruleId,
  });
}

// ===== Competitors =====
export function usePriceResearchCompetitors(brandId?: string) {
  const params = brandId ? `?brand_id=${brandId}` : '';
  return useQuery({
    queryKey: ['price-research-competitors', brandId],
    queryFn: () => api<any[]>(`/api/price-research/competitors${params}`),
    enabled: !!brandId,
  });
}

export function useCreateCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/competitors', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-competitors'] }),
  });
}

export function useUpdateCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/price-research/competitors/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-competitors'] }),
  });
}

export function useDeleteCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/price-research/competitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-competitors'] }),
  });
}

// ===== Product Mappings =====
export function usePriceResearchMappings(brandId?: string) {
  const params = brandId ? `?brand_id=${brandId}` : '';
  return useQuery({
    queryKey: ['price-research-mappings', brandId],
    queryFn: () => api<any[]>(`/api/price-research/product-mappings${params}`),
    enabled: !!brandId,
  });
}

export function useCreateProductMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/product-mappings', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-mappings'] }),
  });
}

export function useDeleteProductMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/price-research/product-mappings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-mappings'] }),
  });
}

// ===== Competitor Products =====
export function useCreateCompetitorProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/competitor-products', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-mappings'] }),
  });
}

export function useDeleteCompetitorProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/price-research/competitor-products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research-mappings'] }),
  });
}

// ===== Executions =====
export function usePriceResearchExecutions(filters?: { brand_id?: string; pdv_id?: string; promoter_id?: string; status?: string; date_from?: string; date_to?: string; rule_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.pdv_id) params.set('pdv_id', filters.pdv_id);
  if (filters?.promoter_id) params.set('promoter_id', filters.promoter_id);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  if (filters?.rule_id) params.set('rule_id', filters.rule_id);
  const qs = params.toString();
  return useQuery({
    queryKey: ['price-research-executions', qs],
    queryFn: () => api<any[]>(`/api/price-research/executions${qs ? `?${qs}` : ''}`),
  });
}

export function usePriceResearchExecutionDetail(id?: string) {
  return useQuery({
    queryKey: ['price-research-execution', id],
    queryFn: () => api<any>(`/api/price-research/executions/${id}`),
    enabled: !!id,
  });
}

// ===== Dashboard =====
export function usePriceResearchDashboard(filters?: { brand_id?: string; date_from?: string; date_to?: string }) {
  const params = new URLSearchParams();
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);
  const qs = params.toString();
  return useQuery({
    queryKey: ['price-research-dashboard', qs],
    queryFn: () => api<any>(`/api/price-research/dashboard${qs ? `?${qs}` : ''}`),
  });
}

// ===== Route Research (Promotor) =====
export function useRouteResearch(routeId?: string) {
  return useQuery({
    queryKey: ['price-research-route', routeId],
    queryFn: () => api<any[]>(`/api/price-research/route/${routeId}`),
    enabled: !!routeId,
  });
}

export function useExecuteResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/execute', { method: 'POST', body: data }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['price-research-route', vars.route_id] });
      qc.invalidateQueries({ queryKey: ['price-research-executions'] });
    },
  });
}

export function usePostponeResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/postpone', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research'] }),
  });
}

export function useJustifyResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/price-research/justify', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-research'] }),
  });
}

// ===== History =====
export function usePriceHistory(filters?: { product_id?: string; brand_id?: string; pdv_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.product_id) params.set('product_id', filters.product_id);
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.pdv_id) params.set('pdv_id', filters.pdv_id);
  const qs = params.toString();
  return useQuery({
    queryKey: ['price-research-history', qs],
    queryFn: () => api<any[]>(`/api/price-research/history${qs ? `?${qs}` : ''}`),
    enabled: !!(filters?.product_id || filters?.brand_id || filters?.pdv_id),
  });
}
