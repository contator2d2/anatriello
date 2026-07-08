// SmartRoute AI - Driver App routes (separate auth)
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { logError } from '../logger.js';
import { ensureSmartRouteTables } from './smartroute.js';
import {
  distanceMeters, getOperationSettings, computeCheckoutBlockers,
  logEvent, buildNavLink,
} from '../lib/sr-journey.js';

const router = express.Router();
router.use(async (req, res, next) => { try { await ensureSmartRouteTables(); next(); } catch (e) { next(e); } });

const authDriver = async (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (d.appType !== 'smartroute_driver') return res.status(403).json({ error: 'Token inválido' });
    req.driverId = d.driverId;
    req.organizationId = d.organizationId;
    next();
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
};

// ============ LOGIN ============
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ error: 'Login e senha obrigatórios' });
    const cleaned = String(login).replace(/\D/g, '');
    const isCpf = cleaned.length === 11;
    const d = await query(
      `SELECT * FROM smartroute_drivers WHERE active=true AND ${isCpf ? 'cpf=$1' : 'LOWER(email)=LOWER($1)'}`,
      [isCpf ? cleaned : login]
    );
    const drv = d.rows[0];
    if (!drv?.password_hash) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, drv.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign(
      { driverId: drv.id, organizationId: drv.organization_id, appType: 'smartroute_driver' },
      process.env.JWT_SECRET, { expiresIn: '30d' }
    );
    const { password_hash, ...safe } = drv;
    res.json({ token, driver: safe });
  } catch (e) { logError('smartroute.driver.login', e); res.status(500).json({ error: 'Erro no login' }); }
});

router.use(authDriver);

router.get('/me', async (req, res) => {
  const r = await query(
    `SELECT d.id, d.full_name, d.phone, d.email, d.cpf, d.current_status, v.plate, v.model
     FROM smartroute_drivers d LEFT JOIN smartroute_vehicles v ON v.id=d.vehicle_id
     WHERE d.id=$1`, [req.driverId]);
  res.json(r.rows[0] || {});
});

router.get('/my-routes', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await query(
      `SELECT r.*, v.plate AS vehicle_plate
       FROM smartroute_routes r
       LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
       WHERE r.driver_id=$1 AND r.planned_date=$2 ORDER BY r.created_at`, [req.driverId, today]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/routes/:id', async (req, res) => {
  try {
    const r = await query(
      `SELECT r.* FROM smartroute_routes r WHERE r.id=$1 AND r.driver_id=$2`,
      [req.params.id, req.driverId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
    const stops = await query(
      `SELECT s.*, p.name AS pdv_name, p.address AS pdv_address, p.city AS pdv_city,
              p.lat AS pdv_lat, p.lng AS pdv_lng, p.contact_name, p.contact_phone,
              o.order_number, o.weight_kg, o.volume_m3, o.value_cents, o.items, o.notes AS order_notes
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       LEFT JOIN smartroute_orders o ON o.id=s.order_id
       WHERE s.route_id=$1 ORDER BY s.sequence`, [req.params.id]);
    res.json({ ...r.rows[0], stops: stops.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/routes/:id/start', async (req, res) => {
  try {
    await query(
      `UPDATE smartroute_routes SET status='em_andamento', started_at=COALESCE(started_at,NOW()), updated_at=NOW()
       WHERE id=$1 AND driver_id=$2`, [req.params.id, req.driverId]);
    await query(`UPDATE smartroute_drivers SET current_status='em_rota' WHERE id=$1`, [req.driverId]);
    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, event_type, event_data, lat, lng)
       VALUES ($1,$2,$3,'route_started',$4,$5,$6)`,
      [req.organizationId, req.params.id, req.driverId, JSON.stringify(req.body || {}), req.body?.lat, req.body?.lng]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ JORNADA (Onda 1) ============
router.get('/journey/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await query(
      `SELECT r.id, r.code, r.status, r.total_stops, r.completed_stops,
              r.total_distance_km, r.estimated_duration_min, r.started_at, r.ended_at,
              v.plate AS vehicle_plate, v.model AS vehicle_model,
              (SELECT COUNT(*) FROM smartroute_orders o
                JOIN smartroute_route_stops s2 ON s2.order_id=o.id
                WHERE s2.route_id=r.id) AS orders_count
       FROM smartroute_routes r
       LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
       WHERE r.driver_id=$1 AND r.planned_date=$2
       ORDER BY r.created_at`, [req.driverId, today]);
    const settings = await getOperationSettings(req.organizationId);
    res.json({ date: today, routes: r.rows, operation: settings });
  } catch (e) { logError('sr.driver.journey.today', e); res.status(500).json({ error: e.message }); }
});

router.post('/journey/start', async (req, res) => {
  try {
    const { route_id, vehicle_checklist } = req.body || {};
    if (route_id) {
      await query(
        `UPDATE smartroute_routes SET status='em_andamento',
           started_at=COALESCE(started_at,NOW()), updated_at=NOW()
         WHERE id=$1 AND driver_id=$2`, [route_id, req.driverId]);
    }
    await query(`UPDATE smartroute_drivers SET current_status='em_rota' WHERE id=$1`, [req.driverId]);
    await logEvent({
      organizationId: req.organizationId, driverId: req.driverId, routeId: route_id,
      eventType: 'journey_started', payload: { vehicle_checklist: vehicle_checklist || null },
    });
    res.json({ ok: true });
  } catch (e) { logError('sr.driver.journey.start', e); res.status(500).json({ error: e.message }); }
});

router.post('/stops/:id/navigate', async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    const r = await query(
      `SELECT s.id, s.route_id, s.state, p.lat AS pdv_lat, p.lng AS pdv_lng, p.name AS pdv_name
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       WHERE s.id=$1`, [req.params.id]);
    const s = r.rows[0];
    if (!s) return res.status(404).json({ error: 'not found' });
    if (['PENDING', 'NAVIGATING'].includes(s.state || 'PENDING')) {
      await query(`UPDATE smartroute_route_stops SET state='NAVIGATING', updated_at=NOW() WHERE id=$1`, [s.id]);
    }
    const settings = await getOperationSettings(req.organizationId);
    const link = buildNavLink({ lat: s.pdv_lat, lng: s.pdv_lng, preferred: settings.preferred_nav_app });
    await logEvent({
      organizationId: req.organizationId, driverId: req.driverId, routeId: s.route_id, stopId: s.id,
      eventType: 'stop_navigate', payload: { preferred: settings.preferred_nav_app }, lat, lng,
    });
    res.json({ ok: true, link, pdv: { name: s.pdv_name, lat: s.pdv_lat, lng: s.pdv_lng } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stops/:id/checkin', async (req, res) => {
  try {
    const { lat, lng, photo } = req.body || {};
    const r = await query(
      `SELECT s.id, s.route_id, s.state, p.lat AS pdv_lat, p.lng AS pdv_lng
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       WHERE s.id=$1`, [req.params.id]);
    const s = r.rows[0];
    if (!s) return res.status(404).json({ error: 'Entrega não encontrada' });
    const settings = await getOperationSettings(req.organizationId);

    // Validação de distância
    let distance = null;
    let distanceOk = true;
    if (s.pdv_lat != null && s.pdv_lng != null && lat != null && lng != null) {
      distance = distanceMeters({ lat, lng }, { lat: s.pdv_lat, lng: s.pdv_lng });
      distanceOk = distance != null && distance <= (settings.max_checkin_distance_m || 30);
    } else if (s.pdv_lat != null && (lat == null || lng == null)) {
      distanceOk = false;
    }

    if (!distanceOk) {
      await logEvent({
        organizationId: req.organizationId, driverId: req.driverId, routeId: s.route_id, stopId: s.id,
        eventType: 'stop_checkin_denied', payload: { distance_m: distance, max: settings.max_checkin_distance_m }, lat, lng,
      });
      return res.status(422).json({
        error: 'Check-in bloqueado: você está fora do raio permitido do PDV.',
        distance_m: distance != null ? Math.round(distance) : null,
        max_distance_m: settings.max_checkin_distance_m,
      });
    }

    if (settings.require_facade_photo && !photo) {
      return res.status(422).json({ error: 'Foto da fachada é obrigatória para o check-in.' });
    }

    await query(
      `UPDATE smartroute_route_stops
         SET status='em_atendimento', state='CHECKED_IN',
             arrived_at=COALESCE(arrived_at,NOW()), checkin_at=COALESCE(checkin_at,NOW()),
             checkin_lat=$2, checkin_lng=$3, checkin_photo=$4,
             checkin_distance_m=$5, distance_ok=$6, updated_at=NOW()
       WHERE id=$1`, [s.id, lat, lng, photo || null, distance, distanceOk]);

    if (photo) {
      await query(
        `INSERT INTO smartroute_stop_media (organization_id, stop_id, kind, url, lat, lng, taken_at)
         VALUES ($1,$2,'facade',$3,$4,$5,NOW())`,
        [req.organizationId, s.id, photo, lat, lng]);
    }

    await query(`UPDATE smartroute_drivers SET current_status='em_pdv', current_lat=$2, current_lng=$3, last_location_at=NOW() WHERE id=$1`,
      [req.driverId, lat, lng]);
    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, stop_id, event_type, lat, lng)
       VALUES ($1,$2,$3,$4,'stop_checkin',$5,$6)`,
      [req.organizationId, s.route_id, req.driverId, s.id, lat, lng]);
    await logEvent({
      organizationId: req.organizationId, driverId: req.driverId, routeId: s.route_id, stopId: s.id,
      eventType: 'stop_checkin', payload: { distance_m: distance }, lat, lng,
    });
    res.json({ ok: true, distance_m: distance != null ? Math.round(distance) : null });
  } catch (e) { logError('sr.driver.checkin', e); res.status(500).json({ error: e.message }); }
});

// Upload genérico de mídia associada à entrega
router.post('/stops/:id/media', async (req, res) => {
  try {
    const { kind, url, lat, lng, metadata } = req.body || {};
    if (!url || !kind) return res.status(400).json({ error: 'kind e url são obrigatórios' });
    const r = await query(
      `INSERT INTO smartroute_stop_media (organization_id, stop_id, kind, url, lat, lng, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.organizationId, req.params.id, kind, url, lat ?? null, lng ?? null,
        JSON.stringify(metadata || {})]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ocorrências ricas
router.post('/stops/:id/occurrence', async (req, res) => {
  try {
    const { type, description, severity, lat, lng, media_ids } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type é obrigatório' });
    const r = await query(
      `INSERT INTO smartroute_stop_occurrences
         (organization_id, stop_id, driver_id, type, description, severity, lat, lng, media_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.organizationId, req.params.id, req.driverId, type, description || null,
        severity || 'medium', lat ?? null, lng ?? null, media_ids || []]);
    await logEvent({
      organizationId: req.organizationId, driverId: req.driverId, stopId: req.params.id,
      eventType: 'occurrence_added', payload: { type, severity }, lat, lng,
    });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Assinatura do cliente (registra como mídia kind=signature)
router.post('/stops/:id/signature', async (req, res) => {
  try {
    const { signature_url, receiver_name, lat, lng } = req.body || {};
    if (!signature_url) return res.status(400).json({ error: 'signature_url é obrigatório' });
    await query(
      `INSERT INTO smartroute_stop_media (organization_id, stop_id, kind, url, lat, lng)
       VALUES ($1,$2,'signature',$3,$4,$5)`,
      [req.organizationId, req.params.id, signature_url, lat ?? null, lng ?? null]);
    await query(
      `UPDATE smartroute_route_stops SET state='SIGNED',
         signature_url=$2, receiver_name=COALESCE($3,receiver_name), updated_at=NOW()
       WHERE id=$1`, [req.params.id, signature_url, receiver_name || null]);
    await logEvent({
      organizationId: req.organizationId, driverId: req.driverId, stopId: req.params.id,
      eventType: 'stop_signed', payload: { receiver_name: receiver_name || null }, lat, lng,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Próxima entrega
router.get('/stops/:id/next', async (req, res) => {
  try {
    const cur = await query(
      `SELECT route_id, sequence FROM smartroute_route_stops WHERE id=$1`, [req.params.id]);
    const c = cur.rows[0];
    if (!c) return res.status(404).json({ error: 'not found' });
    const nxt = await query(
      `SELECT s.id, s.sequence, p.name AS pdv_name, p.address AS pdv_address,
              p.lat AS pdv_lat, p.lng AS pdv_lng
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       WHERE s.route_id=$1 AND s.status='pendente' AND s.sequence > $2
       ORDER BY s.sequence LIMIT 1`, [c.route_id, c.sequence]);
    if (!nxt.rows[0]) return res.json({ done: true });
    const settings = await getOperationSettings(req.organizationId);
    const s = nxt.rows[0];
    res.json({
      done: false,
      stop: s,
      link: buildNavLink({ lat: s.pdv_lat, lng: s.pdv_lng, preferred: settings.preferred_nav_app }),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stops/:id/checkout', async (req, res) => {
  try {
    const { lat, lng, signature_url, receiver_name, notes } = req.body || {};

    // Grava assinatura recebida no mesmo payload (compat com fluxo antigo)
    if (signature_url) {
      await query(
        `INSERT INTO smartroute_stop_media (organization_id, stop_id, kind, url, lat, lng)
         VALUES ($1,$2,'signature',$3,$4,$5)`,
        [req.organizationId, req.params.id, signature_url, lat ?? null, lng ?? null]);
    }

    // Bloqueios
    const blockers = await computeCheckoutBlockers(req.params.id, req.organizationId);
    if (blockers.length) {
      return res.status(422).json({ error: 'Pendências obrigatórias', blockers });
    }

    const s = await query(
      `UPDATE smartroute_route_stops
         SET status='concluida', state='COMPLETED',
             departed_at=NOW(), checkout_at=NOW(),
             checkout_lat=$2, checkout_lng=$3,
             signature_url=COALESCE($4,signature_url),
             receiver_name=COALESCE($5,receiver_name),
             notes=COALESCE($6,notes),
             duration_ms = CASE WHEN checkin_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (NOW() - checkin_at))*1000 ELSE duration_ms END,
             updated_at=NOW()
       WHERE id=$1 RETURNING route_id, order_id, duration_ms`,
      [req.params.id, lat, lng, signature_url || null, receiver_name || null, notes || null]);
    if (!s.rows[0]) return res.status(404).json({ error: 'not found' });

    if (s.rows[0].order_id) {
      await query(`UPDATE smartroute_orders SET status='entregue', updated_at=NOW() WHERE id=$1`, [s.rows[0].order_id]);
    }
    await query(
      `UPDATE smartroute_routes SET completed_stops = (
         SELECT COUNT(*) FROM smartroute_route_stops WHERE route_id=$1 AND status='concluida'
       ), updated_at=NOW() WHERE id=$1`, [s.rows[0].route_id]);
    await query(`UPDATE smartroute_drivers SET current_status='em_rota',
       current_lat=$2, current_lng=$3, last_location_at=NOW() WHERE id=$1`,
      [req.driverId, lat, lng]);

    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, stop_id, event_type, lat, lng)
       VALUES ($1,$2,$3,$4,'stop_checkout',$5,$6)`,
      [req.organizationId, s.rows[0].route_id, req.driverId, req.params.id, lat, lng]);
    await logEvent({
      organizationId: req.organizationId, driverId: req.driverId,
      routeId: s.rows[0].route_id, stopId: req.params.id,
      eventType: 'stop_checkout', payload: { duration_ms: s.rows[0].duration_ms }, lat, lng,
    });
    res.json({ ok: true, duration_ms: s.rows[0].duration_ms });
  } catch (e) { logError('sr.driver.checkout', e); res.status(500).json({ error: e.message }); }
});

// Detalhe da entrega com mídias, ocorrências e link de navegação
router.get('/stops/:id', async (req, res) => {
  try {
    const r = await query(
      `SELECT s.*, p.name AS pdv_name, p.address AS pdv_address, p.city AS pdv_city,
              p.lat AS pdv_lat, p.lng AS pdv_lng, p.contact_name, p.contact_phone,
              o.order_number, o.weight_kg, o.volume_m3, o.value_cents, o.items, o.notes AS order_notes,
              r.code AS route_code, r.status AS route_status
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       LEFT JOIN smartroute_orders o ON o.id=s.order_id
       LEFT JOIN smartroute_routes r ON r.id=s.route_id
       WHERE s.id=$1`, [req.params.id]);
    const s = r.rows[0];
    if (!s) return res.status(404).json({ error: 'not found' });
    const media = await query(
      `SELECT id, kind, url, lat, lng, taken_at FROM smartroute_stop_media
       WHERE stop_id=$1 ORDER BY taken_at`, [req.params.id]);
    const occ = await query(
      `SELECT * FROM smartroute_stop_occurrences WHERE stop_id=$1 ORDER BY created_at`, [req.params.id]);
    const settings = await getOperationSettings(req.organizationId);
    res.json({
      ...s,
      media: media.rows,
      occurrences: occ.rows,
      operation: settings,
      nav_link: buildNavLink({ lat: s.pdv_lat, lng: s.pdv_lng, preferred: settings.preferred_nav_app }),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stops/:id/fail', async (req, res) => {
  try {
    const { reason, lat, lng } = req.body || {};
    const s = await query(
      `UPDATE smartroute_route_stops SET status='nao_entregue', departed_at=NOW(), notes=$2, updated_at=NOW()
       WHERE id=$1 RETURNING route_id, order_id`, [req.params.id, reason]);
    if (s.rows[0]?.order_id) await query(`UPDATE smartroute_orders SET status='devolvido' WHERE id=$1`, [s.rows[0].order_id]);
    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, stop_id, event_type, event_data, lat, lng)
       VALUES ($1,$2,$3,$4,'stop_failed',$5,$6,$7)`,
      [req.organizationId, s.rows[0].route_id, req.driverId, req.params.id, JSON.stringify({ reason }), lat, lng]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/routes/:id/finish', async (req, res) => {
  try {
    await query(
      `UPDATE smartroute_routes SET status='concluida', ended_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND driver_id=$2`, [req.params.id, req.driverId]);
    await query(`UPDATE smartroute_drivers SET current_status='disponivel' WHERE id=$1`, [req.driverId]);
    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, event_type)
       VALUES ($1,$2,$3,'route_finished')`, [req.organizationId, req.params.id, req.driverId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Haversine in km
function distKm(a, b) {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

router.post('/location', async (req, res) => {
  try {
    const { lat, lng, status } = req.body || {};
    await query(
      `UPDATE smartroute_drivers SET current_lat=$2, current_lng=$3, last_location_at=NOW(),
        current_status=COALESCE($4,current_status) WHERE id=$1`,
      [req.driverId, lat, lng, status]);

    // Geofence deviation check — active route + next pending stop, alert if > 5km
    if (lat != null && lng != null) {
      try {
        const rr = await query(
          `SELECT r.id AS route_id, s.pdv_lat, s.pdv_lng FROM smartroute_routes r
           JOIN smartroute_route_stops s ON s.route_id=r.id
           LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
           WHERE r.driver_id=$1 AND r.status='em_andamento' AND s.status='pendente'
             AND p.lat IS NOT NULL AND p.lng IS NOT NULL
           ORDER BY s.sequence LIMIT 1`, [req.driverId]);
        // pdv_lat/lng aren't projected above from stops; fetch via join fix
        const rr2 = await query(
          `SELECT r.id AS route_id, p.lat AS pdv_lat, p.lng AS pdv_lng
           FROM smartroute_routes r
           JOIN smartroute_route_stops s ON s.route_id=r.id
           JOIN smartroute_pdvs p ON p.id=s.pdv_id
           WHERE r.driver_id=$1 AND r.status='em_andamento' AND s.status='pendente'
           ORDER BY s.sequence LIMIT 1`, [req.driverId]);
        const nxt = rr2.rows[0];
        if (nxt) {
          const km = distKm({ lat, lng }, { lat: nxt.pdv_lat, lng: nxt.pdv_lng });
          if (km > 5) {
            await query(`CREATE TABLE IF NOT EXISTS smartroute_alerts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL,
              route_id UUID, driver_id UUID, severity TEXT DEFAULT 'medium',
              type TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
              dedupe_key TEXT UNIQUE, resolved BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW())`);
            const day = new Date().toISOString().slice(0, 10);
            const dedupe = `geofence:${nxt.route_id}:${day}`;
            await query(
              `INSERT INTO smartroute_alerts (organization_id, route_id, driver_id, severity, type, title, message, dedupe_key)
               VALUES ($1,$2,$3,'high','route_deviation',$4,$5,$6) ON CONFLICT (dedupe_key) DO NOTHING`,
              [req.organizationId, nxt.route_id, req.driverId,
               'Desvio de rota detectado', `Motorista a ${km.toFixed(1)}km da próxima parada`, dedupe]);
          }
        }
      } catch { /* silent */ }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

