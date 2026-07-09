import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/api/smartroute/planner';

export function useSRAutoPlan() {
  return useMutation({
    mutationFn: (body: {
      date: string;
      order_ids?: string[];
      vehicle_ids?: string[];
      driver_ids?: string[];
      depot_id?: string;
      start_hour?: number;
    }) => api(`${BASE}/auto-plan`, { method: 'POST', body }) as Promise<any>,
  });
}

export function useSRCommitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { date: string; depot_id?: string; plans: any[] }) =>
      api(`${BASE}/commit`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sr-routes'] });
      qc.invalidateQueries({ queryKey: ['sr-orders'] });
    },
  });
}

export function useSRReoptimize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) =>
      api(`${BASE}/routes/${routeId}/reoptimize`, { method: 'POST', body: {} }) as Promise<any>,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['sr-route', id] });
      qc.invalidateQueries({ queryKey: ['sr-routes'] });
    },
  });
}
