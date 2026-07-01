import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/companies - lista empresas da organização
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { rows } = await query(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM employees e WHERE e.company_id = c.id AND e.status = 'ativo') AS active_employees
       FROM companies c
       WHERE c.organization_id = $1
       ORDER BY c.name ASC`,
      [orgId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[companies GET]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM companies WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organization_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies - criar
router.post('/', async (req, res) => {
  try {
    const role = req.user.role;
    if (!['owner', 'admin', 'superadmin'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const {
      name, trade_name, cnpj, logo_url, color, address, city, state,
      phone, email, punch_facial_required = true, punch_gps_required = false,
    } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nome obrigatório' });

    const { rows } = await query(
      `INSERT INTO companies (organization_id, name, trade_name, cnpj, logo_url, color,
        address, city, state, phone, email, punch_facial_required, punch_gps_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.organization_id, name.trim(), trade_name || null, cnpj || null,
        logo_url || null, color || '#3B82F6', address || null, city || null,
        state || null, phone || null, email || null,
        !!punch_facial_required, !!punch_gps_required]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[companies POST]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', async (req, res) => {
  try {
    const role = req.user.role;
    if (!['owner', 'admin', 'superadmin'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const fields = ['name','trade_name','cnpj','logo_url','color','address','city','state','phone','email','is_active','punch_facial_required','punch_gps_required'];
    const sets = [];
    const values = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        values.push(req.body[f]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada a atualizar' });
    sets.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.organization_id);
    const { rows } = await query(
      `UPDATE companies SET ${sets.join(', ')} WHERE id = $${i++} AND organization_id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/companies/:id (soft: desativa)
router.delete('/:id', async (req, res) => {
  try {
    const role = req.user.role;
    if (!['owner', 'admin', 'superadmin'].includes(role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    await query(
      `UPDATE companies SET is_active = false, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organization_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
