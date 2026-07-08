import { useQuery } from '@tanstack/react-query';
import { api, API_URL, getAuthToken } from '@/lib/api';

export interface PayrollExportFormat {
  key: string; label: string; ext: string; description: string;
}
export interface PayrollExportPreview {
  month: string; format: string; employees_count: number;
  events_count: number; total_lines: number; filename: string; sample: string;
}

export function usePayrollFormats() {
  return useQuery({
    queryKey: ['payroll-formats'],
    queryFn: () => api<PayrollExportFormat[]>('/api/rh/payroll-export/formats'),
  });
}

export function usePayrollPreview(params: { month?: string; format?: string; company_id?: string; columns?: string }) {
  const p = new URLSearchParams();
  if (params.month) p.set('month', params.month);
  if (params.format) p.set('format', params.format);
  if (params.company_id) p.set('company_id', params.company_id);
  if (params.columns) p.set('columns', params.columns);
  const qs = p.toString();
  return useQuery({
    queryKey: ['payroll-preview', qs],
    queryFn: () => api<PayrollExportPreview>(`/api/rh/payroll-export/preview?${qs}`),
    enabled: !!(params.month && params.format),
  });
}

export async function downloadPayrollFile(params: { month: string; format: string; company_id?: string; columns?: string }) {
  const p = new URLSearchParams();
  p.set('month', params.month);
  p.set('format', params.format);
  if (params.company_id) p.set('company_id', params.company_id);
  if (params.columns) p.set('columns', params.columns);
  const token = getAuthToken();
  const url = `${API_URL.replace(/\/$/, '')}/api/rh/payroll-export/download?${p.toString()}`;
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(await r.text());
  const cd = r.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `folha-${params.format}.csv`;
  const blob = await r.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(objUrl); a.remove(); }, 500);
}
