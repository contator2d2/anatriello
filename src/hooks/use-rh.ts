import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ===== EMPLOYEES =====
export function useEmployees(filters?: { status?: string; search?: string; department_id?: string; branch_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.department_id) params.set('department_id', filters.department_id);
  if (filters?.branch_id) params.set('branch_id', filters.branch_id);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-employees', qs],
    queryFn: () => apiGet(`/api/rh/employees${qs ? `?${qs}` : ''}`),
  });
}

export function useEmployee(id?: string) {
  return useQuery({
    queryKey: ['rh-employee', id],
    queryFn: () => apiGet(`/api/rh/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/employees', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiPut(`/api/rh/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-employees'] });
      qc.invalidateQueries({ queryKey: ['rh-employee'] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/rh/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employees'] }),
  });
}

// ===== TIME RECORDS =====
export function useTimeRecords(filters?: { employee_id?: string; start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.start_date) params.set('start_date', filters.start_date);
  if (filters?.end_date) params.set('end_date', filters.end_date);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-time-records', qs],
    queryFn: () => apiGet(`/api/rh/time-records${qs ? `?${qs}` : ''}`),
  });
}

export function useSaveTimeRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/time-records', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-time-records'] }),
  });
}

// ===== PAYSLIPS =====
export function usePayslips(filters?: { employee_id?: string; reference_month?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.reference_month) params.set('reference_month', filters.reference_month);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-payslips', qs],
    queryFn: () => apiGet(`/api/rh/payslips${qs ? `?${qs}` : ''}`),
  });
}

export function useCreatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/payslips', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-payslips'] }),
  });
}

export function useUpdatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiPut(`/api/rh/payslips/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-payslips'] }),
  });
}

// ===== ABSENCES =====
export function useAbsences(employeeId?: string) {
  const params = employeeId ? `?employee_id=${employeeId}` : '';
  return useQuery({
    queryKey: ['rh-absences', employeeId],
    queryFn: () => apiGet(`/api/rh/absences${params}`),
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/absences', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-absences'] }),
  });
}

// ===== SUPPORT TABLES =====
export function useBranches() {
  return useQuery({ queryKey: ['rh-branches'], queryFn: () => apiGet('/api/rh/branches') });
}
export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/branches', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-branches'] }),
  });
}

export function useRhDepartments() {
  return useQuery({ queryKey: ['rh-departments'], queryFn: () => apiGet('/api/rh/rh-departments') });
}
export function useCreateRhDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/rh-departments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-departments'] }),
  });
}

export function useCostCenters() {
  return useQuery({ queryKey: ['rh-cost-centers'], queryFn: () => apiGet('/api/rh/cost-centers') });
}
export function useCreateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/api/rh/cost-centers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-cost-centers'] }),
  });
}

// ===== AUDIT =====
export function useRhAuditLog(entityType?: string, entityId?: string) {
  const params = new URLSearchParams();
  if (entityType) params.set('entity_type', entityType);
  if (entityId) params.set('entity_id', entityId);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-audit', qs],
    queryFn: () => apiGet(`/api/rh/audit-log${qs ? `?${qs}` : ''}`),
  });
}
