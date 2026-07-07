// SmartRoute AI - Public routes (tracking, NPS, order webhook) — no auth
import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { logError } from '../logger.js';
import { ensureSmartRouteTables } from './smartroute.js';

const router = express.Router();

let ensuredPub = false;
async function ensurePublicTables() {
  if (ensuredPub) return;
  await ensureSmartRouteTables();
  await query(`
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS nps_score INTEGER;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS nps_comment TEXT;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS nps_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS smartroute_org_settings (
      organization_id UUID PRIMARY KEY,
      webhook_token TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sr_ord_token ON smartroute_orders(tracking_token);
  `);
  ensuredPub = true;
}

router.use(async (req, res, next) => { try { await ensurePublicTables(); next(); } catch (e) { next(e); } });

// GET /api/smartroute-public/track/:token
router.get('/track/:token', async (req, res) => {
  try {
    const r = await query(
      `SELECT o.id, o.order_number, o.status, o.customer_name, o.value_cents, o.weight_kg,
              o.nps_score, o.nps_comment,
              p.name AS pdv_name, p.address AS pdv_address, p.lat AS pdv_lat, p.lng AS pdv_lng,
              s.id AS stop_id, s.status AS stop_status, s.sequence, s.arrived_at, s.departed_at,
              s.receiver_name, s.signature_url,
              r.id AS route_id, r.code AS route_code, r.status AS route_status,
              d.full_name AS driver_name, d.phone AS driver_phone,
              d.current_lat AS driver_lat, d.current_lng AS driver_lng, d.last_location_at,
              v.plate AS vehicle_plate
       FROM smartroute_orders o
       LEFT JOIN smartroute_pdvs p ON p.id = o.pdv_id
       LEFT JOIN smartroute_route_stops s ON s.id = o.route_stop_id
       LEFT JOIN smartroute_routes r ON r.id = s.route_id
       LEFT JOIN smartroute_drivers d ON d.id = r.driver_id
       LEFT JOIN smartroute_vehicles v ON v.id = r.vehicle_id
       WHERE o.tracking_token=$1`, [req.params.token]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
    const o = r.rows[0];

    // Timeline events (route-level)
    let events = [];
    if (o.route_id) {
      const ev = await query(
        `SELECT event_type, created_at, lat, lng FROM smartroute_events
         WHERE route_id=$1 AND (stop_id=$2 OR stop_id IS NULL) ORDER BY created_at`,
        [o.route_id, o.stop_id]);
      events = ev.rows;
    }
    res.json({ ...o, events });
  } catch (e) { logError('smartroute.public.track', e); res.status(500).json({ error: e.message }); }
});

// POST /api/smartroute-public/track/:token/rating
router.post('/track/:token/rating', async (req, res) => {
  try {
    const { score, comment } = req.body || {};
    const s = parseInt(score, 10);
    if (!s || s < 1 || s > 5) return res.status(400).json({ error: 'score deve ser 1..5' });
    const r = await query(
      `UPDATE smartroute_orders SET nps_score=$2, nps_comment=$3, nps_at=NOW()
       WHERE tracking_token=$1 AND status='entregue' RETURNING id`,
      [req.params.token, s, comment || null]);
    if (!r.rows[0]) return res.status(404).json({ error: 'pedido não entregue' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/smartroute-public/webhook/orders/:orgToken
router.post('/webhook/orders/:orgToken', async (req, res) => {
  try {
    const s = await query(`SELECT organization_id FROM smartroute_org_settings WHERE webhook_token=$1`, [req.params.orgToken]);
    const orgId = s.rows[0]?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'token inválido' });
    const b = req.body || {};
    // Find or create PDV by CNPJ
    let pdvId = b.pdv_id || null;
    if (!pdvId && b.pdv_cnpj) {
      const p = await query(`SELECT id FROM smartroute_pdvs WHERE organization_id=$1 AND cnpj=$2`, [orgId, b.pdv_cnpj]);
      if (p.rows[0]) pdvId = p.rows[0].id;
      else {
        const np = await query(
          `INSERT INTO smartroute_pdvs (organization_id, name, cnpj, address, city, state, zip, lat, lng, contact_name, contact_phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [orgId, b.pdv_name || b.pdv_cnpj, b.pdv_cnpj, b.address, b.city, b.state, b.zip, b.lat, b.lng, b.contact_name, b.contact_phone]);
        pdvId = np.rows[0].id;
      }
    }
    const token = crypto.randomBytes(16).toString('hex');
    const r = await query(
      `INSERT INTO smartroute_orders (organization_id, pdv_id, order_number, weight_kg, volume_m3, value_cents,
        items, priority, delivery_date, customer_name, customer_phone, tracking_token, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, tracking_token`,
      [orgId, pdvId, b.order_number, b.weight_kg || 0, b.volume_m3 || 0, b.value_cents || 0,
       JSON.stringify(b.items || []), b.priority || 5, b.delivery_date || null,
       b.customer_name, b.customer_phone, token, b.notes]);
    res.json({ ok: true, id: r.rows[0].id, tracking_token: r.rows[0].tracking_token });
  } catch (e) { logError('smartroute.public.webhook', e); res.status(500).json({ error: e.message }); }
});

export default router;
