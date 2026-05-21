
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

// Middleware: attach orgId to every request
router.use(async (req, res, next) => {
  try {
    const orgRes = await query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [req.userId]
    );
    if (!orgRes.rows.length) return res.status(403).json({ error: 'Organização não encontrada' });
    req.orgId = orgRes.rows[0].organization_id;
    next();
  } catch (e) {
    logError('merch checklist middleware', e);
    res.status(500).json({ error: 'Erro ao resolver organização' });
  }
});

// List checklists
router.get('/', async (req, res) => {
  try {
    const { brand_id } = req.query;
    let sql = 'SELECT * FROM brand_checklists WHERE organization_id = $1';
    const params = [req.orgId];
    if (brand_id) {
      sql += ' AND brand_id = $2';
      params.push(brand_id);
    }
    sql += ' ORDER BY name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    logError('get checklists', e);
    res.status(500).json({ error: e.message });
  }
});

// Create checklist
router.post('/', async (req, res) => {
  try {
    const { name, brand_id, description, require_checkin_photo, require_checkout_photo } = req.body;
    const r = await query(
      `INSERT INTO brand_checklists (organization_id, brand_id, name, description, require_checkin_photo, require_checkout_photo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.orgId, brand_id, name, description, require_checkin_photo ?? true, require_checkout_photo ?? false]
    );
    res.json(r.rows[0]);
  } catch (e) {
    logError('create checklist', e);
    res.status(500).json({ error: e.message });
  }
});

// Update checklist
router.put('/:id', async (req, res) => {
  try {
    const { name, description, require_checkin_photo, require_checkout_photo, active } = req.body;
    const r = await query(
      `UPDATE brand_checklists SET name=$1, description=$2, require_checkin_photo=$3, require_checkout_photo=$4, active=$5, updated_at=NOW()
       WHERE id=$6 AND organization_id=$7 RETURNING *`,
      [name, description, require_checkin_photo, require_checkout_photo, active, req.params.id, req.orgId]
    );
    res.json(r.rows[0]);
  } catch (e) {
    logError('update checklist', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete checklist
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM brand_checklists WHERE id=$1 AND organization_id=$2', [req.params.id, req.orgId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
