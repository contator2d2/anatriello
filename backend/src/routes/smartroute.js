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

    ALTER TABLE smartroute_vehicles ADD COLUMN IF NOT EXISTS km_per_liter NUMERIC(6,2);
    ALTER TABLE smartroute_vehicles ADD COLUMN IF NOT EXISTS fuel_price_per_liter NUMERIC(8,3);
    ALTER TABLE smartroute_routes ADD COLUMN IF NOT EXISTS estimated_fuel_liters NUMERIC(10,2);
    ALTER TABLE smartroute_routes ADD COLUMN IF NOT EXISTS estimated_cost_brl NUMERIC(10,2);
    ALTER TABLE smartroute_routes ADD COLUMN IF NOT EXISTS estimated_duration_min INTEGER;
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS eta_min INTEGER;

    CREATE TABLE IF NOT EXISTS smartroute_depots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      is_default BOOLEAN DEFAULT false,
      active BOOLEAN DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_depots_org ON smartroute_depots(organization_id, active);
    ALTER TABLE smartroute_routes ADD COLUMN IF NOT EXISTS depot_id UUID;

    -- Atributos do PDV usados pelas regras de checklist
    ALTER TABLE smartroute_pdvs ADD COLUMN IF NOT EXISTS client_id UUID;
    ALTER TABLE smartroute_pdvs ADD COLUMN IF NOT EXISTS pdv_type TEXT;
    ALTER TABLE smartroute_pdvs ADD COLUMN IF NOT EXISTS channel TEXT;
    ALTER TABLE smartroute_pdvs ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE smartroute_pdvs ADD COLUMN IF NOT EXISTS region TEXT;


    -- === Fluxo Inteligente da Operação (Onda 1) ===
    -- Máquina de estados por stop
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'PENDING';
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ;
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMPTZ;
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS distance_ok BOOLEAN;
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS checkin_distance_m NUMERIC(10,2);
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS template_snapshot_id UUID;
    ALTER TABLE smartroute_route_stops ADD COLUMN IF NOT EXISTS occurrence_summary TEXT;

    -- Mídias ricas (foto/vídeo/áudio/assinatura) com EXIF
    CREATE TABLE IF NOT EXISTS smartroute_stop_media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      stop_id UUID NOT NULL REFERENCES smartroute_route_stops(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,               -- photo | video | audio | signature | facade | invoice
      url TEXT NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      taken_at TIMESTAMPTZ DEFAULT NOW(),
      device_info JSONB DEFAULT '{}'::jsonb,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_media_stop ON smartroute_stop_media(stop_id, kind);
    CREATE INDEX IF NOT EXISTS idx_sr_media_org ON smartroute_stop_media(organization_id, created_at DESC);

    -- Ocorrências ricas por stop
    CREATE TABLE IF NOT EXISTS smartroute_stop_occurrences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      stop_id UUID NOT NULL REFERENCES smartroute_route_stops(id) ON DELETE CASCADE,
      driver_id UUID,
      type TEXT NOT NULL,               -- danificado | vencido | recusado | cliente_ausente | cliente_fechado | garantia | devolucao | descarte | equipamento | freezer | outro
      description TEXT,
      severity TEXT DEFAULT 'medium',   -- low | medium | high
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      media_ids UUID[] DEFAULT '{}'::uuid[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_occ_stop ON smartroute_stop_occurrences(stop_id);
    CREATE INDEX IF NOT EXISTS idx_sr_occ_org ON smartroute_stop_occurrences(organization_id, created_at DESC);

    -- Onda 4: enriquecimento de ocorrências (status, SLA, atribuição, resolução)
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS code TEXT;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberta';
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS sla_target_min INTEGER;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS sla_deadline_at TIMESTAMPTZ;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT false;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS assigned_to UUID;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS resolution TEXT;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS resolved_by UUID;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    ALTER TABLE smartroute_stop_occurrences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS idx_sr_occ_status ON smartroute_stop_occurrences(organization_id, status, created_at DESC);

    -- Catálogo configurável de tipos de ocorrência (com SLA por tipo)
    CREATE TABLE IF NOT EXISTS smartroute_occurrence_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'medium',       -- low | medium | high
      sla_target_min INTEGER DEFAULT 60,    -- prazo em minutos para resolução
      require_photo BOOLEAN DEFAULT true,
      require_description BOOLEAN DEFAULT true,
      blocks_checkout BOOLEAN DEFAULT false,
      color TEXT DEFAULT '#f59e0b',
      icon TEXT DEFAULT 'alert-triangle',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (organization_id, code)
    );
    CREATE INDEX IF NOT EXISTS idx_sr_occ_types_org ON smartroute_occurrence_types(organization_id, active);

    -- Comentários / follow-ups em ocorrências
    CREATE TABLE IF NOT EXISTS smartroute_occurrence_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      occurrence_id UUID NOT NULL REFERENCES smartroute_stop_occurrences(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      author_id UUID,
      author_name TEXT,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_occ_cmt ON smartroute_occurrence_comments(occurrence_id, created_at ASC);


    -- Configurações operacionais por organização
    CREATE TABLE IF NOT EXISTS smartroute_org_operation_settings (
      organization_id UUID PRIMARY KEY,
      max_checkin_distance_m INTEGER DEFAULT 30,
      require_facade_photo BOOLEAN DEFAULT true,
      require_vehicle_checklist BOOLEAN DEFAULT false,
      preferred_nav_app TEXT DEFAULT 'ask',     -- google | waze | ask
      allow_checkout_with_occurrence BOOLEAN DEFAULT true,
      require_signature BOOLEAN DEFAULT true,
      require_invoice_photo BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- === Checklists configuráveis (Onda 2 — schema pronto) ===
    CREATE TABLE IF NOT EXISTS smartroute_checklist_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      active BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 100,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ck_tpl_org ON smartroute_checklist_templates(organization_id, active);

    CREATE TABLE IF NOT EXISTS smartroute_checklist_template_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES smartroute_checklist_templates(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL DEFAULT 0,
      field_type TEXT NOT NULL,          -- photo|video|text|number|temperature|stock_count|ocr|qr|barcode|signature|geo|face|yes_no|multi_choice
      label TEXT NOT NULL,
      required BOOLEAN DEFAULT true,
      config JSONB DEFAULT '{}'::jsonb,  -- { min, max, options, gpsToleranceM, ocrTargets, ... }
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ck_item_tpl ON smartroute_checklist_template_items(template_id, seq);

    CREATE TABLE IF NOT EXISTS smartroute_checklist_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      template_id UUID NOT NULL REFERENCES smartroute_checklist_templates(id) ON DELETE CASCADE,
      scope JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { client_ids, pdv_types, channels, categories, regions, equipment, operation, product_ids }
      priority INTEGER DEFAULT 100,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ck_asg_org ON smartroute_checklist_assignments(organization_id, active);

    CREATE TABLE IF NOT EXISTS smartroute_stop_checklist_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stop_id UUID NOT NULL REFERENCES smartroute_route_stops(id) ON DELETE CASCADE,
      template_id UUID NOT NULL,
      item_id UUID NOT NULL,
      value JSONB DEFAULT '{}'::jsonb,
      media_ids UUID[] DEFAULT '{}'::uuid[],
      ocr_json JSONB,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      answered_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ck_resp_stop ON smartroute_stop_checklist_responses(stop_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_ck_resp ON smartroute_stop_checklist_responses(stop_id, item_id);

    CREATE TABLE IF NOT EXISTS smartroute_stop_ocr_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      stop_id UUID NOT NULL REFERENCES smartroute_route_stops(id) ON DELETE CASCADE,
      media_id UUID REFERENCES smartroute_stop_media(id) ON DELETE SET NULL,
      product TEXT,
      brand TEXT,
      code TEXT,
      ean TEXT,
      batch TEXT,
      manufactured_at DATE,
      expires_at DATE,
      confidence NUMERIC(4,3),
      raw_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ocr_stop ON smartroute_stop_ocr_results(stop_id);

    -- Log append-only da jornada
    CREATE TABLE IF NOT EXISTS smartroute_journey_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      driver_id UUID,
      route_id UUID,
      stop_id UUID,
      event_type TEXT NOT NULL,          -- journey_started | stop_navigate | stop_checkin | stop_checkin_denied | checklist_item_answered | occurrence_added | stop_signed | stop_checkout | journey_finished
      payload JSONB DEFAULT '{}'::jsonb,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_jev_route ON smartroute_journey_events(route_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sr_jev_org ON smartroute_journey_events(organization_id, created_at DESC);
  `);
  ensured = true;
}

router.use(authenticate);
router.use(async (req, res, next) => { try { await ensureSmartRouteTables(); next(); } catch (e) { next(e); } });

const orgId = (req) => req.user?.organization_id;

// ============ DEPOTS (Centros de Distribuição) ============
async function geocodeNominatim(parts) {
  const q = encodeURIComponent([parts.address, parts.city, parts.state, parts.zip, 'Brasil'].filter(Boolean).join(', '));
  if (!q) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${q}`,
      { headers: { 'User-Agent': 'AnatrielloSmartRoute/1.0' } });
    const data = await res.json();
    if (Array.isArray(data) && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
  } catch (_) {}
  return null;
}

router.get('/depots', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM smartroute_depots WHERE organization_id=$1 AND active=true ORDER BY is_default DESC, name`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/depots/geocode', async (req, res) => {
  try {
    const g = await geocodeNominatim(req.body || {});
    if (!g) return res.status(404).json({ error: 'Endereço não encontrado' });
    res.json(g);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/depots', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'Nome é obrigatório' });
    let { lat, lng } = b;
    if ((lat == null || lng == null) && (b.address || b.city)) {
      const g = await geocodeNominatim(b);
      if (g) { lat = g.lat; lng = g.lng; }
    }
    if (b.is_default) await query(`UPDATE smartroute_depots SET is_default=false WHERE organization_id=$1`, [orgId(req)]);
    const r = await query(
      `INSERT INTO smartroute_depots (organization_id, name, address, city, state, zip, lat, lng, is_default, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,false),$10) RETURNING *`,
      [orgId(req), b.name, b.address, b.city, b.state, b.zip, lat, lng, b.is_default, b.notes]);
    res.json(r.rows[0]);
  } catch (e) { logError('smartroute.depots.create', e); res.status(500).json({ error: e.message }); }
});
router.put('/depots/:id', async (req, res) => {
  try {
    const b = req.body || {};
    let { lat, lng } = b;
    if ((lat == null || lng == null) && (b.address || b.city)) {
      const g = await geocodeNominatim(b);
      if (g) { lat = g.lat; lng = g.lng; }
    }
    if (b.is_default) await query(`UPDATE smartroute_depots SET is_default=false WHERE organization_id=$1 AND id<>$2`, [orgId(req), req.params.id]);
    const r = await query(
      `UPDATE smartroute_depots SET name=COALESCE($3,name), address=$4, city=$5, state=$6, zip=$7,
        lat=COALESCE($8,lat), lng=COALESCE($9,lng), is_default=COALESCE($10,is_default), notes=$11, updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.name, b.address, b.city, b.state, b.zip, lat, lng, b.is_default, b.notes]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/depots/:id', async (req, res) => {
  try { await query(`UPDATE smartroute_depots SET active=false WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

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
      `INSERT INTO smartroute_vehicles (organization_id, plate, model, brand, year, capacity_kg, capacity_m3, fuel_type, status, notes, km_per_liter, fuel_price_per_liter)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'ativo'),$10,$11,$12) RETURNING *`,
      [orgId(req), b.plate, b.model, b.brand, b.year || null, b.capacity_kg || 0, b.capacity_m3 || 0, b.fuel_type || 'diesel', b.status, b.notes, b.km_per_liter || null, b.fuel_price_per_liter || null]
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
        fuel_type=COALESCE($9,fuel_type), status=COALESCE($10,status), notes=COALESCE($11,notes),
        km_per_liter=COALESCE($12,km_per_liter), fuel_price_per_liter=COALESCE($13,fuel_price_per_liter), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.plate, b.model, b.brand, b.year, b.capacity_kg, b.capacity_m3, b.fuel_type, b.status, b.notes, b.km_per_liter, b.fuel_price_per_liter]
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
    let { depot_lat, depot_lng } = b;
    let depotId = b.depot_id || null;
    if (!depotId && (depot_lat == null || depot_lng == null)) {
      const d = await query(`SELECT id, lat, lng FROM smartroute_depots WHERE organization_id=$1 AND is_default=true AND active=true LIMIT 1`, [orgId(req)]);
      if (d.rows[0]) { depotId = d.rows[0].id; depot_lat = d.rows[0].lat; depot_lng = d.rows[0].lng; }
    } else if (depotId) {
      const d = await query(`SELECT lat, lng FROM smartroute_depots WHERE id=$1 AND organization_id=$2`, [depotId, orgId(req)]);
      if (d.rows[0]) { depot_lat = d.rows[0].lat; depot_lng = d.rows[0].lng; }
    }
    const r = await query(
      `INSERT INTO smartroute_routes (organization_id, code, driver_id, vehicle_id, planned_date, status, depot_lat, depot_lng, depot_id, notes)
       VALUES ($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),'planejada',$6,$7,$8,$9) RETURNING *`,
      [orgId(req), code, b.driver_id || null, b.vehicle_id || null, b.planned_date || null, depot_lat, depot_lng, depotId, b.notes]
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

// ============ Configurações da Operação (Fluxo Inteligente) ============
router.get('/operation-settings', async (req, res) => {
  try {
    const { getOperationSettings } = await import('../lib/sr-journey.js');
    res.json(await getOperationSettings(orgId(req)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/operation-settings', async (req, res) => {
  try {
    const { upsertOperationSettings } = await import('../lib/sr-journey.js');
    res.json(await upsertOperationSettings(orgId(req), req.body || {}));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ CHECKLISTS CONFIGURÁVEIS (Onda 2) ============
router.get('/checklist-templates', async (req, res) => {
  try {
    const r = await query(
      `SELECT t.*, (SELECT COUNT(*) FROM smartroute_checklist_template_items i WHERE i.template_id=t.id)::int AS items_count
       FROM smartroute_checklist_templates t
       WHERE t.organization_id=$1 ORDER BY t.priority ASC, t.name ASC`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/checklist-templates/:id', async (req, res) => {
  try {
    const t = await query(
      `SELECT * FROM smartroute_checklist_templates WHERE id=$1 AND organization_id=$2`,
      [req.params.id, orgId(req)]);
    if (!t.rows[0]) return res.status(404).json({ error: 'not found' });
    const items = await query(
      `SELECT * FROM smartroute_checklist_template_items WHERE template_id=$1 ORDER BY seq ASC`,
      [req.params.id]);
    const assigns = await query(
      `SELECT * FROM smartroute_checklist_assignments WHERE template_id=$1 AND organization_id=$2`,
      [req.params.id, orgId(req)]);
    res.json({ ...t.rows[0], items: items.rows, assignments: assigns.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/checklist-templates', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_checklist_templates (organization_id, name, description, active, priority)
       VALUES ($1,$2,$3,COALESCE($4,true),COALESCE($5,100)) RETURNING *`,
      [orgId(req), b.name, b.description || null, b.active, b.priority]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/checklist-templates/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_checklist_templates
         SET name=COALESCE($3,name), description=COALESCE($4,description),
             active=COALESCE($5,active), priority=COALESCE($6,priority), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.name, b.description, b.active, b.priority]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/checklist-templates/:id', async (req, res) => {
  try {
    await query(`DELETE FROM smartroute_checklist_templates WHERE id=$1 AND organization_id=$2`,
      [req.params.id, orgId(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Substitui todos os itens do template (edição em lote)
router.put('/checklist-templates/:id/items', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    await query(`DELETE FROM smartroute_checklist_template_items WHERE template_id=$1`, [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await query(
        `INSERT INTO smartroute_checklist_template_items
           (template_id, seq, field_type, label, required, config)
         VALUES ($1,$2,$3,$4,COALESCE($5,true),$6)`,
        [req.params.id, i + 1, it.field_type, it.label, it.required,
          JSON.stringify(it.config || {})]);
    }
    res.json({ ok: true, count: items.length });
  } catch (e) { logError('sr.checklist.items.put', e); res.status(500).json({ error: e.message }); }
});

router.get('/checklist-assignments', async (req, res) => {
  try {
    const r = await query(
      `SELECT a.*, t.name AS template_name
       FROM smartroute_checklist_assignments a
       JOIN smartroute_checklist_templates t ON t.id=a.template_id
       WHERE a.organization_id=$1 ORDER BY a.priority ASC`, [orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/checklist-assignments', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `INSERT INTO smartroute_checklist_assignments
         (organization_id, template_id, scope, priority, active)
       VALUES ($1,$2,$3,COALESCE($4,100),COALESCE($5,true)) RETURNING *`,
      [orgId(req), b.template_id, JSON.stringify(b.scope || {}), b.priority, b.active]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/checklist-assignments/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_checklist_assignments
         SET scope=COALESCE($3,scope), priority=COALESCE($4,priority), active=COALESCE($5,active)
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.scope ? JSON.stringify(b.scope) : null, b.priority, b.active]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/checklist-assignments/:id', async (req, res) => {
  try {
    await query(`DELETE FROM smartroute_checklist_assignments WHERE id=$1 AND organization_id=$2`,
      [req.params.id, orgId(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ REPLAY ENRIQUECIDO (Onda 3) ============
router.get('/routes/:id/journey-events', async (req, res) => {
  try {
    const r = await query(
      `SELECT e.*, s.sequence AS stop_seq, p.name AS pdv_name
       FROM smartroute_journey_events e
       LEFT JOIN smartroute_route_stops s ON s.id=e.stop_id
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       WHERE e.route_id=$1 AND e.organization_id=$2
       ORDER BY e.created_at ASC`, [req.params.id, orgId(req)]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ MÉTRICAS OPERACIONAIS (Onda 3) ============
router.get('/ops-metrics', async (req, res) => {
  try {
    const org = orgId(req);
    const today = new Date().toISOString().slice(0, 10);
    const avg = await query(
      `SELECT AVG(duration_ms)::bigint AS avg_ms, COUNT(*)::int AS n
       FROM smartroute_route_stops s
       JOIN smartroute_routes r ON r.id=s.route_id
       WHERE r.organization_id=$1 AND s.duration_ms IS NOT NULL
         AND r.planned_date >= CURRENT_DATE - INTERVAL '7 days'`, [org]);
    const byState = await query(
      `SELECT state, COUNT(*)::int AS n FROM smartroute_route_stops s
       JOIN smartroute_routes r ON r.id=s.route_id
       WHERE r.organization_id=$1 AND r.planned_date=$2
       GROUP BY state`, [org, today]);
    const occ = await query(
      `SELECT type, COUNT(*)::int AS n FROM smartroute_stop_occurrences
       WHERE organization_id=$1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY type ORDER BY n DESC LIMIT 10`, [org]);
    const failedItems = await query(
      `SELECT i.label, COUNT(*)::int AS n
       FROM smartroute_checklist_template_items i
       LEFT JOIN smartroute_stop_checklist_responses r ON r.item_id=i.id
       WHERE i.required=true AND r.id IS NULL
       GROUP BY i.label ORDER BY n DESC LIMIT 5`);
    res.json({
      avg_stop_ms: avg.rows[0]?.avg_ms || 0,
      stops_today_by_state: byState.rows,
      occurrences_7d: occ.rows,
      checklist_gaps: failedItems.rows,
    });
  } catch (e) { logError('sr.ops-metrics', e); res.status(500).json({ error: e.message }); }
});

// ============ TORRE DE CONTROLE AO VIVO (Onda 3) ============
// Snapshot consolidado: motoristas, paradas ativas, alertas de atraso/GPS, feed de eventos.
router.get('/monitor', async (req, res) => {
  try {
    const org = orgId(req);
    const today = new Date().toISOString().slice(0, 10);
    const staleGpsMin = Number(req.query.stale_gps_min) || 5;
    const stopSlaMin = Number(req.query.stop_sla_min) || 30;
    const routeSlaHrs = Number(req.query.route_sla_hrs) || 12;

    const [drivers, activeStops, events, kpis] = await Promise.all([
      query(
        `SELECT d.id, d.full_name, d.current_lat, d.current_lng, d.current_status, d.last_location_at,
                v.plate, v.model,
                r.id AS route_id, r.code AS route_code, r.status AS route_status,
                r.started_at, r.completed_stops, r.total_stops,
                EXTRACT(EPOCH FROM (NOW() - d.last_location_at))::int AS gps_age_sec,
                EXTRACT(EPOCH FROM (NOW() - r.started_at))::int AS route_age_sec
         FROM smartroute_drivers d
         LEFT JOIN smartroute_vehicles v ON v.id=d.vehicle_id
         LEFT JOIN smartroute_routes r ON r.driver_id=d.id AND r.planned_date=$2 AND r.status IN ('em_andamento','planejada')
         WHERE d.organization_id=$1 AND d.active=true
         ORDER BY (d.current_status='em_rota') DESC, d.full_name`,
        [org, today]
      ),
      query(
        `SELECT s.id, s.sequence, s.state, s.status, s.arrived_at,
                EXTRACT(EPOCH FROM (NOW() - s.arrived_at))::int AS elapsed_sec,
                p.name AS pdv_name, p.address AS pdv_address, p.city AS pdv_city,
                r.id AS route_id, r.code AS route_code,
                d.full_name AS driver_name
         FROM smartroute_route_stops s
         JOIN smartroute_routes r ON r.id=s.route_id
         LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
         LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
         WHERE r.organization_id=$1 AND s.state='em_atendimento'
         ORDER BY s.arrived_at ASC NULLS LAST`,
        [org]
      ),
      query(
        `SELECT e.id, e.event_type, e.created_at, e.payload, e.lat, e.lng,
                r.code AS route_code, d.full_name AS driver_name,
                s.sequence AS stop_seq, p.name AS pdv_name
         FROM smartroute_journey_events e
         LEFT JOIN smartroute_routes r ON r.id=e.route_id
         LEFT JOIN smartroute_drivers d ON d.id=e.driver_id
         LEFT JOIN smartroute_route_stops s ON s.id=e.stop_id
         LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
         WHERE e.organization_id=$1 AND e.created_at >= NOW() - INTERVAL '6 hours'
         ORDER BY e.created_at DESC
         LIMIT 60`,
        [org]
      ),
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM smartroute_drivers WHERE organization_id=$1 AND current_status='em_rota' AND active=true) AS drivers_em_rota,
           (SELECT COUNT(*)::int FROM smartroute_route_stops s JOIN smartroute_routes r ON r.id=s.route_id WHERE r.organization_id=$1 AND s.state='em_atendimento') AS stops_em_atendimento,
           (SELECT COUNT(*)::int FROM smartroute_route_stops s JOIN smartroute_routes r ON r.id=s.route_id WHERE r.organization_id=$1 AND r.planned_date=$2 AND s.status='concluida') AS stops_concluidas_hoje,
           (SELECT COUNT(*)::int FROM smartroute_route_stops s JOIN smartroute_routes r ON r.id=s.route_id WHERE r.organization_id=$1 AND r.planned_date=$2 AND s.status='nao_entregue') AS stops_nao_entregues_hoje,
           (SELECT COUNT(*)::int FROM smartroute_stop_occurrences WHERE organization_id=$1 AND created_at::date=$2) AS occ_hoje`,
        [org, today]
      ),
    ]);

    const alerts = [];
    for (const s of activeStops.rows) {
      if ((s.elapsed_sec || 0) >= stopSlaMin * 60) {
        alerts.push({
          type: 'stop_slow',
          severity: s.elapsed_sec >= stopSlaMin * 120 ? 'high' : 'medium',
          driver_name: s.driver_name, route_code: s.route_code,
          pdv_name: s.pdv_name, stop_id: s.id, route_id: s.route_id,
          message: `Parada em atendimento há ${Math.round(s.elapsed_sec / 60)} min`,
          elapsed_sec: s.elapsed_sec,
        });
      }
    }
    for (const d of drivers.rows) {
      if (d.current_status === 'em_rota' && d.gps_age_sec != null && d.gps_age_sec >= staleGpsMin * 60) {
        alerts.push({
          type: 'stale_gps', severity: d.gps_age_sec >= staleGpsMin * 180 ? 'high' : 'medium',
          driver_name: d.full_name, route_code: d.route_code,
          message: `Sem sinal GPS há ${Math.round(d.gps_age_sec / 60)} min`,
          driver_id: d.id, route_id: d.route_id, elapsed_sec: d.gps_age_sec,
        });
      }
      if (d.route_age_sec != null && d.route_age_sec >= routeSlaHrs * 3600 && d.route_status === 'em_andamento') {
        alerts.push({
          type: 'route_overtime', severity: 'high',
          driver_name: d.full_name, route_code: d.route_code,
          message: `Jornada em andamento há ${(d.route_age_sec / 3600).toFixed(1)}h sem finalizar`,
          driver_id: d.id, route_id: d.route_id, elapsed_sec: d.route_age_sec,
        });
      }
    }
    alerts.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0) || (b.elapsed_sec || 0) - (a.elapsed_sec || 0));

    res.json({
      generated_at: new Date().toISOString(),
      thresholds: { stale_gps_min: staleGpsMin, stop_sla_min: stopSlaMin, route_sla_hrs: routeSlaHrs },
      kpis: kpis.rows[0] || {},
      drivers: drivers.rows,
      active_stops: activeStops.rows,
      alerts,
      recent_events: events.rows,
    });
  } catch (e) { logError('sr.monitor', e); res.status(500).json({ error: e.message }); }
});

// ============ DETALHES DE UMA PARADA (para Replay/Torre) ============
router.get('/stops/:id/summary', async (req, res) => {
  try {
    const org = orgId(req);
    const [stop, checklist, media, occ, ocr] = await Promise.all([
      query(
        `SELECT s.*, p.name AS pdv_name, p.address AS pdv_address, p.city AS pdv_city,
                p.lat AS pdv_lat, p.lng AS pdv_lng,
                r.code AS route_code, d.full_name AS driver_name
         FROM smartroute_route_stops s
         JOIN smartroute_routes r ON r.id=s.route_id
         LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
         LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
         WHERE s.id=$1 AND r.organization_id=$2`, [req.params.id, org]),
      query(
        `SELECT r.*, i.label, i.kind, i.required
         FROM smartroute_stop_checklist_responses r
         JOIN smartroute_checklist_template_items i ON i.id=r.item_id
         WHERE r.stop_id=$1 ORDER BY i.seq ASC`, [req.params.id]),
      query(
        `SELECT id, kind, url, created_at FROM smartroute_stop_media
         WHERE stop_id=$1 ORDER BY created_at ASC`, [req.params.id]),
      query(
        `SELECT * FROM smartroute_stop_occurrences WHERE stop_id=$1 ORDER BY created_at ASC`, [req.params.id]),
      query(
        `SELECT * FROM smartroute_stop_ocr_results WHERE stop_id=$1 ORDER BY created_at ASC`, [req.params.id]),
    ]);
    if (!stop.rows[0]) return res.status(404).json({ error: 'Parada não encontrada' });
    res.json({
      stop: stop.rows[0],
      checklist: checklist.rows,
      media: media.rows,
      occurrences: occ.rows,
      ocr: ocr.rows,
    });
  } catch (e) { logError('sr.stop.summary', e); res.status(500).json({ error: e.message }); }
});


// ============ ONDA 4 — OCORRÊNCIAS & SLA ============

// Seed default types for org if empty
async function ensureDefaultOccurrenceTypes(org) {
  const r = await query(`SELECT COUNT(*)::int AS n FROM smartroute_occurrence_types WHERE organization_id=$1`, [org]);
  if ((r.rows[0]?.n || 0) > 0) return;
  const seeds = [
    ['danificado', 'Produto danificado', 'high', 120, true, true, true, '#ef4444'],
    ['vencido', 'Produto vencido', 'high', 60, true, true, true, '#dc2626'],
    ['recusado', 'Recusa de recebimento', 'medium', 60, true, true, false, '#f59e0b'],
    ['cliente_ausente', 'Cliente ausente', 'medium', 30, true, false, false, '#f97316'],
    ['cliente_fechado', 'Estabelecimento fechado', 'medium', 30, true, false, false, '#f97316'],
    ['divergencia_nota', 'Divergência na nota fiscal', 'high', 90, true, true, true, '#dc2626'],
    ['avaria_transporte', 'Avaria em transporte', 'high', 120, true, true, false, '#b91c1c'],
    ['atraso', 'Atraso na entrega', 'low', 240, false, true, false, '#eab308'],
    ['equipamento', 'Problema com equipamento (freezer/rack)', 'medium', 180, true, true, false, '#8b5cf6'],
    ['outro', 'Outro', 'low', 240, false, true, false, '#6b7280'],
  ];
  for (const [code, label, severity, sla, ph, desc, blocks, color] of seeds) {
    await query(
      `INSERT INTO smartroute_occurrence_types
         (organization_id, code, label, severity, sla_target_min, require_photo, require_description, blocks_checkout, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (organization_id, code) DO NOTHING`,
      [org, code, label, severity, sla, ph, desc, blocks, color]);
  }
}

// ----- Catálogo de tipos
router.get('/occurrence-types', async (req, res) => {
  try {
    const org = orgId(req);
    await ensureDefaultOccurrenceTypes(org);
    const r = await query(
      `SELECT * FROM smartroute_occurrence_types WHERE organization_id=$1 ORDER BY active DESC, label`, [org]);
    res.json(r.rows);
  } catch (e) { logError('sr.occ-types.list', e); res.status(500).json({ error: e.message }); }
});

router.post('/occurrence-types', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.label) return res.status(400).json({ error: 'code e label são obrigatórios' });
    const r = await query(
      `INSERT INTO smartroute_occurrence_types
        (organization_id, code, label, description, severity, sla_target_min, require_photo, require_description, blocks_checkout, color, icon, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,true))
       RETURNING *`,
      [orgId(req), b.code, b.label, b.description || null, b.severity || 'medium',
       b.sla_target_min ?? 60, b.require_photo ?? true, b.require_description ?? true,
       b.blocks_checkout ?? false, b.color || '#f59e0b', b.icon || 'alert-triangle', b.active]);
    res.json(r.rows[0]);
  } catch (e) { logError('sr.occ-types.create', e); res.status(500).json({ error: e.message }); }
});

router.put('/occurrence-types/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE smartroute_occurrence_types SET
         label=COALESCE($3,label), description=COALESCE($4,description),
         severity=COALESCE($5,severity), sla_target_min=COALESCE($6,sla_target_min),
         require_photo=COALESCE($7,require_photo), require_description=COALESCE($8,require_description),
         blocks_checkout=COALESCE($9,blocks_checkout), color=COALESCE($10,color),
         icon=COALESCE($11,icon), active=COALESCE($12,active), updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, orgId(req), b.label, b.description, b.severity, b.sla_target_min,
       b.require_photo, b.require_description, b.blocks_checkout, b.color, b.icon, b.active]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Tipo não encontrado' });
    res.json(r.rows[0]);
  } catch (e) { logError('sr.occ-types.update', e); res.status(500).json({ error: e.message }); }
});

router.delete('/occurrence-types/:id', async (req, res) => {
  try {
    await query(`UPDATE smartroute_occurrence_types SET active=false, updated_at=NOW()
                 WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId(req)]);
    res.json({ ok: true });
  } catch (e) { logError('sr.occ-types.delete', e); res.status(500).json({ error: e.message }); }
});

// ----- Listagem/filtro de ocorrências
router.get('/occurrences', async (req, res) => {
  try {
    const org = orgId(req);
    const { status, type, severity, driver_id, from, to, sla, q, limit } = req.query;
    const where = ['o.organization_id=$1'];
    const params = [org];
    let i = 2;
    if (status)   { where.push(`o.status=$${i++}`); params.push(status); }
    if (type)     { where.push(`o.type=$${i++}`); params.push(type); }
    if (severity) { where.push(`o.severity=$${i++}`); params.push(severity); }
    if (driver_id){ where.push(`o.driver_id=$${i++}`); params.push(driver_id); }
    if (from)     { where.push(`o.created_at >= $${i++}`); params.push(from); }
    if (to)       { where.push(`o.created_at <= $${i++}`); params.push(to); }
    if (sla === 'breached')  where.push(`o.sla_breached=true`);
    if (sla === 'in_sla')    where.push(`o.sla_breached=false`);
    if (q) { where.push(`(o.description ILIKE $${i} OR p.name ILIKE $${i})`); params.push(`%${q}%`); i++; }

    const lim = Math.min(Number(limit) || 200, 500);
    const r = await query(
      `SELECT o.*, p.name AS pdv_name, p.city AS pdv_city,
              r.code AS route_code, d.full_name AS driver_name, s.sequence AS stop_seq,
              CASE WHEN o.status IN ('aberta','em_analise') AND o.sla_deadline_at IS NOT NULL
                     AND o.sla_deadline_at < NOW() THEN true ELSE o.sla_breached END AS sla_breached_now,
              GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(o.resolved_at, NOW()) - o.created_at))/60)::int AS age_min
         FROM smartroute_stop_occurrences o
         LEFT JOIN smartroute_route_stops s ON s.id=o.stop_id
         LEFT JOIN smartroute_routes r ON r.id=s.route_id
         LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
         LEFT JOIN smartroute_drivers d ON d.id=o.driver_id
         WHERE ${where.join(' AND ')}
         ORDER BY o.created_at DESC
         LIMIT ${lim}`,
      params);
    res.json(r.rows);
  } catch (e) { logError('sr.occ.list', e); res.status(500).json({ error: e.message }); }
});

router.get('/occurrences/:id', async (req, res) => {
  try {
    const org = orgId(req);
    const [occ, media, comments, stop] = await Promise.all([
      query(
        `SELECT o.*, p.name AS pdv_name, p.address AS pdv_address, p.city AS pdv_city,
                r.code AS route_code, d.full_name AS driver_name
           FROM smartroute_stop_occurrences o
           LEFT JOIN smartroute_route_stops s ON s.id=o.stop_id
           LEFT JOIN smartroute_routes r ON r.id=s.route_id
           LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
           LEFT JOIN smartroute_drivers d ON d.id=o.driver_id
           WHERE o.id=$1 AND o.organization_id=$2`, [req.params.id, org]),
      query(
        `SELECT id, kind, url, created_at FROM smartroute_stop_media
           WHERE id = ANY(
             SELECT UNNEST(media_ids) FROM smartroute_stop_occurrences WHERE id=$1
           ) OR stop_id = (SELECT stop_id FROM smartroute_stop_occurrences WHERE id=$1)
           ORDER BY created_at ASC`, [req.params.id]),
      query(
        `SELECT * FROM smartroute_occurrence_comments
           WHERE occurrence_id=$1 ORDER BY created_at ASC`, [req.params.id]),
      query(
        `SELECT s.id, s.sequence, s.state, s.status, s.arrived_at, s.checkin_at, s.completed_at
           FROM smartroute_route_stops s
           JOIN smartroute_stop_occurrences o ON o.stop_id=s.id
           WHERE o.id=$1`, [req.params.id]),
    ]);
    if (!occ.rows[0]) return res.status(404).json({ error: 'Ocorrência não encontrada' });
    res.json({ occurrence: occ.rows[0], media: media.rows, comments: comments.rows, stop: stop.rows[0] || null });
  } catch (e) { logError('sr.occ.detail', e); res.status(500).json({ error: e.message }); }
});

// Update status / atribuição / resolução
router.put('/occurrences/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const setResolved = b.status === 'resolvida' || b.status === 'descartada';
    const r = await query(
      `UPDATE smartroute_stop_occurrences SET
         status = COALESCE($3, status),
         severity = COALESCE($4, severity),
         assigned_to = COALESCE($5, assigned_to),
         assigned_at = CASE WHEN $5 IS NOT NULL AND assigned_at IS NULL THEN NOW() ELSE assigned_at END,
         resolution = COALESCE($6, resolution),
         resolved_by = CASE WHEN $7::boolean THEN COALESCE($8, resolved_by) ELSE resolved_by END,
         resolved_at = CASE WHEN $7::boolean AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
         sla_breached = CASE
             WHEN $7::boolean AND sla_deadline_at IS NOT NULL AND NOW() > sla_deadline_at THEN true
             WHEN $7::boolean THEN false
             ELSE sla_breached
         END,
         updated_at = NOW()
       WHERE id=$1 AND organization_id=$2
       RETURNING *`,
      [req.params.id, orgId(req), b.status, b.severity, b.assigned_to || null,
       b.resolution || null, setResolved, req.user?.id || null]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Ocorrência não encontrada' });
    if (b.comment) {
      await query(
        `INSERT INTO smartroute_occurrence_comments (occurrence_id, organization_id, author_id, author_name, body)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, orgId(req), req.user?.id || null, req.user?.name || req.user?.email || 'Sistema', b.comment]);
    }
    res.json(r.rows[0]);
  } catch (e) { logError('sr.occ.update', e); res.status(500).json({ error: e.message }); }
});

router.post('/occurrences/:id/comments', async (req, res) => {
  try {
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ error: 'body obrigatório' });
    const r = await query(
      `INSERT INTO smartroute_occurrence_comments (occurrence_id, organization_id, author_id, author_name, body)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, orgId(req), req.user?.id || null, req.user?.name || req.user?.email || 'Sistema', body]);
    res.json(r.rows[0]);
  } catch (e) { logError('sr.occ.comment', e); res.status(500).json({ error: e.message }); }
});

// Marca SLA vencido em lote (útil chamar via cron/refresh do frontend)
router.post('/occurrences/refresh-sla', async (req, res) => {
  try {
    const r = await query(
      `UPDATE smartroute_stop_occurrences
         SET sla_breached=true, updated_at=NOW()
       WHERE organization_id=$1 AND status IN ('aberta','em_analise')
         AND sla_deadline_at IS NOT NULL AND sla_deadline_at < NOW()
         AND sla_breached=false
       RETURNING id`, [orgId(req)]);
    res.json({ updated: r.rowCount });
  } catch (e) { logError('sr.occ.refresh-sla', e); res.status(500).json({ error: e.message }); }
});

// ----- Métricas de SLA
router.get('/sla-metrics', async (req, res) => {
  try {
    const org = orgId(req);
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 180));
    const since = `CURRENT_DATE - INTERVAL '${days} days'`;

    const [totals, byStatus, bySeverity, byType, mttr, topDrivers, stageAvg, trend] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status IN ('aberta','em_analise'))::int AS abertas,
           COUNT(*) FILTER (WHERE status='resolvida')::int AS resolvidas,
           COUNT(*) FILTER (WHERE status='descartada')::int AS descartadas,
           COUNT(*) FILTER (WHERE sla_breached=true OR (status IN ('aberta','em_analise') AND sla_deadline_at < NOW()))::int AS breached,
           COUNT(*) FILTER (WHERE severity='high')::int AS high_severity
         FROM smartroute_stop_occurrences
         WHERE organization_id=$1 AND created_at >= ${since}`, [org]),
      query(
        `SELECT status, COUNT(*)::int AS n FROM smartroute_stop_occurrences
         WHERE organization_id=$1 AND created_at >= ${since}
         GROUP BY status`, [org]),
      query(
        `SELECT severity, COUNT(*)::int AS n FROM smartroute_stop_occurrences
         WHERE organization_id=$1 AND created_at >= ${since}
         GROUP BY severity`, [org]),
      query(
        `SELECT o.type,
                COALESCE(t.label, o.type) AS label,
                COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE o.sla_breached=true)::int AS breached
         FROM smartroute_stop_occurrences o
         LEFT JOIN smartroute_occurrence_types t ON t.organization_id=o.organization_id AND t.code=o.type
         WHERE o.organization_id=$1 AND o.created_at >= ${since}
         GROUP BY o.type, t.label ORDER BY n DESC LIMIT 10`, [org]),
      query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60)::int AS mttr_min
         FROM smartroute_stop_occurrences
         WHERE organization_id=$1 AND status='resolvida' AND created_at >= ${since}`, [org]),
      query(
        `SELECT d.id, d.full_name, COUNT(o.*)::int AS n,
                COUNT(*) FILTER (WHERE o.sla_breached=true)::int AS breached
         FROM smartroute_stop_occurrences o
         JOIN smartroute_drivers d ON d.id=o.driver_id
         WHERE o.organization_id=$1 AND o.created_at >= ${since}
         GROUP BY d.id, d.full_name ORDER BY n DESC LIMIT 10`, [org]),
      query(
        `SELECT
           AVG(EXTRACT(EPOCH FROM (s.checkin_at - s.arrived_at)))::int AS avg_arrival_to_checkin_sec,
           AVG(EXTRACT(EPOCH FROM (s.completed_at - s.checkin_at)))::int AS avg_service_sec,
           AVG(EXTRACT(EPOCH FROM (s.completed_at - s.arrived_at)))::int AS avg_total_sec,
           COUNT(*)::int AS stops
         FROM smartroute_route_stops s
         JOIN smartroute_routes r ON r.id=s.route_id
         WHERE r.organization_id=$1 AND r.planned_date >= ${since}
           AND s.arrived_at IS NOT NULL AND s.completed_at IS NOT NULL`, [org]),
      query(
        `SELECT date_trunc('day', created_at)::date AS d,
                COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE sla_breached=true)::int AS breached
         FROM smartroute_stop_occurrences
         WHERE organization_id=$1 AND created_at >= ${since}
         GROUP BY d ORDER BY d ASC`, [org]),
    ]);

    const t = totals.rows[0] || {};
    const sla_compliance = t.total > 0 ? Math.round(((t.total - t.breached) / t.total) * 100) : 100;

    res.json({
      period_days: days,
      totals: { ...t, sla_compliance_pct: sla_compliance },
      by_status: byStatus.rows,
      by_severity: bySeverity.rows,
      top_types: byType.rows,
      top_drivers: topDrivers.rows,
      mttr_min: mttr.rows[0]?.mttr_min || 0,
      stage_avg: stageAvg.rows[0] || {},
      trend: trend.rows,
    });
  } catch (e) { logError('sr.sla.metrics', e); res.status(500).json({ error: e.message }); }
});

export default router;




