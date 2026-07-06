import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============ ITEM CATALOG ============
export function useItemCatalog(kind?: string) {
  const qs = kind ? `?kind=${kind}` : '';
  return useQuery({ queryKey: ['rh-item-catalog', kind || 'all'], queryFn: () => api<any[]>(`/api/rh/items/catalog${qs}`) });
}
export function useCreateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/items/catalog', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-item-catalog'] }),
  });
}
export function useUpdateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/items/catalog/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-item-catalog'] }),
  });
}
export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/items/catalog/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-item-catalog'] }),
  });
}

// ============ ASSIGNMENTS ============
export function useItemAssignments(filters?: { employee_id?: string; status?: string; kind?: string }) {
  const p = new URLSearchParams();
  if (filters?.employee_id) p.set('employee_id', filters.employee_id);
  if (filters?.status) p.set('status', filters.status);
  if (filters?.kind) p.set('kind', filters.kind);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-item-assignments', qs],
    queryFn: () => api<any[]>(`/api/rh/items/assignments${qs ? `?${qs}` : ''}`),
  });
}
export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/items/assignments', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-item-assignments'] }),
  });
}
export function useReturnAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/items/assignments/${id}/return`, { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-item-assignments'] }),
  });
}
export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/items/assignments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-item-assignments'] }),
  });
}
export function useItemsSummary() {
  return useQuery({ queryKey: ['rh-items-summary'], queryFn: () => api<any[]>('/api/rh/items/summary') });
}

// ============ PAYROLL CHECKLIST ============
export function usePayrollChecklists() {
  return useQuery({ queryKey: ['rh-payroll-checklists'], queryFn: () => api<any[]>('/api/rh/payroll-checklists') });
}
export function usePayrollChecklist(id?: string) {
  return useQuery({
    queryKey: ['rh-payroll-checklist', id],
    queryFn: () => api<any>(`/api/rh/payroll-checklists/${id}`),
    enabled: !!id,
  });
}
export function useCreatePayrollChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/rh/payroll-checklists', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-payroll-checklists'] }),
  });
}
export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId, itemId, ...data }: any) =>
      api<any>(`/api/rh/payroll-checklists/${checklistId}/items/${itemId}`, { method: 'PATCH', body: data }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['rh-payroll-checklist', v.checklistId] }),
  });
}
export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId, ...data }: any) =>
      api<any>(`/api/rh/payroll-checklists/${checklistId}/items`, { method: 'POST', body: data }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['rh-payroll-checklist', v.checklistId] }),
  });
}
export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ checklistId, itemId }: any) =>
      api<any>(`/api/rh/payroll-checklists/${checklistId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['rh-payroll-checklist', v.checklistId] }),
  });
}
export function useClosePayrollChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/payroll-checklists/${id}/close`, { method: 'POST' }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['rh-payroll-checklists'] });
      qc.invalidateQueries({ queryKey: ['rh-payroll-checklist', id] });
    },
  });
}
export function useReopenPayrollChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/payroll-checklists/${id}/reopen`, { method: 'POST' }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['rh-payroll-checklists'] });
      qc.invalidateQueries({ queryKey: ['rh-payroll-checklist', id] });
    },
  });
}

// ============ CHANGE ALERTS ============
export function useChangeAlerts(filters?: { acknowledged?: boolean; alert_type?: string; employee_id?: string }) {
  const p = new URLSearchParams();
  if (filters?.acknowledged !== undefined) p.set('acknowledged', String(filters.acknowledged));
  if (filters?.alert_type) p.set('alert_type', filters.alert_type);
  if (filters?.employee_id) p.set('employee_id', filters.employee_id);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-change-alerts', qs],
    queryFn: () => api<any[]>(`/api/rh/change-alerts${qs ? `?${qs}` : ''}`),
  });
}
export function useAckChangeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/rh/change-alerts/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-change-alerts'] }),
  });
}

// ============ EMPLOYEE REQUESTS (admin) ============
export function useEmployeeRequestsAdmin(filters?: { status?: string; kind?: string }) {
  const p = new URLSearchParams();
  if (filters?.status) p.set('status', filters.status);
  if (filters?.kind) p.set('kind', filters.kind);
  const qs = p.toString();
  return useQuery({
    queryKey: ['rh-employee-requests', qs],
    queryFn: () => api<any[]>(`/api/rh/requests${qs ? `?${qs}` : ''}`),
  });
}
export function useUpdateEmployeeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/rh/requests/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-employee-requests'] }),
  });
}
