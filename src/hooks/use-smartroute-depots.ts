import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/api/smartroute/depots';

export function useSRDepots() {
  return useQuery<any[]>({ queryKey: ['sr-depots'], queryFn: () => api(BASE) });
}
export function useSRSaveDepot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => id
      ? api(`${BASE}/${id}`, { method: 'PUT', body })
      : api(BASE, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-depots'] }),
  });
}
export function useSRDeleteDepot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-depots'] }),
  });
}
export function useSRGeocodeDepot() {
  return useMutation({
    mutationFn: (body: any) => api(`${BASE}/geocode`, { method: 'POST', body }) as Promise<{ lat: number; lng: number; display_name: string }>,
  });
}
