import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

let infraDone = false;

async function ensureMerchandisingInfra() {
  if (infraDone) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS merch_brands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      razao_social VARCHAR(255),
      cnpj VARCHAR(20),
      logo_url TEXT,
      description TEXT,
      segment VARCHAR(100),
      responsible VARCHAR(255),
      phone VARCHAR(30),
      email VARCHAR(255),
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS merch_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS merch_subcategories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      category_id UUID NOT NULL REFERENCES merch_categories(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS merch_products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
      category_id UUID NOT NULL REFERENCES merch_categories(id) ON DELETE RESTRICT,
      subcategory_id UUID NOT NULL REFERENCES merch_subcategories(id) ON DELETE RESTRICT,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100),
      internal_code VARCHAR(100),
      barcode VARCHAR(100),
      description TEXT,
      image_url TEXT,
      unit VARCHAR(20) DEFAULT 'un',
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS merch_pdv_brands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      pdv_id UUID NOT NULL,
      brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(pdv_id, brand_id)
    )`,
    `CREATE TABLE IF NOT EXISTS merch_pdv_brand_products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      pdv_id UUID NOT NULL,
      brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES merch_products(id) ON DELETE CASCADE,
      active BOOLEAN DEFAULT true,
      mandatory BOOLEAN DEFAULT false,
      priority VARCHAR(10) DEFAULT 'media',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(pdv_id, brand_id, product_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_merch_brands_org ON merch_brands(organization_id)`,
    `CREATE INDEX IF NOT EXISTS idx_merch_products_brand ON merch_products(brand_id)`,
    `CREATE INDEX IF NOT EXISTS idx_merch_products_category ON merch_products(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_merch_pdv_brands_pdv ON merch_pdv_brands(pdv_id)`,
    `CREATE INDEX IF NOT EXISTS idx_merch_pdv_brands_brand ON merch_pdv_brands(brand_id)`,
    `CREATE INDEX IF NOT EXISTS idx_merch_pdv_bp_pdv ON merch_pdv_brand_products(pdv_id)`,
    `CREATE INDEX IF NOT EXISTS idx_merch_pdv_bp_brand ON merch_pdv_brand_products(brand_id)`,
  ];
  for (const sql of statements) {
    try { await query(sql); } catch (err) { logError('merch infra stmt', err, { sql: sql.slice(0, 80) }); }
  }
  infraDone = true;
}

// ==================== BRANDS ====================
router.get('/brands', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const { status, search } = req.query;
    let sql = 'SELECT * FROM merch_brands WHERE organization_id = $1';
    const params = [orgId];
    if (status && status !== 'all') { params.push(status); sql += ` AND status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (name ILIKE $${params.length} OR razao_social ILIKE $${params.length})`; }
    sql += ' ORDER BY name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { logError('get brands', e); res.status(500).json({ error: e.message }); }
});

router.post('/brands', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const { name, razao_social, cnpj, logo_url, description, segment, responsible, phone, email, status, notes } = req.body;
    const r = await query(
      `INSERT INTO merch_brands (organization_id, name, razao_social, cnpj, logo_url, description, segment, responsible, phone, email, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [orgId, name, razao_social, cnpj, logo_url, description, segment, responsible, phone, email, status || 'active', notes]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('create brand', e); res.status(500).json({ error: e.message }); }
});

router.put('/brands/:id', async (req, res) => {
  try {
    const { name, razao_social, cnpj, logo_url, description, segment, responsible, phone, email, status, notes } = req.body;
    const r = await query(
      `UPDATE merch_brands SET name=$1, razao_social=$2, cnpj=$3, logo_url=$4, description=$5, segment=$6, responsible=$7, phone=$8, email=$9, status=$10, notes=$11, updated_at=NOW() WHERE id=$12 AND organization_id=$13 RETURNING *`,
      [name, razao_social, cnpj, logo_url, description, segment, responsible, phone, email, status, notes, req.params.id, req.user.organization_id]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('update brand', e); res.status(500).json({ error: e.message }); }
});

router.delete('/brands/:id', async (req, res) => {
  try {
    await query('DELETE FROM merch_brands WHERE id=$1 AND organization_id=$2', [req.params.id, req.user.organization_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== CATEGORIES ====================
router.get('/categories', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const r = await query('SELECT * FROM merch_categories WHERE organization_id=$1 ORDER BY name', [req.user.organization_id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/categories', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const { name, description, status } = req.body;
    const r = await query(
      'INSERT INTO merch_categories (organization_id, name, description, status) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.organization_id, name, description, status || 'active']
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const r = await query(
      'UPDATE merch_categories SET name=$1, description=$2, status=$3 WHERE id=$4 AND organization_id=$5 RETURNING *',
      [name, description, status, req.params.id, req.user.organization_id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await query('DELETE FROM merch_categories WHERE id=$1 AND organization_id=$2', [req.params.id, req.user.organization_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SUBCATEGORIES ====================
router.get('/subcategories', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const { category_id } = req.query;
    let sql = 'SELECT s.*, c.name as category_name FROM merch_subcategories s JOIN merch_categories c ON c.id = s.category_id WHERE s.organization_id=$1';
    const params = [req.user.organization_id];
    if (category_id) { params.push(category_id); sql += ` AND s.category_id=$${params.length}`; }
    sql += ' ORDER BY c.name, s.name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subcategories', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const { name, category_id, description, status } = req.body;
    const r = await query(
      'INSERT INTO merch_subcategories (organization_id, category_id, name, description, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.organization_id, category_id, name, description, status || 'active']
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/subcategories/:id', async (req, res) => {
  try {
    const { name, category_id, description, status } = req.body;
    const r = await query(
      'UPDATE merch_subcategories SET name=$1, category_id=$2, description=$3, status=$4 WHERE id=$5 AND organization_id=$6 RETURNING *',
      [name, category_id, description, status, req.params.id, req.user.organization_id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/subcategories/:id', async (req, res) => {
  try {
    await query('DELETE FROM merch_subcategories WHERE id=$1 AND organization_id=$2', [req.params.id, req.user.organization_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== PRODUCTS ====================
router.get('/products', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const { brand_id, category_id, subcategory_id, status, search } = req.query;
    let sql = `SELECT p.*, b.name as brand_name, c.name as category_name, sc.name as subcategory_name
               FROM merch_products p
               JOIN merch_brands b ON b.id = p.brand_id
               JOIN merch_categories c ON c.id = p.category_id
               JOIN merch_subcategories sc ON sc.id = p.subcategory_id
               WHERE p.organization_id = $1`;
    const params = [orgId];
    if (brand_id) { params.push(brand_id); sql += ` AND p.brand_id=$${params.length}`; }
    if (category_id) { params.push(category_id); sql += ` AND p.category_id=$${params.length}`; }
    if (subcategory_id) { params.push(subcategory_id); sql += ` AND p.subcategory_id=$${params.length}`; }
    if (status) { params.push(status); sql += ` AND p.status=$${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`; }
    sql += ' ORDER BY p.name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { logError('get products', e); res.status(500).json({ error: e.message }); }
});

router.post('/products', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const { name, brand_id, category_id, subcategory_id, sku, internal_code, barcode, description, image_url, unit, status } = req.body;
    const r = await query(
      `INSERT INTO merch_products (organization_id, brand_id, category_id, subcategory_id, name, sku, internal_code, barcode, description, image_url, unit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [orgId, brand_id, category_id, subcategory_id, name, sku, internal_code, barcode, description, image_url, unit || 'un', status || 'active']
    );
    res.json(r.rows[0]);
  } catch (e) { logError('create product', e); res.status(500).json({ error: e.message }); }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, brand_id, category_id, subcategory_id, sku, internal_code, barcode, description, image_url, unit, status } = req.body;
    const r = await query(
      `UPDATE merch_products SET name=$1, brand_id=$2, category_id=$3, subcategory_id=$4, sku=$5, internal_code=$6, barcode=$7, description=$8, image_url=$9, unit=$10, status=$11, updated_at=NOW()
       WHERE id=$12 AND organization_id=$13 RETURNING *`,
      [name, brand_id, category_id, subcategory_id, sku, internal_code, barcode, description, image_url, unit, status, req.params.id, req.user.organization_id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await query('DELETE FROM merch_products WHERE id=$1 AND organization_id=$2', [req.params.id, req.user.organization_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk import products
router.post('/products/import', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const { items, auto_create } = req.body;
    const results = { success: 0, errors: [] };

    for (const item of items) {
      try {
        let brandRow = (await query('SELECT id FROM merch_brands WHERE organization_id=$1 AND name ILIKE $2', [orgId, item.brand_name])).rows[0];
        if (!brandRow && auto_create) {
          brandRow = (await query('INSERT INTO merch_brands (organization_id, name) VALUES ($1,$2) RETURNING id', [orgId, item.brand_name])).rows[0];
        }
        if (!brandRow) { results.errors.push({ row: item.name, error: `Marca "${item.brand_name}" não encontrada` }); continue; }

        let catRow = (await query('SELECT id FROM merch_categories WHERE organization_id=$1 AND name ILIKE $2', [orgId, item.category_name])).rows[0];
        if (!catRow && auto_create) {
          catRow = (await query('INSERT INTO merch_categories (organization_id, name) VALUES ($1,$2) RETURNING id', [orgId, item.category_name])).rows[0];
        }
        if (!catRow) { results.errors.push({ row: item.name, error: `Categoria "${item.category_name}" não encontrada` }); continue; }

        let subRow = (await query('SELECT id FROM merch_subcategories WHERE organization_id=$1 AND category_id=$2 AND name ILIKE $3', [orgId, catRow.id, item.subcategory_name])).rows[0];
        if (!subRow && auto_create) {
          subRow = (await query('INSERT INTO merch_subcategories (organization_id, category_id, name) VALUES ($1,$2,$3) RETURNING id', [orgId, catRow.id, item.subcategory_name])).rows[0];
        }
        if (!subRow) { results.errors.push({ row: item.name, error: `Subcategoria "${item.subcategory_name}" não encontrada` }); continue; }

        const dup = (await query('SELECT id FROM merch_products WHERE organization_id=$1 AND brand_id=$2 AND name ILIKE $3', [orgId, brandRow.id, item.name])).rows[0];
        if (dup) { results.errors.push({ row: item.name, error: 'Produto duplicado' }); continue; }

        await query(
          `INSERT INTO merch_products (organization_id, brand_id, category_id, subcategory_id, name, sku, barcode, image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [orgId, brandRow.id, catRow.id, subRow.id, item.name, item.sku || null, item.barcode || null, item.image_url || null]
        );
        results.success++;
      } catch (itemErr) {
        results.errors.push({ row: item.name, error: itemErr.message });
      }
    }
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== PDV BRANDS ====================
router.get('/pdv-brands/:pdvId', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const r = await query(
      `SELECT pb.*, b.name as brand_name, b.logo_url, b.segment
       FROM merch_pdv_brands pb JOIN merch_brands b ON b.id = pb.brand_id
       WHERE pb.pdv_id=$1 AND pb.organization_id=$2 ORDER BY b.name`,
      [req.params.pdvId, req.user.organization_id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pdv-brands', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const { pdv_id, brand_id } = req.body;
    const r = await query(
      `INSERT INTO merch_pdv_brands (organization_id, pdv_id, brand_id) VALUES ($1,$2,$3) ON CONFLICT (pdv_id, brand_id) DO UPDATE SET active=true RETURNING *`,
      [req.user.organization_id, pdv_id, brand_id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/pdv-brands/:id', async (req, res) => {
  try {
    await query('DELETE FROM merch_pdv_brands WHERE id=$1 AND organization_id=$2', [req.params.id, req.user.organization_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== MIX (PDV BRAND PRODUCTS) ====================
router.get('/mix/:pdvId/:brandId', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const r = await query(
      `SELECT pbp.*, p.name as product_name, p.sku, p.barcode, p.image_url, p.unit,
              c.name as category_name, sc.name as subcategory_name
       FROM merch_pdv_brand_products pbp
       JOIN merch_products p ON p.id = pbp.product_id
       JOIN merch_categories c ON c.id = p.category_id
       JOIN merch_subcategories sc ON sc.id = p.subcategory_id
       WHERE pbp.pdv_id=$1 AND pbp.brand_id=$2 AND pbp.organization_id=$3
       ORDER BY p.name`,
      [req.params.pdvId, req.params.brandId, req.user.organization_id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/mix', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const { pdv_id, brand_id, product_ids, mandatory, priority } = req.body;
    const orgId = req.user.organization_id;
    const inserted = [];
    for (const pid of product_ids) {
      const r = await query(
        `INSERT INTO merch_pdv_brand_products (organization_id, pdv_id, brand_id, product_id, mandatory, priority)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (pdv_id, brand_id, product_id) DO UPDATE SET active=true, updated_at=NOW() RETURNING *`,
        [orgId, pdv_id, brand_id, pid, mandatory || false, priority || 'media']
      );
      inserted.push(r.rows[0]);
    }
    res.json(inserted);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/mix/:id', async (req, res) => {
  try {
    const { active, mandatory, priority, notes } = req.body;
    const r = await query(
      `UPDATE merch_pdv_brand_products SET active=$1, mandatory=$2, priority=$3, notes=$4, updated_at=NOW() WHERE id=$5 AND organization_id=$6 RETURNING *`,
      [active, mandatory, priority, notes, req.params.id, req.user.organization_id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/mix', async (req, res) => {
  try {
    const { pdv_id, brand_id, product_ids } = req.body;
    for (const pid of product_ids) {
      await query('DELETE FROM merch_pdv_brand_products WHERE pdv_id=$1 AND brand_id=$2 AND product_id=$3 AND organization_id=$4',
        [pdv_id, brand_id, pid, req.user.organization_id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== REPORTS ====================
router.get('/reports/brand/:brandId', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const r = await query(
      `SELECT pb.pdv_id, pb.pdv_id as pdv_name,
              COUNT(pbp.id) as product_count
       FROM merch_pdv_brands pb
       LEFT JOIN merch_pdv_brand_products pbp ON pbp.pdv_id = pb.pdv_id AND pbp.brand_id = pb.brand_id AND pbp.active=true
       WHERE pb.brand_id=$1 AND pb.organization_id=$2 AND pb.active=true
       GROUP BY pb.pdv_id ORDER BY pb.pdv_id`,
      [req.params.brandId, orgId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/reports/pdv/:pdvId', async (req, res) => {
  try {
    await ensureMerchandisingInfra();
    const orgId = req.user.organization_id;
    const brands = await query(
      `SELECT b.id, b.name, b.logo_url, COUNT(pbp.id) as product_count
       FROM merch_pdv_brands pb JOIN merch_brands b ON b.id = pb.brand_id
       LEFT JOIN merch_pdv_brand_products pbp ON pbp.pdv_id=pb.pdv_id AND pbp.brand_id=pb.brand_id AND pbp.active=true
       WHERE pb.pdv_id=$1 AND pb.organization_id=$2 AND pb.active=true
       GROUP BY b.id, b.name, b.logo_url ORDER BY b.name`,
      [req.params.pdvId, orgId]
    );
    res.json(brands.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
