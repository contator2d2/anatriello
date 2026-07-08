import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RhAnalyticsFilters {
  start?: string;
  end?: string;
  company_id?: string;
  department_id?: string;
}

export function useRhAnalytics(filters: RhAnalyticsFilters = {}) {
  const p = new URLSearchParams();
  if (filters.start) p.set('start', filters.start);
  if (filters.end) p.set('end', filters.end);
  if (filters.company_id) p.set('company_id', filters.company_id);
  if (filters.department_id) p.set('department_id', filters.department_id);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-analytics', qs],
    queryFn: () => api<any>(`/api/rh/analytics${qs ? `?${qs}` : ''}`),
  });
}
