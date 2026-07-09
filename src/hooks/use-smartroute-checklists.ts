// Hooks admin — checklists configuráveis (Onda 2)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const FIELD_TYPES = [
  { v: 'photo', l: 'Foto' },
  { v: 'video', l: 'Vídeo' },
  { v: 'text', l: 'Texto' },
  { v: 'number', l: 'Número' },
  { v: 'temperature', l: 'Temperatura' },
  { v: 'stock_count', l: 'Contagem de estoque' },
  { v: 'ocr', l: 'OCR (foto do produto)' },
  { v: 'qr', l: 'QR Code' },
  { v: 'barcode', l: 'Código de barras' },
  { v: 'signature', l: 'Assinatura' },
  { v: 'geo', l: 'Geolocalização' },
  { v: 'face', l: 'Validação facial' },
  { v: 'yes_no', l: 'Sim / Não' },
  { v: 'multi_choice', l: 'Múltipla escolha' },
];

export function useChecklistTemplates() {
  return useQuery<any[]>({
    queryKey: ['sr-checklist-templates'],
    queryFn: () => api('/api/smartroute/checklist-templates'),
  });
}

export function useChecklistTemplate(id?: string) {
  return useQuery<any>({
    queryKey: ['sr-checklist-template', id],
    queryFn: () => api(`/api/smartroute/checklist-templates/${id}`),
    enabled: !!id,
  });
}

export function useSaveChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: any) => t.id
      ? api(`/api/smartroute/checklist-templates/${t.id}`, { method: 'PUT', body: t })
      : api(`/api/smartroute/checklist-templates`, { method: 'POST', body: t }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-checklist-templates'] }),
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/smartroute/checklist-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-checklist-templates'] }),
  });
}

export function useSaveChecklistItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: any[] }) =>
      api(`/api/smartroute/checklist-templates/${id}/items`, { method: 'PUT', body: { items } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['sr-checklist-template', v.id] });
      qc.invalidateQueries({ queryKey: ['sr-checklist-templates'] });
    },
  });
}

export function useChecklistAssignments() {
  return useQuery<any[]>({
    queryKey: ['sr-checklist-assignments'],
    queryFn: () => api('/api/smartroute/checklist-assignments'),
  });
}

export function useSaveChecklistAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: any) => a.id
      ? api(`/api/smartroute/checklist-assignments/${a.id}`, { method: 'PUT', body: a })
      : api(`/api/smartroute/checklist-assignments`, { method: 'POST', body: a }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-checklist-assignments'] }),
  });
}

export function useDeleteChecklistAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/smartroute/checklist-assignments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-checklist-assignments'] }),
  });
}

// Operação (settings) + métricas + replay enriquecido
export function useOperationSettings() {
  return useQuery<any>({
    queryKey: ['sr-operation-settings'],
    queryFn: () => api('/api/smartroute/operation-settings'),
  });
}
export function useSaveOperationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: any) => api('/api/smartroute/operation-settings', { method: 'PUT', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-operation-settings'] }),
  });
}

export function useOpsMetrics() {
  return useQuery<any>({
    queryKey: ['sr-ops-metrics'],
    queryFn: () => api('/api/smartroute/ops-metrics'),
    refetchInterval: 60_000,
  });
}

export function useRouteJourneyEvents(routeId?: string) {
  return useQuery<any[]>({
    queryKey: ['sr-route-journey-events', routeId],
    queryFn: () => api(`/api/smartroute/routes/${routeId}/journey-events`),
    enabled: !!routeId,
  });
}

export function useSRMonitor() {
  return useQuery<any>({
    queryKey: ['sr-monitor'],
    queryFn: () => api('/api/smartroute/monitor'),
    refetchInterval: 15_000,
  });
}

export function useSRStopSummary(stopId?: string) {
  return useQuery<any>({
    queryKey: ['sr-stop-summary', stopId],
    queryFn: () => api(`/api/smartroute/stops/${stopId}/summary`),
    enabled: !!stopId,
  });
}

