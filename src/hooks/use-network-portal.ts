import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============ Public network portal ============

export interface NetworkDashboard {
  units: { total: number; active: number; inactive: number };
  entries: { today: number; week: number };
  partners_by_type: { partner_type: string; c: number }[];
  total_active_promoters: number;
  total_brands: number;
  active_blocks: number;
  pending_inauguration_requests: number;
}

export interface NetworkUnit {
  id: string; name: string; cnpj?: string; city?: string; state?: string;
  active: boolean; created_at: string;
  entries_today: number; active_blocks: number; partners_count: number;
}

export interface NetworkPartner {
  id: string; name: string; cnpj?: string;
  responsible_name?: string; responsible_phone?: string; responsible_email?: string;
  partner_type: string; category_label?: string; status?: string;
  active_promoters: number; units_count: number;
}

export interface NetworkBrand {
  id: string; name: string; promoters: number; units: number;
}

export interface NetworkInaugurationRequest {
  id: string; name: string; cnpj?: string; address?: string;
  city?: string; state?: string; zip_code?: string;
  contact_name?: string; contact_phone?: string; contact_email?: string;
  expected_opening?: string; notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes?: string;
  reviewed_at?: string;
  created_unit_id?: string | null;
  created_at: string;
  requested_by_name?: string;
}

export function useNetworkDashboard() {
  return useQuery<NetworkDashboard>({
    queryKey: ['network-dashboard'],
    queryFn: () => api('/api/network-portal/dashboard'),
    refetchInterval: 60_000,
  });
}

export function useNetworkUnits() {
  return useQuery<NetworkUnit[]>({
    queryKey: ['network-units'],
    queryFn: () => api('/api/network-portal/units'),
  });
}

export function useNetworkUnitOverview(unitId?: string) {
  return useQuery<any>({
    queryKey: ['network-unit-overview', unitId],
    queryFn: () => api(`/api/network-portal/units/${unitId}/overview`),
    enabled: !!unitId,
  });
}

export function useNetworkPartners(partnerType?: string) {
  return useQuery<NetworkPartner[]>({
    queryKey: ['network-partners', partnerType],
    queryFn: () => api(`/api/network-portal/partners${partnerType ? `?partner_type=${partnerType}` : ''}`),
  });
}

export function useNetworkBrands() {
  return useQuery<NetworkBrand[]>({
    queryKey: ['network-brands'],
    queryFn: () => api('/api/network-portal/brands'),
  });
}

export function useNetworkBlocks() {
  return useQuery<any[]>({
    queryKey: ['network-blocks-all'],
    queryFn: () => api('/api/network-portal/blocks'),
  });
}

export function useNetworkAudit() {
  return useQuery<any[]>({
    queryKey: ['network-audit'],
    queryFn: () => api('/api/network-portal/audit'),
  });
}

export function useNetworkInaugurationRequests() {
  return useQuery<NetworkInaugurationRequest[]>({
    queryKey: ['network-inauguration-requests'],
    queryFn: () => api('/api/network-portal/inauguration-requests'),
  });
}

export function useCreateInaugurationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<NetworkInaugurationRequest>) =>
      api('/api/network-portal/inauguration-requests', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-inauguration-requests'] }),
  });
}

// ============ Admin (Ayratech main app) ============

export function useAdminInaugurationRequests() {
  return useQuery<any[]>({
    queryKey: ['admin-inauguration-requests'],
    queryFn: () => api('/api/network-portal/admin/inauguration-requests'),
  });
}

export function useReviewInaugurationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, review_notes }: { id: string; decision: 'approved' | 'rejected'; review_notes?: string }) =>
      api(`/api/network-portal/admin/inauguration-requests/${id}/review`, { method: 'POST', body: { decision, review_notes } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-inauguration-requests'] }),
  });
}

export function useAdminNetworkUsers(networkId?: string) {
  return useQuery<any[]>({
    queryKey: ['admin-network-users', networkId],
    queryFn: () => api(`/api/network-portal/admin/network-users${networkId ? `?network_id=${networkId}` : ''}`),
  });
}

export function useCreateNetworkUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { network_id: string; email: string; password: string; name: string; role?: string }) =>
      api('/api/network-portal/admin/network-users', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-network-users'] }),
  });
}

export function useDeleteNetworkUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/network-portal/admin/network-users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-network-users'] }),
  });
}
