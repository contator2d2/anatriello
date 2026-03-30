import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

// Helper: get user org_id
async function getUserOrgId(userId) {
  const r = await query(
    `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.organization_id;
}

// Helper: audit log
async function auditLog(orgId, entityType, entityId, action, changes, userId) {
  for (const ch of changes) {
    await query(
      `INSERT INTO rh_audit_log (organization_id, entity_type, entity_id, action, field_name, old_value, new_value, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [orgId, entityType, entityId, action, ch.field, ch.oldVal, ch.newVal, userId]
    );
  }
}

// ===== EMPLOYEES =====

// List employees
router.get('/employees', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);

    const { status, search, department_id, branch_id } = req.query;
    let sql = `SELECT e.*, d.name as department_name, b.name as branch_name
               FROM employees e
               LEFT JOIN rh_departments d ON d.id = e.department_id
               LEFT JOIN branches b ON b.id = e.branch_id
               WHERE e.organization_id = $1`;
    const params = [orgId];
    let idx = 2;

    if (status) { sql += ` AND e.status = $${idx++}`; params.push(status); }
    if (department_id) { sql += ` AND e.department_id = $${idx++}`; params.push(department_id); }
    if (branch_id) { sql += ` AND e.branch_id = $${idx++}`; params.push(branch_id); }
    if (search) { sql += ` AND (e.full_name ILIKE $${idx} OR e.cpf ILIKE $${idx} OR e.email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    sql += ` ORDER BY e.full_name`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.employees.list', err);
    res.status(500).json({ error: 'Erro ao listar colaboradores' });
  }
});

// Get single employee
router.get('/employees/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, d.name as department_name, b.name as branch_name, cc.name as cost_center_name
       FROM employees e
       LEFT JOIN rh_departments d ON d.id = e.department_id
       LEFT JOIN branches b ON b.id = e.branch_id
       LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
       WHERE e.id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.employees.get', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// Create employee
router.post('/employees', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const d = req.body;
    const result = await query(
      `INSERT INTO employees (organization_id, full_name, social_name, cpf, rg, rg_issuer, birth_date, gender, marital_status, email, phone, phone2,
        address, address_number, complement, neighborhood, city, state, zip_code,
        registration_number, worker_profile, employment_type, position, role_level,
        branch_id, department_id, cost_center_id, direct_manager_id,
        admission_date, contract_end_date, salary, work_schedule,
        bank_name, bank_agency, bank_account, bank_account_type,
        ctps_number, ctps_series, pis_pasep, cnpj, company_name, status, photo_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44)
       RETURNING *`,
      [orgId, d.full_name, d.social_name, d.cpf, d.rg, d.rg_issuer, d.birth_date, d.gender, d.marital_status, d.email, d.phone, d.phone2,
        d.address, d.address_number, d.complement, d.neighborhood, d.city, d.state, d.zip_code,
        d.registration_number, d.worker_profile || 'operacional', d.employment_type || 'clt', d.position, d.role_level,
        d.branch_id || null, d.department_id || null, d.cost_center_id || null, d.direct_manager_id || null,
        d.admission_date, d.contract_end_date, d.salary, d.work_schedule || '08:00-17:00',
        d.bank_name, d.bank_agency, d.bank_account, d.bank_account_type,
        d.ctps_number, d.ctps_series, d.pis_pasep, d.cnpj, d.company_name, d.status || 'ativo', d.photo_url, req.userId]
    );
    await auditLog(orgId, 'employee', result.rows[0].id, 'create', [{ field: 'full_name', oldVal: null, newVal: d.full_name }], req.userId);
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.employees.create', err);
    res.status(500).json({ error: 'Erro ao criar colaborador' });
  }
});

// Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const d = req.body;
    // Get old values for audit
    const old = await query(`SELECT * FROM employees WHERE id = $1`, [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Não encontrado' });

    const fields = Object.keys(d).filter(k => k !== 'id' && k !== 'organization_id' && k !== 'created_at');
    if (!fields.length) return res.json(old.rows[0]);

    const sets = fields.map((f, i) => `${f} = $${i + 2}`);
    sets.push(`updated_at = NOW()`);
    const vals = fields.map(f => d[f]);

    const result = await query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      [req.params.id, ...vals]
    );

    // Audit changes
    const changes = fields
      .filter(f => String(old.rows[0][f]) !== String(d[f]))
      .map(f => ({ field: f, oldVal: String(old.rows[0][f] ?? ''), newVal: String(d[f] ?? '') }));
    if (changes.length) {
      await auditLog(old.rows[0].organization_id, 'employee', req.params.id, 'update', changes, req.userId);
    }

    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.employees.update', err);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

// Delete employee (soft: set status desligado)
router.delete('/employees/:id', async (req, res) => {
  try {
    await query(`UPDATE employees SET status = 'desligado', termination_date = NOW(), updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    logError('rh.employees.delete', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== TIME RECORDS (PONTO) =====

router.get('/time-records', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, start_date, end_date } = req.query;
    let sql = `SELECT tr.*, e.full_name as employee_name
               FROM time_records tr
               JOIN employees e ON e.id = tr.employee_id
               WHERE tr.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (employee_id) { sql += ` AND tr.employee_id = $${idx++}`; params.push(employee_id); }
    if (start_date) { sql += ` AND tr.record_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND tr.record_date <= $${idx++}`; params.push(end_date); }
    sql += ` ORDER BY tr.record_date DESC, e.full_name`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.time_records.list', err);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/time-records', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const d = req.body;
    const result = await query(
      `INSERT INTO time_records (organization_id, employee_id, record_date, entry1, exit1, entry2, exit2, entry3, exit3, total_hours, overtime_hours, status, justification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (employee_id, record_date) DO UPDATE SET
         entry1=EXCLUDED.entry1, exit1=EXCLUDED.exit1, entry2=EXCLUDED.entry2, exit2=EXCLUDED.exit2,
         entry3=EXCLUDED.entry3, exit3=EXCLUDED.exit3, total_hours=EXCLUDED.total_hours,
         overtime_hours=EXCLUDED.overtime_hours, status=EXCLUDED.status, justification=EXCLUDED.justification, updated_at=NOW()
       RETURNING *`,
      [orgId, d.employee_id, d.record_date, d.entry1, d.exit1, d.entry2, d.exit2, d.entry3, d.exit3, d.total_hours || 0, d.overtime_hours || 0, d.status || 'normal', d.justification]
    );
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.time_records.create', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== PAYSLIPS (HOLERITE) =====

router.get('/payslips', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, reference_month } = req.query;
    let sql = `SELECT p.*, e.full_name as employee_name, e.cpf, e.position
               FROM payslips p
               JOIN employees e ON e.id = p.employee_id
               WHERE p.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (employee_id) { sql += ` AND p.employee_id = $${idx++}`; params.push(employee_id); }
    if (reference_month) { sql += ` AND p.reference_month = $${idx++}`; params.push(reference_month); }
    sql += ` ORDER BY p.reference_month DESC, e.full_name`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.payslips.list', err);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/payslips', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const d = req.body;
    const result = await query(
      `INSERT INTO payslips (organization_id, employee_id, reference_month, payment_type, gross_salary, earnings, total_earnings, deductions, total_deductions, net_salary, fgts_base, fgts_value, inss_base, inss_value, irrf_base, irrf_value, payment_date, status, notes, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [orgId, d.employee_id, d.reference_month, d.payment_type || 'mensal', d.gross_salary || 0,
        JSON.stringify(d.earnings || []), d.total_earnings || 0, JSON.stringify(d.deductions || []), d.total_deductions || 0,
        d.net_salary || 0, d.fgts_base || 0, d.fgts_value || 0, d.inss_base || 0, d.inss_value || 0,
        d.irrf_base || 0, d.irrf_value || 0, d.payment_date, d.status || 'rascunho', d.notes, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.payslips.create', err);
    res.status(500).json({ error: 'Erro' });
  }
});

router.put('/payslips/:id', async (req, res) => {
  try {
    const d = req.body;
    const result = await query(
      `UPDATE payslips SET gross_salary=$2, earnings=$3, total_earnings=$4, deductions=$5, total_deductions=$6,
       net_salary=$7, fgts_value=$8, inss_value=$9, irrf_value=$10, payment_date=$11, status=$12, notes=$13, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, d.gross_salary, JSON.stringify(d.earnings || []), d.total_earnings, JSON.stringify(d.deductions || []),
        d.total_deductions, d.net_salary, d.fgts_value, d.inss_value, d.irrf_value, d.payment_date, d.status, d.notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.payslips.update', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== ABSENCES =====

router.get('/absences', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const { employee_id } = req.query;
    let sql = `SELECT a.*, e.full_name as employee_name
               FROM employee_absences a
               JOIN employees e ON e.id = a.employee_id
               WHERE e.organization_id = $1`;
    const params = [orgId];
    if (employee_id) { sql += ` AND a.employee_id = $2`; params.push(employee_id); }
    sql += ` ORDER BY a.start_date DESC`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.absences.list', err);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/absences', async (req, res) => {
  try {
    const d = req.body;
    const result = await query(
      `INSERT INTO employee_absences (employee_id, absence_type, start_date, end_date, days_count, reason, document_url, approved, approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.employee_id, d.absence_type, d.start_date, d.end_date, d.days_count, d.reason, d.document_url, d.approved || false, d.approved ? req.userId : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.absences.create', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// ===== BRANCHES, DEPARTMENTS, COST CENTERS =====

router.get('/branches', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const result = await query(`SELECT * FROM branches WHERE organization_id = $1 ORDER BY name`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/branches', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const result = await query(`INSERT INTO branches (organization_id, name, cnpj, address, city, state) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, req.body.name, req.body.cnpj, req.body.address, req.body.city, req.body.state]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.get('/rh-departments', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const result = await query(`SELECT * FROM rh_departments WHERE organization_id = $1 ORDER BY name`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh-departments', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const result = await query(`INSERT INTO rh_departments (organization_id, name, branch_id) VALUES ($1,$2,$3) RETURNING *`,
      [orgId, req.body.name, req.body.branch_id || null]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.get('/cost-centers', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const result = await query(`SELECT * FROM cost_centers WHERE organization_id = $1 ORDER BY code`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/cost-centers', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const result = await query(`INSERT INTO cost_centers (organization_id, code, name) VALUES ($1,$2,$3) RETURNING *`,
      [orgId, req.body.code, req.body.name]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== AUDIT LOG =====

router.get('/audit-log', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const { entity_type, entity_id } = req.query;
    let sql = `SELECT a.*, u.name as changed_by_name
               FROM rh_audit_log a
               LEFT JOIN users u ON u.id = a.changed_by
               WHERE a.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (entity_type) { sql += ` AND a.entity_type = $${idx++}`; params.push(entity_type); }
    if (entity_id) { sql += ` AND a.entity_id = $${idx++}`; params.push(entity_id); }
    sql += ` ORDER BY a.changed_at DESC LIMIT 200`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.audit.list', err);
    res.status(500).json({ error: 'Erro' });
  }
});

export default router;
