// Módulo de Ponto Eletrônico completo
// Cartão Ponto (grade Secullum), Banco de Horas 1:1, Feriados, Ajustes (RH + Colaborador)

import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';
import { recalcEmployeePeriod, parseWorkSchedule } from '../services/point-calculator.js';

const router = express.Router();
router.use(authenticate);

async function resolveOrgId(req) {
  if (req.query.org_id) return req.query.org_id;
  if (req.body?.organization_id) return req.body.organization_id;
  const r = await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId]);
  return r.rows[0]?.organization_id;
}

// ---- ensureSchema (JIT) ----
let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      holiday_date DATE NOT NULL,
      description VARCHAR(255) NOT NULL,
      scope VARCHAR(20) DEFAULT 'nacional',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON holidays(organization_id, holiday_date);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_holidays_org_comp_date ON holidays(organization_id, COALESCE(company_id::text,''), holiday_date);

    CREATE TABLE IF NOT EXISTS time_bank_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      minutes INTEGER NOT NULL,
      kind VARCHAR(20) NOT NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'auto',
      description TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tb_emp_date ON time_bank_entries(employee_id, entry_date);

    CREATE TABLE IF NOT EXISTS punch_adjustment_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      punch_date DATE NOT NULL,
      requested_times TEXT,
      justification TEXT NOT NULL,
      attachment_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      review_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_par_org_status ON punch_adjustment_requests(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_par_emp ON punch_adjustment_requests(employee_id);

    CREATE TABLE IF NOT EXISTS time_period_closings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      closed_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tpc_org_period ON time_period_closings(organization_id, period_end);

    CREATE TABLE IF NOT EXISTS punch_edit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      punch_date DATE NOT NULL,
      action VARCHAR(20) NOT NULL,
      field_name VARCHAR(40),
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
      edited_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pel_emp_date ON punch_edit_log(employee_id, punch_date);

    ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'app';
    ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS edited_by UUID;
    ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
    ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS original_time TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS time_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      record_date DATE NOT NULL,
      entry1 TIME, exit1 TIME, entry2 TIME, exit2 TIME, entry3 TIME, exit3 TIME,
      total_hours NUMERIC(6,2) DEFAULT 0,
      overtime_hours NUMERIC(6,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'normal',
      justification TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee_id, record_date)
    );
  `).catch(err => logError('timeclock.ensureSchema', err));
  schemaReady = true;
}
router.use(async (_req, _res, next) => { await ensureSchema(); next(); });

// ============================================
// CARTÃO PONTO (grade estilo Secullum)
// ============================================

// GET /api/timeclock/cartao-ponto?employee_id=..&start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/cartao-ponto', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id, start, end } = req.query;
    if (!orgId || !employee_id || !start || !end) return res.status(400).json({ error: 'org_id, employee_id, start, end obrigatórios' });

    const emp = await query(
      `SELECT e.id, e.full_name, e.cpf, e.registration, e.work_schedule, e.company_id,
              c.trade_name AS company_name, c.cnpj AS company_cnpj,
              d.name AS department_name, e.position
       FROM employees e
       LEFT JOIN companies c ON c.id = e.company_id
       LEFT JOIN rh_departments d ON d.id = e.department_id
       WHERE e.id = $1`,
      [employee_id]
    );
    if (!emp.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado' });

    // Recalcular tudo antes de retornar
    const { days } = await recalcEmployeePeriod({ organizationId: orgId, employeeId: employee_id, startDate: start, endDate: end });

    // Totais
    const totals = days.reduce((acc, d) => {
      acc.worked_min += d.total_worked_min;
      acc.expected_min += d.expected_min;
      acc.credit_min += d.credit_min;
      acc.debit_min += d.debit_min;
      acc.balance_min += d.balance_min;
      if (d.status === 'falta') acc.absences++;
      if (d.status === 'atraso') acc.lates++;
      return acc;
    }, { worked_min: 0, expected_min: 0, credit_min: 0, debit_min: 0, balance_min: 0, absences: 0, lates: 0 });

    res.json({ employee: emp.rows[0], days, totals });
  } catch (err) {
    logError('timeclock.cartao-ponto', err);
    res.status(500).json({ error: 'Erro ao carregar cartão ponto' });
  }
});

// PUT /api/timeclock/cartao-ponto — editar batidas de um dia (RH)
// body: { employee_id, date, times: ["08:00","12:00","13:00","17:00"], reason }
router.put('/cartao-ponto', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id, date, times = [], reason } = req.body || {};
    if (!orgId || !employee_id || !date) return res.status(400).json({ error: 'Dados obrigatórios' });

    // Buscar batidas atuais do dia
    const current = await query(
      `SELECT id, punched_at FROM time_punches WHERE employee_id = $1 AND punched_at::date = $2 ORDER BY punched_at`,
      [employee_id, date]
    );
    const oldTimes = current.rows.map(r => new Date(r.punched_at).toISOString().slice(11, 16));

    // Estratégia: apagar e recriar como source='manual'
    if (current.rows.length) {
      await query(`DELETE FROM time_punches WHERE id = ANY($1::uuid[])`, [current.rows.map(r => r.id)]);
    }

    const cleanTimes = times.filter(t => /^\d{1,2}:\d{2}$/.test(t)).slice(0, 8);
    for (let i = 0; i < cleanTimes.length; i++) {
      const t = cleanTimes[i];
      const punchType = i === 0 ? 'entrada' : (i === cleanTimes.length - 1 ? 'saida' : (i % 2 === 1 ? 'saida_intervalo' : 'retorno_intervalo'));
      await query(
        `INSERT INTO time_punches (organization_id, employee_id, punch_type, punched_at, source, edited_by, edited_at)
         VALUES ($1, $2, $3, ($4::date + $5::time), 'manual', $6, NOW())`,
        [orgId, employee_id, punchType, date, t + ':00', req.userId]
      );
    }

    // Log de edição
    await query(
      `INSERT INTO punch_edit_log (organization_id, employee_id, punch_date, action, field_name, old_value, new_value, reason, edited_by)
       VALUES ($1,$2,$3,'edit','times',$4,$5,$6,$7)`,
      [orgId, employee_id, date, oldTimes.join(', '), cleanTimes.join(', '), reason || null, req.userId]
    );

    // Recalcular
    await recalcEmployeePeriod({ organizationId: orgId, employeeId: employee_id, startDate: date, endDate: date });
    res.json({ ok: true });
  } catch (err) {
    logError('timeclock.cartao-ponto.put', err);
    res.status(500).json({ error: 'Erro ao editar cartão ponto' });
  }
});

// GET log de edições de um dia
router.get('/cartao-ponto/audit', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id, date } = req.query;
    const r = await query(
      `SELECT pel.*, u.name AS editor_name FROM punch_edit_log pel
       LEFT JOIN users u ON u.id = pel.edited_by
       WHERE pel.organization_id = $1 AND pel.employee_id = $2 AND pel.punch_date = $3
       ORDER BY pel.edited_at DESC`,
      [orgId, employee_id, date]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ============================================
// BANCO DE HORAS
// ============================================
router.get('/time-bank/summary', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id } = req.query;
    let sql, params;
    if (employee_id) {
      sql = `SELECT e.id, e.full_name,
                    COALESCE(SUM(tb.minutes),0)::int AS balance_min
             FROM employees e
             LEFT JOIN time_bank_entries tb ON tb.employee_id = e.id
             WHERE e.id = $1 GROUP BY e.id, e.full_name`;
      params = [employee_id];
    } else {
      sql = `SELECT e.id, e.full_name, e.photo_url,
                    COALESCE(SUM(tb.minutes),0)::int AS balance_min
             FROM employees e
             LEFT JOIN time_bank_entries tb ON tb.employee_id = e.id
             WHERE e.organization_id = $1 AND e.status = 'ativo'
             GROUP BY e.id, e.full_name, e.photo_url
             ORDER BY e.full_name`;
      params = [orgId];
    }
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('timeclock.tb.summary', err); res.status(500).json({ error: 'Erro' }); }
});

router.get('/time-bank/entries', async (req, res) => {
  try {
    const { employee_id, start, end } = req.query;
    const r = await query(
      `SELECT tb.*, u.name AS created_by_name FROM time_bank_entries tb
       LEFT JOIN users u ON u.id = tb.created_by
       WHERE tb.employee_id = $1 AND tb.entry_date BETWEEN $2 AND $3
       ORDER BY tb.entry_date, tb.created_at`,
      [employee_id, start, end]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/time-bank/manual', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id, entry_date, minutes, description } = req.body || {};
    if (!employee_id || !entry_date || minutes == null) return res.status(400).json({ error: 'Dados obrigatórios' });
    const emp = await query(`SELECT company_id FROM employees WHERE id = $1`, [employee_id]);
    const r = await query(
      `INSERT INTO time_bank_entries (organization_id, company_id, employee_id, entry_date, minutes, kind, source, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'manual',$7,$8) RETURNING *`,
      [orgId, emp.rows[0]?.company_id || null, employee_id, entry_date, minutes,
        minutes > 0 ? 'credit' : 'debit', description || 'Ajuste manual', req.userId]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('timeclock.tb.manual', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/time-bank/entries/:id', async (req, res) => {
  try {
    await query(`DELETE FROM time_bank_entries WHERE id = $1 AND source = 'manual'`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ============================================
// FERIADOS
// ============================================
router.get('/holidays', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { company_id, year } = req.query;
    let sql = `SELECT h.*, c.trade_name AS company_name FROM holidays h
               LEFT JOIN companies c ON c.id = h.company_id
               WHERE h.organization_id = $1`;
    const params = [orgId];
    let i = 2;
    if (company_id) { sql += ` AND (h.company_id = $${i++} OR h.company_id IS NULL)`; params.push(company_id); }
    if (year) { sql += ` AND EXTRACT(YEAR FROM h.holiday_date) = $${i++}`; params.push(year); }
    sql += ` ORDER BY h.holiday_date`;
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('timeclock.holidays.get', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/holidays', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { holiday_date, description, scope, company_id } = req.body || {};
    if (!holiday_date || !description) return res.status(400).json({ error: 'Dados obrigatórios' });
    const r = await query(
      `INSERT INTO holidays (organization_id, company_id, holiday_date, description, scope)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organization_id, COALESCE(company_id::text,''), holiday_date)
       DO UPDATE SET description = EXCLUDED.description, scope = EXCLUDED.scope
       RETURNING *`,
      [orgId, company_id || null, holiday_date, description, scope || 'nacional']
    );
    res.json(r.rows[0]);
  } catch (err) { logError('timeclock.holidays.post', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/holidays/:id', async (req, res) => {
  try { await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Importar feriados nacionais brasileiros para o ano
router.post('/holidays/import-national', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { year, company_id } = req.body || {};
    const y = parseInt(year, 10) || new Date().getFullYear();
    // Datas fixas nacionais
    const nationals = [
      [`${y}-01-01`, 'Confraternização Universal'],
      [`${y}-04-21`, 'Tiradentes'],
      [`${y}-05-01`, 'Dia do Trabalho'],
      [`${y}-09-07`, 'Independência do Brasil'],
      [`${y}-10-12`, 'Nossa Senhora Aparecida'],
      [`${y}-11-02`, 'Finados'],
      [`${y}-11-15`, 'Proclamação da República'],
      [`${y}-12-25`, 'Natal'],
    ];
    // Móveis (Páscoa - algoritmo)
    const easter = calcEaster(y);
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    nationals.push([addDays(easter, -48), 'Carnaval']);
    nationals.push([addDays(easter, -47), 'Carnaval']);
    nationals.push([addDays(easter, -2), 'Sexta-feira Santa']);
    nationals.push([addDays(easter, 60), 'Corpus Christi']);

    let inserted = 0;
    for (const [date, desc] of nationals) {
      await query(
        `INSERT INTO holidays (organization_id, company_id, holiday_date, description, scope)
         VALUES ($1,$2,$3,$4,'nacional')
         ON CONFLICT (organization_id, COALESCE(company_id::text,''), holiday_date) DO NOTHING`,
        [orgId, company_id || null, date, desc]
      );
      inserted++;
    }
    res.json({ ok: true, count: inserted });
  } catch (err) { logError('timeclock.holidays.import', err); res.status(500).json({ error: 'Erro' }); }
});

function calcEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// ============================================
// SOLICITAÇÕES DE AJUSTE (colaborador → RH)
// ============================================
router.get('/adjustment-requests', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { status, employee_id } = req.query;
    let sql = `SELECT par.*, e.full_name AS employee_name, e.photo_url,
                      u.name AS reviewer_name, c.trade_name AS company_name
               FROM punch_adjustment_requests par
               JOIN employees e ON e.id = par.employee_id
               LEFT JOIN users u ON u.id = par.reviewed_by
               LEFT JOIN companies c ON c.id = par.company_id
               WHERE par.organization_id = $1`;
    const params = [orgId]; let i = 2;
    if (status) { sql += ` AND par.status = $${i++}`; params.push(status); }
    if (employee_id) { sql += ` AND par.employee_id = $${i++}`; params.push(employee_id); }
    sql += ` ORDER BY par.created_at DESC LIMIT 200`;
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('timeclock.adj.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.patch('/adjustment-requests/:id', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { status, review_note } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
    const cur = await query(`SELECT * FROM punch_adjustment_requests WHERE id = $1 AND organization_id = $2`, [req.params.id, orgId]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Solicitação não encontrada' });
    const reqRow = cur.rows[0];

    await query(
      `UPDATE punch_adjustment_requests SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4`,
      [status, review_note || null, req.userId, req.params.id]
    );

    // Se aprovado, aplicar batidas
    if (status === 'approved' && reqRow.requested_times) {
      const times = String(reqRow.requested_times).split(',').map(s => s.trim()).filter(t => /^\d{1,2}:\d{2}$/.test(t)).slice(0, 8);
      const dateStr = new Date(reqRow.punch_date).toISOString().slice(0, 10);
      await query(`DELETE FROM time_punches WHERE employee_id = $1 AND punched_at::date = $2`, [reqRow.employee_id, dateStr]);
      for (let idx = 0; idx < times.length; idx++) {
        const t = times[idx];
        const punchType = idx === 0 ? 'entrada' : (idx === times.length - 1 ? 'saida' : (idx % 2 === 1 ? 'saida_intervalo' : 'retorno_intervalo'));
        await query(
          `INSERT INTO time_punches (organization_id, employee_id, punch_type, punched_at, source, edited_by, edited_at, justification)
           VALUES ($1, $2, $3, ($4::date + $5::time), 'request', $6, NOW(), $7)`,
          [orgId, reqRow.employee_id, punchType, dateStr, t + ':00', req.userId, reqRow.justification]
        );
      }
      await query(
        `INSERT INTO punch_edit_log (organization_id, employee_id, punch_date, action, field_name, new_value, reason, edited_by)
         VALUES ($1,$2,$3,'request_approved','times',$4,$5,$6)`,
        [orgId, reqRow.employee_id, dateStr, times.join(', '), reqRow.justification, req.userId]
      );
      await recalcEmployeePeriod({ organizationId: orgId, employeeId: reqRow.employee_id, startDate: dateStr, endDate: dateStr });
    }

    res.json({ ok: true });
  } catch (err) { logError('timeclock.adj.patch', err); res.status(500).json({ error: 'Erro ao processar solicitação' }); }
});

// ============================================
// FECHAMENTO DE PERÍODO
// ============================================
router.get('/closings', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const r = await query(
      `SELECT tpc.*, c.trade_name AS company_name, u.name AS closed_by_name
       FROM time_period_closings tpc
       LEFT JOIN companies c ON c.id = tpc.company_id
       LEFT JOIN users u ON u.id = tpc.closed_by
       WHERE tpc.organization_id = $1
       ORDER BY tpc.period_end DESC LIMIT 50`, [orgId]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/closings', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { period_start, period_end, company_id, notes } = req.body || {};
    if (!period_start || !period_end) return res.status(400).json({ error: 'Período obrigatório' });
    const r = await query(
      `INSERT INTO time_period_closings (organization_id, company_id, period_start, period_end, closed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, company_id || null, period_start, period_end, req.userId, notes || null]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('timeclock.closings.post', err); res.status(500).json({ error: 'Erro' }); }
});

export default router;
