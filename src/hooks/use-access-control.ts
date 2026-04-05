import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/access-control";

const getErrorMessage = (error: any, fallback: string) => error?.message || fallback;

// ─── Networks ───
export function useNetworks() {
  return useQuery({ queryKey: ["ac-networks"], queryFn: () => api<any[]>(`${BASE}/networks`) });
}
export function useCreateNetwork() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/networks`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-networks"] }); toast({ title: "Rede criada" }); },
  });
}
export function useUpdateNetwork() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`${BASE}/networks/${id}`, { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-networks"] }); toast({ title: "Rede atualizada" }); },
  });
}
export function useDeleteNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/networks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ac-networks"] }),
  });
}

// ─── Units ───
export function useUnits() {
  return useQuery({ queryKey: ["ac-units"], queryFn: () => api<any[]>(`${BASE}/units`) });
}
export function useCreateUnit() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/units`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-units"] }); toast({ title: "Unidade criada" }); },
  });
}
export function useUpdateUnit() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`${BASE}/units/${id}`, { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-units"] }); toast({ title: "Unidade atualizada" }); },
  });
}
export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/units/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ac-units"] }),
  });
}

// ─── Agencies ───
export function useAgencies() {
  return useQuery({ queryKey: ["ac-agencies"], queryFn: () => api<any[]>(`${BASE}/agencies`) });
}
export function useCreateAgency() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/agencies`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-agencies"] }); toast({ title: "Agência criada" }); },
  });
}
export function useUpdateAgency() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`${BASE}/agencies/${id}`, { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-agencies"] }); toast({ title: "Agência atualizada" }); },
  });
}

// ─── Promoters ───
export function usePromoters() {
  return useQuery({ queryKey: ["ac-promoters"], queryFn: () => api<any[]>(`${BASE}/promoters`) });
}
export function useCreatePromoter() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/promoters`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-promoters"] }); toast({ title: "Promotor cadastrado" }); },
  });
}
export function useUpdatePromoter() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`${BASE}/promoters/${id}`, { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-promoters"] }); toast({ title: "Promotor atualizado" }); },
  });
}

// ─── Access Rules ───
export function useAccessRules(promoterId?: string) {
  return useQuery({
    queryKey: ["ac-rules", promoterId],
    queryFn: () => api<any[]>(`${BASE}/rules?promoter_id=${promoterId}`),
    enabled: !!promoterId,
  });
}
export function useCreateAccessRule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/rules`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-rules"] }); toast({ title: "Regra criada" }); },
  });
}
export function useDeleteAccessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ac-rules"] }),
  });
}

// ─── Supermarket Users ───
export function useSupermarketUser(unitId?: string) {
  return useQuery({
    queryKey: ["ac-supermarket-user", unitId],
    queryFn: () => api<any | null>(`${BASE}/units/${unitId}/supermarket-user`),
    enabled: !!unitId,
  });
}

export function useCreateSupermarketUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/supermarket-users`, { method: "POST", body: data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["ac-units"] });
      qc.invalidateQueries({ queryKey: ["ac-supermarket-user", variables.supermarket_unit_id] });
      toast({ title: "Acesso do supermercado criado" });
    },
  });
}

export function useUpdateSupermarketUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`${BASE}/supermarket-users/${id}`, { method: "PUT", body: data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["ac-units"] });
      qc.invalidateQueries({ queryKey: ["ac-supermarket-user", variables.supermarket_unit_id] });
      toast({ title: "Acesso do supermercado atualizado" });
    },
  });
}

export function useRegenerateTotemToken() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (unitId: string) => api<{ totem_token: string }>(`${BASE}/units/${unitId}/regenerate-token`, { method: "POST" }),
    onSuccess: (_data, unitId) => {
      qc.invalidateQueries({ queryKey: ["ac-units"] });
      qc.invalidateQueries({ queryKey: ["ac-supermarket-user", unitId] });
      toast({ title: "Token do totem atualizado" });
    },
  });
}

// ─── Agency Users ───
export function useCreateAgencyUser() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ agencyId, ...data }: any) => api(`${BASE}/agencies/${agencyId}/users`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-agencies"] }); toast({ title: "Acesso da agência criado" }); },
  });
}

export function useAgencyUsers(agencyId?: string) {
  return useQuery({
    queryKey: ["ac-agency-users", agencyId],
    queryFn: () => api<any[]>(`${BASE}/agencies/${agencyId}/users`),
    enabled: !!agencyId,
  });
}

// ─── Agency PDV Permissions ───
export function useAgencyUnits(agencyId?: string) {
  return useQuery({
    queryKey: ["ac-agency-units", agencyId],
    queryFn: () => api<any[]>(`${BASE}/agencies/${agencyId}/allowed-units`),
    enabled: !!agencyId,
  });
}
export function useSetAgencyUnits() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ agencyId, unit_ids }: { agencyId: string; unit_ids: string[] }) =>
      api(`${BASE}/agencies/${agencyId}/allowed-units`, { method: "PUT", body: { unit_ids } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-agency-units"] }); toast({ title: "PDVs atualizados" }); },
  });
}

// ─── Entry Logs ───
export function useEntryLogs(filters?: { unit_id?: string; date?: string }) {
  const params = new URLSearchParams();
  if (filters?.unit_id) params.set("unit_id", filters.unit_id);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();
  return useQuery({
    queryKey: ["ac-logs", filters],
    queryFn: () => api<any[]>(`${BASE}/logs${qs ? `?${qs}` : ""}`),
  });
}

// ─── Network Auth Settings ───
export function useNetworkAuthSettings(networkId?: string) {
  return useQuery({
    queryKey: ["ac-network-auth", networkId],
    queryFn: () => api<any>(`${BASE}/networks/${networkId}/auth-settings`),
    enabled: !!networkId,
  });
}
export function useUpdateNetworkAuthSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ networkId, ...data }: any) => api(`${BASE}/networks/${networkId}/auth-settings`, { method: "PUT", body: data }),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["ac-network-auth", vars.networkId] }); },
  });
}

// ─── PDV Auth Override ───
export function usePdvAuthOverride(unitId?: string) {
  return useQuery({
    queryKey: ["ac-pdv-auth-override", unitId],
    queryFn: () => api<any>(`${BASE}/units/${unitId}/auth-override`),
    enabled: !!unitId,
  });
}
export function usePdvAuthOverrides(unitIds: string[]) {
  return useQuery({
    queryKey: ["ac-pdv-auth-overrides", unitIds],
    queryFn: async () => {
      const results: Record<string, any> = {};
      await Promise.all(unitIds.map(async (id) => {
        try {
          const data = await api<any>(`${BASE}/units/${id}/auth-override`);
          results[id] = data;
        } catch { results[id] = null; }
      }));
      return results;
    },
    enabled: unitIds.length > 0,
  });
}
export function useUpdatePdvAuthOverride() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ unitId, ...data }: any) => api(`${BASE}/units/${unitId}/auth-override`, { method: "PUT", body: data }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ac-pdv-auth-override", vars.unitId] });
      toast({ title: "Override de autenticação salvo" });
    },
  });
}

// ─── QR Tokens ───
export function useQrTokens(filters?: { unit_id?: string }) {
  const qs = filters?.unit_id ? `?unit_id=${filters.unit_id}` : "";
  return useQuery({ queryKey: ["ac-qr-tokens", filters], queryFn: () => api<any[]>(`${BASE}/qr-tokens${qs}`) });
}
export function useCreateQrToken() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: any) => api(`${BASE}/qr-tokens`, { method: "POST", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-qr-tokens"] }); toast({ title: "QR Token gerado" }); },
  });
}
export function useRevokeQrToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`${BASE}/qr-tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ac-qr-tokens"] }),
  });
}

// ─── Auth Attempts ───
export function useAuthAttempts(filters?: { unit_id?: string; method?: string; result?: string; date?: string }) {
  const params = new URLSearchParams();
  if (filters?.unit_id) params.set("unit_id", filters.unit_id);
  if (filters?.method) params.set("method", filters.method);
  if (filters?.result) params.set("result", filters.result);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();
  return useQuery({
    queryKey: ["ac-auth-attempts", filters],
    queryFn: () => api<any[]>(`${BASE}/auth-attempts${qs ? `?${qs}` : ""}`),
  });
}

// ─── Fraud Logs ───
export function useFraudLogs(filters?: { unit_id?: string; fraud_type?: string; severity?: string; resolved?: string }) {
  const params = new URLSearchParams();
  if (filters?.unit_id) params.set("unit_id", filters.unit_id);
  if (filters?.fraud_type) params.set("fraud_type", filters.fraud_type);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.resolved) params.set("resolved", filters.resolved);
  const qs = params.toString();
  return useQuery({
    queryKey: ["ac-fraud-logs", filters],
    queryFn: () => api<any[]>(`${BASE}/fraud-logs${qs ? `?${qs}` : ""}`),
  });
}
export function useResolveFraudLog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api(`${BASE}/fraud-logs/${id}/resolve`, { method: "PUT", body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ac-fraud-logs"] }); toast({ title: "Log resolvido" }); },
  });
}

// ─── Promoter Conformity ───
export function usePromoterConformity(filters?: { network_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.network_id) params.set("network_id", filters.network_id);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["ac-conformity", filters],
    queryFn: () => api<any[]>(`${BASE}/promoters/conformity${qs ? `?${qs}` : ""}`),
  });
}

export function useCheckPromoterConformity() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: "agency_promoter" | "employee" }) =>
      api<{ results: any[]; message?: string }>(`${BASE}/promoters/${id}/check-conformity`, { method: "POST", body: { type } }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ac-conformity"] });
      toast({
        title: data?.message || "Conformidade verificada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao verificar conformidade",
        description: getErrorMessage(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });
}

export function useCheckAllConformity() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => api<{ checked: number; message?: string }>(`${BASE}/promoters/check-all-conformity`, { method: "POST" }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["ac-conformity"] });
      toast({
        title: data?.message || `Conformidade verificada para ${data.checked} promotores`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao verificar conformidade em lote",
        description: getErrorMessage(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });
}

export function useConformityNotifications(filters?: { agency_id?: string; unread_only?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.agency_id) params.set("agency_id", filters.agency_id);
  if (filters?.unread_only) params.set("unread_only", "true");
  const qs = params.toString();
  return useQuery({
    queryKey: ["ac-conformity-notif", filters],
    queryFn: () => api<any[]>(`${BASE}/conformity-notifications${qs ? `?${qs}` : ""}`),
  });
}
