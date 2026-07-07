// SmartRoute AI - Configurações operacionais (tipos de veículo, janelas de entrega, exceções)
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';
import { ensureSmartRouteTables } from './smartroute.js';

const router = express.Router();

let opsEnsured = false;
async function ensureOpsTables() {
  if (opsEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS smartroute_vehicle_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      max_weight_kg NUMERIC(10,2) DEFAULT 0,
      max_volume_m3 NUMERIC(10,2) DEFAULT 0,
      max_stops INTEGER DEFAULT 0,
      avg_speed_kmh NUMERIC(6,2) DEFAULT 40,
      cost_per_km NUMERIC(10,2) DEFAULT 0,
      icon TEXT DEFAULT 'truck',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_vt_org ON smartroute_vehicle_types(organization_id, active);

    CREATE TABLE IF NOT EXISTS smartroute_delivery_windows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      window_start TIME NOT NULL,
      window_end TIME NOT NULL,
      weekdays INTEGER[] DEFAULT '{1,2,3,4,5}',
      priority INTEGER DEFAULT 5,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_dw_org ON smartroute_delivery_windows(organization_id, active);

    CREATE TABLE IF NOT EXISTS smartroute_exceptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      exception_date DATE NOT NULL,
      kind TEXT NOT NULL DEFAULT 'feriado',
      name TEXT NOT NULL,
      description TEXT,
      blocks_delivery BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_exc_org ON smartroute_exceptions(organization_id, exception_date);

    ALTER TABLE smartroute_vehicles ADD COLUMN IF NOT EXISTS vehicle_type_id UUID REFERENCES smartroute_vehicle_types(id) ON DELETE SET NULL;
  `);
  opsEnsured = true;
}

router.use(authenticate);
router.use(async (req, res, next) => { try { await ensureSmartRouteTables(); await ensureOpsTables(); next(); } catch (e) { next(e); } });

const orgId = (req) => req.user?.organization_id;

// ============ VEHICLE TYPES ============
router.get('/vehicle-types', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM smartroute_vehicle_types WHERE organization_id=$1 ORDER BY name`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { logError('sr.ops.vt.list', e); res.status(500).json({ error: e.message }); }
});
router.post('/vehicle-types', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_vehicle_types
       (organization_id, name, description, max_weight_kg, max_volume_m3, max_stops, avg_speed_kmh, cost_per_km, icon, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'truck'),COALESCE($10,true)) RETURNING *`,
      [orgId(req), b.name, b.description, b.max_weight_kg || 0, b.max_volume_m3 || 0, b.max_stops || 0, b.avg_speed_kmh || 40, b.cost_per_km || 0, b.icon, b.active]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/vehicle-types/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_vehicle_types SET
         name=COALESCE($3,name), description=COALESCE($4,description),
         max_weight_kg=COALESCE($5,max_weight_kg), max_volume_m3=COALESCE($6,max_volume_m3),
         max_stops=COALESCE($7,max_stops), avg_speed_kmh=COALESCE($8,avg_speed_kmh),
         cost_per_km=COALESCE($9,cost_per_km), icon=COALESCE($10,icon), active=COALESCE($11,active),
         updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.name, b.description, b.max_weight_kg, b.max_volume_m3, b.max_stops, b.avg_speed_kmh, b.cost_per_km, b.icon, b.active]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/vehicle-types/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_vehicle_types WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DELIVERY WINDOWS ============
router.get('/windows', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM smartroute_delivery_windows WHERE organization_id=$1 ORDER BY window_start`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/windows', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_delivery_windows
       (organization_id, name, window_start, window_end, weekdays, priority, active)
       VALUES ($1,$2,$3,$4,COALESCE($5,'{1,2,3,4,5}')::int[],COALESCE($6,5),COALESCE($7,true)) RETURNING *`,
      [orgId(req), b.name, b.window_start, b.window_end, b.weekdays, b.priority, b.active]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/windows/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_delivery_windows SET
         name=COALESCE($3,name), window_start=COALESCE($4,window_start), window_end=COALESCE($5,window_end),
         weekdays=COALESCE($6,weekdays), priority=COALESCE($7,priority), active=COALESCE($8,active),
         updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.name, b.window_start, b.window_end, b.weekdays, b.priority, b.active]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/windows/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_delivery_windows WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ EXCEPTIONS (feriados / bloqueios) ============
router.get('/exceptions', async (req, res) => {
  try {
    const r = await query(
      `SELECT * FROM smartroute_exceptions WHERE organization_id=$1
       ORDER BY exception_date DESC LIMIT 500`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/exceptions', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_exceptions
       (organization_id, exception_date, kind, name, description, blocks_delivery)
       VALUES ($1,$2,COALESCE($3,'feriado'),$4,$5,COALESCE($6,true)) RETURNING *`,
      [orgId(req), b.exception_date, b.kind, b.name, b.description, b.blocks_delivery]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/exceptions/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_exceptions WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
