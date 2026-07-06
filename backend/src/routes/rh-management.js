import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS rh_item_catalog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      kind VARCHAR(30) NOT NULL DEFAULT 'uniforme', -- uniforme | epi | chave | outro
      name TEXT NOT NULL,
      sku TEXT,
      size TEXT,
      cost_cents INTEGER DEFAULT 0,
      description TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rh_item_catalog_org ON rh_item_catalog(organization_id, kind, active);

    CREATE TABLE IF NOT EXISTS rh_item_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      catalog_id UUID REFERENCES rh_item_catalog(id) ON DELETE SET NULL,
      item_name_snapshot TEXT,
      kind_snapshot VARCHAR(30),
      quantity INTEGER DEFAULT 1,
      cost_cents_snapshot INTEGER DEFAULT 0,
      delivered_at DATE DEFAULT CURRENT_DATE,
      delivered_by UUID,
      returned_at DATE,
      returned_by UUID,
      condition_out TEXT,
      condition_in TEXT,
      notes TEXT,
      status VARCHAR(20) DEFAULT 'ativo', -- ativo | devolvido | perdido | danificado
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rh_item_asg_emp ON rh_item_assignments(employee_id, status);
    CREATE INDEX IF NOT EXISTS idx_rh_item_asg_org ON rh_item_assignments(organization_id, status);

    CREATE TABLE IF NOT EXISTS rh_payroll_checklists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      reference_month DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'aberto', -- aberto | fechado
      notes TEXT,
      created_by UUID,
      closed_by UUID,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, reference_month)
    );

    CREATE TABLE IF NOT EXISTS rh_payroll_checklist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      checklist_id UUID NOT NULL REFERENCES rh_payroll_checklists(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      category VARCHAR(40),
      done BOOLEAN DEFAULT false,
      done_at TIMESTAMPTZ,
      done_by UUID,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rh_pcli_ck ON rh_payroll_checklist_items(checklist_id);

    CREATE TABLE IF NOT EXISTS rh_change_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      alert_type VARCHAR(30) NOT NULL, -- cargo | salario | vale | plano_saude | plano_odonto | outro
      acknowledged BOOLEAN DEFAULT false,
      acknowledged_by UUID,
      acknowledged_at TIMESTAMPTZ,
      changed_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rh_alerts_org ON rh_change_alerts(organization_id, acknowledged, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rh_alerts_emp ON rh_change_alerts(employee_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS employee_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      kind VARCHAR(50) NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(20) DEFAULT 'pendente',
      reviewer_notes TEXT,
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  ensured = true;
}

async function resolveOrgId(req) {
  if (req.organizationId) return req.organizationId;
  if (!req.userId) return null;
  const r = await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId]);
  return r.rows[0]?.organization_id || null;
}

router.use(async (req, res, next) => {
  try {
    await ensureTables();
    req.orgId = await resolveOrgId(req);
    if (!req.orgId) return res.status(403).json({ error: 'Organização não encontrada' });
    next();
  } catch (e) {
    logError('rh-management middleware', e);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// =========================================================
// ITEM CATALOG (uniformes / EPIs / chaves)
// =========================================================
router.get('/items/catalog', async (req, res) => {
  try {
    const { kind } = req.query;
    let sql = 'SELECT * FROM rh_item_catalog WHERE organization_id = $1';
    const params = [req.orgId];
    if (kind) { sql += ' AND kind = $2'; params.push(kind); }
    sql += ' ORDER BY kind, name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { logError('rh.items.catalog.list', e); res.status(500).json({ error: e.message }); }
});

router.post('/items/catalog', async (req, res) => {
  try {
    const { kind, name, sku, size, cost_cents, description, active } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name obrigatório' });
    const r = await query(
      `INSERT INTO rh_item_catalog (organization_id, kind, name, sku, size, cost_cents, description, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.orgId, kind || 'uniforme', name, sku || null, size || null, cost_cents || 0, description || null, active !== false]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('rh.items.catalog.create', e); res.status(500).json({ error: e.message }); }
});

router.put('/items/catalog/:id', async (req, res) => {
  try {
    const { kind, name, sku, size, cost_cents, description, active } = req.body || {};
    const r = await query(
      `UPDATE rh_item_catalog SET kind=$1, name=$2, sku=$3, size=$4, cost_cents=$5, description=$6, active=$7, updated_at=NOW()
       WHERE id=$8 AND organization_id=$9 RETURNING *`,
      [kind, name, sku || null, size || null, cost_cents || 0, description || null, active !== false, req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('rh.items.catalog.update', e); res.status(500).json({ error: e.message }); }
});

router.delete('/items/catalog/:id', async (req, res) => {
  try {
    await query(`DELETE FROM rh_item_catalog WHERE id=$1 AND organization_id=$2`, [req.params.id, req.orgId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================
// ITEM ASSIGNMENTS (delivery + return)
// =========================================================
router.get('/items/assignments', async (req, res) => {
  try {
    const { employee_id, status, kind } = req.query;
    let sql = `
      SELECT a.*, e.full_name AS employee_name, c.name AS catalog_name, c.kind AS catalog_kind
      FROM rh_item_assignments a
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN rh_item_catalog c ON c.id = a.catalog_id
      WHERE a.organization_id = $1`;
    const params = [req.orgId];
    let i = 2;
    if (employee_id) { sql += ` AND a.employee_id = $${i++}`; params.push(employee_id); }
    if (status) { sql += ` AND a.status = $${i++}`; params.push(status); }
    if (kind) { sql += ` AND (a.kind_snapshot = $${i} OR c.kind = $${i})`; params.push(kind); i++; }
    sql += ' ORDER BY a.delivered_at DESC, a.created_at DESC LIMIT 500';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { logError('rh.items.assign.list', e); res.status(500).json({ error: e.message }); }
});

router.post('/items/assignments', async (req, res) => {
  try {
    const { employee_id, catalog_id, quantity, delivered_at, condition_out, notes } = req.body || {};
    if (!employee_id) return res.status(400).json({ error: 'employee_id obrigatório' });
    let snap = { name: null, kind: null, cost: 0 };
    if (catalog_id) {
      const c = await query(`SELECT name, kind, cost_cents FROM rh_item_catalog WHERE id=$1 AND organization_id=$2`, [catalog_id, req.orgId]);
      if (c.rows[0]) snap = { name: c.rows[0].name, kind: c.rows[0].kind, cost: c.rows[0].cost_cents };
    }
    const r = await query(
      `INSERT INTO rh_item_assignments
        (organization_id, employee_id, catalog_id, item_name_snapshot, kind_snapshot, quantity, cost_cents_snapshot, delivered_at, delivered_by, condition_out, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date, CURRENT_DATE),$9,$10,$11) RETURNING *`,
      [req.orgId, employee_id, catalog_id || null, snap.name, snap.kind, quantity || 1, snap.cost * (quantity || 1),
       delivered_at || null, req.userId, condition_out || null, notes || null]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('rh.items.assign.create', e); res.status(500).json({ error: e.message }); }
});

router.post('/items/assignments/:id/return', async (req, res) => {
  try {
    const { returned_at, condition_in, notes, status } = req.body || {};
    const r = await query(
      `UPDATE rh_item_assignments SET returned_at=COALESCE($1::date, CURRENT_DATE), returned_by=$2,
         condition_in=$3, notes=COALESCE($4, notes), status=$5, updated_at=NOW()
       WHERE id=$6 AND organization_id=$7 RETURNING *`,
      [returned_at || null, req.userId, condition_in || null, notes || null, status || 'devolvido', req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('rh.items.assign.return', e); res.status(500).json({ error: e.message }); }
});

router.delete('/items/assignments/:id', async (req, res) => {
  try {
    await query(`DELETE FROM rh_item_assignments WHERE id=$1 AND organization_id=$2`, [req.params.id, req.orgId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/items/summary', async (req, res) => {
  try {
    const r = await query(
      `SELECT COALESCE(kind_snapshot,'outro') AS kind,
              COUNT(*) FILTER (WHERE status='ativo') AS ativos,
              COUNT(*) FILTER (WHERE status='devolvido') AS devolvidos,
              COALESCE(SUM(cost_cents_snapshot) FILTER (WHERE status='ativo'),0) AS custo_ativo_cents
       FROM rh_item_assignments WHERE organization_id=$1 GROUP BY 1`,
      [req.orgId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================
// PAYROLL CHECKLIST
// =========================================================
const DEFAULT_PAYROLL_TEMPLATE = [
  { label: 'Conferir alterações de cargo', category: 'cargo' },
  { label: 'Conferir alterações de salário', category: 'salario' },
  { label: 'Cancelamentos de vales', category: 'vale' },
  { label: 'Alterações de plano de saúde', category: 'plano_saude' },
  { label: 'Alterações de plano odontológico', category: 'plano_odonto' },
  { label: 'Conferir horas extras aprovadas', category: 'horas_extras' },
  { label: 'Conferir faltas e atestados', category: 'faltas' },
  { label: 'Conferir férias do mês', category: 'ferias' },
  { label: 'Conferir vale-transporte', category: 'vale_transporte' },
  { label: 'Conferir adiantamentos', category: 'adiantamento' },
  { label: 'Entrega/devolução de uniformes e EPIs', category: 'uniformes' },
  { label: 'Fechar folha e gerar holerites', category: 'fechamento' },
];

router.get('/payroll-checklists', async (req, res) => {
  try {
    const r = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM rh_payroll_checklist_items i WHERE i.checklist_id = p.id) AS total_items,
        (SELECT COUNT(*) FROM rh_payroll_checklist_items i WHERE i.checklist_id = p.id AND i.done) AS done_items
       FROM rh_payroll_checklists p WHERE organization_id=$1
       ORDER BY reference_month DESC LIMIT 36`,
      [req.orgId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payroll-checklists', async (req, res) => {
  try {
    const { reference_month, notes } = req.body || {};
    if (!reference_month) return res.status(400).json({ error: 'reference_month obrigatório' });
    // Normalize to first day of month
    const dt = new Date(reference_month);
    const norm = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1)).toISOString().slice(0,10);
    const existing = await query(`SELECT * FROM rh_payroll_checklists WHERE organization_id=$1 AND reference_month=$2`, [req.orgId, norm]);
    if (existing.rows[0]) return res.json(existing.rows[0]);
    const r = await query(
      `INSERT INTO rh_payroll_checklists (organization_id, reference_month, notes, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.orgId, norm, notes || null, req.userId]
    );
    const cid = r.rows[0].id;
    for (let i = 0; i < DEFAULT_PAYROLL_TEMPLATE.length; i++) {
      const it = DEFAULT_PAYROLL_TEMPLATE[i];
      await query(
        `INSERT INTO rh_payroll_checklist_items (checklist_id, label, category, sort_order) VALUES ($1,$2,$3,$4)`,
        [cid, it.label, it.category, i]
      );
    }
    res.json(r.rows[0]);
  } catch (e) { logError('rh.payroll.create', e); res.status(500).json({ error: e.message }); }
});

router.get('/payroll-checklists/:id', async (req, res) => {
  try {
    const p = await query(`SELECT * FROM rh_payroll_checklists WHERE id=$1 AND organization_id=$2`, [req.params.id, req.orgId]);
    if (!p.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    const items = await query(`SELECT * FROM rh_payroll_checklist_items WHERE checklist_id=$1 ORDER BY sort_order, created_at`, [req.params.id]);
    // Alerts summary for the month
    const alerts = await query(
      `SELECT * FROM rh_change_alerts WHERE organization_id=$1
        AND date_trunc('month', created_at) = date_trunc('month', $2::date)
        ORDER BY created_at DESC`,
      [req.orgId, p.rows[0].reference_month]
    );
    res.json({ ...p.rows[0], items: items.rows, alerts: alerts.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/payroll-checklists/:id/items/:itemId', async (req, res) => {
  try {
    const { done, notes, label } = req.body || {};
    const r = await query(
      `UPDATE rh_payroll_checklist_items
       SET done = COALESCE($1, done),
           done_at = CASE WHEN $1 = TRUE THEN NOW() WHEN $1 = FALSE THEN NULL ELSE done_at END,
           done_by = CASE WHEN $1 = TRUE THEN $2 WHEN $1 = FALSE THEN NULL ELSE done_by END,
           notes = COALESCE($3, notes),
           label = COALESCE($4, label)
       WHERE id=$5 AND checklist_id=$6 RETURNING *`,
      [typeof done === 'boolean' ? done : null, req.userId, notes ?? null, label ?? null, req.params.itemId, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payroll-checklists/:id/items', async (req, res) => {
  try {
    const { label, category } = req.body || {};
    if (!label) return res.status(400).json({ error: 'label obrigatório' });
    const r = await query(
      `INSERT INTO rh_payroll_checklist_items (checklist_id, label, category, sort_order)
       VALUES ($1,$2,$3, COALESCE((SELECT MAX(sort_order)+1 FROM rh_payroll_checklist_items WHERE checklist_id=$1),0))
       RETURNING *`,
      [req.params.id, label, category || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/payroll-checklists/:id/items/:itemId', async (req, res) => {
  try {
    await query(`DELETE FROM rh_payroll_checklist_items WHERE id=$1 AND checklist_id=$2`, [req.params.itemId, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payroll-checklists/:id/close', async (req, res) => {
  try {
    const r = await query(
      `UPDATE rh_payroll_checklists SET status='fechado', closed_by=$1, closed_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND organization_id=$3 RETURNING *`,
      [req.userId, req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payroll-checklists/:id/reopen', async (req, res) => {
  try {
    const r = await query(
      `UPDATE rh_payroll_checklists SET status='aberto', closed_by=NULL, closed_at=NULL, updated_at=NOW()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================
// CHANGE ALERTS
// =========================================================
router.get('/change-alerts', async (req, res) => {
  try {
    const { acknowledged, alert_type, employee_id } = req.query;
    let sql = `SELECT a.*, e.full_name AS employee_name
               FROM rh_change_alerts a LEFT JOIN employees e ON e.id = a.employee_id
               WHERE a.organization_id=$1`;
    const params = [req.orgId];
    let i = 2;
    if (acknowledged === 'true') { sql += ` AND a.acknowledged = TRUE`; }
    if (acknowledged === 'false') { sql += ` AND a.acknowledged = FALSE`; }
    if (alert_type) { sql += ` AND a.alert_type = $${i++}`; params.push(alert_type); }
    if (employee_id) { sql += ` AND a.employee_id = $${i++}`; params.push(employee_id); }
    sql += ' ORDER BY a.created_at DESC LIMIT 500';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/change-alerts/:id/acknowledge', async (req, res) => {
  try {
    const r = await query(
      `UPDATE rh_change_alerts SET acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW()
       WHERE id=$2 AND organization_id=$3 RETURNING *`,
      [req.userId, req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manual alert creation (used internally too)
router.post('/change-alerts', async (req, res) => {
  try {
    const { employee_id, field, old_value, new_value, alert_type } = req.body || {};
    if (!employee_id || !field || !alert_type) return res.status(400).json({ error: 'campos obrigatórios' });
    const r = await query(
      `INSERT INTO rh_change_alerts (organization_id, employee_id, field, old_value, new_value, alert_type, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.orgId, employee_id, field, String(old_value ?? ''), String(new_value ?? ''), alert_type, req.userId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =========================================================
// EMPLOYEE REQUESTS (admin view of collaborator requests)
// =========================================================
router.get('/requests', async (req, res) => {
  try {
    const { status, kind } = req.query;
    let sql = `SELECT r.*, e.full_name AS employee_name
               FROM employee_requests r LEFT JOIN employees e ON e.id = r.employee_id
               WHERE r.organization_id=$1`;
    const params = [req.orgId];
    let i = 2;
    if (status) { sql += ` AND r.status=$${i++}`; params.push(status); }
    if (kind) { sql += ` AND r.kind=$${i++}`; params.push(kind); }
    sql += ' ORDER BY r.created_at DESC LIMIT 500';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { logError('rh.requests.list', e); res.status(500).json({ error: e.message }); }
});

router.patch('/requests/:id', async (req, res) => {
  try {
    const { status, reviewer_notes } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status obrigatório' });
    const r = await query(
      `UPDATE employee_requests SET status=$1, reviewer_notes=$2, reviewed_by=$3, reviewed_at=NOW()
       WHERE id=$4 AND organization_id=$5 RETURNING *`,
      [status, reviewer_notes || null, req.userId, req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) { logError('rh.requests.update', e); res.status(500).json({ error: e.message }); }
});

export default router;
export { ensureTables as ensureRhManagementTables };
