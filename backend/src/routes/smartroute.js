// SmartRoute AI - Admin routes
import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();

let ensured = false;
export async function ensureSmartRouteTables() {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS smartroute_vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      plate TEXT NOT NULL,
      model TEXT,
      brand TEXT,
      year INTEGER,
      capacity_kg NUMERIC(10,2) DEFAULT 0,
      capacity_m3 NUMERIC(10,2) DEFAULT 0,
      fuel_type TEXT DEFAULT 'diesel',
      status TEXT DEFAULT 'ativo',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_veh_org ON smartroute_vehicles(organization_id, status);

    CREATE TABLE IF NOT EXISTS smartroute_drivers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      full_name TEXT NOT NULL,
      cpf TEXT,
      phone TEXT,
      email TEXT,
      license_number TEXT,
      license_category TEXT,
      license_expires_at DATE,
      vehicle_id UUID REFERENCES smartroute_vehicles(id) ON DELETE SET NULL,
      password_hash TEXT,
      active BOOLEAN DEFAULT true,
      current_lat DOUBLE PRECISION,
      current_lng DOUBLE PRECISION,
      current_status TEXT DEFAULT 'offline',
      last_location_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_drv_org ON smartroute_drivers(organization_id, active);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sr_drv_cpf ON smartroute_drivers(organization_id, cpf) WHERE cpf IS NOT NULL;

    CREATE TABLE IF NOT EXISTS smartroute_pdvs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      cnpj TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      contact_name TEXT,
      contact_phone TEXT,
      delivery_window_start TIME,
      delivery_window_end TIME,
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_pdv_org ON smartroute_pdvs(organization_id, active);

    CREATE TABLE IF NOT EXISTS smartroute_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      pdv_id UUID REFERENCES smartroute_pdvs(id) ON DELETE SET NULL,
      order_number TEXT,
      weight_kg NUMERIC(10,2) DEFAULT 0,
      volume_m3 NUMERIC(10,3) DEFAULT 0,
      value_cents INTEGER DEFAULT 0,
      items JSONB DEFAULT '[]'::jsonb,
      priority INTEGER DEFAULT 5,
      delivery_date DATE,
      status TEXT DEFAULT 'pendente',
      route_stop_id UUID,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ord_org ON smartroute_orders(organization_id, status, delivery_date);
    CREATE INDEX IF NOT EXISTS idx_sr_ord_pdv ON smartroute_orders(pdv_id);

    CREATE TABLE IF NOT EXISTS smartroute_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      code TEXT,
      driver_id UUID REFERENCES smartroute_drivers(id) ON DELETE SET NULL,
      vehicle_id UUID REFERENCES smartroute_vehicles(id) ON DELETE SET NULL,
      planned_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'planejada',
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      total_distance_km NUMERIC(10,2) DEFAULT 0,
      total_stops INTEGER DEFAULT 0,
      completed_stops INTEGER DEFAULT 0,
      depot_lat DOUBLE PRECISION,
      depot_lng DOUBLE PRECISION,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_rt_org ON smartroute_routes(organization_id, planned_date, status);
    CREATE INDEX IF NOT EXISTS idx_sr_rt_driver ON smartroute_routes(driver_id, planned_date);

    CREATE TABLE IF NOT EXISTS smartroute_route_stops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id UUID NOT NULL REFERENCES smartroute_routes(id) ON DELETE CASCADE,
      order_id UUID REFERENCES smartroute_orders(id) ON DELETE SET NULL,
      pdv_id UUID REFERENCES smartroute_pdvs(id) ON DELETE SET NULL,
      sequence INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      arrived_at TIMESTAMPTZ,
      checkin_lat DOUBLE PRECISION,
      checkin_lng DOUBLE PRECISION,
      checkin_photo TEXT,
      departed_at TIMESTAMPTZ,
      checkout_lat DOUBLE PRECISION,
      checkout_lng DOUBLE PRECISION,
      signature_url TEXT,
      receiver_name TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_stops_route ON smartroute_route_stops(route_id, sequence);

    CREATE TABLE IF NOT EXISTS smartroute_stop_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stop_id UUID NOT NULL REFERENCES smartroute_route_stops(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      kind TEXT DEFAULT 'entrega',
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_photos_stop ON smartroute_stop_photos(stop_id);

    CREATE TABLE IF NOT EXISTS smartroute_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      route_id UUID REFERENCES smartroute_routes(id) ON DELETE CASCADE,
      driver_id UUID REFERENCES smartroute_drivers(id) ON DELETE SET NULL,
      stop_id UUID REFERENCES smartroute_route_stops(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      event_data JSONB DEFAULT '{}'::jsonb,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_evt_route ON smartroute_events(route_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sr_evt_driver ON smartroute_events(driver_id, created_at DESC);
  `);
  ensured = true;
}

router.use(authenticate);
router.use(async (req, res, next) => { try { await ensureSmartRouteTables(); next(); } catch (e) { next(e); } });

const orgId = (req) => req.user?.organization_id;

// ============ DASHBOARD ============
router.get('/dashboard', async (req, res) => {
  try {
    const org = orgId(req);
    const today = new Date().toISOString().slice(0, 10);
    const [routes, stops, drivers, vehicles, orders] = await Promise.all([
      query(`SELECT status, COUNT(*)::int c FROM smartroute_routes WHERE organization_id=$1 AND planned_date=$2 GROUP BY status`, [org, today]),
      query(`SELECT s.status, COUNT(*)::int c FROM smartroute_route_stops s JOIN smartroute_routes r ON r.id=s.route_id WHERE r.organization_id=$1 AND r.planned_date=$2 GROUP BY s.status`, [org, today]),
      query(`SELECT current_status, COUNT(*)::int c FROM smartroute_drivers WHERE organization_id=$1 AND active=true GROUP BY current_status`, [org]),
      query(`SELECT status, COUNT(*)::int c FROM smartroute_vehicles WHERE organization_id=$1 GROUP BY status`, [org]),
      query(`SELECT status, COUNT(*)::int c FROM smartroute_orders WHERE organization_id=$1 AND (delivery_date=$2 OR delivery_date IS NULL) GROUP BY status`, [org, today]),
    ]);
    const toMap = (rows, k = 'status') => Object.fromEntries(rows.map((r) => [r[k] || 'na', r.c]));
    res.json({
      date: today,
      routes: toMap(routes.rows),
      stops: toMap(stops.rows),
      drivers: toMap(drivers.rows, 'current_status'),
      vehicles: toMap(vehicles.rows),
      orders: toMap(orders.rows),
    });
  } catch (e) { logError('smartroute.dashboard', e); res.status(500).json({ error: e.message }); }
});

// ============ LIVE MAP ============
router.get('/live', async (req, res) => {
  try {
    const org = orgId(req);
    const today = new Date().toISOString().slice(0, 10);
    const drivers = await query(
      `SELECT d.id, d.full_name, d.current_lat, d.current_lng, d.current_status, d.last_location_at,
              v.plate, v.model,
              r.id AS route_id, r.code AS route_code, r.status AS route_status, r.completed_stops, r.total_stops
       FROM smartroute_drivers d
       LEFT JOIN smartroute_vehicles v ON v.id=d.vehicle_id
       LEFT JOIN smartroute_routes r ON r.driver_id=d.id AND r.planned_date=$2 AND r.status IN ('em_andamento','planejada')
       WHERE d.organization_id=$1 AND d.active=true`,
      [org, today]
    );
    res.json({ drivers: drivers.rows, date: today });
  } catch (e) { logError('smartroute.live', e); res.status(500).json({ error: e.message }); }
});

// ============ VEHICLES CRUD ============
router.get('/vehicles', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM smartroute_vehicles WHERE organization_id=$1 ORDER BY plate`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/vehicles', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_vehicles (organization_id, plate, model, brand, year, capacity_kg, capacity_m3, fuel_type, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'ativo'),$10) RETURNING *`,
      [orgId(req), b.plate, b.model, b.brand, b.year || null, b.capacity_kg || 0, b.capacity_m3 || 0, b.fuel_type || 'diesel', b.status, b.notes]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/vehicles/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_vehicles SET plate=COALESCE($3,plate), model=COALESCE($4,model), brand=COALESCE($5,brand),
        year=COALESCE($6,year), capacity_kg=COALESCE($7,capacity_kg), capacity_m3=COALESCE($8,capacity_m3),
        fuel_type=COALESCE($9,fuel_type), status=COALESCE($10,status), notes=COALESCE($11,notes), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.plate, b.model, b.brand, b.year, b.capacity_kg, b.capacity_m3, b.fuel_type, b.status, b.notes]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/vehicles/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_vehicles WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DRIVERS CRUD ============
router.get('/drivers', async (req, res) => {
  try {
    const r = await query(
      `SELECT d.*, v.plate AS vehicle_plate FROM smartroute_drivers d
       LEFT JOIN smartroute_vehicles v ON v.id=d.vehicle_id
       WHERE d.organization_id=$1 ORDER BY d.full_name`, [orgId(req)]);
    res.json(r.rows.map(({ password_hash, ...rest }) => rest));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/drivers', async (req, res) => {
  try {
    const b = req.body || {};
    const cpf = (b.cpf || '').replace(/\D/g, '') || null;
    const password = b.password || Math.random().toString(36).slice(2, 8);
    const hash = await bcrypt.hash(password, 10);
    const r = await query(
      `INSERT INTO smartroute_drivers (organization_id, full_name, cpf, phone, email, license_number, license_category, license_expires_at, vehicle_id, password_hash, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,true)) RETURNING *`,
      [orgId(req), b.full_name, cpf, b.phone, b.email, b.license_number, b.license_category, b.license_expires_at || null, b.vehicle_id || null, hash, b.active]
    );
    const { password_hash, ...safe } = r.rows[0];
    res.json({ ...safe, generated_password: b.password ? undefined : password });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/drivers/:id', async (req, res) => {
  try {
    const b = req.body || {};
    let hash = null;
    if (b.password) hash = await bcrypt.hash(b.password, 10);
    const r = await query(
      `UPDATE smartroute_drivers SET full_name=COALESCE($3,full_name), cpf=COALESCE($4,cpf), phone=COALESCE($5,phone),
        email=COALESCE($6,email), license_number=COALESCE($7,license_number), license_category=COALESCE($8,license_category),
        license_expires_at=COALESCE($9,license_expires_at), vehicle_id=$10, active=COALESCE($11,active),
        password_hash=COALESCE($12,password_hash), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.full_name, (b.cpf || '').replace(/\D/g, '') || null, b.phone, b.email, b.license_number, b.license_category, b.license_expires_at || null, b.vehicle_id || null, b.active, hash]
    );
    const { password_hash, ...safe } = r.rows[0] || {};
    res.json(safe);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/drivers/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_drivers WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ PDVs CRUD ============
router.get('/pdvs', async (req, res) => {
  try { const r = await query(`SELECT * FROM smartroute_pdvs WHERE organization_id=$1 ORDER BY name`, [orgId(req)]); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/pdvs', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_pdvs (organization_id, name, cnpj, address, city, state, zip, lat, lng, contact_name, contact_phone, delivery_window_start, delivery_window_end, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15,true)) RETURNING *`,
      [orgId(req), b.name, b.cnpj, b.address, b.city, b.state, b.zip, b.lat, b.lng, b.contact_name, b.contact_phone, b.delivery_window_start, b.delivery_window_end, b.notes, b.active]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/pdvs/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_pdvs SET name=COALESCE($3,name), cnpj=COALESCE($4,cnpj), address=COALESCE($5,address),
        city=COALESCE($6,city), state=COALESCE($7,state), zip=COALESCE($8,zip), lat=$9, lng=$10,
        contact_name=COALESCE($11,contact_name), contact_phone=COALESCE($12,contact_phone),
        delivery_window_start=$13, delivery_window_end=$14, notes=COALESCE($15,notes), active=COALESCE($16,active), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.name, b.cnpj, b.address, b.city, b.state, b.zip, b.lat, b.lng, b.contact_name, b.contact_phone, b.delivery_window_start, b.delivery_window_end, b.notes, b.active]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/pdvs/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_pdvs WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ ORDERS CRUD ============
router.get('/orders', async (req, res) => {
  try {
    const { status, date } = req.query;
    const conds = ['o.organization_id=$1'];
    const params = [orgId(req)];
    if (status) { params.push(status); conds.push(`o.status=$${params.length}`); }
    if (date) { params.push(date); conds.push(`o.delivery_date=$${params.length}`); }
    const r = await query(
      `SELECT o.*, p.name AS pdv_name, p.address AS pdv_address, p.lat AS pdv_lat, p.lng AS pdv_lng
       FROM smartroute_orders o LEFT JOIN smartroute_pdvs p ON p.id=o.pdv_id
       WHERE ${conds.join(' AND ')} ORDER BY o.delivery_date NULLS LAST, o.priority DESC, o.created_at DESC LIMIT 500`,
      params
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/orders', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_orders (organization_id, pdv_id, order_number, weight_kg, volume_m3, value_cents, items, priority, delivery_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'pendente'),$11) RETURNING *`,
      [orgId(req), b.pdv_id, b.order_number, b.weight_kg || 0, b.volume_m3 || 0, b.value_cents || 0, JSON.stringify(b.items || []), b.priority || 5, b.delivery_date || null, b.status, b.notes]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/orders/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_orders SET pdv_id=COALESCE($3,pdv_id), order_number=COALESCE($4,order_number),
        weight_kg=COALESCE($5,weight_kg), volume_m3=COALESCE($6,volume_m3), value_cents=COALESCE($7,value_cents),
        items=COALESCE($8,items), priority=COALESCE($9,priority), delivery_date=$10,
        status=COALESCE($11,status), notes=COALESCE($12,notes), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.pdv_id, b.order_number, b.weight_kg, b.volume_m3, b.value_cents, b.items ? JSON.stringify(b.items) : null, b.priority, b.delivery_date || null, b.status, b.notes]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/orders/:id', async (req, res) => {
  try { await query(`DELETE FROM smartroute_orders WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ ROUTES CRUD + STOPS ============
router.get('/routes', async (req, res) => {
  try {
    const { date, status } = req.query;
    const conds = ['r.organization_id=$1']; const params = [orgId(req)];
    if (date) { params.push(date); conds.push(`r.planned_date=$${params.length}`); }
    if (status) { params.push(status); conds.push(`r.status=$${params.length}`); }
    const r = await query(
      `SELECT r.*, d.full_name AS driver_name, v.plate AS vehicle_plate
       FROM smartroute_routes r
       LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
       LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
       WHERE ${conds.join(' AND ')} ORDER BY r.planned_date DESC, r.created_at DESC LIMIT 300`, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/routes/:id', async (req, res) => {
  try {
    const org = orgId(req);
    const r = await query(
      `SELECT r.*, d.full_name AS driver_name, d.phone AS driver_phone, v.plate AS vehicle_plate, v.model AS vehicle_model
       FROM smartroute_routes r
       LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
       LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
       WHERE r.id=$1 AND r.organization_id=$2`, [req.params.id, org]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
    const stops = await query(
      `SELECT s.*, p.name AS pdv_name, p.address AS pdv_address, p.lat AS pdv_lat, p.lng AS pdv_lng,
              o.order_number, o.weight_kg, o.volume_m3, o.value_cents, o.items
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       LEFT JOIN smartroute_orders o ON o.id=s.order_id
       WHERE s.route_id=$1 ORDER BY s.sequence`, [req.params.id]);
    res.json({ ...r.rows[0], stops: stops.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/routes', async (req, res) => {
  try {
    const b = req.body || {};
    const code = b.code || `R-${Date.now().toString(36).toUpperCase()}`;
    const r = await query(
      `INSERT INTO smartroute_routes (organization_id, code, driver_id, vehicle_id, planned_date, status, depot_lat, depot_lng, notes)
       VALUES ($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),'planejada',$6,$7,$8) RETURNING *`,
      [orgId(req), code, b.driver_id || null, b.vehicle_id || null, b.planned_date || null, b.depot_lat, b.depot_lng, b.notes]
    );
    const route = r.rows[0];

    // Add stops from order_ids
    if (Array.isArray(b.order_ids) && b.order_ids.length) {
      const ords = await query(
        `SELECT id, pdv_id FROM smartroute_orders WHERE organization_id=$1 AND id = ANY($2::uuid[])`,
        [orgId(req), b.order_ids]
      );
      for (let i = 0; i < ords.rows.length; i++) {
        const o = ords.rows[i];
        const st = await query(
          `INSERT INTO smartroute_route_stops (route_id, order_id, pdv_id, sequence) VALUES ($1,$2,$3,$4) RETURNING id`,
          [route.id, o.id, o.pdv_id, i + 1]
        );
        await query(`UPDATE smartroute_orders SET status='em_rota', route_stop_id=$2, updated_at=NOW() WHERE id=$1`, [o.id, st.rows[0].id]);
      }
      await query(`UPDATE smartroute_routes SET total_stops=$2 WHERE id=$1`, [route.id, ords.rows.length]);
    }
    res.json(route);
  } catch (e) { logError('smartroute.createRoute', e); res.status(500).json({ error: e.message }); }
});
router.put('/routes/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_routes SET driver_id=$3, vehicle_id=$4, planned_date=COALESCE($5,planned_date),
        status=COALESCE($6,status), depot_lat=$7, depot_lng=$8, notes=COALESCE($9,notes), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.driver_id || null, b.vehicle_id || null, b.planned_date || null, b.status, b.depot_lat, b.depot_lng, b.notes]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/routes/:id', async (req, res) => {
  try {
    await query(`UPDATE smartroute_orders SET status='pendente', route_stop_id=NULL WHERE route_stop_id IN (SELECT id FROM smartroute_route_stops WHERE route_id=$1)`, [req.params.id]);
    await query(`DELETE FROM smartroute_routes WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Simple nearest-neighbor optimizer
router.post('/routes/:id/optimize', async (req, res) => {
  try {
    const org = orgId(req);
    const r = await query(`SELECT * FROM smartroute_routes WHERE id=$1 AND organization_id=$2`, [req.params.id, org]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
    const route = r.rows[0];
    const stops = await query(
      `SELECT s.id, s.pdv_id, p.lat, p.lng FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id WHERE s.route_id=$1`, [req.params.id]);
    const pts = stops.rows.filter((s) => s.lat != null && s.lng != null);
    const d = (a, b) => { const dx = a.lat - b.lat, dy = a.lng - b.lng; return Math.sqrt(dx * dx + dy * dy); };
    let cur = { lat: route.depot_lat ?? pts[0]?.lat, lng: route.depot_lng ?? pts[0]?.lng };
    const remaining = [...pts]; const order = [];
    while (remaining.length) {
      remaining.sort((a, b) => d(cur, a) - d(cur, b));
      const next = remaining.shift(); order.push(next); cur = next;
    }
    for (let i = 0; i < order.length; i++) {
      await query(`UPDATE smartroute_route_stops SET sequence=$2, updated_at=NOW() WHERE id=$1`, [order[i].id, i + 1]);
    }
    res.json({ ok: true, sequenced: order.length });
  } catch (e) { logError('smartroute.optimize', e); res.status(500).json({ error: e.message }); }
});

// Route events (timeline)
router.get('/routes/:id/events', async (req, res) => {
  try {
    const r = await query(
      `SELECT e.*, d.full_name AS driver_name FROM smartroute_events e
       LEFT JOIN smartroute_drivers d ON d.id=e.driver_id
       WHERE e.route_id=$1 AND e.organization_id=$2 ORDER BY e.created_at DESC LIMIT 200`,
      [req.params.id, orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route replay — geo-tagged events chronological + stops
router.get('/routes/:id/replay', async (req, res) => {
  try {
    const org = orgId(req);
    const route = await query(
      `SELECT r.*, d.full_name AS driver_name, v.plate AS vehicle_plate
       FROM smartroute_routes r
       LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
       LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
       WHERE r.id=$1 AND r.organization_id=$2`, [req.params.id, org]);
    if (!route.rows[0]) return res.status(404).json({ error: 'not found' });
    const events = await query(
      `SELECT event_type, event_data, lat, lng, created_at FROM smartroute_events
       WHERE route_id=$1 AND organization_id=$2 ORDER BY created_at`, [req.params.id, org]);
    const stops = await query(
      `SELECT s.id, s.sequence, s.status, s.arrived_at, s.departed_at, s.checkin_lat, s.checkin_lng,
              s.checkout_lat, s.checkout_lng, s.receiver_name, p.name AS pdv_name, p.lat AS pdv_lat, p.lng AS pdv_lng
       FROM smartroute_route_stops s LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       WHERE s.route_id=$1 ORDER BY s.sequence`, [req.params.id]);
    res.json({ route: route.rows[0], events: events.rows, stops: stops.rows });
  } catch (e) { logError('smartroute.replay', e); res.status(500).json({ error: e.message }); }
});

// Alerts table (shared with geofence + AI scanner)
export async function ensureSRAlerts() {
  await query(`
    CREATE TABLE IF NOT EXISTS smartroute_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      route_id UUID REFERENCES smartroute_routes(id) ON DELETE CASCADE,
      driver_id UUID REFERENCES smartroute_drivers(id) ON DELETE SET NULL,
      severity TEXT DEFAULT 'medium',
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      dedupe_key TEXT UNIQUE,
      resolved BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

router.get('/alerts', async (req, res) => {
  try { await ensureSRAlerts();
    const r = await query(`SELECT * FROM smartroute_alerts WHERE organization_id=$1 AND resolved=false ORDER BY created_at DESC LIMIT 100`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/alerts/:id/resolve', async (req, res) => {
  try { await query(`UPDATE smartroute_alerts SET resolved=true WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Webhook token (import orders)
router.get('/webhook-token', async (req, res) => {
  try {
    const org = orgId(req);
    await query(`CREATE TABLE IF NOT EXISTS smartroute_org_settings (organization_id UUID PRIMARY KEY, webhook_token TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
    let r = await query(`SELECT webhook_token FROM smartroute_org_settings WHERE organization_id=$1`, [org]);
    if (!r.rows[0]) {
      const crypto = await import('crypto');
      const t = crypto.randomBytes(24).toString('hex');
      r = await query(`INSERT INTO smartroute_org_settings (organization_id, webhook_token) VALUES ($1,$2) RETURNING webhook_token`, [org, t]);
    }
    res.json({ token: r.rows[0].webhook_token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/webhook-token/rotate', async (req, res) => {
  try {
    const org = orgId(req);
    const crypto = await import('crypto');
    const t = crypto.randomBytes(24).toString('hex');
    await query(`CREATE TABLE IF NOT EXISTS smartroute_org_settings (organization_id UUID PRIMARY KEY, webhook_token TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
    await query(
      `INSERT INTO smartroute_org_settings (organization_id, webhook_token) VALUES ($1,$2)
       ON CONFLICT (organization_id) DO UPDATE SET webhook_token=EXCLUDED.webhook_token, updated_at=NOW()`, [org, t]);
    res.json({ token: t });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ensure tracking token for a specific order
router.post('/orders/:id/tracking-token', async (req, res) => {
  try {
    const crypto = await import('crypto');
    const t = crypto.randomBytes(16).toString('hex');
    await query(`ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE`);
    const r = await query(
      `UPDATE smartroute_orders SET tracking_token=COALESCE(tracking_token,$3)
       WHERE id=$1 AND organization_id=$2 RETURNING tracking_token`,
      [req.params.id, orgId(req), t]);
    res.json({ token: r.rows[0]?.tracking_token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

