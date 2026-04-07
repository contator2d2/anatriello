import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ===== BRANDS =====
export function useBrands(filters?: { status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['merch-brands', qs],
    queryFn: () => api<any[]>(`/api/merchandising/brands${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/brands', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-brands'] }),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merchandising/brands/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-brands'] }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merchandising/brands/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-brands'] }),
  });
}

export function useImportBrands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: any[] }) =>
      api<any>('/api/merchandising/brands/import', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-brands'] }),
  });
}

// ===== CATEGORIES =====
export function useCategories() {
  return useQuery({
    queryKey: ['merch-categories'],
    queryFn: () => api<any[]>('/api/merchandising/categories'),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/categories', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merchandising/categories/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merchandising/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-categories'] }),
  });
}

export function useImportCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: { name: string; parent?: string; description?: string }[] }) =>
      api<any>('/api/merchandising/categories/import', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merch-categories'] });
      qc.invalidateQueries({ queryKey: ['merch-subcategories'] });
    },
  });
}

// ===== SUBCATEGORIES =====
export function useSubcategories(categoryId?: string) {
  const params = categoryId ? `?category_id=${categoryId}` : '';
  return useQuery({
    queryKey: ['merch-subcategories', categoryId],
    queryFn: () => api<any[]>(`/api/merchandising/subcategories${params}`),
  });
}

export function useCreateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/subcategories', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-subcategories'] }),
  });
}

export function useUpdateSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merchandising/subcategories/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-subcategories'] }),
  });
}

export function useDeleteSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merchandising/subcategories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-subcategories'] }),
  });
}

// ===== PRODUCTS =====
export function useProducts(filters?: { brand_id?: string; category_id?: string; subcategory_id?: string; status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.category_id) params.set('category_id', filters.category_id);
  if (filters?.subcategory_id) params.set('subcategory_id', filters.subcategory_id);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['merch-products', qs],
    queryFn: () => api<any[]>(`/api/merchandising/products${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/products', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merchandising/products/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merchandising/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-products'] }),
  });
}

export function useBulkDeleteProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api<{ ok: boolean; deleted: number }>('/api/merchandising/products/bulk-delete', { method: 'POST', body: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-products'] }),
  });
}

export function useImportProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: any[]; auto_create: boolean }) => api<any>('/api/merchandising/products/import', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-products'] }),
  });
}

// ===== PDV BRANDS =====
export function usePdvBrands(pdvId?: string) {
  return useQuery({
    queryKey: ['merch-pdv-brands', pdvId],
    queryFn: () => api<any[]>(`/api/merchandising/pdv-brands/${pdvId}`),
    enabled: !!pdvId,
  });
}

// ===== BRAND PDVs (which PDVs a brand serves) =====
export function useBrandPdvs(brandId?: string) {
  return useQuery({
    queryKey: ['merch-brand-pdvs', brandId],
    queryFn: () => api<any[]>(`/api/merchandising/brand-pdvs/${brandId}`),
    enabled: !!brandId,
  });
}

export function useAddPdvBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pdv_id: string; brand_id: string }) => api<any>('/api/merchandising/pdv-brands', { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merch-pdv-brands'] }); qc.invalidateQueries({ queryKey: ['merch-brand-pdvs'] }); },
  });
}

export function useRemovePdvBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merchandising/pdv-brands/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merch-pdv-brands'] }); qc.invalidateQueries({ queryKey: ['merch-brand-pdvs'] }); },
  });
}

// ===== MIX =====
export function useMix(pdvId?: string, brandId?: string) {
  return useQuery({
    queryKey: ['merch-mix', pdvId, brandId],
    queryFn: () => api<any[]>(`/api/merchandising/mix/${pdvId}/${brandId}`),
    enabled: !!pdvId && !!brandId,
  });
}

export function useAddToMix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pdv_id: string; brand_id: string; product_ids: string[]; mandatory?: boolean; priority?: string }) =>
      api<any>('/api/merchandising/mix', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-mix'] }),
  });
}

export function useUpdateMixItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merchandising/mix/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-mix'] }),
  });
}

export function useRemoveFromMix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pdv_id: string; brand_id: string; product_ids: string[] }) =>
      api<any>('/api/merchandising/mix', { method: 'DELETE', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-mix'] }),
  });
}

// ===== REPORTS =====
export function useBrandReport(brandId?: string) {
  return useQuery({
    queryKey: ['merch-report-brand', brandId],
    queryFn: () => api<any[]>(`/api/merchandising/reports/brand/${brandId}`),
    enabled: !!brandId,
  });
}

export function usePdvReport(pdvId?: string) {
  return useQuery({
    queryKey: ['merch-report-pdv', pdvId],
    queryFn: () => api<any[]>(`/api/merchandising/reports/pdv/${pdvId}`),
    enabled: !!pdvId,
  });
}
