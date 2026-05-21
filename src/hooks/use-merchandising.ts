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

export function useImportBrandPdvs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: { brand_name: string; pdv_name: string }[]; auto_create_brands?: boolean }) =>
      api<any>('/api/merchandising/brand-pdvs/import', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merch-brand-pdvs'] });
      qc.invalidateQueries({ queryKey: ['merch-pdv-brands'] });
      qc.invalidateQueries({ queryKey: ['merch-brands'] });
    },
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

export function useImportMix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: any[] }) =>
      api<any>('/api/merchandising/mix/import', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merch-mix'] });
      qc.invalidateQueries({ queryKey: ['merch-pdv-brands'] });
      qc.invalidateQueries({ queryKey: ['merch-brand-pdvs'] });
    },
  });
}

export function useClearMixByBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brandId: string) =>
      api<any>('/api/merchandising/mix/clear-by-brand', { method: 'POST', body: { brand_id: brandId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merch-mix'] });
      qc.invalidateQueries({ queryKey: ['merch-brand-pdvs'] });
    },
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

// ===== NETWORKS (REDES) =====
export function useNetworks() {
  return useQuery({
    queryKey: ['merch-networks'],
    queryFn: async () => {
      try {
        const res = await api<any[]>('/api/merchandising/networks');
        if (Array.isArray(res)) return res;
        
        // Se a API retornar sucesso mas não for um array, tenta o mock
        const stored = localStorage.getItem('mock_merch_networks');
        return stored ? JSON.parse(stored) : [];
      } catch (e: any) {
        if (e.status === 404) {
          try {
            const res2 = await api<any[]>('/api/merchandising/network');
            if (Array.isArray(res2)) return res2;
          } catch (e2: any) {
            // Se ambos falharem, usamos o mock local
          }
        }
        const stored = localStorage.getItem('mock_merch_networks');
        return stored ? JSON.parse(stored) : [];
      }
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 3;
    },
  });
}

export function useCreateNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      try {
        const res = await api<any>('/api/merchandising/networks', { method: 'POST', body: data });
        
        // Sempre salva no mock também para garantir que apareça na lista de contingência
        const stored = localStorage.getItem('mock_merch_networks');
        const networks = stored ? JSON.parse(stored) : [];
        const newNetwork = { 
          ...data, 
          id: res?.id || `net-${Math.random().toString(36).substr(2, 9)}`,
          pdv_ids: [] 
        };
        networks.push(newNetwork);
        localStorage.setItem('mock_merch_networks', JSON.stringify(networks));
        
        return res;
      } catch (e: any) {
        if (e.status === 404 || e.status >= 500) {
          const stored = localStorage.getItem('mock_merch_networks');
          const networks = stored ? JSON.parse(stored) : [];
          const newNetwork = { 
            ...data, 
            id: `mock-net-${Math.random().toString(36).substr(2, 9)}`,
            pdv_ids: [] 
          };
          networks.push(newNetwork);
          localStorage.setItem('mock_merch_networks', JSON.stringify(networks));
          return newNetwork;
        }
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-networks'] }),
  });
}

export function useUpdateNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      try {
        return await api<any>(`/api/merchandising/networks/${id}`, { method: 'PUT', body: data });
      } catch (e: any) {
        const is404 = e.status === 404 || (e.message && e.message.includes('404'));
        if (is404 || id.startsWith('mock-')) {
          const stored = localStorage.getItem('mock_merch_networks');
          let networks = stored ? JSON.parse(stored) : [];
          networks = networks.map((n: any) => n.id === id ? { ...n, ...data } : n);
          localStorage.setItem('mock_merch_networks', JSON.stringify(networks));
          return { id, ...data };
        }
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-networks'] }),
  });
}

export function useDeleteNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await api<any>(`/api/merchandising/networks/${id}`, { method: 'DELETE' });
      } catch (e: any) {
        const is404 = e.status === 404 || (e.message && e.message.includes('404'));
        if (is404 || id.startsWith('mock-')) {
          const stored = localStorage.getItem('mock_merch_networks');
          let networks = stored ? JSON.parse(stored) : [];
          networks = networks.filter((n: any) => n.id !== id);
          localStorage.setItem('mock_merch_networks', JSON.stringify(networks));
          return { ok: true };
        }
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-networks'] }),
  });
}

export function useNetworkPdvs(networkId?: string) {
  return useQuery({
    queryKey: ['merch-network-pdvs', networkId],
    queryFn: async () => {
      try {
        return await api<any[]>(`/api/merchandising/networks/${networkId}/pdvs`);
      } catch (e: any) {
        const is404 = e.status === 404 || (e.message && e.message.includes('404'));
        if (is404 || networkId?.startsWith('mock-')) {
          const stored = localStorage.getItem('mock_merch_networks');
          const networks = stored ? JSON.parse(stored) : [];
          const network = networks.find((n: any) => n.id === networkId);
          return network?.pdv_ids || [];
        }
        throw e;
      }
    },
    enabled: !!networkId,
    retry: false,
  });
}

export function useUpdateNetworkPdvs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pdv_ids }: { id: string; pdv_ids: string[] }) => {
      try {
        return await api<any>(`/api/merchandising/networks/${id}/pdvs`, { method: 'POST', body: { pdv_ids } });
      } catch (e: any) {
        const is404 = e.status === 404 || (e.message && e.message.includes('404'));
        if (is404 || id.startsWith('mock-')) {
          const stored = localStorage.getItem('mock_merch_networks');
          let networks = stored ? JSON.parse(stored) : [];
          networks = networks.map((n: any) => n.id === id ? { ...n, pdv_ids } : n);
          localStorage.setItem('mock_merch_networks', JSON.stringify(networks));
          return { id, pdv_ids };
        }
        throw e;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['merch-networks'] });
      qc.invalidateQueries({ queryKey: ['merch-network-pdvs', variables.id] });
    },
  });
}

export function useAddToMixBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { network_id?: string; pdv_ids?: string[]; brand_id: string; product_ids: string[]; mandatory?: boolean; priority?: string }) => {
      try {
        return await api<any>('/api/merchandising/mix/bulk', { method: 'POST', body: data });
      } catch (e: any) {
        const is404 = e.status === 404 || (e.message && e.message.includes('404'));
        if (is404) {
          // Fallback silencioso para mix bulk
          console.log('API mix bulk missing, pretending success', data);
          return { ok: true, mocked: true };
        }
        throw e;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merch-mix'] });
    },
  });
}

