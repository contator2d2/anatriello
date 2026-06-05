// Access Control Dashboard - aggregations for operational, validations, promoters and financial panels.
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

async function ensureColumns() {
  await query(`ALTER TABLE agency_promoters
    ADD COLUMN IF NOT EXISTS promoter_type VARCHAR(20) DEFAULT 'fixo',
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2)`).catch(() => {});
}

// 1) Operational — visits today, currently in PDV, active leaves, pending substitutions
router.get('/operational', async (req, res) => {
  try {
    await ensureColumns();
    const today = await query(`
      SELECT COUNT(*)::int as visits_today,
             SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END)::int as approved,
             SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END)::int as pending,
             SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END)::int as rejected
        FROM visit_requests
       WHERE (period_start::date <= CURRENT_DATE AND COALESCE(period_end::date, period_start::date) >= CURRENT_DATE)
          OR created_at::date = CURRENT_DATE
    `).catch(() => ({ rows: [{ visits_today: 0, approved: 0, pending: 0, rejected: 0 }] }));

    const inPdv = await query(`
      SELECT COUNT(*)::int as in_pdv FROM access_entry_logs
       WHERE entry_at::date = CURRENT_DATE AND exit_at IS NULL
    `).catch(() => ({ rows: [{ in_pdv: 0 }] }));

    const leaves = await query(`
      SELECT pl.*, p.name as promoter_name, s.name as substitute_name
        FROM promoter_leaves pl
        JOIN agency_promoters p ON p.id = pl.promoter_id
        LEFT JOIN agency_promoters s ON s.id = pl.substitute_promoter_id
       WHERE pl.status='active' AND (pl.end_date IS NULL OR pl.end_date >= CURRENT_DATE)
       ORDER BY pl.created_at DESC LIMIT 50
    `).catch(() => ({ rows: [] }));

    const pendingSub = await query(`
      SELECT COUNT(*)::int as pending_substitution
        FROM promoter_leaves
       WHERE status='active' AND substitute_promoter_id IS NULL
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    `).catch(() => ({ rows: [{ pending_substitution: 0 }] }));

    res.json({
      ...today.rows[0],
      in_pdv: inPdv.rows[0].in_pdv,
      active_leaves: leaves.rows,
      pending_substitution: pendingSub.rows[0].pending_substitution,
    });
  } catch (e) {
    logError('dashboard.operational', e);
    res.status(500).json({ error: 'Erro' });
  }
});

// 2) Validations IA — pending, score average, rejections, critical divergences
router.get('/validations', async (req, res) => {
  try {
    const agg = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending','analyzing'))::int as pending,
        COUNT(*) FILTER (WHERE status IN ('approved','pre_approved'))::int as approved,
        COUNT(*) FILTER (WHERE status='rejected' OR override_status='rejected')::int as rejected,
        COUNT(*) FILTER (WHERE status='divergent')::int as divergent,
        AVG(score) FILTER (WHERE score > 0)::numeric(5,2) as avg_score
      FROM promoter_document_validations
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ pending: 0, approved: 0, rejected: 0, divergent: 0, avg_score: 0 }] }));

    const recent = await query(`
      SELECT v.id, v.status, v.score, v.created_at, v.divergences,
             p.name as promoter_name, p.cpf as promoter_cpf,
             r.name as rede_name
        FROM promoter_document_validations v
        JOIN agency_promoters p ON p.id = v.agency_promoter_id
        LEFT JOIN merch_redes r ON r.id = v.rede_id
       ORDER BY v.created_at DESC LIMIT 20
    `).catch(() => ({ rows: [] }));

    res.json({ ...agg.rows[0], recent: recent.rows });
  } catch (e) {
    logError('dashboard.validations', e);
    res.status(500).json({ error: 'Erro' });
  }
});

// 3) Promoters — totals by type, conformity, availability
router.get('/promoters', async (req, res) => {
  try {
    await ensureColumns();
    const totals = await query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status='active')::int as active,
        COUNT(*) FILTER (WHERE status='blocked')::int as blocked,
        COUNT(*) FILTER (WHERE COALESCE(promoter_type,'fixo')='fixo')::int as fixo,
        COUNT(*) FILTER (WHERE promoter_type='freelance')::int as freelance,
        COUNT(*) FILTER (WHERE promoter_type='substituto')::int as substituto,
        COUNT(*) FILTER (WHERE COALESCE(is_available,true)=true AND status='active')::int as available
      FROM agency_promoters
    `);

    const byAgency = await query(`
      SELECT a.id, a.name as agency_name,
             COUNT(p.id)::int as total,
             COUNT(p.id) FILTER (WHERE p.status='active')::int as active,
             COUNT(p.id) FILTER (WHERE p.promoter_type='freelance')::int as freelance
        FROM agencies a
        LEFT JOIN agency_promoters p ON p.agency_id = a.id
       GROUP BY a.id, a.name
       ORDER BY a.name LIMIT 50
    `).catch(() => ({ rows: [] }));

    res.json({ ...totals.rows[0], by_agency: byAgency.rows });
  } catch (e) {
    logError('dashboard.promoters', e);
    res.status(500).json({ error: 'Erro' });
  }
});

// 4) Financial — contracts expiring 30d, freelancers activated this month, estimated cost
router.get('/financial', async (req, res) => {
  try {
    await ensureColumns();
    const contractsExpiring = await query(`
      SELECT id, name, contract_end_date
        FROM agency_promoters
       WHERE contract_end_date IS NOT NULL
         AND contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
       ORDER BY contract_end_date ASC LIMIT 50
    `).catch(() => ({ rows: [] }));

    const freelancersMonth = await query(`
      SELECT COUNT(DISTINCT p.id)::int as count,
             COALESCE(SUM(p.hourly_rate * 6), 0)::numeric(12,2) as estimated_cost
        FROM agency_promoters p
        LEFT JOIN visit_requests v ON v.promoter_id = p.id
       WHERE p.promoter_type IN ('freelance','substituto')
         AND v.created_at >= date_trunc('month', CURRENT_DATE)
    `).catch(() => ({ rows: [{ count: 0, estimated_cost: 0 }] }));

    const costByPdv = await query(`
      SELECT su.id, su.name as pdv_name,
             COUNT(v.id)::int as visits,
             COALESCE(SUM(p.hourly_rate * 6), 0)::numeric(12,2) as estimated_cost
        FROM visit_requests v
        JOIN agency_promoters p ON p.id = v.promoter_id
        LEFT JOIN supermarket_units su ON su.id = v.supermarket_unit_id
       WHERE p.promoter_type IN ('freelance','substituto')
         AND v.created_at >= date_trunc('month', CURRENT_DATE)
       GROUP BY su.id, su.name
       ORDER BY estimated_cost DESC LIMIT 20
    `).catch(() => ({ rows: [] }));

    res.json({
      contracts_expiring: contractsExpiring.rows,
      freelancers_this_month: freelancersMonth.rows[0],
      cost_by_pdv: costByPdv.rows,
    });
  } catch (e) {
    logError('dashboard.financial', e);
    res.status(500).json({ error: 'Erro' });
  }
});

export default router;
