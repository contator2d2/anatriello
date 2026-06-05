import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const BASE = '/api/access-control-dashboard';

export function useDashboardOperational() {
  return useQuery<any>({
    queryKey: ['ac-dashboard-operational'],
    queryFn: () => api(`${BASE}/operational`),
    refetchInterval: 30000,
  });
}

export function useDashboardValidations() {
  return useQuery<any>({
    queryKey: ['ac-dashboard-validations'],
    queryFn: () => api(`${BASE}/validations`),
    refetchInterval: 30000,
  });
}

export function useDashboardPromoters() {
  return useQuery<any>({
    queryKey: ['ac-dashboard-promoters'],
    queryFn: () => api(`${BASE}/promoters`),
  });
}

export function useDashboardFinancial() {
  return useQuery<any>({
    queryKey: ['ac-dashboard-financial'],
    queryFn: () => api(`${BASE}/financial`),
  });
}
