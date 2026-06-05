import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AyratechAIConfig {
  provider: 'openai' | 'gemini' | 'openrouter';
  model: string;
  enabled: boolean;
  has_key: boolean;
  updated_at?: string;
}

export function useAyratechAIConfig() {
  return useQuery<AyratechAIConfig>({
    queryKey: ['ayratech-ai-config'],
    queryFn: () => api('/api/ayratech-ai/config'),
  });
}

export function useSaveAyratechAIConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { provider: string; model: string; api_key?: string; enabled?: boolean }) =>
      api('/api/ayratech-ai/config', { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ayratech-ai-config'] }),
  });
}

export function useTestAyratechAI() {
  return useMutation({
    mutationFn: () => api<{ success: boolean; error?: string }>('/api/ayratech-ai/test', { method: 'POST' }),
  });
}
