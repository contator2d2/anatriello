// SmartRoute — motor de jornada (Onda 1)
// Regras: estado do stop, validação de check-in por distância, cálculo de duração.
import { query } from '../db.js';

// Haversine em metros
export function distanceMeters(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null;
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ordem canônica dos estados
export const STOP_STATES = [
  'PENDING', 'NAVIGATING', 'ARRIVED', 'CHECKED_IN',
  'CHECKLIST_IN_PROGRESS', 'CHECKLIST_DONE', 'PROOF_CAPTURED',
  'SIGNED', 'CHECKED_OUT', 'COMPLETED', 'EXCEPTION'
];

export function canTransition(from, to) {
  if (from === to) return true;
  if (to === 'EXCEPTION') return true; // sempre permitido registrar ocorrência bloqueante
  const idxFrom = STOP_STATES.indexOf(from || 'PENDING');
  const idxTo = STOP_STATES.indexOf(to);
  return idxTo >= 0 && idxTo >= idxFrom;
}

export async function getOperationSettings(organizationId) {
  const r = await query(
    `SELECT * FROM smartroute_org_operation_settings WHERE organization_id=$1`,
    [organizationId]
  );
  if (r.rows[0]) return r.rows[0];
  // Defaults se ainda não existir linha
  return {
    organization_id: organizationId,
    max_checkin_distance_m: 30,
    require_facade_photo: true,
    require_vehicle_checklist: false,
    preferred_nav_app: 'ask',
    allow_checkout_with_occurrence: true,
    require_signature: true,
    require_invoice_photo: true,
    require_receiver_document: false,
    receiver_document_type: 'cpf',
  };
}

export async function upsertOperationSettings(organizationId, patch) {
  const s = await getOperationSettings(organizationId);
  const merged = { ...s, ...patch };
  const r = await query(
    `INSERT INTO smartroute_org_operation_settings (
       organization_id, max_checkin_distance_m, require_facade_photo,
       require_vehicle_checklist, preferred_nav_app,
       allow_checkout_with_occurrence, require_signature, require_invoice_photo,
       require_receiver_document, receiver_document_type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (organization_id) DO UPDATE SET
       max_checkin_distance_m = EXCLUDED.max_checkin_distance_m,
       require_facade_photo = EXCLUDED.require_facade_photo,
       require_vehicle_checklist = EXCLUDED.require_vehicle_checklist,
       preferred_nav_app = EXCLUDED.preferred_nav_app,
       allow_checkout_with_occurrence = EXCLUDED.allow_checkout_with_occurrence,
       require_signature = EXCLUDED.require_signature,
       require_invoice_photo = EXCLUDED.require_invoice_photo,
       require_receiver_document = EXCLUDED.require_receiver_document,
       receiver_document_type = EXCLUDED.receiver_document_type,
       updated_at = NOW()
     RETURNING *`,
    [
      organizationId,
      merged.max_checkin_distance_m,
      merged.require_facade_photo,
      merged.require_vehicle_checklist,
      merged.preferred_nav_app,
      merged.allow_checkout_with_occurrence,
      merged.require_signature,
      merged.require_invoice_photo,
      !!merged.require_receiver_document,
      merged.receiver_document_type || 'cpf',
    ]
  );
  return r.rows[0];
}

// Regra POD: por parada > por rota > default org
export function effectivePodDocument(stop, route, settings) {
  const stopFlag = stop?.pod_require_document;
  const routeFlag = route?.pod_require_document;
  const required =
    stopFlag != null ? !!stopFlag :
    routeFlag != null ? !!routeFlag :
    !!settings?.require_receiver_document;
  return { required, type: settings?.receiver_document_type || 'cpf' };
}

// Verifica pendências obrigatórias antes do check-out
export async function computeCheckoutBlockers(stopId, organizationId) {
  const settings = await getOperationSettings(organizationId);
  const stop = await query(
    `SELECT s.*, r.pod_require_document AS route_pod_require_document
     FROM smartroute_route_stops s
     LEFT JOIN smartroute_routes r ON r.id=s.route_id
     WHERE s.id=$1`, [stopId]
  );
  if (!stop.rows[0]) return ['Entrega não encontrada'];
  const blockers = [];
  const st = stop.rows[0];
  if (!st.checkin_at) blockers.push('Check-in não realizado');

  const media = await query(
    `SELECT kind, COUNT(*)::int AS n FROM smartroute_stop_media
     WHERE stop_id=$1 GROUP BY kind`, [stopId]
  );
  const has = (k) => (media.rows.find((r) => r.kind === k)?.n || 0) > 0;

  if (settings.require_facade_photo && !has('facade')) blockers.push('Foto da fachada obrigatória');
  if (settings.require_invoice_photo && !has('invoice')) blockers.push('Foto da nota fiscal obrigatória');
  if (settings.require_signature && !has('signature')) blockers.push('Assinatura do cliente obrigatória');

  // POD: documento do recebedor quando exigido
  const pod = effectivePodDocument(
    st,
    { pod_require_document: st.route_pod_require_document },
    settings
  );
  if (pod.required && !st.receiver_document) {
    blockers.push(`${(pod.type || 'cpf').toUpperCase()} do recebedor obrigatório`);
  }

  // Itens obrigatórios do checklist configurável
  try {
    const { getPendingRequiredItems } = await import('./sr-checklists.js');
    const pending = await getPendingRequiredItems(stopId, organizationId);
    for (const label of pending) blockers.push(`Checklist: ${label}`);
  } catch { /* silent */ }

  return blockers;
}

export async function logEvent({ organizationId, driverId, routeId, stopId, eventType, payload, lat, lng }) {
  try {
    await query(
      `INSERT INTO smartroute_journey_events
         (organization_id, driver_id, route_id, stop_id, event_type, payload, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [organizationId, driverId || null, routeId || null, stopId || null, eventType,
        JSON.stringify(payload || {}), lat ?? null, lng ?? null]
    );
  } catch { /* silent */ }
}

export function buildNavLink({ lat, lng, preferred = 'ask' }) {
  if (lat == null || lng == null) return null;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return { google, waze, preferred };
}
