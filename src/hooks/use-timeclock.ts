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
