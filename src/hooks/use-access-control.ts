import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const BASE = "/api/access-control";

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
