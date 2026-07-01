import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/holding/dashboard
// Retorna cards e agregados por empresa + alertas
router.get('/dashboard', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Empresas + contagem de ativos
    const companies = await query(
      `SELECT c.id, c.name, c.trade_name, c.color, c.is_active, c.punch_facial_required,
        (SELECT COUNT(*)::int FROM employees e WHERE e.company_id = c.id AND e.status = 'ativo') AS active_employees,
        (SELECT COUNT(*)::int FROM punch_adjustments pa WHERE pa.company_id = c.id AND pa.status = 'pending') AS pending_adjustments,
        (SELECT COUNT(*)::int FROM document_deliveries dd WHERE dd.company_id = c.id AND dd.status IN ('sent') ) AS pending_deliveries
       FROM companies c
       WHERE c.organization_id = $1
       ORDER BY c.name ASC`,
      [orgId]
    );

    // Totais globais
    const totals = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1 AND status = 'ativo') AS active_employees,
         (SELECT COUNT(*)::int FROM punch_adjustments WHERE organization_id = $1 AND status = 'pending') AS pending_adjustments,
         (SELECT COUNT(*)::int FROM document_deliveries WHERE organization_id = $1 AND status = 'sent') AS pending_deliveries,
         (SELECT COUNT(*)::int FROM companies WHERE organization_id = $1 AND is_active = true) AS active_companies`,
      [orgId]
    );

    // Alertas recentes (ajustes pendentes + entregas não lidas há > 24h)
    const alerts = await query(
      `SELECT
         'punch_adjustment' AS kind,
         pa.id, pa.employee_id, e.full_name AS employee_name, pa.company_id,
         c.name AS company_name, pa.type AS detail, pa.created_at
       FROM punch_adjustments pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       LEFT JOIN companies c ON c.id = pa.company_id
       WHERE pa.organization_id = $1 AND pa.status = 'pending'
       ORDER BY pa.created_at DESC
       LIMIT 20`,
      [orgId]
    );

    res.json({
      date: dateStr,
      totals: totals.rows[0] || {},
      companies: companies.rows,
      alerts: alerts.rows,
    });
  } catch (err) {
    console.error('[holding dashboard]', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ PUNCH ADJUSTMENTS ============
router.get('/adjustments', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status, company_id } = req.query;
    const where = ['pa.organization_id = $1'];
    const params = [orgId];
    if (status) { params.push(status); where.push(`pa.status = $${params.length}`); }
    if (company_id) { params.push(company_id); where.push(`pa.company_id = $${params.length}`); }
    const { rows } = await query(
      `SELECT pa.*, e.full_name AS employee_name, c.name AS company_name
       FROM punch_adjustments pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       LEFT JOIN companies c ON c.id = pa.company_id
       WHERE ${where.join(' AND ')}
       ORDER BY pa.created_at DESC LIMIT 200`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/adjustments', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, punch_date, type, justification, attachment_url, company_id } = req.body;
    if (!employee_id || !punch_date || !type || !justification) {
      return res.status(400).json({ error: 'Campos obrigatórios: employee_id, punch_date, type, justification' });
    }
    const { rows } = await query(
      `INSERT INTO punch_adjustments (organization_id, company_id, employee_id, punch_date, type, justification, attachment_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, company_id || null, employee_id, punch_date, type, justification, attachment_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/adjustments/:id', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status, review_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const { rows } = await query(
      `UPDATE punch_adjustments
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND organization_id = $5 RETURNING *`,
      [status, review_note || null, req.user.id, req.params.id, orgId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ajuste não encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ DOCUMENT DELIVERIES ============
router.get('/deliveries', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, company_id, status } = req.query;
    const where = ['dd.organization_id = $1'];
    const params = [orgId];
    if (employee_id) { params.push(employee_id); where.push(`dd.employee_id = $${params.length}`); }
    if (company_id) { params.push(company_id); where.push(`dd.company_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`dd.status = $${params.length}`); }
    const { rows } = await query(
      `SELECT dd.*, e.full_name AS employee_name, c.name AS company_name
       FROM document_deliveries dd
       LEFT JOIN employees e ON e.id = dd.employee_id
       LEFT JOIN companies c ON c.id = dd.company_id
       WHERE ${where.join(' AND ')}
       ORDER BY dd.sent_at DESC LIMIT 200`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deliveries', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, company_id, title, description, file_url, require_signature, require_read } = req.body;
    if (!employee_id || !title || !file_url) {
      return res.status(400).json({ error: 'Campos obrigatórios: employee_id, title, file_url' });
    }
    const { rows } = await query(
      `INSERT INTO document_deliveries
        (organization_id, company_id, employee_id, title, description, file_url, require_signature, require_read, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, company_id || null, employee_id, title, description || null, file_url,
        !!require_signature, require_read !== false, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deliveries/:id/read', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { rows } = await query(
      `UPDATE document_deliveries SET read_at = COALESCE(read_at, NOW()),
        status = CASE WHEN require_signature AND signed_at IS NULL THEN 'read' ELSE 'read' END,
        updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [req.params.id, orgId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Entrega não encontrada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deliveries/:id/sign', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { signature_hash } = req.body;
    const { rows } = await query(
      `UPDATE document_deliveries
       SET signed_at = NOW(), signature_hash = $1, status = 'signed', updated_at = NOW()
       WHERE id = $2 AND organization_id = $3 RETURNING *`,
      [signature_hash || null, req.params.id, orgId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Entrega não encontrada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
