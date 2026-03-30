import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
    queryFn: () => api<any[]>(`/api/rh/employees${qs ? `?${qs}` : ''}`),
  });
}

export function useEmployee(id?: string) {
  return useQuery({
    queryKey: ['rh-employee', id],
    queryFn: () => api<any>(`/api/rh/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/employees', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/employees/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-employees'] });
      qc.invalidateQueries({ queryKey: ['rh-employee'] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/employees/${id}`, { method: 'DELETE' }),
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
    queryFn: () => api<any[]>(`/api/rh/time-records${qs ? `?${qs}` : ''}`),
  });
}

export function useSaveTimeRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/time-records', { method: 'POST', body: data }),
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
    queryFn: () => api<any[]>(`/api/rh/payslips${qs ? `?${qs}` : ''}`),
  });
}

export function useCreatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/payslips', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-payslips'] }),
  });
}

export function useUpdatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/payslips/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-payslips'] }),
  });
}

// ===== ABSENCES =====
export function useAbsences(employeeId?: string) {
  const params = employeeId ? `?employee_id=${employeeId}` : '';
  return useQuery({
    queryKey: ['rh-absences', employeeId],
    queryFn: () => api<any[]>(`/api/rh/absences${params}`),
  });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/absences', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-absences'] }),
  });
}

// ===== SUPPORT TABLES =====
export function useBranches() {
  return useQuery({ queryKey: ['rh-branches'], queryFn: () => api<any[]>('/api/rh/branches') });
}
export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/branches', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-branches'] }),
  });
}

export function useRhDepartments() {
  return useQuery({ queryKey: ['rh-departments'], queryFn: () => api<any[]>('/api/rh/rh-departments') });
}
export function useCreateRhDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/rh-departments', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-departments'] }),
  });
}
export function useDeleteRhDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/rh-departments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-departments'] }),
  });
}

// ===== POSITIONS (CARGOS) =====
export function useRhPositions() {
  return useQuery({ queryKey: ['rh-positions'], queryFn: () => api<any[]>('/api/rh/positions') });
}
export function useCreateRhPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/positions', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-positions'] }),
  });
}
export function useDeleteRhPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/positions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-positions'] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/branches/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-branches'] }),
  });
}

// ===== WORKER PROFILES (PERFIS FUNCIONAIS) =====
export function useWorkerProfiles() {
  return useQuery({ queryKey: ['rh-worker-profiles'], queryFn: () => api<any[]>('/api/rh/worker-profiles') });
}
export function useCreateWorkerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/worker-profiles', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-worker-profiles'] }),
  });
}
export function useDeleteWorkerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/worker-profiles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-worker-profiles'] }),
  });
}

export function useCostCenters() {
  return useQuery({ queryKey: ['rh-cost-centers'], queryFn: () => api<any[]>('/api/rh/cost-centers') });
}
export function useCreateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/cost-centers', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-cost-centers'] }),
  });
}

// ===== AUDIT =====

// ===== DASHBOARD =====
export function useRhDashboard() {
  return useQuery({
    queryKey: ['rh-dashboard'],
    queryFn: () => api<any>('/api/rh/dashboard-stats'),
    refetchInterval: 60000,
  });
}

// ===== VACATIONS =====
export function useVacations(filters?: { employee_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-vacations', qs],
    queryFn: () => api<any[]>(`/api/rh/vacations${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/vacations', { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rh-vacations'] }); qc.invalidateQueries({ queryKey: ['rh-dashboard'] }); },
  });
}

export function useUpdateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/vacations/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rh-vacations'] }); qc.invalidateQueries({ queryKey: ['rh-dashboard'] }); },
  });
}

// ===== MEDICAL CERTIFICATES =====
export function useMedicalCertificates(filters?: { employee_id?: string; validated?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.validated !== undefined) params.set('validated', filters.validated);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-medical-certs', qs],
    queryFn: () => api<any[]>(`/api/rh/medical-certificates${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateMedicalCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/medical-certificates', { method: 'POST', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rh-medical-certs'] }); qc.invalidateQueries({ queryKey: ['rh-dashboard'] }); qc.invalidateQueries({ queryKey: ['rh-time-records'] }); },
  });
}

export function useValidateMedicalCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/medical-certificates/${id}/validate`, { method: 'PUT', body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rh-medical-certs'] }); qc.invalidateQueries({ queryKey: ['rh-dashboard'] }); },
  });
}

// ===== DOCUMENTS =====
export function useRhDocuments(filters?: { employee_id?: string; doc_type?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.doc_type) params.set('doc_type', filters.doc_type);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-documents', qs],
    queryFn: () => api<any[]>(`/api/rh/documents${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateRhDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/documents', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-documents'] }),
  });
}

export function useValidateRhDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/documents/${id}/validate`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-documents'] }),
  });
}

export function useRhAuditLog(entityType?: string, entityId?: string) {
  const params = new URLSearchParams();
  if (entityType) params.set('entity_type', entityType);
  if (entityId) params.set('entity_id', entityId);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-audit', qs],
    queryFn: () => api<any[]>(`/api/rh/audit-log${qs ? `?${qs}` : ''}`),
  });
}
