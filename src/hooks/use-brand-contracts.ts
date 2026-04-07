import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ===== BRAND CONTRACTS =====
export function useBrandContracts(brandId?: string) {
  return useQuery({
    queryKey: ['merch-contracts', brandId],
    queryFn: () => api<any[]>(`/api/merchandising/contracts/brand/${brandId}`),
    enabled: !!brandId,
  });
}

export function useContract(contractId?: string) {
  return useQuery({
    queryKey: ['merch-contract', contractId],
    queryFn: () => api<any>(`/api/merchandising/contracts/${contractId}`),
    enabled: !!contractId,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/contracts', { method: 'POST', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-contracts'] }),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api<any>(`/api/merchandising/contracts/${id}`, { method: 'PUT', body: data }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['merch-contracts'] });
      qc.invalidateQueries({ queryKey: ['merch-contract', vars.id] });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api/merchandising/contracts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-contracts'] }),
  });
}

export function useContractCompliance(contractId?: string) {
  return useQuery({
    queryKey: ['merch-contract-compliance', contractId],
    queryFn: () => api<any[]>(`/api/merchandising/contracts/${contractId}/compliance`),
    enabled: !!contractId,
  });
}

export function useCheckCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, ...data }: { contractId: string; period_start: string; period_end: string }) =>
      api<any>(`/api/merchandising/contracts/${contractId}/check-compliance`, { method: 'POST', body: data }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['merch-contract-compliance', vars.contractId] });
      qc.invalidateQueries({ queryKey: ['merch-contracts'] });
    },
  });
}

// ===== LETTERHEAD =====
export function useOrgLetterhead() {
  return useQuery({
    queryKey: ['merch-letterhead'],
    queryFn: () => api<any>('/api/merchandising/letterhead'),
  });
}

export function useUpdateLetterhead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/letterhead', { method: 'PUT', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merch-letterhead'] }),
  });
}

// ===== CONVERT DEAL TO CONTRACT =====
export function useConvertDealToContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api<any>('/api/merchandising/contracts/from-deal', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merch-contracts'] });
      qc.invalidateQueries({ queryKey: ['merch-brands'] });
    },
  });
}
