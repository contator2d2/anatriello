import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PromoterValidation {
  id: string;
  agency_promoter_id: string;
  promoter_name?: string;
  promoter_cpf?: string;
  rede_id?: string | null;
  supermarket_unit_id?: string | null;
  status: 'pending' | 'analyzing' | 'pre_approved' | 'approved' | 'divergent' | 'rejected' | 'failed';
  score: number;
  divergences: Array<{
    field: string;
    sources?: string[];
    values?: string[];
    severity?: 'critical' | 'warning' | 'info';
    message?: string;
  }>;
  extracted_data: any;
  recommendation?: string;
  documents_analyzed: any[];
  ai_provider?: string;
  ai_model?: string;
  ai_raw_response?: string;
  auto_applied?: boolean;
  override_status?: string;
  override_reason?: string;
  error_message?: string;
  created_at: string;
  validated_at?: string;
}

export interface RedeValidationConfig {
  id: string;
  name: string;
  doc_validation_enabled: boolean;
  required_documents: string[];
  facial_required: boolean;
  auto_approve_on_match: boolean;
  auto_approve_min_score: number;
}

export const DOCUMENT_LABELS: Record<string, string> = {
  cnh: 'CNH',
  contrato_trabalho: 'Contrato de Trabalho',
  comprovante_endereco: 'Comprovante de Endereço',
  ctps: 'CTPS / eSocial',
  selfie: 'Selfie (Biometria)',
};

export function usePromoterValidations(filters?: { agency_promoter_id?: string; status?: string }) {
  return useQuery<PromoterValidation[]>({
    queryKey: ['promoter-validations', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.agency_promoter_id) params.append('agency_promoter_id', filters.agency_promoter_id);
      if (filters?.status) params.append('status', filters.status);
      const qs = params.toString();
      return api(`/api/promoter-validations${qs ? '?' + qs : ''}`);
    },
  });
}

export function usePromoterValidation(id?: string) {
  return useQuery<PromoterValidation>({
    queryKey: ['promoter-validation', id],
    queryFn: () => api(`/api/promoter-validations/${id}`),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = (q.state.data as PromoterValidation | undefined)?.status;
      return s === 'analyzing' || s === 'pending' ? 3000 : false;
    },
  });
}

export function useRunValidation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { agency_promoter_id: string; rede_id?: string; supermarket_unit_id?: string }) =>
      api<{ id: string; status: string }>('/api/promoter-validations/run', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promoter-validations'] }),
  });
}

export function useReviewValidation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'approved' | 'rejected'; reason?: string }) =>
      api(`/api/promoter-validations/${id}/review`, { method: 'POST', body: { decision, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promoter-validations'] });
      qc.invalidateQueries({ queryKey: ['promoter-validation'] });
    },
  });
}

export function useRedeValidationConfig(redeId?: string) {
  return useQuery<RedeValidationConfig>({
    queryKey: ['rede-validation-config', redeId],
    queryFn: () => api(`/api/promoter-validations/rede/${redeId}/config`),
    enabled: !!redeId,
  });
}

export function useSaveRedeValidationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ redeId, ...body }: { redeId: string } & Partial<RedeValidationConfig>) =>
      api(`/api/promoter-validations/rede/${redeId}/config`, { method: 'PUT', body }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['rede-validation-config', vars.redeId] }),
  });
}
