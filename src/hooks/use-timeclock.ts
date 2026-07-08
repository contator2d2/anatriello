import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------- CARTÃO PONTO ----------
export function useCartaoPonto(params: { employee_id?: string; start?: string; end?: string; org_id?: string }) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'cartao-ponto', qs],
    queryFn: () => api<{ employee: any; days: any[]; totals: any }>(`/api/timeclock/cartao-ponto?${qs}`),
    enabled: !!(params.employee_id && params.start && params.end),
  });
}

export function useEditCartaoPonto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employee_id: string; date: string; times: string[]; reason?: string }) =>
      api('/api/timeclock/cartao-ponto', { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}

export function useCartaoPontoAudit(employee_id?: string, date?: string) {
  return useQuery({
    queryKey: ['timeclock', 'audit', employee_id, date],
    queryFn: () => api<any[]>(`/api/timeclock/cartao-ponto/audit?employee_id=${employee_id}&date=${date}`),
    enabled: !!(employee_id && date),
  });
}

// ---------- BANCO DE HORAS ----------
export function useTimeBankSummary(employee_id?: string) {
  const qs = employee_id ? `?employee_id=${employee_id}` : '';
  return useQuery({
    queryKey: ['timeclock', 'tb-summary', employee_id || 'all'],
    queryFn: () => api<any[]>(`/api/timeclock/time-bank/summary${qs}`),
  });
}

export function useTimeBankEntries(employee_id?: string, start?: string, end?: string) {
  return useQuery({
    queryKey: ['timeclock', 'tb-entries', employee_id, start, end],
    queryFn: () => api<any[]>(`/api/timeclock/time-bank/entries?employee_id=${employee_id}&start=${start}&end=${end}`),
    enabled: !!(employee_id && start && end),
  });
}

export function useAddTimeBankManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employee_id: string; entry_date: string; minutes: number; description?: string }) =>
      api('/api/timeclock/time-bank/manual', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}

// ---------- FERIADOS ----------
export function useHolidays(params: { company_id?: string; year?: number } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'holidays', qs],
    queryFn: () => api<any[]>(`/api/timeclock/holidays${qs ? `?${qs}` : ''}`),
  });
}

// ---------- CONFIG BANCO DE HORAS (Fase 6) ----------
export function useTimeBankConfig(company_id?: string) {
  return useQuery({
    queryKey: ['timeclock', 'tb-config', company_id || 'org'],
    queryFn: () => api<any>(`/api/timeclock/time-bank/config${company_id ? `?company_id=${company_id}` : ''}`),
  });
}
export function useSaveTimeBankConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api('/api/timeclock/time-bank/config', { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'tb-config'] }),
  });
}

// ---------- EXPIRAÇÃO ----------
export function useExpiringEntries(params: { days?: number; company_id?: string; employee_id?: string } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'tb-expiring', qs],
    queryFn: () => api<any[]>(`/api/timeclock/time-bank/expiring${qs ? `?${qs}` : ''}`),
  });
}
export function useRunExpiration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean; processed: number }>('/api/timeclock/time-bank/expire-run', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}

// ---------- COMPENSAÇÕES ----------
export function useCompensations(params: { status?: string; employee_id?: string } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'compensations', qs],
    queryFn: () => api<any[]>(`/api/timeclock/time-bank/compensations${qs ? `?${qs}` : ''}`),
  });
}
export function useCreateCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employee_id: string; planned_date: string; minutes: number; description?: string }) =>
      api('/api/timeclock/time-bank/compensations', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}
export function useUpdateCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, review_note }: { id: string; status: 'approved' | 'rejected' | 'cancelled' | 'executed'; review_note?: string }) =>
      api(`/api/timeclock/time-bank/compensations/${id}`, { method: 'PATCH', body: { status, review_note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}
export function useDeleteCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/timeclock/time-bank/compensations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}


export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api('/api/timeclock/holidays', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/timeclock/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'holidays'] }),
  });
}

export function useImportNationalHolidays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { year: number; company_id?: string }) =>
      api('/api/timeclock/holidays/import-national', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'holidays'] }),
  });
}

// ---------- SOLICITAÇÕES DE AJUSTE ----------
export function useAdjustmentRequests(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['timeclock', 'adj-requests', status || 'all'],
    queryFn: () => api<any[]>(`/api/timeclock/adjustment-requests${qs}`),
  });
}

export function useReviewAdjustmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, review_note }: { id: string; status: 'approved' | 'rejected'; review_note?: string }) =>
      api(`/api/timeclock/adjustment-requests/${id}`, { method: 'PATCH', body: { status, review_note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}

// ---------- FECHAMENTOS ----------
export function useClosings() {
  return useQuery({
    queryKey: ['timeclock', 'closings'],
    queryFn: () => api<any[]>('/api/timeclock/closings'),
  });
}

export function useCreateClosing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api('/api/timeclock/closings', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}

export function useDeleteClosing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/timeclock/closings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock'] }),
  });
}

// ---------- ESCALAS AVANÇADAS (Fase 7) ----------
export function useScheduleTemplates() {
  return useQuery({
    queryKey: ['timeclock', 'ws-templates'],
    queryFn: () => api<any[]>('/api/timeclock/work-schedules/templates'),
    staleTime: 5 * 60_000,
  });
}
export function useScheduleForecast(id?: string, start?: string, days = 90) {
  return useQuery({
    queryKey: ['timeclock', 'ws-forecast', id, start, days],
    queryFn: () => api<{ schedule: any; days_list: any[]; totals: any }>(
      `/api/timeclock/work-schedules/${id}/forecast?start=${start}&days=${days}`
    ),
    enabled: !!(id && start),
  });
}
export function useSchedulePreview() {
  return useMutation({
    mutationFn: (data: { schedule: any; start: string; days: number }) =>
      api<{ days_list: any[]; totals: any }>('/api/timeclock/work-schedules/preview', { method: 'POST', body: data }),
  });
}


// ---------- JORNADAS DE TRABALHO (Fase 3) ----------
export function useWorkSchedules() {
  return useQuery({
    queryKey: ['timeclock', 'work-schedules'],
    queryFn: () => api<any[]>('/api/timeclock/work-schedules'),
  });
}

export function useCreateWorkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api('/api/timeclock/work-schedules', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'work-schedules'] }),
  });
}

export function useUpdateWorkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`/api/timeclock/work-schedules/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'work-schedules'] }),
  });
}

export function useDeleteWorkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/timeclock/work-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'work-schedules'] }),
  });
}

export function useAssignWorkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_ids }: { id: string; employee_ids: string[] }) =>
      api(`/api/timeclock/work-schedules/${id}/assign`, { method: 'POST', body: { employee_ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeclock'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// ---------- RELATÓRIOS ----------
export function useReportSummary(params: { start?: string; end?: string; company_id?: string; employee_id?: string }) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'report-summary', qs],
    queryFn: () => api<{ start: string; end: string; rows: any[] }>(`/api/timeclock/reports/summary?${qs}`),
    enabled: !!(params.start && params.end),
  });
}

export function useReportAbsencesLates(params: { start?: string; end?: string; company_id?: string; employee_id?: string }) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'report-abslates', qs],
    queryFn: () => api<{ start: string; end: string; items: any[] }>(`/api/timeclock/reports/absences-lates?${qs}`),
    enabled: !!(params.start && params.end),
  });
}

export function useTimeBankStatement(employee_id?: string, start?: string, end?: string) {
  return useQuery({
    queryKey: ['timeclock', 'tb-statement', employee_id, start, end],
    queryFn: () => api<{ opening_min: number; entries: any[] }>(
      `/api/timeclock/reports/time-bank-statement?employee_id=${employee_id}&start=${start}&end=${end}`
    ),
    enabled: !!(employee_id && start && end),
  });
}

export async function downloadTimeclockCsv(endpoint: string, filename: string) {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('promotor_token');
  const url = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${endpoint}`;
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error('Falha ao gerar CSV');
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(objUrl); a.remove(); }, 500);
}

