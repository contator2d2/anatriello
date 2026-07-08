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

router.post('/stops/:id/checkin', async (req, res) => {
  try {
    const { lat, lng, photo } = req.body || {};
    const s = await query(
      `UPDATE smartroute_route_stops SET status='em_atendimento', arrived_at=NOW(),
        checkin_lat=$2, checkin_lng=$3, checkin_photo=$4, updated_at=NOW()
       WHERE id=$1 RETURNING route_id`, [req.params.id, lat, lng, photo]);
    if (!s.rows[0]) return res.status(404).json({ error: 'not found' });
    await query(`UPDATE smartroute_drivers SET current_status='em_pdv', current_lat=$2, current_lng=$3, last_location_at=NOW() WHERE id=$1`, [req.driverId, lat, lng]);
    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, stop_id, event_type, lat, lng)
       VALUES ($1,$2,$3,$4,'stop_checkin',$5,$6)`,
      [req.organizationId, s.rows[0].route_id, req.driverId, req.params.id, lat, lng]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stops/:id/photo', async (req, res) => {
  try {
    const { url, kind, lat, lng } = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_stop_photos (stop_id, url, kind, lat, lng) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, url, kind || 'entrega', lat, lng]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stops/:id/checkout', async (req, res) => {
  try {
    const { lat, lng, signature_url, receiver_name, notes } = req.body || {};
    const s = await query(
      `UPDATE smartroute_route_stops SET status='concluida', departed_at=NOW(),
        checkout_lat=$2, checkout_lng=$3, signature_url=$4, receiver_name=$5, notes=COALESCE($6,notes), updated_at=NOW()
       WHERE id=$1 RETURNING route_id, order_id`, [req.params.id, lat, lng, signature_url, receiver_name, notes]);
    if (!s.rows[0]) return res.status(404).json({ error: 'not found' });
    if (s.rows[0].order_id) await query(`UPDATE smartroute_orders SET status='entregue', updated_at=NOW() WHERE id=$1`, [s.rows[0].order_id]);
    await query(
      `UPDATE smartroute_routes SET completed_stops = (
         SELECT COUNT(*) FROM smartroute_route_stops WHERE route_id=$1 AND status='concluida'
       ), updated_at=NOW() WHERE id=$1`, [s.rows[0].route_id]);
    await query(`UPDATE smartroute_drivers SET current_status='em_rota', current_lat=$2, current_lng=$3, last_location_at=NOW() WHERE id=$1`, [req.driverId, lat, lng]);
    await query(
      `INSERT INTO smartroute_events (organization_id, route_id, driver_id, stop_id, event_type, lat, lng)
       VALUES ($1,$2,$3,$4,'stop_checkout',$5,$6)`,
      [req.organizationId, s.rows[0].route_id, req.driverId, req.params.id, lat, lng]);
    res.json({ ok: true });
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

