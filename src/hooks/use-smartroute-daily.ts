import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/api/smartroute';

// -------- Templates (rotas fixas) --------
export function useSRTemplates() {
  return useQuery<any[]>({ queryKey: ['sr-templates'], queryFn: () => api(`${BASE}/routes-templates`) });
}
export function useSRCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api(`${BASE}/routes/template`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-templates'] }),
  });
}
export function useSRUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => api(`${BASE}/routes/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-templates'] }),
  });
}
export function useSRDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-templates'] }),
  });
}

// -------- PDVs fixos da rota --------
export function useSRRoutePdvs(routeId?: string) {
  return useQuery<any[]>({
    queryKey: ['sr-route-pdvs', routeId],
    queryFn: () => api(`${BASE}/routes/${routeId}/pdvs`),
    enabled: !!routeId,
  });
}
export function useSRSaveRoutePdv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, ...body }: any) => api(`${BASE}/routes/${routeId}/pdvs`, { method: 'POST', body }),
    onSuccess: (_, v: any) => qc.invalidateQueries({ queryKey: ['sr-route-pdvs', v.routeId] }),
  });
}
export function useSRUpdateRoutePdv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, pdvId, ...body }: any) =>
      api(`${BASE}/routes/${routeId}/pdvs/${pdvId}`, { method: 'PUT', body }),
    onSuccess: (_, v: any) => qc.invalidateQueries({ queryKey: ['sr-route-pdvs', v.routeId] }),
  });
}
export function useSRDeleteRoutePdv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, pdvId }: any) =>
      api(`${BASE}/routes/${routeId}/pdvs/${pdvId}`, { method: 'DELETE' }),
    onSuccess: (_, v: any) => qc.invalidateQueries({ queryKey: ['sr-route-pdvs', v.routeId] }),
  });
}
export function useSRReorderRoutePdvs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, pdv_ids }: any) =>
      api(`${BASE}/routes/${routeId}/pdvs/reorder`, { method: 'PUT', body: { pdv_ids } }),
    onSuccess: (_, v: any) => qc.invalidateQueries({ queryKey: ['sr-route-pdvs', v.routeId] }),
  });
}

// -------- Escala semanal --------
export function useSRRouteSchedule(routeId?: string) {
  return useQuery<any[]>({
    queryKey: ['sr-route-schedule', routeId],
    queryFn: () => api(`${BASE}/routes/${routeId}/schedule`),
    enabled: !!routeId,
  });
}
export function useSRSaveRouteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, entries }: any) =>
      api(`${BASE}/routes/${routeId}/schedule`, { method: 'PUT', body: { entries } }),
    onSuccess: (_, v: any) => qc.invalidateQueries({ queryKey: ['sr-route-schedule', v.routeId] }),
  });
}

// -------- Rota do dia --------
export function useSRRouteDay(routeId?: string, date?: string) {
  return useQuery<any>({
    queryKey: ['sr-route-day', routeId, date],
    queryFn: () => api(`${BASE}/routes/${routeId}/day?date=${date}`),
    enabled: !!routeId && !!date,
  });
}
export function useSRSetDayDrivers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, date, driver_ids, vehicle_id }: any) =>
      api(`${BASE}/routes/${routeId}/day/${date}/drivers`, { method: 'POST', body: { driver_ids, vehicle_id } }),
    onSuccess: (_, v: any) => qc.invalidateQueries({ queryKey: ['sr-route-day', v.routeId, v.date] }),
  });
}
export function useSRCloseDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, date }: any) =>
      api(`${BASE}/routes/${routeId}/day/${date}/close`, { method: 'POST', body: {} }),
    onSuccess: (_, v: any) => {
      qc.invalidateQueries({ queryKey: ['sr-route-day', v.routeId, v.date] });
      qc.invalidateQueries({ queryKey: ['sr-routes'] });
    },
  });
}
export function useSRReopenDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, date }: any) =>
      api(`${BASE}/routes/${routeId}/day/${date}/reopen`, { method: 'POST', body: {} }),
    onSuccess: (_, v: any) => {
      qc.invalidateQueries({ queryKey: ['sr-route-day', v.routeId, v.date] });
      qc.invalidateQueries({ queryKey: ['sr-routes'] });
    },
  });
}
