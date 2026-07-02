import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AppTemplate {
  id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  capabilities: string[];
  employees_count: number;
  created_at: string;
  updated_at: string;
}

export function useAppAccessTemplates() {
  return useQuery({
    queryKey: ["app-access-templates"],
    queryFn: () => api<AppTemplate[]>("/api/rh/app-templates"),
  });
}

export function useCapabilityCatalog() {
  return useQuery({
    queryKey: ["app-access-capabilities"],
    queryFn: () => api<{ key: string; group: string; label: string }[]>("/api/rh/app-templates/capabilities"),
    staleTime: 5 * 60_000,
  });
}

export function useCreateAppTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; capabilities: string[]; is_default?: boolean }) =>
      api("/api/rh/app-templates", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-access-templates"] }),
  });
}

export function useUpdateAppTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{ name: string; description: string; capabilities: string[]; is_default: boolean }>) =>
      api(`/api/rh/app-templates/${id}`, { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-access-templates"] }),
  });
}

export function useDeleteAppTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/rh/app-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-access-templates"] });
      qc.invalidateQueries({ queryKey: ["rh-employees"] });
    },
  });
}

export function useAssignAppTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employee_id, template_id }: { employee_id: string; template_id: string | null }) =>
      api(`/api/rh/app-templates/assign/${employee_id}`, { method: "PUT", body: { template_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-access-templates"] });
      qc.invalidateQueries({ queryKey: ["rh-employees"] });
    },
  });
}
