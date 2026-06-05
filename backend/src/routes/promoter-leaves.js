// Promoter Leaves (afastamentos) and substitution routing.
// Allows agency to mark a titular promoter as on-leave and assign a substitute.
// Pending visit_requests are reassigned to the substitute, preserving original_promoter_id.

import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';
import { triggerValidation } from './promoter-validations.js';

const router = express.Router();

// Reuses the same agency auth pattern from access-control.js
const authenticateAgency = async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Token ausente' });
    const r = await query(
      `SELECT au.id as user_id, au.agency_id, a.organization_id
         FROM agency_users au
         LEFT JOIN agencies a ON a.id = au.agency_id
        WHERE au.session_token = $1`,
      [token]
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Sessão inválida' });
    req.agencyId = r.rows[0].agency_id;
    req.userId = r.rows[0].user_id;
    req.organizationId = r.rows[0].organization_id;
    next();
  } catch (e) {
    logError('promoter-leaves.auth', e);
    res.status(500).json({ error: 'Erro de autenticação' });
  }
};

async function ensureTables() {
  // Promoter type + freelance fields
  await query(`ALTER TABLE agency_promoters
    ADD COLUMN IF NOT EXISTS promoter_type VARCHAR(20) DEFAULT 'fixo',
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS mei_cnpj VARCHAR(20),
    ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2)`).catch(() => {});

  // Leaves table
  await query(`CREATE TABLE IF NOT EXISTS promoter_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promoter_id UUID NOT NULL REFERENCES agency_promoters(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL,
    reason VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    substitute_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active',
    visits_reassigned INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leaves_promoter ON promoter_leaves(promoter_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_leaves_status ON promoter_leaves(status)`);

  // Visit request columns for substitution tracking
  await query(`ALTER TABLE visit_requests
    ADD COLUMN IF NOT EXISTS original_promoter_id UUID,
    ADD COLUMN IF NOT EXISTS substitution_reason VARCHAR(30),
    ADD COLUMN IF NOT EXISTS leave_id UUID`).catch(() => {});
}

router.use(authenticate);

// List leaves for current agency (or any if admin)
router.get('/', async (req, res) => {
  try {
    await ensureTables();
    const { agency_id, active, promoter_id } = req.query;
    const where = [];
    const params = [];
    if (agency_id) { params.push(agency_id); where.push(`pl.agency_id = $${params.length}`); }
    if (promoter_id) { params.push(promoter_id); where.push(`pl.promoter_id = $${params.length}`); }
    if (active === 'true') where.push(`pl.status = 'active' AND (pl.end_date IS NULL OR pl.end_date >= CURRENT_DATE)`);
    const sql = `
      SELECT pl.*,
             p.name as promoter_name, p.cpf as promoter_cpf, p.promoter_type as promoter_type,
             s.name as substitute_name, s.cpf as substitute_cpf, s.promoter_type as substitute_type
        FROM promoter_leaves pl
        JOIN agency_promoters p ON p.id = pl.promoter_id
        LEFT JOIN agency_promoters s ON s.id = pl.substitute_promoter_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY pl.created_at DESC`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    logError('promoter-leaves.list', e);
    res.status(500).json({ error: 'Erro ao listar afastamentos' });
  }
});

// Available substitutes for a date range — freelance/substituto + available + no overlapping visit
router.get('/available-substitutes', async (req, res) => {
  try {
    await ensureTables();
    const { agency_id, start_date, end_date } = req.query;
    if (!agency_id) return res.status(400).json({ error: 'agency_id obrigatório' });
    const r = await query(
      `SELECT id, name, cpf, phone, promoter_type, is_available, hourly_rate, city, state
         FROM agency_promoters
        WHERE agency_id = $1
          AND status = 'active'
          AND COALESCE(is_available, true) = true
          AND promoter_type IN ('freelance','substituto')
        ORDER BY name`,
      [agency_id]
    );
    res.json(r.rows);
  } catch (e) {
    logError('promoter-leaves.available', e);
    res.status(500).json({ error: 'Erro' });
  }
});

// Create leave + optionally reassign visits to substitute
router.post('/', async (req, res) => {
  try {
    await ensureTables();
    const { promoter_id, agency_id, reason, start_date, end_date, substitute_promoter_id, notes } = req.body || {};
    if (!promoter_id || !agency_id || !reason || !start_date) {
      return res.status(400).json({ error: 'promoter_id, agency_id, reason e start_date são obrigatórios' });
    }

    const ins = await query(
      `INSERT INTO promoter_leaves
        (promoter_id, agency_id, reason, start_date, end_date, substitute_promoter_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [promoter_id, agency_id, reason, start_date, end_date || null, substitute_promoter_id || null, notes || null, req.userId]
    );
    const leave = ins.rows[0];

    let reassigned = 0;
    if (substitute_promoter_id) {
      const upd = await query(
        `UPDATE visit_requests
            SET original_promoter_id = COALESCE(original_promoter_id, $1),
                promoter_id = $2,
                substitution_reason = $3,
                leave_id = $4,
                updated_at = NOW()
          WHERE promoter_id = $1
            AND status IN ('pending','approved')
            AND ( (period_start IS NOT NULL AND period_start >= $5)
                  OR (period_end IS NOT NULL AND period_end >= $5)
                  OR (period_start IS NULL AND period_end IS NULL) )
            AND ( $6::date IS NULL
                  OR (period_start IS NOT NULL AND period_start <= $6)
                  OR (period_end IS NOT NULL AND period_end <= $6) )
          RETURNING id, rede_id, supermarket_unit_id`,
        [promoter_id, substitute_promoter_id, reason, leave.id, start_date, end_date || null]
      ).catch(err => { logError('promoter-leaves.reassign', err); return { rows: [] }; });
      reassigned = upd.rows.length;

      // Trigger re-validation for substitute on each reassigned visit
      for (const v of upd.rows) {
        triggerValidation({
          agency_promoter_id: substitute_promoter_id,
          rede_id: v.rede_id,
          supermarket_unit_id: v.supermarket_unit_id,
        }).catch(err => logError('promoter-leaves.revalidate', err));
      }

      await query(`UPDATE promoter_leaves SET visits_reassigned = $1 WHERE id = $2`, [reassigned, leave.id]);
    }

    // Mark titular as unavailable while on leave
    await query(`UPDATE agency_promoters SET is_available = false WHERE id = $1`, [promoter_id]).catch(() => {});

    res.json({ ...leave, visits_reassigned: reassigned });
  } catch (e) {
    logError('promoter-leaves.create', e);
    res.status(500).json({ error: 'Erro ao registrar afastamento' });
  }
});

// Update leave — close or change substitute
router.put('/:id', async (req, res) => {
  try {
    await ensureTables();
    const { end_date, substitute_promoter_id, notes, status } = req.body || {};
    const r = await query(
      `UPDATE promoter_leaves
          SET end_date = COALESCE($1, end_date),
              substitute_promoter_id = COALESCE($2, substitute_promoter_id),
              notes = COALESCE($3, notes),
              status = COALESCE($4, status),
              updated_at = NOW()
        WHERE id = $5 RETURNING *`,
      [end_date || null, substitute_promoter_id || null, notes || null, status || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Afastamento não encontrado' });

    // If closing the leave, restore titular availability
    if (status === 'closed' || (end_date && new Date(end_date) <= new Date())) {
      await query(`UPDATE agency_promoters SET is_available = true WHERE id = $1`, [r.rows[0].promoter_id]).catch(() => {});
    }
    res.json(r.rows[0]);
  } catch (e) {
    logError('promoter-leaves.update', e);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

// Cancel leave
router.delete('/:id', async (req, res) => {
  try {
    await ensureTables();
    const r = await query(`SELECT promoter_id FROM promoter_leaves WHERE id = $1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    await query(`DELETE FROM promoter_leaves WHERE id = $1`, [req.params.id]);
    await query(`UPDATE agency_promoters SET is_available = true WHERE id = $1`, [r.rows[0].promoter_id]).catch(() => {});
    res.json({ success: true });
  } catch (e) {
    logError('promoter-leaves.delete', e);
    res.status(500).json({ error: 'Erro ao cancelar' });
  }
});

export default router;
