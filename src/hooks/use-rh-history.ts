import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface EmploymentPeriod {
  id: string;
  sequence: number;
  start_date: string | null;
  end_date: string | null;
  employment_type: string | null;
  position: string | null;
  role_level: string | null;
  salary: string | number | null;
  department_name?: string | null;
  company_name?: string | null;
  termination_reason?: string | null;
  status: string;
}

export interface HistoryEvent {
  id: string;
  event_type: string;
  title: string | null;
  description: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  effective_date: string;
  source: 'auto' | 'manual';
  created_at: string;
  created_by_name?: string | null;
  period_id?: string | null;
}

export interface EmployeeHistory {
  employee: {
    id: string; full_name: string; status: string;
    position?: string | null; employment_type?: string | null;
    admission_date?: string | null; termination_date?: string | null;
  };
  periods: EmploymentPeriod[];
  events: HistoryEvent[];
}

export function useEmployeeHistory(employeeId?: string) {
  return useQuery({
    queryKey: ['rh-employee-history', employeeId],
    queryFn: () => api<EmployeeHistory>(`/api/rh/employees/${employeeId}/history`),
    enabled: !!employeeId,
  });
}

export function useAddHistoryEvent(employeeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>(`/api/rh/employees/${employeeId}/history`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employee-history', employeeId] }),
  });
}

export function useDeleteHistoryEvent(employeeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api<any>(`/api/rh/employees/${employeeId}/history/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employee-history', employeeId] }),
  });
}

export function useReadmitEmployee(employeeId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>(`/api/rh/employees/${employeeId}/readmit`, { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-employee-history', employeeId] });
      qc.invalidateQueries({ queryKey: ['rh-employees'] });
    },
  });
}
