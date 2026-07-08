// Hook da jornada do entregador (Onda 1)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driverApi } from '@/contexts/DriverAuthContext';

const BASE = '/api/smartroute/driver';

export interface OperationSettings {
  max_checkin_distance_m: number;
  require_facade_photo: boolean;
  require_vehicle_checklist: boolean;
  preferred_nav_app: 'google' | 'waze' | 'ask';
  allow_checkout_with_occurrence: boolean;
  require_signature: boolean;
  require_invoice_photo: boolean;
}

export function useJourneyToday() {
  return useQuery<{ date: string; routes: any[]; operation: OperationSettings }>({
    queryKey: ['sr-journey-today'],
    queryFn: () => driverApi(`${BASE}/journey/today`),
    refetchInterval: 60_000,
  });
}

export function useStartJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { route_id?: string; vehicle_checklist?: any }) =>
      driverApi(`${BASE}/journey/start`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-journey-today'] }),
  });
}

export function useStopDetail(stopId?: string) {
  return useQuery<any>({
    queryKey: ['sr-stop', stopId],
    queryFn: () => driverApi(`${BASE}/stops/${stopId}`),
    enabled: !!stopId,
  });
}

export function useStopNavigate(stopId: string) {
  return useMutation({
    mutationFn: (pos: { lat?: number; lng?: number }) =>
      driverApi(`${BASE}/stops/${stopId}/navigate`, { method: 'POST', body: pos }),
  });
}

export function useStopCheckin(stopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { lat?: number; lng?: number; photo?: string }) =>
      driverApi(`${BASE}/stops/${stopId}/checkin`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-stop', stopId] }),
  });
}

export function useStopMedia(stopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: string; url: string; lat?: number; lng?: number; metadata?: any }) =>
      driverApi(`${BASE}/stops/${stopId}/media`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-stop', stopId] }),
  });
}

export function useStopOccurrence(stopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      type: string; description?: string; severity?: string;
      lat?: number; lng?: number; media_ids?: string[];
    }) => driverApi(`${BASE}/stops/${stopId}/occurrence`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-stop', stopId] }),
  });
}

export function useStopSignature(stopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { signature_url: string; receiver_name?: string; lat?: number; lng?: number }) =>
      driverApi(`${BASE}/stops/${stopId}/signature`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-stop', stopId] }),
  });
}

export function useStopCheckout(stopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      lat?: number; lng?: number; signature_url?: string;
      receiver_name?: string; notes?: string;
    }) => driverApi(`${BASE}/stops/${stopId}/checkout`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sr-stop', stopId] }),
  });
}

export function useNextStop(stopId?: string) {
  return useQuery<{ done: boolean; stop?: any; link?: { google: string; waze: string; preferred: string } }>({
    queryKey: ['sr-stop-next', stopId],
    queryFn: () => driverApi(`${BASE}/stops/${stopId}/next`),
    enabled: !!stopId,
  });
}

// Utilidades
export const getPos = () => new Promise<{ lat?: number; lng?: number }>((resolve) => {
  if (!navigator.geolocation) return resolve({});
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => resolve({}),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

export const pickPhoto = (): Promise<string | null> => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; (input as any).capture = 'environment';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(f);
  };
  input.click();
});

export function openNavLink(link?: { google: string; waze: string; preferred: string }) {
  if (!link) return;
  const target = link.preferred === 'waze' ? link.waze : link.google;
  window.location.href = target;
}
