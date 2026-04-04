import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();

// ===== Helper =====
async function getOrgId(userId) {
  const r = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [userId]);
  return r.rows[0]?.organization_id;
}

async function ensureTables() {
  await query(`CREATE TABLE IF NOT EXISTS price_research_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT false, frequency VARCHAR(20) DEFAULT 'weekly', preferred_weekday INTEGER DEFAULT 1,
    preferred_time TIME, require_photo BOOLEAN DEFAULT false, require_justification BOOLEAN DEFAULT true,
    block_route_completion BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, brand_id))`);
  // Add name/description/scheduled_date/schedule_dates to rules
  try { await query('ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS name VARCHAR(255)'); } catch {}
  try { await query('ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS description TEXT'); } catch {}
  try { await query('ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS scheduled_date DATE'); } catch {}
  try { await query('ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS schedule_dates JSONB'); } catch {}
  try { await query('ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS shared_with_brand BOOLEAN DEFAULT false'); } catch {}
  try { await query('ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS validated BOOLEAN DEFAULT false'); } catch {}
  await query(`CREATE TABLE IF NOT EXISTS price_research_brand_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    competitor_name VARCHAR(255) NOT NULL, category VARCHAR(100), active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    product_id UUID NOT NULL, enabled BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(brand_id, product_id))`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_competitor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), mapping_id UUID NOT NULL, competitor_id UUID NOT NULL,
    competitor_product_name VARCHAR(255) NOT NULL, category VARCHAR(100), subcategory VARCHAR(100),
    unit_measure VARCHAR(50), photo_url TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())`);
  try { await query('ALTER TABLE price_research_competitor_products ADD COLUMN IF NOT EXISTS photo_url TEXT'); } catch {}
  try { await query("ALTER TABLE price_research_rules DROP CONSTRAINT IF EXISTS price_research_rules_frequency_check"); } catch {}
  // Drop unique constraint to allow multiple models per brand
  try { await query("ALTER TABLE price_research_rules DROP CONSTRAINT IF EXISTS price_research_rules_organization_id_brand_id_key"); } catch {}
  await query(`CREATE TABLE IF NOT EXISTS price_research_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, schedule_id UUID,
    route_id UUID, brand_id UUID NOT NULL, pdv_id UUID, promoter_id UUID,
    rule_id UUID, status VARCHAR(30) DEFAULT 'pending', progress_pct NUMERIC(5,2) DEFAULT 0, total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  try { await query('ALTER TABLE price_research_executions ADD COLUMN IF NOT EXISTS rule_id UUID'); } catch {}
  try { await query('ALTER TABLE price_research_executions ALTER COLUMN route_id DROP NOT NULL'); } catch {}
  try { await query('ALTER TABLE price_research_executions ALTER COLUMN pdv_id DROP NOT NULL'); } catch {}
  try { await query('ALTER TABLE price_research_executions ALTER COLUMN promoter_id DROP NOT NULL'); } catch {}
  await query(`CREATE TABLE IF NOT EXISTS price_research_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), execution_id UUID NOT NULL, product_id UUID NOT NULL,
    price NUMERIC(10,2), observation TEXT, collected_at TIMESTAMPTZ, collected_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_item_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_id UUID NOT NULL, competitor_product_id UUID,
    competitor_id UUID, competitor_product_name VARCHAR(255), competitor_brand_name VARCHAR(255),
    price NUMERIC(10,2), observation TEXT, collected_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), execution_id UUID NOT NULL, item_id UUID,
    photo_url TEXT NOT NULL, photo_type VARCHAR(30) DEFAULT 'evidence', latitude NUMERIC(10,7),
    longitude NUMERIC(10,7), watermark_applied BOOLEAN DEFAULT false,
    captured_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_postponements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id UUID NOT NULL, route_id UUID NOT NULL,
    reason TEXT NOT NULL, observation TEXT, next_route_id UUID, postponed_by UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_justifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id UUID, route_id UUID,
    reason VARCHAR(255) NOT NULL, observation TEXT, next_route_date DATE, justified_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW())`);
  await query(`CREATE TABLE IF NOT EXISTS price_research_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    pdv_id UUID NOT NULL, promoter_id UUID NOT NULL, route_id UUID, week_start DATE NOT NULL,
    week_end DATE NOT NULL, preferred_date DATE, status VARCHAR(30) DEFAULT 'pending',
    is_last_route_of_week BOOLEAN DEFAULT false, is_mandatory BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
}

// ===== ADMIN: Rules =====
router.get('/rules', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id } = req.query;
    let sql = `SELECT r.*, b.name as brand_name,
      (SELECT COUNT(*) FROM price_research_product_mappings pm WHERE pm.brand_id = r.brand_id AND pm.enabled = true) as products_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id) as executions_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status IN ('completed','validated')) as completed_count
      FROM price_research_rules r
      LEFT JOIN merch_brands b ON b.id = r.brand_id WHERE r.organization_id = $1`;
    const params = [orgId];
    if (brand_id) { sql += ' AND r.brand_id = $2'; params.push(brand_id); }
    sql += ' ORDER BY r.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { logError('price-research.rules.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/rules', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { id, brand_id, name, description, enabled, frequency, preferred_weekday, preferred_time, require_photo, require_justification, block_route_completion, scheduled_date, schedule_dates } = req.body;
    let result;
    if (id) {
      // Update existing
      result = await query(
        `UPDATE price_research_rules SET name=COALESCE($1,name), description=$2, enabled=$3, frequency=$4,
         preferred_weekday=$5, preferred_time=$6, require_photo=$7, require_justification=$8,
         block_route_completion=$9, scheduled_date=$10, schedule_dates=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [name, description, enabled ?? false, frequency ?? 'weekly', preferred_weekday ?? 1, preferred_time, require_photo ?? false, require_justification ?? true, block_route_completion ?? false, scheduled_date, schedule_dates ? JSON.stringify(schedule_dates) : null, id]
      );
    } else {
      result = await query(
        `INSERT INTO price_research_rules (organization_id, brand_id, name, description, enabled, frequency, preferred_weekday, preferred_time, require_photo, require_justification, block_route_completion, scheduled_date, schedule_dates)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [orgId, brand_id, name || 'Pesquisa de Preços', description, enabled ?? false, frequency ?? 'weekly', preferred_weekday ?? 1, preferred_time, require_photo ?? false, require_justification ?? true, block_route_completion ?? false, scheduled_date, schedule_dates ? JSON.stringify(schedule_dates) : null]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { logError('price-research.rules.upsert', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Competitors =====
router.get('/competitors', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id } = req.query;
    let sql = 'SELECT * FROM price_research_brand_competitors WHERE organization_id = $1';
    const params = [orgId];
    if (brand_id) { sql += ' AND brand_id = $2'; params.push(brand_id); }
    sql += ' ORDER BY competitor_name';
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('price-research.competitors.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/competitors', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    const { brand_id, competitor_name, category } = req.body;
    const r = await query('INSERT INTO price_research_brand_competitors (organization_id, brand_id, competitor_name, category) VALUES ($1,$2,$3,$4) RETURNING *', [orgId, brand_id, competitor_name, category]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitors.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/competitors/:id', authenticate, async (req, res) => {
  try {
    const { competitor_name, category, active } = req.body;
    const r = await query('UPDATE price_research_brand_competitors SET competitor_name=COALESCE($1,competitor_name), category=COALESCE($2,category), active=COALESCE($3,active) WHERE id=$4 RETURNING *', [competitor_name, category, active, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitors.update', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/competitors/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_brand_competitors WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.competitors.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Product Mappings =====
router.get('/product-mappings', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    const { brand_id } = req.query;

    // Check which columns exist on products table to avoid errors
    let productCols = 'p.name as product_name, p.sku';
    try {
      const colCheck = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name IN ('photo_url','description')`);
      const existing = colCheck.rows.map(r => r.column_name);
      if (existing.includes('photo_url')) productCols += ', p.photo_url';
      if (existing.includes('description')) productCols += ', p.description';
    } catch {}

    let sql = `SELECT pm.*, ${productCols} FROM price_research_product_mappings pm
               LEFT JOIN products p ON p.id = pm.product_id WHERE pm.organization_id = $1`;
    const params = [orgId];
    if (brand_id) { sql += ' AND pm.brand_id = $2'; params.push(brand_id); }
    sql += ' ORDER BY p.name';
    const mappings = (await query(sql, params)).rows;
    // Load competitor products for each mapping
    if (mappings.length > 0) {
      const mapIds = mappings.map(m => m.id);
      const cpRes = await query(`SELECT cp.*, c.competitor_name FROM price_research_competitor_products cp
        LEFT JOIN price_research_brand_competitors c ON c.id = cp.competitor_id
        WHERE cp.mapping_id = ANY($1) ORDER BY c.competitor_name, cp.competitor_product_name`, [mapIds]);
      const cpMap = {};
      for (const cp of cpRes.rows) { if (!cpMap[cp.mapping_id]) cpMap[cp.mapping_id] = []; cpMap[cp.mapping_id].push(cp); }
      for (const m of mappings) m.competitor_products = cpMap[m.id] || [];
    }
    res.json(mappings);
  } catch (err) { logError('price-research.mappings.list', err); res.status(500).json({ error: err.message || 'Erro' }); }
});

router.post('/product-mappings', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    const { brand_id, product_id } = req.body;
    const r = await query('INSERT INTO price_research_product_mappings (organization_id, brand_id, product_id) VALUES ($1,$2,$3) ON CONFLICT (brand_id, product_id) DO UPDATE SET enabled=true RETURNING *', [orgId, brand_id, product_id]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.mappings.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/product-mappings/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_product_mappings WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.mappings.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Competitor Products =====
router.post('/competitor-products', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { mapping_id, competitor_id, competitor_product_name, category, subcategory, unit_measure, photo_url } = req.body;
    const r = await query('INSERT INTO price_research_competitor_products (mapping_id, competitor_id, competitor_product_name, category, subcategory, unit_measure, photo_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [mapping_id, competitor_id, competitor_product_name, category, subcategory, unit_measure, photo_url]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitor-products.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/competitor-products/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_competitor_products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.competitor-products.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Executions / Dashboard =====
router.get('/executions', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id, pdv_id, promoter_id, status, date_from, date_to } = req.query;
    let sql = `SELECT e.*, b.name as brand_name, p.name as pdv_name, emp.full_name as promoter_name
               FROM price_research_executions e
               LEFT JOIN merch_brands b ON b.id = e.brand_id
               LEFT JOIN pdvs p ON p.id = e.pdv_id
               LEFT JOIN employees emp ON emp.id = e.promoter_id
               WHERE e.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (brand_id) { sql += ` AND e.brand_id = $${idx++}`; params.push(brand_id); }
    if (pdv_id) { sql += ` AND e.pdv_id = $${idx++}`; params.push(pdv_id); }
    if (promoter_id) { sql += ` AND e.promoter_id = $${idx++}`; params.push(promoter_id); }
    if (status) { sql += ` AND e.status = $${idx++}`; params.push(status); }
    if (date_from) { sql += ` AND e.created_at >= $${idx++}`; params.push(date_from); }
    if (date_to) { sql += ` AND e.created_at <= $${idx++}`; params.push(date_to + 'T23:59:59'); }
    sql += ' ORDER BY e.created_at DESC LIMIT 500';
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('price-research.executions.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.get('/executions/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const exec = (await query(`SELECT e.*, b.name as brand_name, p.name as pdv_name, emp.full_name as promoter_name
      FROM price_research_executions e LEFT JOIN merch_brands b ON b.id = e.brand_id
      LEFT JOIN pdvs p ON p.id = e.pdv_id LEFT JOIN employees emp ON emp.id = e.promoter_id
      WHERE e.id = $1`, [req.params.id])).rows[0];
    if (!exec) return res.status(404).json({ error: 'Não encontrado' });
    // Items with competitors
    const items = (await query(`SELECT i.*, p.name as product_name, p.photo_url, p.description FROM price_research_items i
      LEFT JOIN products p ON p.id = i.product_id WHERE i.execution_id = $1 ORDER BY p.name`, [exec.id])).rows;
    for (const item of items) {
      item.competitors = (await query(`SELECT ic.*, cp.photo_url FROM price_research_item_competitors ic
        LEFT JOIN price_research_competitor_products cp ON cp.id = ic.competitor_product_id
        WHERE ic.item_id = $1 ORDER BY ic.competitor_brand_name`, [item.id])).rows;
    }
    exec.items = items;
    exec.photos = (await query('SELECT * FROM price_research_photos WHERE execution_id = $1 ORDER BY created_at', [exec.id])).rows;
    res.json(exec);
  } catch (err) { logError('price-research.executions.detail', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Dashboard Stats =====
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id, date_from, date_to } = req.query;
    let dateFilter = '';
    const params = [orgId];
    let idx = 2;
    if (brand_id) { dateFilter += ` AND brand_id = $${idx++}`; params.push(brand_id); }
    if (date_from) { dateFilter += ` AND created_at >= $${idx++}`; params.push(date_from); }
    if (date_to) { dateFilter += ` AND created_at <= $${idx++}`; params.push(date_to + 'T23:59:59'); }

    const stats = (await query(`SELECT
      COUNT(*) FILTER (WHERE status='pending') as pending,
      COUNT(*) FILTER (WHERE status='completed') as completed,
      COUNT(*) FILTER (WHERE status='postponed') as postponed,
      COUNT(*) FILTER (WHERE status='expired') as expired,
      COUNT(*) as total
      FROM price_research_executions WHERE organization_id = $1 ${dateFilter}`, params)).rows[0];

    // Average prices per product (top 20)
    const avgPrices = (await query(`SELECT i.product_id, p.name as product_name, AVG(i.price) as avg_price,
      MIN(i.price) as min_price, MAX(i.price) as max_price, COUNT(*) as collections
      FROM price_research_items i
      JOIN price_research_executions e ON e.id = i.execution_id
      LEFT JOIN products p ON p.id = i.product_id
      WHERE e.organization_id = $1 AND i.price IS NOT NULL ${dateFilter.replace(/brand_id/g, 'e.brand_id').replace(/created_at/g, 'e.created_at')}
      GROUP BY i.product_id, p.name ORDER BY collections DESC LIMIT 20`, params)).rows;

    res.json({ stats, avgPrices });
  } catch (err) { logError('price-research.dashboard', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== PROMOTOR: Get research for route =====
router.get('/route/:routeId', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { routeId } = req.params;
    // Get existing execution or check if brand has research enabled
    let exec = (await query('SELECT * FROM price_research_executions WHERE route_id = $1', [routeId])).rows;
    if (exec.length > 0) {
      for (const e of exec) {
        e.items = (await query(`SELECT i.*, p.name as product_name, p.photo_url, p.description FROM price_research_items i
          LEFT JOIN products p ON p.id = i.product_id WHERE i.execution_id = $1 ORDER BY p.name`, [e.id])).rows;
        for (const item of e.items) {
          item.competitors = (await query(`SELECT ic.*, cp.photo_url FROM price_research_item_competitors ic
            LEFT JOIN price_research_competitor_products cp ON cp.id = ic.competitor_product_id
            WHERE ic.item_id = $1`, [item.id])).rows;
        }
        e.photos = (await query('SELECT * FROM price_research_photos WHERE execution_id = $1', [e.id])).rows;
      }
      return res.json(exec);
    }
    // Check route brands with active research rules
    const route = (await query('SELECT * FROM merch_routes WHERE id = $1', [routeId])).rows[0];
    if (!route) return res.json([]);
    // Get brands for this route (single or multi-brand)
    let brandIds = [];
    if (route.brand_id) { brandIds = [route.brand_id]; }
    else {
      const rb = (await query('SELECT brand_id FROM route_brands WHERE route_id = $1', [routeId])).rows;
      brandIds = rb.map(r => r.brand_id);
    }
    if (brandIds.length === 0) return res.json([]);
    // Check which brands have research enabled
    const rules = (await query('SELECT * FROM price_research_rules WHERE brand_id = ANY($1) AND enabled = true', [brandIds])).rows;
    const result = [];
    for (const rule of rules) {
      // Load mapped products with photos and competitor products
      const mappings = (await query(`SELECT pm.*, p.name as product_name, p.photo_url, p.description
        FROM price_research_product_mappings pm LEFT JOIN products p ON p.id = pm.product_id
        WHERE pm.brand_id = $1 AND pm.enabled = true ORDER BY p.name`, [rule.brand_id])).rows;
      const items = [];
      for (const m of mappings) {
        const compProducts = (await query(`SELECT cp.*, c.competitor_name as competitor_brand_name
          FROM price_research_competitor_products cp
          LEFT JOIN price_research_brand_competitors c ON c.id = cp.competitor_id
          WHERE cp.mapping_id = $1 AND cp.active = true ORDER BY c.competitor_name`, [m.id])).rows;
        items.push({
          product_id: m.product_id,
          product_name: m.product_name,
          photo_url: m.photo_url,
          description: m.description,
          price: null,
          competitors: compProducts.map(cp => ({
            competitor_product_id: cp.id,
            competitor_id: cp.competitor_id,
            competitor_product_name: cp.competitor_product_name,
            competitor_brand_name: cp.competitor_brand_name,
            photo_url: cp.photo_url,
            price: null,
          })),
        });
      }
      result.push({ brand_id: rule.brand_id, rule, status: 'not_started', items, photos: [] });
    }
    res.json(result);
  } catch (err) { logError('price-research.route', err); if (err.code === '42P01') return res.json([]); res.status(500).json({ error: 'Erro' }); }
});

// ===== PROMOTOR: Start/save execution =====
router.post('/execute', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { route_id, brand_id, pdv_id, promoter_id, items, photos } = req.body;
    const orgRes = await query('SELECT organization_id FROM merch_routes WHERE id = $1', [route_id]);
    const orgId = orgRes.rows[0]?.organization_id;
    if (!orgId) return res.status(404).json({ error: 'Rota não encontrada' });

    // Upsert execution
    let exec = (await query('SELECT * FROM price_research_executions WHERE route_id = $1 AND brand_id = $2', [route_id, brand_id])).rows[0];
    if (!exec) {
      exec = (await query(`INSERT INTO price_research_executions (organization_id, route_id, brand_id, pdv_id, promoter_id, status, started_at)
        VALUES ($1,$2,$3,$4,$5,'in_progress',NOW()) RETURNING *`, [orgId, route_id, brand_id, pdv_id, promoter_id])).rows[0];
    }

    // Save items
    let completedCount = 0;
    const totalCount = items?.length || 0;
    for (const item of (items || [])) {
      let existingItem = (await query('SELECT id FROM price_research_items WHERE execution_id = $1 AND product_id = $2', [exec.id, item.product_id])).rows[0];
      if (existingItem) {
        await query('UPDATE price_research_items SET price=$1, observation=$2, collected_at=NOW(), updated_at=NOW() WHERE id=$3',
          [item.price, item.observation, existingItem.id]);
        existingItem = { id: existingItem.id };
      } else {
        existingItem = (await query('INSERT INTO price_research_items (execution_id, product_id, price, observation, collected_at, collected_by) VALUES ($1,$2,$3,$4,NOW(),$5) RETURNING id',
          [exec.id, item.product_id, item.price, item.observation, promoter_id])).rows[0];
      }
      if (item.price !== null && item.price !== undefined) completedCount++;
      // Save competitor prices
      if (item.competitors) {
        await query('DELETE FROM price_research_item_competitors WHERE item_id = $1', [existingItem.id]);
        for (const comp of item.competitors) {
          await query(`INSERT INTO price_research_item_competitors (item_id, competitor_product_id, competitor_id, competitor_product_name, competitor_brand_name, price, observation, collected_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
            [existingItem.id, comp.competitor_product_id, comp.competitor_id, comp.competitor_product_name, comp.competitor_brand_name, comp.price, comp.observation]);
        }
      }
    }

    // Save photos
    for (const photo of (photos || [])) {
      await query('INSERT INTO price_research_photos (execution_id, item_id, photo_url, photo_type, latitude, longitude, watermark_applied) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [exec.id, photo.item_id, photo.photo_url, photo.photo_type || 'evidence', photo.latitude, photo.longitude, photo.watermark_applied ?? false]);
    }

    // Update progress
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isComplete = completedCount === totalCount && totalCount > 0;
    await query('UPDATE price_research_executions SET progress_pct=$1, total_items=$2, completed_items=$3, status=$4, completed_at=$5, updated_at=NOW() WHERE id=$6',
      [progressPct, totalCount, completedCount, isComplete ? 'completed' : 'in_progress', isComplete ? new Date() : null, exec.id]);

    res.json({ id: exec.id, progress_pct: progressPct, status: isComplete ? 'completed' : 'in_progress' });
  } catch (err) { logError('price-research.execute', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== PROMOTOR: Postpone =====
router.post('/postpone', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { schedule_id, route_id, reason, observation, next_route_id, postponed_by } = req.body;
    const r = await query('INSERT INTO price_research_postponements (schedule_id, route_id, reason, observation, next_route_id, postponed_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [schedule_id, route_id, reason, observation, next_route_id, postponed_by]);
    if (schedule_id) {
      await query("UPDATE price_research_schedules SET status='postponed', updated_at=NOW() WHERE id=$1", [schedule_id]);
    }
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.postpone', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== PROMOTOR: Justify =====
router.post('/justify', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { schedule_id, route_id, reason, observation, next_route_date, justified_by } = req.body;
    const r = await query('INSERT INTO price_research_justifications (schedule_id, route_id, reason, observation, next_route_date, justified_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [schedule_id, route_id, reason, observation, next_route_date, justified_by]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.justify', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Price History =====
router.get('/history', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { product_id, brand_id, pdv_id, limit: lim } = req.query;
    let sql = `SELECT i.*, e.pdv_id, e.brand_id, e.created_at as execution_date, p.name as product_name,
               pdv.name as pdv_name, b.name as brand_name
               FROM price_research_items i
               JOIN price_research_executions e ON e.id = i.execution_id
               LEFT JOIN products p ON p.id = i.product_id
               LEFT JOIN pdvs pdv ON pdv.id = e.pdv_id
               LEFT JOIN merch_brands b ON b.id = e.brand_id
               WHERE e.organization_id = $1 AND i.price IS NOT NULL`;
    const params = [orgId];
    let idx = 2;
    if (product_id) { sql += ` AND i.product_id = $${idx++}`; params.push(product_id); }
    if (brand_id) { sql += ` AND e.brand_id = $${idx++}`; params.push(brand_id); }
    if (pdv_id) { sql += ` AND e.pdv_id = $${idx++}`; params.push(pdv_id); }
    sql += ` ORDER BY e.created_at DESC LIMIT ${parseInt(lim) || 100}`;
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('price-research.history', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Delete rule/model =====
router.delete('/rules/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    await query('DELETE FROM price_research_rules WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.rules.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Validate research =====
router.put('/executions/:id/validate', authenticate, async (req, res) => {
  try {
    await query("UPDATE price_research_executions SET status='validated', updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.validate', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== ADMIN: Share rule results with brand =====
router.put('/rules/:id/share', authenticate, async (req, res) => {
  try {
    const { shared } = req.body;
    await query('UPDATE price_research_rules SET shared_with_brand=$1, updated_at=NOW() WHERE id=$2', [shared !== false, req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.share', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== BRAND: Get shared results =====
router.get('/brand-results', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id } = req.query;
    let sql = `SELECT r.*, b.name as brand_name,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status IN ('completed','validated')) as completed_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status = 'in_progress') as in_progress_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id) as total_count
      FROM price_research_rules r
      LEFT JOIN merch_brands b ON b.id = r.brand_id
      WHERE r.organization_id = $1 AND r.shared_with_brand = true`;
    const params = [orgId];
    if (brand_id) { sql += ' AND r.brand_id = $2'; params.push(brand_id); }
    sql += ' ORDER BY r.updated_at DESC';
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('price-research.brand-results', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== BRAND: Get detailed results for a specific rule =====
router.get('/brand-results/:ruleId', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    // Check rule is shared
    const rule = (await query('SELECT * FROM price_research_rules WHERE id=$1 AND organization_id=$2 AND shared_with_brand=true', [req.params.ruleId, orgId])).rows[0];
    if (!rule) return res.status(404).json({ error: 'Não encontrado' });
    // Get executions
    const execs = (await query(`SELECT e.*, p.name as pdv_name, emp.full_name as promoter_name
      FROM price_research_executions e
      LEFT JOIN pdvs p ON p.id = e.pdv_id
      LEFT JOIN employees emp ON emp.id = e.promoter_id
      WHERE e.rule_id = $1 AND e.status IN ('completed','validated')
      ORDER BY e.completed_at DESC`, [rule.id])).rows;
    // Get avg prices
    const avgPrices = (await query(`SELECT i.product_id, p.name as product_name, AVG(i.price) as avg_price,
      MIN(i.price) as min_price, MAX(i.price) as max_price, COUNT(*) as collections
      FROM price_research_items i
      JOIN price_research_executions e ON e.id = i.execution_id
      LEFT JOIN products p ON p.id = i.product_id
      WHERE e.rule_id = $1 AND i.price IS NOT NULL AND e.status IN ('completed','validated')
      GROUP BY i.product_id, p.name ORDER BY p.name`, [rule.id])).rows;
    res.json({ rule, executions: execs, avgPrices });
  } catch (err) { logError('price-research.brand-results.detail', err); res.status(500).json({ error: 'Erro' }); }
});

export default router;
