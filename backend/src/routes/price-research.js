import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();

async function getOrgId(userId) {
  const r = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [userId]);
  return r.rows[0]?.organization_id;
}

async function ensureTables() {
  // Rules / Templates
  await query(`CREATE TABLE IF NOT EXISTS price_research_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT false, frequency VARCHAR(20) DEFAULT 'weekly', preferred_weekday INTEGER DEFAULT 1,
    preferred_time TIME, require_photo BOOLEAN DEFAULT false, require_justification BOOLEAN DEFAULT true,
    block_route_completion BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, brand_id))`);
  const alterCols = [
    'name VARCHAR(255)', 'description TEXT', 'scheduled_date DATE', 'schedule_dates JSONB',
    'shared_with_brand BOOLEAN DEFAULT false', 'validated BOOLEAN DEFAULT false',
    'selected_products JSONB', 'selected_competitors JSONB',
    'allow_postpone BOOLEAN DEFAULT true', 'postpone_limit_type VARCHAR(20) DEFAULT \'week\'',
    'postpone_limit_days INTEGER DEFAULT 7', 'require_all_prices BOOLEAN DEFAULT true',
    'allow_partial BOOLEAN DEFAULT true', 'require_observation BOOLEAN DEFAULT false',
    'allow_promoter_edit BOOLEAN DEFAULT false', 'category VARCHAR(100)',
    'status VARCHAR(20) DEFAULT \'active\'',
    'competitor_config JSONB',
  ];
  for (const col of alterCols) {
    try { await query(`ALTER TABLE price_research_rules ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  try { await query("ALTER TABLE price_research_rules DROP CONSTRAINT IF EXISTS price_research_rules_frequency_check"); } catch {}
  try { await query("ALTER TABLE price_research_rules DROP CONSTRAINT IF EXISTS price_research_rules_organization_id_brand_id_key"); } catch {}

  // Brand Competitors (global library)
  await query(`CREATE TABLE IF NOT EXISTS price_research_brand_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    competitor_name VARCHAR(255) NOT NULL, category VARCHAR(100), active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())`);

  // Product Mappings
  await query(`CREATE TABLE IF NOT EXISTS price_research_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    product_id UUID NOT NULL, enabled BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(brand_id, product_id))`);

  // Competitor Products
  await query(`CREATE TABLE IF NOT EXISTS price_research_competitor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), mapping_id UUID NOT NULL, competitor_id UUID NOT NULL,
    competitor_product_name VARCHAR(255) NOT NULL, category VARCHAR(100), subcategory VARCHAR(100),
    unit_measure VARCHAR(50), photo_url TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW())`);
  try { await query('ALTER TABLE price_research_competitor_products ADD COLUMN IF NOT EXISTS photo_url TEXT'); } catch {}
  try { await query('ALTER TABLE price_research_competitor_products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0'); } catch {}
  try { await query('ALTER TABLE price_research_competitor_products ADD COLUMN IF NOT EXISTS description TEXT'); } catch {}

  // Executions
  await query(`CREATE TABLE IF NOT EXISTS price_research_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, schedule_id UUID,
    route_id UUID, brand_id UUID NOT NULL, pdv_id UUID, promoter_id UUID,
    rule_id UUID, status VARCHAR(30) DEFAULT 'pending', progress_pct NUMERIC(5,2) DEFAULT 0, total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  const execAlterCols = [
    'rule_id UUID', 'scheduled_date DATE', 'scheduled_time TIME',
    'published_at TIMESTAMPTZ', 'validated_at TIMESTAMPTZ', 'expired_at TIMESTAMPTZ',
    'recurrence_type VARCHAR(20)', 'recurrence_end_date DATE',
  ];
  for (const col of execAlterCols) {
    try { await query(`ALTER TABLE price_research_executions ADD COLUMN IF NOT EXISTS ${col}`); } catch {}
  }
  try { await query('ALTER TABLE price_research_executions ALTER COLUMN route_id DROP NOT NULL'); } catch {}
  try { await query('ALTER TABLE price_research_executions ALTER COLUMN pdv_id DROP NOT NULL'); } catch {}
  try { await query('ALTER TABLE price_research_executions ALTER COLUMN promoter_id DROP NOT NULL'); } catch {}

  // Items
  await query(`CREATE TABLE IF NOT EXISTS price_research_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), execution_id UUID NOT NULL, product_id UUID NOT NULL,
    price NUMERIC(10,2), observation TEXT, collected_at TIMESTAMPTZ, collected_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  // Item Competitors
  await query(`CREATE TABLE IF NOT EXISTS price_research_item_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_id UUID NOT NULL, competitor_product_id UUID,
    competitor_id UUID, competitor_product_name VARCHAR(255), competitor_brand_name VARCHAR(255),
    price NUMERIC(10,2), observation TEXT, collected_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`);
  try { await query('ALTER TABLE price_research_item_competitors ADD COLUMN IF NOT EXISTS photo_url TEXT'); } catch {}

  // Photos
  await query(`CREATE TABLE IF NOT EXISTS price_research_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), execution_id UUID NOT NULL, item_id UUID,
    photo_url TEXT NOT NULL, photo_type VARCHAR(30) DEFAULT \'evidence\', latitude NUMERIC(10,7),
    longitude NUMERIC(10,7), watermark_applied BOOLEAN DEFAULT false,
    captured_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())`);

  // Postponements
  await query(`CREATE TABLE IF NOT EXISTS price_research_postponements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id UUID NOT NULL, route_id UUID NOT NULL,
    reason TEXT NOT NULL, observation TEXT, next_route_id UUID, postponed_by UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())`);

  // Justifications
  await query(`CREATE TABLE IF NOT EXISTS price_research_justifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id UUID, route_id UUID,
    reason VARCHAR(255) NOT NULL, observation TEXT, next_route_date DATE, justified_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW())`);

  // Schedules
  await query(`CREATE TABLE IF NOT EXISTS price_research_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL, brand_id UUID NOT NULL,
    pdv_id UUID NOT NULL, promoter_id UUID NOT NULL, route_id UUID, week_start DATE NOT NULL,
    week_end DATE NOT NULL, preferred_date DATE, status VARCHAR(30) DEFAULT 'pending',
    is_last_route_of_week BOOLEAN DEFAULT false, is_mandatory BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  // Redes (Networks / Chains)
  await query(`CREATE TABLE IF NOT EXISTS merch_redes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL, description TEXT, active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);

  await query(`CREATE TABLE IF NOT EXISTS merch_rede_pdvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rede_id UUID NOT NULL, pdv_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(rede_id, pdv_id))`);
}

async function getProductColumns(alias = 'p') {
  let productCols = `${alias}.name as product_name`;
  try {
    const colCheck = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name IN ('photo_url','image_url','description')`);
    const existing = colCheck.rows.map((r) => r.column_name);
    if (existing.includes('image_url')) productCols += `, ${alias}.image_url as photo_url`;
    else if (existing.includes('photo_url')) productCols += `, ${alias}.photo_url`;
    if (existing.includes('description')) productCols += `, ${alias}.description`;
  } catch {}
  return productCols;
}

function mapRuleCompetitors(productId, competitors = []) {
  return competitors.map((comp, index) => ({
    id: comp.id || `rule-${productId}-${index}`,
    competitor_product_id: comp.competitor_product_id || null,
    competitor_id: comp.competitor_id || null,
    competitor_product_name: comp.competitor_product_name || comp.name || '',
    competitor_brand_name: comp.competitor_brand_name || comp.brand || '',
    photo_url: comp.photo_url || null,
    price: comp.price ?? null,
    observation: comp.observation ?? null,
    source: 'rule',
  }));
}

async function buildTemplateItems(rule) {
  const selectedProducts = Array.isArray(rule?.selected_products) ? rule.selected_products : [];
  const competitorConfig = rule?.competitor_config || {};
  if (selectedProducts.length === 0) return [];

  const productCols = await getProductColumns('p');
  const products = (await query(
    `SELECT p.id, ${productCols} FROM products p WHERE p.id = ANY($1::uuid[]) ORDER BY p.name`,
    [selectedProducts],
  )).rows;
  const productMap = new Map(products.map((product) => [product.id, product]));

  return selectedProducts.map((productId, index) => {
    const product = productMap.get(productId) || {};
    return {
      id: `template-${productId}-${index}`,
      product_id: productId,
      product_name: product.product_name || 'Produto',
      photo_url: product.photo_url || null,
      description: product.description || null,
      price: null,
      observation: null,
      competitors: mapRuleCompetitors(productId, competitorConfig[productId] || []),
      source: 'template',
      is_template_only: true,
    };
  });
}

async function hydrateExecution(exec, ruleOverride = null) {
  const rule = ruleOverride || (exec.rule_id
    ? (await query('SELECT selected_products, competitor_config FROM price_research_rules WHERE id = $1', [exec.rule_id])).rows[0]
    : null);
  const productCols = await getProductColumns('p');

  const items = (await query(
    `SELECT i.*, ${productCols} FROM price_research_items i
     LEFT JOIN products p ON p.id = i.product_id WHERE i.execution_id = $1 ORDER BY p.name`,
    [exec.id],
  )).rows;

  for (const item of items) {
    item.competitors = (await query(
      `SELECT ic.*, COALESCE(ic.photo_url, cp.photo_url) as photo_url FROM price_research_item_competitors ic
       LEFT JOIN price_research_competitor_products cp ON cp.id = ic.competitor_product_id
       WHERE ic.item_id = $1 ORDER BY ic.competitor_brand_name, ic.competitor_product_name`,
      [item.id],
    )).rows;
  }

  const mergedItems = [];
  const existingByProductId = new Map(items.map((item) => [item.product_id, item]));
  const selectedProducts = Array.isArray(rule?.selected_products) ? rule.selected_products : [];

  if (selectedProducts.length > 0) {
    const templateItems = await buildTemplateItems(rule);
    for (const templateItem of templateItems) {
      const existingItem = existingByProductId.get(templateItem.product_id);
      if (existingItem) {
        if ((!existingItem.competitors || existingItem.competitors.length === 0) && templateItem.competitors.length > 0) {
          existingItem.competitors = templateItem.competitors;
        }
        mergedItems.push(existingItem);
      } else {
        mergedItems.push(templateItem);
      }
      existingByProductId.delete(templateItem.product_id);
    }
  }

  for (const item of existingByProductId.values()) mergedItems.push(item);

  exec.rule_selected_products = selectedProducts;
  exec.rule_competitor_config = rule?.competitor_config || {};
  exec.items = selectedProducts.length > 0 ? mergedItems : items;
  exec.photos = (await query('SELECT * FROM price_research_photos WHERE execution_id = $1 ORDER BY created_at', [exec.id])).rows;
  return exec;
}

// ===== ADMIN: Rules / Templates =====
router.get('/rules', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id } = req.query;
    let sql = `SELECT r.*, b.name as brand_name,
      (SELECT COUNT(*) FROM price_research_product_mappings pm WHERE pm.brand_id = r.brand_id AND pm.enabled = true) as products_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id) as executions_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status IN ('completed','validated','published')) as completed_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status = 'scheduled') as scheduled_count,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status = 'in_progress') as in_progress_count
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
    const {
      id, brand_id, name, description, enabled, frequency, preferred_weekday, preferred_time,
      require_photo, require_justification, block_route_completion, scheduled_date, schedule_dates,
      selected_products, selected_competitors, category,
      allow_postpone, postpone_limit_type, postpone_limit_days,
      require_all_prices, allow_partial, require_observation, allow_promoter_edit,
      competitor_config, status,
    } = req.body;
    const cols = {
      brand_id: brand_id || null,
      name: name || 'Pesquisa de Preços', description, enabled: enabled ?? false,
      frequency: frequency ?? 'weekly', preferred_weekday: preferred_weekday ?? 1, preferred_time,
      require_photo: require_photo ?? false, require_justification: require_justification ?? true,
      block_route_completion: block_route_completion ?? false, scheduled_date,
      schedule_dates: schedule_dates ? JSON.stringify(schedule_dates) : null,
      selected_products: selected_products ? JSON.stringify(selected_products) : null,
      selected_competitors: selected_competitors ? JSON.stringify(selected_competitors) : null,
      category: category || null,
      allow_postpone: allow_postpone ?? true, postpone_limit_type: postpone_limit_type ?? 'week',
      postpone_limit_days: postpone_limit_days ?? 7,
      require_all_prices: require_all_prices ?? true, allow_partial: allow_partial ?? true,
      require_observation: require_observation ?? false, allow_promoter_edit: allow_promoter_edit ?? false,
      competitor_config: competitor_config ? JSON.stringify(competitor_config) : null,
      status: status ?? 'active',
    };
    let result;
    if (id) {
      const sets = Object.keys(cols).map((k, i) => `${k}=$${i + 1}`).join(',');
      result = await query(`UPDATE price_research_rules SET ${sets}, updated_at=NOW() WHERE id=$${Object.keys(cols).length + 1} RETURNING *`,
        [...Object.values(cols), id]);
    } else {
      const keys = ['organization_id', ...Object.keys(cols)];
      const vals = [orgId, ...Object.values(cols)];
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
      result = await query(`INSERT INTO price_research_rules (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`, vals);
    }
    res.json(result.rows[0]);
  } catch (err) { logError('price-research.rules.upsert', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/rules/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    await query('DELETE FROM price_research_rules WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.rules.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Competitors (global library) =====
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
    const r = await query('INSERT INTO price_research_brand_competitors (organization_id, brand_id, competitor_name, category) VALUES ($1,$2,$3,$4) RETURNING *',
      [orgId, brand_id, competitor_name, category]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitors.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/competitors/:id', authenticate, async (req, res) => {
  try {
    const { competitor_name, category, active } = req.body;
    const r = await query('UPDATE price_research_brand_competitors SET competitor_name=COALESCE($1,competitor_name), category=COALESCE($2,category), active=COALESCE($3,active) WHERE id=$4 RETURNING *',
      [competitor_name, category, active, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitors.update', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/competitors/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_brand_competitors WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.competitors.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Product Mappings =====
router.get('/product-mappings', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    const { brand_id } = req.query;
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
    if (mappings.length > 0) {
      const mapIds = mappings.map(m => m.id);
      const cpRes = await query(`SELECT cp.*, c.competitor_name FROM price_research_competitor_products cp
        LEFT JOIN price_research_brand_competitors c ON c.id = cp.competitor_id
        WHERE cp.mapping_id = ANY($1) ORDER BY COALESCE(cp.sort_order, 0), c.competitor_name, cp.competitor_product_name`, [mapIds]);
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
    const r = await query('INSERT INTO price_research_product_mappings (organization_id, brand_id, product_id) VALUES ($1,$2,$3) ON CONFLICT (brand_id, product_id) DO UPDATE SET enabled=true RETURNING *',
      [orgId, brand_id, product_id]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.mappings.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/product-mappings/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_product_mappings WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.mappings.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Competitor Products =====
router.post('/competitor-products', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { mapping_id, competitor_id, competitor_product_name, category, subcategory, unit_measure, photo_url, description, sort_order } = req.body;
    const r = await query(`INSERT INTO price_research_competitor_products (mapping_id, competitor_id, competitor_product_name, category, subcategory, unit_measure, photo_url, description, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [mapping_id, competitor_id, competitor_product_name, category, subcategory, unit_measure, photo_url, description, sort_order ?? 0]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitor-products.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/competitor-products/:id', authenticate, async (req, res) => {
  try {
    const { competitor_product_name, category, subcategory, unit_measure, photo_url, description, sort_order, active } = req.body;
    const r = await query(`UPDATE price_research_competitor_products SET
      competitor_product_name=COALESCE($1,competitor_product_name), category=COALESCE($2,category),
      subcategory=COALESCE($3,subcategory), unit_measure=COALESCE($4,unit_measure),
      photo_url=COALESCE($5,photo_url), description=COALESCE($6,description),
      sort_order=COALESCE($7,sort_order), active=COALESCE($8,active) WHERE id=$9 RETURNING *`,
      [competitor_product_name, category, subcategory, unit_measure, photo_url, description, sort_order, active, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) { logError('price-research.competitor-products.update', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/competitor-products/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_competitor_products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.competitor-products.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Executions =====
router.get('/executions', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id, pdv_id, promoter_id, status, date_from, date_to, rule_id } = req.query;
    let sql = `SELECT e.*, b.name as brand_name, p.name as pdv_name, emp.full_name as promoter_name,
               r.name as rule_name, r.frequency as rule_frequency, r.block_route_completion, r.require_photo,
               r.require_justification, r.allow_postpone, r.allow_partial, r.require_all_prices
               FROM price_research_executions e
               LEFT JOIN merch_brands b ON b.id = e.brand_id
               LEFT JOIN pdvs p ON p.id = e.pdv_id
               LEFT JOIN employees emp ON emp.id = e.promoter_id
               LEFT JOIN price_research_rules r ON r.id = e.rule_id
               WHERE e.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (brand_id) { sql += ` AND e.brand_id = $${idx++}`; params.push(brand_id); }
    if (pdv_id) { sql += ` AND e.pdv_id = $${idx++}`; params.push(pdv_id); }
    if (promoter_id) { sql += ` AND e.promoter_id = $${idx++}`; params.push(promoter_id); }
    if (status) { sql += ` AND e.status = $${idx++}`; params.push(status); }
    if (rule_id) { sql += ` AND e.rule_id = $${idx++}`; params.push(rule_id); }
    if (date_from) { sql += ` AND COALESCE(e.scheduled_date, e.created_at::date) >= $${idx++}`; params.push(date_from); }
    if (date_to) { sql += ` AND COALESCE(e.scheduled_date, e.created_at::date) <= $${idx++}`; params.push(date_to); }
    sql += ' ORDER BY COALESCE(e.scheduled_date, e.created_at::date) DESC, e.created_at DESC LIMIT 500';
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('price-research.executions.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.get('/executions/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const exec = (await query(`SELECT e.*, b.name as brand_name, p.name as pdv_name, emp.full_name as promoter_name,
      r.name as rule_name, r.require_photo, r.require_all_prices, r.allow_partial, r.allow_postpone
      FROM price_research_executions e LEFT JOIN merch_brands b ON b.id = e.brand_id
      LEFT JOIN pdvs p ON p.id = e.pdv_id LEFT JOIN employees emp ON emp.id = e.promoter_id
      LEFT JOIN price_research_rules r ON r.id = e.rule_id
      WHERE e.id = $1`, [req.params.id])).rows[0];
    if (!exec) return res.status(404).json({ error: 'Não encontrado' });
    res.json(await hydrateExecution(exec));
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
      COUNT(*) FILTER (WHERE status='scheduled') as scheduled,
      COUNT(*) FILTER (WHERE status='in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status='completed') as completed,
      COUNT(*) FILTER (WHERE status='validated') as validated,
      COUNT(*) FILTER (WHERE status='published') as published,
      COUNT(*) FILTER (WHERE status='postponed') as postponed,
      COUNT(*) FILTER (WHERE status='expired') as expired,
      COUNT(*) as total
      FROM price_research_executions WHERE organization_id = $1 ${dateFilter}`, params)).rows[0];

    const avgPrices = (await query(`SELECT i.product_id, p.name as product_name, AVG(i.price) as avg_price,
      MIN(i.price) as min_price, MAX(i.price) as max_price, COUNT(*) as collections
      FROM price_research_items i
      JOIN price_research_executions e ON e.id = i.execution_id
      LEFT JOIN products p ON p.id = i.product_id
      WHERE e.organization_id = $1 AND i.price IS NOT NULL ${dateFilter.replace(/brand_id/g, 'e.brand_id').replace(/created_at/g, 'e.created_at')}
      GROUP BY i.product_id, p.name ORDER BY collections DESC LIMIT 20`, params)).rows;

    // Competitor comparison
    const competitorPrices = (await query(`SELECT ic.competitor_brand_name, AVG(ic.price) as avg_price,
      COUNT(*) as collections
      FROM price_research_item_competitors ic
      JOIN price_research_items i ON i.id = ic.item_id
      JOIN price_research_executions e ON e.id = i.execution_id
      WHERE e.organization_id = $1 AND ic.price IS NOT NULL ${dateFilter.replace(/brand_id/g, 'e.brand_id').replace(/created_at/g, 'e.created_at')}
      GROUP BY ic.competitor_brand_name ORDER BY avg_price LIMIT 20`, params)).rows;

    // Recent executions
    const recentExecs = (await query(`SELECT e.id, e.status, e.scheduled_date, e.progress_pct, e.brand_id,
      b.name as brand_name, p.name as pdv_name, emp.full_name as promoter_name
      FROM price_research_executions e
      LEFT JOIN merch_brands b ON b.id = e.brand_id
      LEFT JOIN pdvs p ON p.id = e.pdv_id
      LEFT JOIN employees emp ON emp.id = e.promoter_id
      WHERE e.organization_id = $1 ${dateFilter}
      ORDER BY e.created_at DESC LIMIT 10`, params)).rows;

    res.json({ stats, avgPrices, competitorPrices, recentExecs });
  } catch (err) { logError('price-research.dashboard', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Schedule from model =====
router.post('/schedule', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { rule_id, brand_id, pdv_id, pdv_ids, rede_id, promoter_id, scheduled_date, scheduled_time, recurrence_type, recurrence_end_date } = req.body;
    if (!rule_id || !brand_id || !scheduled_date || (!rede_id && !promoter_id)) {
      return res.status(400).json({ error: 'Campos obrigatórios: rule_id, brand_id, scheduled_date e promotor para agendamento por PDV' });
    }

    // Resolve PDV list
    let targetPdvIds = [];
    if (rede_id) {
      const redePdvs = (await query('SELECT pdv_id FROM merch_rede_pdvs WHERE rede_id=$1', [rede_id])).rows;
      targetPdvIds = redePdvs.map(r => r.pdv_id);
    } else if (pdv_ids && Array.isArray(pdv_ids) && pdv_ids.length > 0) {
      targetPdvIds = pdv_ids;
    } else if (pdv_id) {
      targetPdvIds = [pdv_id];
    }
    if (targetPdvIds.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos um PDV ou Rede' });
    }

    const dates = [scheduled_date];
    if (recurrence_type && recurrence_type !== 'once' && recurrence_end_date) {
      const start = new Date(scheduled_date);
      const end = new Date(recurrence_end_date);
      let current = new Date(start);
      const increment = recurrence_type === 'daily' ? 1 : recurrence_type === 'weekly' ? 7 : recurrence_type === 'biweekly' ? 14 : 30;
      current.setDate(current.getDate() + increment);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + increment);
      }
    }

    const ruleRow = (await query('SELECT selected_products, competitor_config FROM price_research_rules WHERE id=$1', [rule_id])).rows[0];
    const selectedProducts = ruleRow?.selected_products || [];
    const competitorConfig = ruleRow?.competitor_config || {};

    const results = [];
    for (const targetPdv of targetPdvIds) {
      for (const date of dates) {
        const result = await query(
          `INSERT INTO price_research_executions (organization_id, rule_id, brand_id, pdv_id, promoter_id, scheduled_date, scheduled_time, recurrence_type, recurrence_end_date, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled') RETURNING *`,
          [orgId, rule_id, brand_id, targetPdv, rede_id ? null : promoter_id, date, scheduled_time || null, recurrence_type || 'once', recurrence_end_date || null]
        );
        const exec = result.rows[0];

        let totalItems = 0;
        for (const pid of selectedProducts) {
          const itemResult = await query(
            'INSERT INTO price_research_items (execution_id, product_id) VALUES ($1,$2) RETURNING id',
            [exec.id, pid]
          );
          totalItems++;
          const itemId = itemResult.rows[0].id;
          const comps = competitorConfig[pid] || [];
          for (const comp of comps) {
            await query(
              `INSERT INTO price_research_item_competitors (item_id, competitor_product_name, competitor_brand_name, photo_url)
               VALUES ($1,$2,$3,$4)`,
              [itemId, comp.name, comp.brand, comp.photo_url || null]
            );
          }
        }
        if (totalItems > 0) {
          await query('UPDATE price_research_executions SET total_items=$1 WHERE id=$2', [totalItems, exec.id]);
          exec.total_items = totalItems;
        }
        results.push(exec);
      }
    }
    logInfo('price-research.schedule', `Scheduled ${results.length} research(es) rule=${rule_id} pdvs=${targetPdvIds.length}`);
    res.json(results.length === 1 ? results[0] : results);
  } catch (err) { logError('price-research.schedule', err); res.status(500).json({ error: 'Erro ao agendar pesquisa' }); }
});

// ===== Update Execution =====
router.put('/executions/:id', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { promoter_id, pdv_id, scheduled_date, scheduled_time, products, items, status } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (promoter_id !== undefined) { updates.push(`promoter_id=$${idx++}`); params.push(promoter_id); }
    if (pdv_id !== undefined) { updates.push(`pdv_id=$${idx++}`); params.push(pdv_id); }
    if (scheduled_date !== undefined) { updates.push(`scheduled_date=$${idx++}`); params.push(scheduled_date); }
    if (scheduled_time !== undefined) { updates.push(`scheduled_time=$${idx++}`); params.push(scheduled_time || null); }
    if (status !== undefined) { updates.push(`status=$${idx++}`); params.push(status); }
    updates.push('updated_at=NOW()');
    params.push(req.params.id);

    if (updates.length > 1) {
      await query(`UPDATE price_research_executions SET ${updates.join(',')} WHERE id=$${idx}`, params);
    }

    // Sync products/items to match provided list
    if ((items && Array.isArray(items)) || (products && Array.isArray(products))) {
      const execId = req.params.id;
      const exec = (await query('SELECT rule_id FROM price_research_executions WHERE id=$1', [execId])).rows[0];
      const ruleRow = exec?.rule_id ? (await query('SELECT competitor_config FROM price_research_rules WHERE id=$1', [exec.rule_id])).rows[0] : null;
      const competitorConfig = ruleRow?.competitor_config || {};
      const itemPayload = Array.isArray(items) ? items.filter((item) => item?.product_id) : null;
      const nextProducts = itemPayload ? itemPayload.map((item) => item.product_id) : products;

      // Get current items
      const currentItems = (await query('SELECT id, product_id FROM price_research_items WHERE execution_id=$1', [execId])).rows;
      const currentProductIds = currentItems.map(i => i.product_id);

      // Remove items no longer in the list
      const toRemove = currentItems.filter(i => !nextProducts.includes(i.product_id));
      for (const item of toRemove) {
        await query('DELETE FROM price_research_item_competitors WHERE item_id=$1', [item.id]);
        await query('DELETE FROM price_research_items WHERE id=$1', [item.id]);
      }

      if (itemPayload) {
        for (const item of itemPayload) {
          let currentItem = currentItems.find((row) => row.product_id === item.product_id);
          if (!currentItem) {
            currentItem = (await query(
              'INSERT INTO price_research_items (execution_id, product_id, price, observation, updated_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id, product_id',
              [execId, item.product_id, item.price ?? null, item.observation ?? null],
            )).rows[0];
          } else {
            await query(
              'UPDATE price_research_items SET price=$1, observation=$2, updated_at=NOW() WHERE id=$3',
              [item.price ?? null, item.observation ?? null, currentItem.id],
            );
          }

          await query('DELETE FROM price_research_item_competitors WHERE item_id=$1', [currentItem.id]);
          for (const comp of (item.competitors || [])) {
            await query(
              `INSERT INTO price_research_item_competitors (
                 item_id, competitor_product_id, competitor_id, competitor_product_name,
                 competitor_brand_name, price, observation, photo_url, collected_at
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                currentItem.id,
                comp.competitor_product_id || null,
                comp.competitor_id || null,
                comp.competitor_product_name || null,
                comp.competitor_brand_name || null,
                comp.price ?? null,
                comp.observation ?? null,
                comp.photo_url || null,
                comp.price != null ? new Date() : null,
              ],
            );
          }
        }
      } else {
        const toAdd = products.filter(pid => !currentProductIds.includes(pid));
        for (const pid of toAdd) {
          const itemResult = await query(
            'INSERT INTO price_research_items (execution_id, product_id) VALUES ($1,$2) RETURNING id',
            [execId, pid]
          );
          const itemId = itemResult.rows[0].id;
          const comps = competitorConfig[pid] || [];
          for (const comp of comps) {
            await query(
              `INSERT INTO price_research_item_competitors (item_id, competitor_product_name, competitor_brand_name, photo_url)
               VALUES ($1,$2,$3,$4)`,
              [itemId, comp.name, comp.brand, comp.photo_url || null]
            );
          }
        }
      }

      const countResult = await query('SELECT COUNT(*) as cnt FROM price_research_items WHERE execution_id=$1', [execId]);
      const completedResult = await query('SELECT COUNT(*) as cnt FROM price_research_items WHERE execution_id=$1 AND price IS NOT NULL', [execId]);
      const totalItems = parseInt(countResult.rows[0].cnt, 10) || 0;
      const completedItems = parseInt(completedResult.rows[0].cnt, 10) || 0;
      const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      await query('UPDATE price_research_executions SET total_items=$1, completed_items=$2, progress_pct=$3, updated_at=NOW() WHERE id=$4', [totalItems, completedItems, progressPct, execId]);
    }

    logInfo('price-research.update-execution', `Updated execution ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) { logError('price-research.update-execution', err); res.status(500).json({ error: 'Erro ao atualizar pesquisa' }); }
});

// ===== Validate =====
router.put('/executions/:id/validate', authenticate, async (req, res) => {
  try {
    await query("UPDATE price_research_executions SET status='validated', validated_at=NOW(), updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.validate', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Publish =====
router.put('/executions/:id/publish', authenticate, async (req, res) => {
  try {
    await query("UPDATE price_research_executions SET status='published', published_at=NOW(), updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.publish', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Item Competitors CRUD =====
router.post('/item-competitors', authenticate, async (req, res) => {
  try {
    const { item_id, competitor_product_name, competitor_brand_name, photo_url, observation } = req.body;
    if (!item_id || !competitor_product_name) return res.status(400).json({ error: 'item_id e nome obrigatórios' });
    const result = await query(
      `INSERT INTO price_research_item_competitors (item_id, competitor_product_name, competitor_brand_name, photo_url, observation) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [item_id, competitor_product_name, competitor_brand_name || null, photo_url || null, observation || null]
    );
    res.json(result.rows[0]);
  } catch (err) { logError('price-research.add-item-competitor', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/item-competitors/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM price_research_item_competitors WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.delete-item-competitor', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Delete execution =====
router.delete('/executions/:id', authenticate, async (req, res) => {
  try {
    const execId = req.params.id;
    // Delete in correct order due to FK constraints
    await query('DELETE FROM price_research_photos WHERE execution_id=$1', [execId]);
    await query(`DELETE FROM price_research_item_competitors WHERE item_id IN (SELECT id FROM price_research_items WHERE execution_id=$1)`, [execId]);
    await query('DELETE FROM price_research_items WHERE execution_id=$1', [execId]);
    await query('DELETE FROM price_research_executions WHERE id=$1', [execId]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.executions.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Bulk delete executions =====
router.post('/executions/bulk-delete', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs obrigatórios' });
    for (const execId of ids) {
      await query('DELETE FROM price_research_photos WHERE execution_id=$1', [execId]);
      await query(`DELETE FROM price_research_item_competitors WHERE item_id IN (SELECT id FROM price_research_items WHERE execution_id=$1)`, [execId]);
      await query('DELETE FROM price_research_items WHERE execution_id=$1', [execId]);
      await query('DELETE FROM price_research_executions WHERE id=$1', [execId]);
    }
    res.json({ ok: true, deleted: ids.length });
  } catch (err) { logError('price-research.executions.bulk-delete', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Share rule =====
router.put('/rules/:id/share', authenticate, async (req, res) => {
  try {
    const { shared } = req.body;
    await query('UPDATE price_research_rules SET shared_with_brand=$1, updated_at=NOW() WHERE id=$2', [shared !== false, req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.share', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Brand results =====
router.get('/brand-results', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { brand_id } = req.query;
    let sql = `SELECT r.*, b.name as brand_name,
      (SELECT COUNT(*) FROM price_research_executions ex WHERE ex.rule_id = r.id AND ex.status IN ('completed','validated','published')) as completed_count,
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

router.get('/brand-results/:ruleId', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const rule = (await query('SELECT * FROM price_research_rules WHERE id=$1 AND organization_id=$2 AND shared_with_brand=true', [req.params.ruleId, orgId])).rows[0];
    if (!rule) return res.status(404).json({ error: 'Não encontrado' });
    const execs = (await query(`SELECT e.*, p.name as pdv_name, emp.full_name as promoter_name
      FROM price_research_executions e LEFT JOIN pdvs p ON p.id = e.pdv_id LEFT JOIN employees emp ON emp.id = e.promoter_id
      WHERE e.rule_id = $1 AND e.status IN ('completed','validated','published') ORDER BY e.completed_at DESC`, [rule.id])).rows;
    const avgPrices = (await query(`SELECT i.product_id, p.name as product_name, AVG(i.price) as avg_price,
      MIN(i.price) as min_price, MAX(i.price) as max_price, COUNT(*) as collections
      FROM price_research_items i JOIN price_research_executions e ON e.id = i.execution_id
      LEFT JOIN products p ON p.id = i.product_id
      WHERE e.rule_id = $1 AND i.price IS NOT NULL AND e.status IN ('completed','validated','published')
      GROUP BY i.product_id, p.name ORDER BY p.name`, [rule.id])).rows;
    // Competitor avg prices
    const competitorAvg = (await query(`SELECT ic.competitor_brand_name, ic.competitor_product_name,
      AVG(ic.price) as avg_price, MIN(ic.price) as min_price, MAX(ic.price) as max_price
      FROM price_research_item_competitors ic
      JOIN price_research_items i ON i.id = ic.item_id
      JOIN price_research_executions e ON e.id = i.execution_id
      WHERE e.rule_id = $1 AND ic.price IS NOT NULL AND e.status IN ('completed','validated','published')
      GROUP BY ic.competitor_brand_name, ic.competitor_product_name ORDER BY ic.competitor_brand_name`, [rule.id])).rows;
    // Photos
    const photos = (await query(`SELECT ph.* FROM price_research_photos ph
      JOIN price_research_executions e ON e.id = ph.execution_id
      WHERE e.rule_id = $1 AND e.status IN ('completed','validated','published') ORDER BY ph.created_at DESC LIMIT 50`, [rule.id])).rows;
    res.json({ rule, executions: execs, avgPrices, competitorAvg, photos });
  } catch (err) { logError('price-research.brand-results.detail', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Route research (Promotor) =====
router.get('/route/:routeId', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { routeId } = req.params;
    const route = (await query('SELECT * FROM merch_routes WHERE id = $1', [routeId])).rows[0];
    if (!route) return res.json([]);
    let brandIds = [];
    if (route.brand_id) { brandIds = [route.brand_id]; }
    else {
      const rb = (await query('SELECT brand_id FROM route_brands WHERE route_id = $1', [routeId])).rows;
      brandIds = rb.map(r => r.brand_id);
    }
    if (brandIds.length === 0) return res.json([]);

    const directExecutions = (await query('SELECT * FROM price_research_executions WHERE route_id = $1 ORDER BY created_at', [routeId])).rows;
    const sharedExecutions = (await query(
      `SELECT * FROM price_research_executions
       WHERE route_id IS NULL
         AND pdv_id = $1
         AND brand_id = ANY($2::uuid[])
         AND status = ANY($3::text[])
         AND (scheduled_date IS NULL OR scheduled_date <= $4)
       ORDER BY COALESCE(scheduled_date, created_at::date), created_at`,
      [route.pdv_id, brandIds, ['scheduled', 'pending', 'in_progress', 'draft', 'postponed', 'partially_completed'], route.visit_date],
    )).rows;

    const executionMap = new Map();
    [...directExecutions, ...sharedExecutions].forEach((execution) => executionMap.set(execution.id, execution));

    const result = [];
    const executionBrandIds = new Set();
    for (const execution of executionMap.values()) {
      executionBrandIds.add(execution.brand_id);
      result.push(await hydrateExecution(execution));
    }

    const rules = (await query('SELECT * FROM price_research_rules WHERE brand_id = ANY($1) AND enabled = true', [brandIds])).rows;
    for (const rule of rules) {
      if (executionBrandIds.has(rule.brand_id)) continue;
      let items = await buildTemplateItems(rule);
      if (items.length === 0) {
        const mappings = (await query(`SELECT pm.*, p.name as product_name, p.photo_url, p.description
          FROM price_research_product_mappings pm LEFT JOIN products p ON p.id = pm.product_id
          WHERE pm.brand_id = $1 AND pm.enabled = true ORDER BY p.name`, [rule.brand_id])).rows;
        items = [];
        for (const m of mappings) {
          const compProducts = (await query(`SELECT cp.*, c.competitor_name as competitor_brand_name
            FROM price_research_competitor_products cp
            LEFT JOIN price_research_brand_competitors c ON c.id = cp.competitor_id
            WHERE cp.mapping_id = $1 AND cp.active = true ORDER BY COALESCE(cp.sort_order,0), c.competitor_name`, [m.id])).rows;
          items.push({
            product_id: m.product_id, product_name: m.product_name, photo_url: m.photo_url, description: m.description, price: null,
            competitors: compProducts.map(cp => ({
              competitor_product_id: cp.id, competitor_id: cp.competitor_id,
              competitor_product_name: cp.competitor_product_name, competitor_brand_name: cp.competitor_brand_name,
              photo_url: cp.photo_url, price: null,
            })),
          });
        }
      }
      result.push({
        brand_id: rule.brand_id,
        rule,
        rule_selected_products: rule.selected_products || [],
        rule_competitor_config: rule.competitor_config || {},
        status: 'not_started',
        items,
        photos: [],
      });
    }
    res.json(result);
  } catch (err) { logError('price-research.route', err); if (err.code === '42P01') return res.json([]); res.status(500).json({ error: 'Erro' }); }
});

// ===== Execute =====
router.post('/execute', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const { route_id, brand_id, pdv_id, promoter_id, items, photos, execution_id } = req.body;
    let orgId;
    if (route_id) {
      const orgRes = await query('SELECT organization_id FROM merch_routes WHERE id = $1', [route_id]);
      orgId = orgRes.rows[0]?.organization_id;
    }
    if (!orgId) {
      const orgRes2 = await query('SELECT organization_id FROM organization_members WHERE user_id=$1 LIMIT 1', [req.userId]);
      orgId = orgRes2.rows[0]?.organization_id;
    }
    if (!orgId) return res.status(404).json({ error: 'Organização não encontrada' });

    let exec;
    if (execution_id) {
      exec = (await query('SELECT * FROM price_research_executions WHERE id = $1', [execution_id])).rows[0];
    }
    if (!exec && route_id) {
      exec = (await query('SELECT * FROM price_research_executions WHERE route_id = $1 AND brand_id = $2', [route_id, brand_id])).rows[0];
      if (!exec) {
        const route = (await query('SELECT pdv_id, visit_date FROM merch_routes WHERE id = $1', [route_id])).rows[0];
        if (route?.pdv_id) {
          exec = (await query(
            `SELECT * FROM price_research_executions
             WHERE route_id IS NULL
               AND pdv_id = $1
               AND brand_id = $2
               AND status = ANY($3::text[])
               AND (scheduled_date IS NULL OR scheduled_date <= $4)
             ORDER BY COALESCE(scheduled_date, created_at::date), created_at
             LIMIT 1`,
            [route.pdv_id, brand_id, ['scheduled', 'pending', 'in_progress', 'draft', 'postponed', 'partially_completed'], route.visit_date],
          )).rows[0];
        }
      }
    }
    if (!exec) {
      exec = (await query(`INSERT INTO price_research_executions (organization_id, route_id, brand_id, pdv_id, promoter_id, status, started_at)
        VALUES ($1,$2,$3,$4,$5,'in_progress',NOW()) RETURNING *`, [orgId, route_id, brand_id, pdv_id, promoter_id])).rows[0];
    } else {
      await query('UPDATE price_research_executions SET promoter_id = COALESCE($1, promoter_id), updated_at = NOW() WHERE id = $2', [promoter_id || null, exec.id]);
    }

    let completedCount = 0;
    const totalCount = items?.length || 0;
    for (const item of (items || [])) {
      let existingItem = (await query('SELECT id FROM price_research_items WHERE execution_id = $1 AND product_id = $2', [exec.id, item.product_id])).rows[0];
      if (existingItem) {
        await query('UPDATE price_research_items SET price=$1, observation=$2, collected_at=NOW(), updated_at=NOW() WHERE id=$3',
          [item.price, item.observation, existingItem.id]);
      } else {
        existingItem = (await query('INSERT INTO price_research_items (execution_id, product_id, price, observation, collected_at, collected_by) VALUES ($1,$2,$3,$4,NOW(),$5) RETURNING id',
          [exec.id, item.product_id, item.price, item.observation, promoter_id])).rows[0];
      }
      if (item.price !== null && item.price !== undefined) completedCount++;
      if (item.competitors) {
        await query('DELETE FROM price_research_item_competitors WHERE item_id = $1', [existingItem.id]);
        for (const comp of item.competitors) {
          await query(`INSERT INTO price_research_item_competitors (item_id, competitor_product_id, competitor_id, competitor_product_name, competitor_brand_name, price, observation, collected_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
            [existingItem.id, comp.competitor_product_id, comp.competitor_id, comp.competitor_product_name, comp.competitor_brand_name, comp.price, comp.observation]);
        }
      }
    }

    for (const photo of (photos || [])) {
      await query('INSERT INTO price_research_photos (execution_id, item_id, photo_url, photo_type, latitude, longitude, watermark_applied) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [exec.id, photo.item_id, photo.photo_url, photo.photo_type || 'evidence', photo.latitude, photo.longitude, photo.watermark_applied ?? false]);
    }

    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isComplete = completedCount === totalCount && totalCount > 0;
    await query('UPDATE price_research_executions SET progress_pct=$1, total_items=$2, completed_items=$3, status=$4, completed_at=$5, updated_at=NOW() WHERE id=$6',
      [progressPct, totalCount, completedCount, isComplete ? 'completed' : 'in_progress', isComplete ? new Date() : null, exec.id]);

    res.json({ id: exec.id, progress_pct: progressPct, status: isComplete ? 'completed' : 'in_progress' });
  } catch (err) { logError('price-research.execute', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== Postpone =====
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

// ===== Justify =====
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

// ===== Redes (Networks) CRUD =====
router.get('/redes', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const redes = (await query(`SELECT r.*, 
      (SELECT COUNT(*) FROM merch_rede_pdvs rp WHERE rp.rede_id = r.id) as pdv_count
      FROM merch_redes r WHERE r.organization_id = $1 ORDER BY r.name`, [orgId])).rows;
    // Get PDVs for each rede
    for (const rede of redes) {
      rede.pdvs = (await query(`SELECT rp.pdv_id, p.name as pdv_name, p.client_name, p.city, p.state
        FROM merch_rede_pdvs rp LEFT JOIN pdvs p ON p.id = rp.pdv_id
        WHERE rp.rede_id = $1 ORDER BY p.name`, [rede.id])).rows;
    }
    res.json(redes);
  } catch (err) { logError('price-research.redes.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/redes', authenticate, async (req, res) => {
  try {
    await ensureTables();
    const orgId = await getOrgId(req.userId);
    if (!orgId) return res.status(403).json({ error: 'Sem organização' });
    const { name, description, pdv_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const result = await query('INSERT INTO merch_redes (organization_id, name, description) VALUES ($1,$2,$3) RETURNING *', [orgId, name, description || null]);
    const rede = result.rows[0];
    if (pdv_ids && Array.isArray(pdv_ids)) {
      for (const pdvId of pdv_ids) {
        await query('INSERT INTO merch_rede_pdvs (rede_id, pdv_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rede.id, pdvId]);
      }
    }
    rede.pdv_count = pdv_ids?.length || 0;
    res.json(rede);
  } catch (err) { logError('price-research.redes.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/redes/:id', authenticate, async (req, res) => {
  try {
    const { name, description, active, pdv_ids } = req.body;
    await query('UPDATE merch_redes SET name=COALESCE($1,name), description=COALESCE($2,description), active=COALESCE($3,active), updated_at=NOW() WHERE id=$4',
      [name, description, active, req.params.id]);
    if (pdv_ids && Array.isArray(pdv_ids)) {
      await query('DELETE FROM merch_rede_pdvs WHERE rede_id=$1', [req.params.id]);
      for (const pdvId of pdv_ids) {
        await query('INSERT INTO merch_rede_pdvs (rede_id, pdv_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, pdvId]);
      }
    }
    res.json({ ok: true });
  } catch (err) { logError('price-research.redes.update', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/redes/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM merch_rede_pdvs WHERE rede_id=$1', [req.params.id]);
    await query('DELETE FROM merch_redes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('price-research.redes.delete', err); res.status(500).json({ error: 'Erro' }); }
});

export default router;
