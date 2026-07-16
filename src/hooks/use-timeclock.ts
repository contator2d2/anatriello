import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type CartaoPontoResponse = { employee: any; days: any[]; totals: any };

const parseLocalDate = (value: string) => new Date(`${value}T12:00:00`);

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const listDates = (start: string, end: string) => {
  const dates: string[] = [];
  const current = parseLocalDate(start);
  const last = parseLocalDate(end);
  while (current <= last) {
    dates.push(formatLocalDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const buildCartaoFromDailyGrid = (
  params: { employee_id?: string; start?: string; end?: string },
  grid: {
    days?: string[];
    employees?: Array<{
      employee_id: string;
      full_name: string;
      company_id?: string;
      company_name?: string;
      days?: Record<string, { times?: string[]; minutes?: number; punch_count?: number }>;
      total_minutes?: number;
    }>;
  }
): CartaoPontoResponse => {
  const employee = grid.employees?.find((item) => item.employee_id === params.employee_id) || grid.employees?.[0];
  const dates = grid.days?.length ? grid.days : listDates(params.start || '', params.end || '');
  const days = dates.map((date) => {
    const dayData = employee?.days?.[date] || { times: [], minutes: 0, punch_count: 0 };
    const times = (dayData.times || []).map((time) => String(time).slice(0, 5));
    const dow = parseLocalDate(date).getDay();
    return {
      date,
      dow,
      entry1: times[0] || null,
      exit1: times[1] || null,
      entry2: times[2] || null,
      exit2: times[3] || null,
      entry3: times[4] || null,
      exit3: times[5] || null,
      total_worked_min: dayData.minutes || 0,
      expected_min: 0,
      credit_min: 0,
      debit_min: 0,
      balance_min: dayData.minutes || 0,
      punch_count: dayData.punch_count || times.length,
      status: times.length ? 'normal' : (dow === 0 || dow === 6 ? 'folga' : 'sem registro'),
      is_holiday: false,
      fallback: true,
    };
  });
  const worked = days.reduce((sum, day) => sum + (day.total_worked_min || 0), 0);
  return {
    employee: {
      id: employee?.employee_id || params.employee_id,
      full_name: employee?.full_name || 'Colaborador',
      company_id: employee?.company_id,
      company_name: employee?.company_name,
    },
    days,
    totals: {
      worked_min: worked,
      expected_min: 0,
      credit_min: 0,
      debit_min: 0,
      balance_min: worked,
      fallback: true,
    },
  };
};

// ---------- CARTÃO PONTO ----------
export function useCartaoPonto(params: { employee_id?: string; start?: string; end?: string; org_id?: string }) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'cartao-ponto', qs],
    queryFn: async () => {
      try {
        return await api<CartaoPontoResponse>(`/api/timeclock/cartao-ponto?${qs}`, { silent: true });
      } catch (error: any) {
        if (error?.status !== 404) throw error;
        const fallbackQs = new URLSearchParams(
          Object.entries({ start: params.start, end: params.end, employee_id: params.employee_id }).filter(([, v]) => v) as [string, string][]
        ).toString();
        const grid = await api<{
          days: string[];
          employees: Array<{
            employee_id: string; full_name: string; photo_url?: string;
            company_id?: string; company_name?: string;
            days: Record<string, { times: string[]; minutes: number; punch_count: number }>;
            total_minutes: number;
          }>;
        }>(`/api/timeclock/punches/daily-grid?${fallbackQs}`);
        return buildCartaoFromDailyGrid(params, grid);
      }
    },
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

// ---------- REGISTROS DE PONTO (grade diária) ----------
export function usePunchesDailyGrid(params: { start?: string; end?: string; company_id?: string; employee_id?: string }) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'daily-grid', qs],
    queryFn: () => api<{
      days: string[];
      employees: Array<{
        employee_id: string; full_name: string; photo_url?: string;
        company_id?: string; company_name?: string;
        days: Record<string, { times: string[]; minutes: number; punch_count: number }>;
        total_minutes: number;
      }>;
    }>(`/api/timeclock/punches/daily-grid?${qs}`),
    enabled: !!(params.start && params.end),
  });
}

async function safeSummary(url: string): Promise<any[]> {
  try {
    return await api<any[]>(url);
  } catch (e: any) {
    // Backend antigo pode retornar 500/404 quando o schema de banco de horas ainda não foi criado.
    if (e?.status === 500 || e?.status === 404) return [];
    throw e;
  }
}

export function useTimeBankSummaryByCompany(company_id?: string) {
  const qs = company_id ? `?company_id=${company_id}` : '';
  return useQuery({
    queryKey: ['timeclock', 'tb-summary-comp', company_id || 'all'],
    queryFn: () => safeSummary(`/api/timeclock/time-bank/summary${qs}`),
  });
}

export function useTimeBankSummary(employee_id?: string) {
  const qs = employee_id ? `?employee_id=${employee_id}` : '';
  return useQuery({
    queryKey: ['timeclock', 'tb-summary', employee_id || 'all'],
    queryFn: () => safeSummary(`/api/timeclock/time-bank/summary${qs}`),
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

// ---------- ESPELHO DIGITAL (Fase 8) ----------
export function useMirrorAcceptances(params: { month?: string; status?: string; company_id?: string } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['timeclock', 'mirror', qs],
    queryFn: () => api<any[]>(`/api/timeclock/mirror-acceptance${qs ? `?${qs}` : ''}`),
  });
}
export function useMirrorAcceptance(id?: string) {
  return useQuery({
    queryKey: ['timeclock', 'mirror', id],
    queryFn: () => api<any>(`/api/timeclock/mirror-acceptance/${id}`),
    enabled: !!id,
  });
}
export function useGenerateMirrors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reference_month: string; company_id?: string; employee_ids?: string[] }) =>
      api<{ ok: boolean; created: number; skipped: number; total: number }>(
        '/api/timeclock/mirror-acceptance/generate', { method: 'POST', body: data }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'mirror'] }),
  });
}
export function useDeleteMirror() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/timeclock/mirror-acceptance/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeclock', 'mirror'] }),
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

