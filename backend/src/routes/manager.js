// ============================================
// APP GESTOR — Aprovações centralizadas (Fase 3)
// ============================================
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

function logError(scope, err) {
  console.error(`[manager.${scope}]`, err?.message || err);
}

// GET /api/manager/pending — resumo de tudo que aguarda aprovação
router.get('/pending', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const supervisorFilter = req.query.mine === '1'
      ? `AND (e.supervisor_id IN (SELECT id FROM employees WHERE user_id = $2) OR e.supervisor_id IS NULL)`
      : '';
    const params = supervisorFilter ? [orgId, req.userId] : [orgId];

    const [ot, vac, med, adj] = await Promise.all([
      query(
        `SELECT ot.id, ot.request_date, ot.requested_start, ot.requested_end, ot.reason, ot.created_at,
                e.id AS employee_id, e.full_name AS employee_name, e.photo_url, c.trade_name AS company_name
         FROM overtime_requests ot
         JOIN employees e ON e.id = ot.employee_id
         LEFT JOIN companies c ON c.id = e.company_id
         WHERE ot.organization_id = $1 AND ot.status = 'pendente' ${supervisorFilter}
         ORDER BY ot.created_at DESC LIMIT 100`, params
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT v.id, v.start_date, v.end_date, v.days_total, v.vacation_type, v.notes, v.created_at,
                e.id AS employee_id, e.full_name AS employee_name, e.photo_url, c.trade_name AS company_name
         FROM rh_vacations v
         JOIN employees e ON e.id = v.employee_id
         LEFT JOIN companies c ON c.id = e.company_id
         WHERE v.organization_id = $1 AND COALESCE(v.approved, false) = false AND v.status <> 'cancelada' ${supervisorFilter}
         ORDER BY v.created_at DESC LIMIT 100`, params
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT m.id, m.start_date, m.end_date, m.days, m.cid, m.reason, m.file_url, m.created_at,
                e.id AS employee_id, e.full_name AS employee_name, e.photo_url, c.trade_name AS company_name
         FROM rh_medical_certificates m
         JOIN employees e ON e.id = m.employee_id
         LEFT JOIN companies c ON c.id = e.company_id
         WHERE m.organization_id = $1 AND COALESCE(m.validated, false) = false ${supervisorFilter}
         ORDER BY m.created_at DESC LIMIT 100`, params
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT par.id, par.punch_date, par.requested_times, par.justification, par.created_at,
                e.id AS employee_id, e.full_name AS employee_name, e.photo_url, c.trade_name AS company_name
         FROM punch_adjustment_requests par
         JOIN employees e ON e.id = par.employee_id
         LEFT JOIN companies c ON c.id = e.company_id
         WHERE par.organization_id = $1 AND par.status = 'pending' ${supervisorFilter}
         ORDER BY par.created_at DESC LIMIT 100`, params
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      overtime: ot.rows,
      vacations: vac.rows,
      medical: med.rows,
      adjustments: adj.rows,
      total: ot.rows.length + vac.rows.length + med.rows.length + adj.rows.length,
    });
  } catch (err) {
    logError('pending', err);
    res.status(500).json({ error: 'Erro ao carregar aprovações' });
  }
});

// Ações rápidas (delegam para os endpoints já existentes)
router.post('/overtime/:id/:action', async (req, res) => {
  try {
    const status = req.params.action === 'approve' ? 'aprovado' : 'recusado';
    const supEmp = await query(`SELECT id FROM employees WHERE user_id = $1 LIMIT 1`, [req.userId]);
    const approvedBy = supEmp.rows[0]?.id || null;
    const r = await query(
      `UPDATE overtime_requests SET status=$1, supervisor_notes=$2, approved_by=$3, approved_at=NOW()
       WHERE id=$4 AND organization_id=$5 RETURNING *`,
      [status, req.body?.note || null, approvedBy, req.params.id, req.user.organization_id]
    );
    if (r.rows[0]) {
      await query(
        `INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type)
         VALUES ($1,$2,$3,$4,'overtime_response')`,
        [r.rows[0].organization_id, r.rows[0].employee_id,
         `Hora Extra ${status === 'aprovado' ? '✅ Aprovada' : '❌ Recusada'}`,
         `Data ${r.rows[0].request_date}. ${req.body?.note || ''}`]
      ).catch(() => {});
    }
    res.json(r.rows[0]);
  } catch (err) { logError('overtime', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/vacation/:id/:action', async (req, res) => {
  try {
    const approved = req.params.action === 'approve';
    const r = await query(
      `UPDATE rh_vacations SET approved=$1, status=$2, notes=COALESCE($3, notes), updated_at=NOW()
       WHERE id=$4 AND organization_id=$5 RETURNING *`,
      [approved, approved ? 'aprovada' : 'recusada', req.body?.note || null, req.params.id, req.user.organization_id]
    );
    if (r.rows[0]) {
      await query(
        `INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type)
         VALUES ($1,$2,$3,$4,'vacation_response')`,
        [r.rows[0].organization_id, r.rows[0].employee_id,
         `Férias ${approved ? '✅ Aprovadas' : '❌ Recusadas'}`,
         `${r.rows[0].start_date} → ${r.rows[0].end_date}. ${req.body?.note || ''}`]
      ).catch(() => {});
    }
    res.json(r.rows[0]);
  } catch (err) { logError('vacation', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/medical/:id/:action', async (req, res) => {
  try {
    const validated = req.params.action === 'approve';
    const r = await query(
      `UPDATE rh_medical_certificates SET validated=$1, validated_by=$2, validated_at=NOW(),
         rejection_reason=$3, updated_at=NOW()
       WHERE id=$4 AND organization_id=$5 RETURNING *`,
      [validated, req.userId, validated ? null : (req.body?.note || 'Reprovado'), req.params.id, req.user.organization_id]
    );
    if (r.rows[0]) {
      await query(
        `INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type)
         VALUES ($1,$2,$3,$4,'medical_response')`,
        [r.rows[0].organization_id, r.rows[0].employee_id,
         `Atestado ${validated ? '✅ Validado' : '❌ Recusado'}`,
         `${r.rows[0].start_date} → ${r.rows[0].end_date}. ${req.body?.note || ''}`]
      ).catch(() => {});
    }
    res.json(r.rows[0]);
  } catch (err) { logError('medical', err); res.status(500).json({ error: 'Erro' }); }
});

// Adjustments — reaproveita a lógica do timeclock via chamada interna
router.post('/adjustment/:id/:action', async (req, res, next) => {
  req.url = `/adjustment-requests/${req.params.id}`;
  req.method = 'PATCH';
  req.body = { status: req.params.action === 'approve' ? 'approved' : 'rejected', review_note: req.body?.note };
  // encaminhar para o router do timeclock
  const { default: timeclockRouter } = await import('./timeclock.js');
  timeclockRouter.handle(req, res, next);
});

export default router;
