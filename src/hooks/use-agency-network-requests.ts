import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AvailableNetwork { id: string; name: string; units_count: number }
export interface AvailableUnit { id: string; name: string; city?: string; state?: string; active: boolean }
export interface BrandLite { id: string; name: string }

export interface RequestItem {
  id?: string;
  supermarket_unit_id: string;
  brand_id: string;
  conflict_with_agency_id?: string | null;
  status?: string;
  decision?: string;
  unit_name?: string;
  brand_name?: string;
  conflict_agency_name?: string;
}

export interface AccessRequest {
  id: string;
  agency_id: string;
  network_id: string;
  network_name?: string;
  agency_name?: string;
  agency_cnpj?: string;
  status: 'pending' | 'approved' | 'rejected';
  has_conflict: boolean;
  items_count: number;
  conflict_items: number;
  review_notes?: string;
  message?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface ConflictNotif {
  id: string;
  unit_name?: string;
  brand_name?: string;
  other_agency_name?: string;
  kind: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

// ============ AGENCY ============
export function useAvailableNetworks() {
  return useQuery<AvailableNetwork[]>({
    queryKey: ['agency-available-networks'],
    queryFn: () => api('/api/access-control/agency/network-requests/available-networks'),
  });
}
export function useNetworkUnitsForAgency(networkId?: string) {
  return useQuery<AvailableUnit[]>({
    queryKey: ['agency-network-units', networkId],
    queryFn: () => api(`/api/access-control/agency/network-requests/networks/${networkId}/units`),
    enabled: !!networkId,
  });
}
export function useAvailableBrands() {
  return useQuery<BrandLite[]>({
    queryKey: ['agency-available-brands'],
    queryFn: () => api('/api/access-control/agency/network-requests/brands'),
  });
}
export function useCheckConflict() {
  return useMutation({
    mutationFn: (items: { supermarket_unit_id: string; brand_id: string }[]) =>
      api<{ conflicts: any[] }>('/api/access-control/agency/network-requests/check-conflict', {
        method: 'POST', body: { items },
      }),
  });
}
export function useCreateAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { network_id: string; message?: string; items: any[] }) =>
      api('/api/access-control/agency/network-requests', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency-access-requests'] }),
  });
}
export function useAgencyAccessRequests() {
  return useQuery<AccessRequest[]>({
    queryKey: ['agency-access-requests'],
    queryFn: () => api('/api/access-control/agency/network-requests'),
  });
}
export function useAgencyAccessRequestDetail(id?: string) {
  return useQuery<{ request: AccessRequest; items: RequestItem[] }>({
    queryKey: ['agency-access-request', id],
    queryFn: () => api(`/api/access-control/agency/network-requests/${id}`),
    enabled: !!id,
  });
}
export function useAgencyConflictNotifications() {
  return useQuery<ConflictNotif[]>({
    queryKey: ['agency-conflict-notifications'],
    queryFn: () => api('/api/access-control/agency/network-requests/notifications/conflicts'),
    refetchInterval: 60_000,
  });
}
export function useAckConflictNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/access-control/agency/network-requests/notifications/${id}/ack`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency-conflict-notifications'] }),
  });
}

// ============ NETWORK ============
export function useNetworkAccessRequests() {
  return useQuery<AccessRequest[]>({
    queryKey: ['network-access-requests'],
    queryFn: () => api('/api/network-portal/access-requests'),
  });
}
export function useNetworkAccessRequestDetail(id?: string) {
  return useQuery<{ request: AccessRequest; items: RequestItem[] }>({
    queryKey: ['network-access-request', id],
    queryFn: () => api(`/api/network-portal/access-requests/${id}`),
    enabled: !!id,
  });
}
export function useReviewAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; decision: 'approved' | 'rejected'; review_notes?: string; item_decisions?: Record<string, string> }) =>
      api(`/api/network-portal/access-requests/${id}/review`, { method: 'POST', body }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['network-access-requests'] });
      qc.invalidateQueries({ queryKey: ['network-access-request', v.id] });
    },
  });
}
export function useBrandMatrix() {
  return useQuery<any[]>({
    queryKey: ['network-brand-matrix'],
    queryFn: () => api('/api/network-portal/brand-matrix'),
  });
}
