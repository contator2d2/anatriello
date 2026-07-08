import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ===== EMPLOYEES =====
export function useEmployees(filters?: { status?: string; search?: string; department_id?: string; branch_id?: string; company_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.department_id) params.set('department_id', filters.department_id);
  if (filters?.branch_id) params.set('branch_id', filters.branch_id);
  if (filters?.company_id) params.set('company_id', filters.company_id);
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

export function useEmployeeNotifications(id?: string) {
  return useQuery({
    queryKey: ['rh-employee-notifications', id],
    queryFn: () => api<any[]>(`/api/rh/employees/${id}/notifications`),
    enabled: !!id,
  });
}

export function useFacialAlerts() {
  return useQuery({
    queryKey: ['rh-facial-alerts'],
    queryFn: () => api<any[]>('/api/rh/facial-recognition/disabled-alerts'),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { id: string; hard?: boolean }) => {
      const id = typeof input === 'string' ? input : input.id;
      const hard = typeof input === 'string' ? false : !!input.hard;
      const url = `/api/rh/employees/${id}${hard ? '?hard=true' : ''}`;
      return api<any>(url, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employees'] }),
  });
}

export function useGrantManagerAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employee_id, ...data }: any) => api<any>(`/api/rh/employees/${employee_id}/manager-access`, { method: 'POST', body: data }),
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

export function useImportPayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/payslips/import', { method: 'POST', body: data }),
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

// ===== APP PUNCHES (from promotor app) =====
export function useAppPunches(filters?: { employee_id?: string; start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.start_date) params.set('start_date', filters.start_date);
  if (filters?.end_date) params.set('end_date', filters.end_date);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-app-punches', qs],
    queryFn: () => api<any[]>(`/api/rh/app-punches${qs ? `?${qs}` : ''}`),
  });
}

// ===== SYNC DIAGNOSTICS =====
export function useSyncDiagnostics() {
  return useQuery({
    queryKey: ['rh-sync-diagnostics'],
    queryFn: () => api<any>('/api/rh/sync-diagnostics'),
    refetchInterval: 15000,
  });
}

// ===== CONSOLIDATED TIMESHEET =====
export function useConsolidatedTimesheet(filters?: { employee_id?: string; start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.start_date) params.set('start_date', filters.start_date);
  if (filters?.end_date) params.set('end_date', filters.end_date);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-consolidated-timesheet', qs],
    queryFn: () => api<any[]>(`/api/rh/consolidated-timesheet${qs ? `?${qs}` : ''}`),
  });
}

// ===== PUNCH DIVERGENCES =====
export function usePunchDivergences(filters?: { start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters?.start_date) params.set('start_date', filters.start_date);
  if (filters?.end_date) params.set('end_date', filters.end_date);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-punch-divergences', qs],
    queryFn: () => api<any[]>(`/api/rh/punch-divergences${qs ? `?${qs}` : ''}`),
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

export function useDeleteRhDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/documents/${id}`, { method: 'DELETE' }),
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

// ===== HOLIDAYS =====
export function useHolidays(filters?: { year?: string; type?: string }) {
  const params = new URLSearchParams();
  if (filters?.year) params.set('year', filters.year);
  if (filters?.type) params.set('type', filters.type);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-holidays', qs],
    queryFn: () => api<any[]>(`/api/rh/holidays${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/holidays', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-holidays'] }),
  });
}

export function useBulkImportHolidays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (holidays: any[]) => api<any>('/api/rh/holidays/bulk', { method: 'POST', body: { holidays } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-holidays'] }),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      api<any>(`/api/rh/holidays/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-holidays'] }),
  });
}


// ===== SERVICE REGIONS =====
export function useServiceRegions() {
  return useQuery({
    queryKey: ['rh-regions'],
    queryFn: () => api<any[]>('/api/rh/regions'),
  });
}

export function useCreateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/regions', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-regions'] }),
  });
}

export function useUpdateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/regions/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-regions'] }),
  });
}

export function useDeleteRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/regions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-regions'] }),
  });
}

export function useLinkPDVsToRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ regionId, pdv_ids }: { regionId: string; pdv_ids: string[] }) =>
      api<any>(`/api/rh/regions/${regionId}/pdvs`, { method: 'POST', body: { pdv_ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-regions'] }),
  });
}

export function useRegionPDVs(regionId?: string) {
  return useQuery({
    queryKey: ['rh-region-pdvs', regionId],
    queryFn: () => api<any[]>(`/api/rh/regions/${regionId}/pdvs`),
    enabled: !!regionId,
  });
}

// ===== GEOCODING =====
export function useGeocode() {
  return useMutation({
    mutationFn: (data: { address?: string; address_number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; zip_code?: string }) =>
      api<any>('/api/rh/geocode', { method: 'POST', body: data }),
  });
}

// ===== MAP DATA =====
export function useRhMapData() {
  return useQuery({
    queryKey: ['rh-map-data'],
    queryFn: () => api<any>('/api/rh/map-data'),
  });
}

// ===== FASE 9 - FÉRIAS COLETIVAS =====
export function useCollectiveVacations() {
  return useQuery({
    queryKey: ['rh-collective-vacations'],
    queryFn: () => api<any[]>('/api/rh/vacations/collective'),
  });
}

export function useCollectiveVacation(id?: string) {
  return useQuery({
    queryKey: ['rh-collective-vacation', id],
    queryFn: () => api<any>(`/api/rh/vacations/collective/${id}`),
    enabled: !!id,
  });
}

export function usePreviewCollectiveVacation() {
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/vacations/collective/preview', { method: 'POST', body: data }),
  });
}

export function useCreateCollectiveVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/vacations/collective', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-collective-vacations'] });
      qc.invalidateQueries({ queryKey: ['rh-vacations'] });
      qc.invalidateQueries({ queryKey: ['rh-dashboard'] });
    },
  });
}

export function useUpdateCollectiveVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/vacations/collective/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-collective-vacations'] });
      qc.invalidateQueries({ queryKey: ['rh-collective-vacation', v.id] });
    },
  });
}

export function useCancelCollectiveVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/vacations/collective/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-collective-vacations'] });
      qc.invalidateQueries({ queryKey: ['rh-vacations'] });
    },
  });
}

// ===== FASE 10 - DESLIGAMENTO / RESCISÃO =====
export function useTerminations(filters?: { status?: string; employee_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-terminations', qs],
    queryFn: () => api<any[]>(`/api/rh/terminations${qs ? `?${qs}` : ''}`),
  });
}

export function useTermination(id?: string) {
  return useQuery({
    queryKey: ['rh-termination', id],
    queryFn: () => api<any>(`/api/rh/terminations/${id}`),
    enabled: !!id,
  });
}

export function usePreviewTermination() {
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/terminations/preview', { method: 'POST', body: data }),
  });
}

export function useCreateTermination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/terminations', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-terminations'] });
      qc.invalidateQueries({ queryKey: ['rh-dashboard'] });
    },
  });
}

export function useUpdateTermination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/terminations/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-terminations'] });
      qc.invalidateQueries({ queryKey: ['rh-termination', v.id] });
    },
  });
}

export function useHomologateTermination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api<any>(`/api/rh/terminations/${id}/homologate`, { method: 'POST', body: { force } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-terminations'] });
      qc.invalidateQueries({ queryKey: ['rh-employees'] });
    },
  });
}

export function useCancelTermination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<any>(`/api/rh/terminations/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-terminations'] }),
  });
}


// ===== FASE 11 - ADMISSÃO / ONBOARDING =====
export function useOnboardings(filters?: { status?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-onboardings', qs],
    queryFn: () => api<any[]>(`/api/rh/onboarding${qs ? `?${qs}` : ''}`),
  });
}

export function useOnboarding(id?: string) {
  return useQuery({
    queryKey: ['rh-onboarding', id],
    queryFn: () => api<any>(`/api/rh/onboarding/${id}`),
    enabled: !!id,
  });
}

export function useCreateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/onboarding', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-onboardings'] }),
  });
}

export function useUpdateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/onboarding/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-onboardings'] });
      qc.invalidateQueries({ queryKey: ['rh-onboarding', v.id] });
    },
  });
}

export function useFinishOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api<any>(`/api/rh/onboarding/${id}/finish`, { method: 'POST', body: { force } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-onboardings'] });
      qc.invalidateQueries({ queryKey: ['rh-employees'] });
    },
  });
}

export function useCancelOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<any>(`/api/rh/onboarding/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-onboardings'] }),
  });
}

// ===== FASE 12 - ADVERTÊNCIAS E MEDIDAS DISCIPLINARES =====
export function useWarnings(filters?: { employee_id?: string; status?: string; type?: string }) {
  const params = new URLSearchParams();
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-warnings', qs],
    queryFn: () => api<any[]>(`/api/rh/warnings${qs ? `?${qs}` : ''}`),
  });
}

export function useWarning(id?: string) {
  return useQuery({
    queryKey: ['rh-warning', id],
    queryFn: () => api<any>(`/api/rh/warnings/${id}`),
    enabled: !!id,
  });
}

export function useCreateWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/warnings', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-warnings'] }),
  });
}

export function useUpdateWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/warnings/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-warnings'] });
      qc.invalidateQueries({ queryKey: ['rh-warning', v.id] });
    },
  });
}

export function useAcknowledgeWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, signature, note }: { id: string; signature: string; note?: string }) =>
      api<any>(`/api/rh/warnings/${id}/acknowledge`, { method: 'POST', body: { signature, note } }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-warnings'] });
      qc.invalidateQueries({ queryKey: ['rh-warning', v.id] });
    },
  });
}

export function useRefuseWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<any>(`/api/rh/warnings/${id}/refuse`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-warnings'] }),
  });
}

export function useRevokeWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<any>(`/api/rh/warnings/${id}/revoke`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-warnings'] }),
  });
}

export function useDeleteWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/warnings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-warnings'] }),
  });
}

// ===== FASE 13 - eSOCIAL =====
export function useEsocialEvents(filters?: { event_type?: string; status?: string; employee_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.event_type) params.set('event_type', filters.event_type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.employee_id) params.set('employee_id', filters.employee_id);
  const qs = params.toString();
  return useQuery({
    queryKey: ['rh-esocial-events', qs],
    queryFn: () => api<any[]>(`/api/rh/esocial/events${qs ? `?${qs}` : ''}`),
  });
}

export function useEsocialEvent(id?: string) {
  return useQuery({
    queryKey: ['rh-esocial-event', id],
    queryFn: () => api<any>(`/api/rh/esocial/events/${id}`),
    enabled: !!id,
  });
}

export function useEsocialSummary() {
  return useQuery({
    queryKey: ['rh-esocial-summary'],
    queryFn: () => api<any>('/api/rh/esocial/summary'),
  });
}

export function useGenerateEsocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string; reference_id: string }) =>
      api<any>('/api/rh/esocial/generate', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-esocial-events'] });
      qc.invalidateQueries({ queryKey: ['rh-esocial-summary'] });
    },
  });
}

export function useGenerateEsocialBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string }) =>
      api<any>('/api/rh/esocial/generate-batch', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-esocial-events'] });
      qc.invalidateQueries({ queryKey: ['rh-esocial-summary'] });
    },
  });
}

export function useUpdateEsocialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      api<any>(`/api/rh/esocial/events/${id}/status`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-esocial-events'] });
      qc.invalidateQueries({ queryKey: ['rh-esocial-event', v.id] });
      qc.invalidateQueries({ queryKey: ['rh-esocial-summary'] });
    },
  });
}

export function useDeleteEsocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/esocial/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-esocial-events'] });
      qc.invalidateQueries({ queryKey: ['rh-esocial-summary'] });
    },
  });
}

// ===== FASE 14 - AVALIAÇÕES DE DESEMPENHO =====
export function usePerfCycles() {
  return useQuery({
    queryKey: ['rh-perf-cycles'],
    queryFn: () => api<any[]>('/api/rh/performance/cycles'),
  });
}
export function usePerfCycle(id?: string) {
  return useQuery({
    queryKey: ['rh-perf-cycle', id],
    queryFn: () => api<any>(`/api/rh/performance/cycles/${id}`),
    enabled: !!id,
  });
}
export function useCreatePerfCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/performance/cycles', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-cycles'] }),
  });
}
export function useUpdatePerfCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/performance/cycles/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-perf-cycles'] });
      qc.invalidateQueries({ queryKey: ['rh-perf-cycle', v.id] });
    },
  });
}
export function useOpenPerfCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_ids, peers_per_employee }: any) =>
      api<any>(`/api/rh/performance/cycles/${id}/open`, { method: 'POST', body: { employee_ids, peers_per_employee } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-perf-cycles'] });
      qc.invalidateQueries({ queryKey: ['rh-perf-reviews'] });
    },
  });
}
export function useClosePerfCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/performance/cycles/${id}/close`, { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-cycles'] }),
  });
}
export function useDeletePerfCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/performance/cycles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-cycles'] }),
  });
}
export function usePerfReviews(filters?: { cycle_id?: string; employee_id?: string; evaluator_id?: string; status?: string }) {
  const p = new URLSearchParams();
  if (filters?.cycle_id) p.set('cycle_id', filters.cycle_id);
  if (filters?.employee_id) p.set('employee_id', filters.employee_id);
  if (filters?.evaluator_id) p.set('evaluator_id', filters.evaluator_id);
  if (filters?.status) p.set('status', filters.status);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-perf-reviews', qs],
    queryFn: () => api<any[]>(`/api/rh/performance/reviews${qs ? `?${qs}` : ''}`),
  });
}
export function usePerfReview(id?: string) {
  return useQuery({
    queryKey: ['rh-perf-review', id],
    queryFn: () => api<any>(`/api/rh/performance/reviews/${id}`),
    enabled: !!id,
  });
}
export function useUpdatePerfReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/performance/reviews/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_d, v: any) => {
      qc.invalidateQueries({ queryKey: ['rh-perf-reviews'] });
      qc.invalidateQueries({ queryKey: ['rh-perf-review', v.id] });
    },
  });
}
export function useSubmitPerfReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/performance/reviews/${id}/submit`, { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-reviews'] }),
  });
}
export function usePerfGoals(filters?: { employee_id?: string; cycle_id?: string; status?: string }) {
  const p = new URLSearchParams();
  if (filters?.employee_id) p.set('employee_id', filters.employee_id);
  if (filters?.cycle_id) p.set('cycle_id', filters.cycle_id);
  if (filters?.status) p.set('status', filters.status);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-perf-goals', qs],
    queryFn: () => api<any[]>(`/api/rh/performance/goals${qs ? `?${qs}` : ''}`),
  });
}
export function useCreatePerfGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/performance/goals', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-goals'] }),
  });
}
export function useUpdatePerfGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/performance/goals/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-goals'] }),
  });
}
export function useDeletePerfGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/performance/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-goals'] }),
  });
}
export function usePerfFeedback(employeeId?: string) {
  const qs = employeeId ? `?employee_id=${employeeId}` : '';
  return useQuery({
    queryKey: ['rh-perf-feedback', employeeId || ''],
    queryFn: () => api<any[]>(`/api/rh/performance/feedback${qs}`),
  });
}
export function useCreatePerfFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/performance/feedback', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-feedback'] }),
  });
}
export function useDeletePerfFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/performance/feedback/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-feedback'] }),
  });
}
export function usePerfPDIs(filters?: { employee_id?: string; cycle_id?: string }) {
  const p = new URLSearchParams();
  if (filters?.employee_id) p.set('employee_id', filters.employee_id);
  if (filters?.cycle_id) p.set('cycle_id', filters.cycle_id);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-perf-pdis', qs],
    queryFn: () => api<any[]>(`/api/rh/performance/pdi${qs ? `?${qs}` : ''}`),
  });
}
export function useCreatePerfPDI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/performance/pdi', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-perf-pdis'] });
      qc.invalidateQueries({ queryKey: ['rh-perf-ninebox'] });
    },
  });
}
export function useUpdatePerfPDI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/performance/pdi/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-perf-pdis'] });
      qc.invalidateQueries({ queryKey: ['rh-perf-ninebox'] });
    },
  });
}
export function useDeletePerfPDI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/performance/pdi/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-perf-pdis'] }),
  });
}
export function usePerfNineBox() {
  return useQuery({
    queryKey: ['rh-perf-ninebox'],
    queryFn: () => api<any[]>('/api/rh/performance/nine-box'),
  });
}
export function usePerfConsolidated(cycleId?: string) {
  return useQuery({
    queryKey: ['rh-perf-consolidated', cycleId],
    queryFn: () => api<any[]>(`/api/rh/performance/cycles/${cycleId}/consolidated`),
    enabled: !!cycleId,
  });
}
