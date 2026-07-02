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
    ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS nsr BIGINT;
    ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(128);
    CREATE INDEX IF NOT EXISTS idx_tp_org_nsr ON time_punches(organization_id, nsr);

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

    -- ==== FASE 3: Jornadas reutilizáveis ====
    CREATE TABLE IF NOT EXISTS work_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      name VARCHAR(120) NOT NULL,
      kind VARCHAR(30) NOT NULL DEFAULT 'fixa',
      -- schedule_json: { sun:"folga", mon:"08:00-12:00,13:00-17:00", ... }
      schedule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- Escalas rotativas: cycle_days_json = [{d:1,h:"07:00-19:00"},{d:2,h:"folga"},...]
      cycle_pattern JSONB,
      cycle_start_date DATE,
      -- Regras
      tolerance_minutes INTEGER DEFAULT 10,
      night_bonus_pct INTEGER DEFAULT 20,
      sunday_bonus_pct INTEGER DEFAULT 100,
      holiday_bonus_pct INTEGER DEFAULT 100,
      overtime_weekday_pct INTEGER DEFAULT 50,
      dsr_enabled BOOLEAN DEFAULT TRUE,
      night_reduced_hour BOOLEAN DEFAULT TRUE,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ws_org ON work_schedules(organization_id);
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_schedule_id UUID REFERENCES work_schedules(id) ON DELETE SET NULL;
  `).catch(err => logError('timeclock.ensureSchema', err));
  schemaReady = true;
}
router.use(async (_req, _res, next) => { await ensureSchema(); next(); });

// ============================================
// JORNADAS DE TRABALHO (Fase 3)
// ============================================
router.get('/work-schedules', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const r = await query(
      `SELECT ws.*, c.trade_name AS company_name,
              (SELECT COUNT(*)::int FROM employees WHERE work_schedule_id = ws.id) AS employees_count
       FROM work_schedules ws
       LEFT JOIN companies c ON c.id = ws.company_id
       WHERE ws.organization_id = $1
       ORDER BY ws.name`, [orgId]);
    res.json(r.rows);
  } catch (err) { logError('timeclock.ws.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/work-schedules', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await query(
      `INSERT INTO work_schedules
       (organization_id, company_id, name, kind, schedule_json, cycle_pattern, cycle_start_date,
        tolerance_minutes, night_bonus_pct, sunday_bonus_pct, holiday_bonus_pct,
        overtime_weekday_pct, dsr_enabled, night_reduced_hour, active)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [orgId, b.company_id || null, b.name, b.kind || 'fixa',
        JSON.stringify(b.schedule_json || {}),
        b.cycle_pattern ? JSON.stringify(b.cycle_pattern) : null,
        b.cycle_start_date || null,
        b.tolerance_minutes ?? 10, b.night_bonus_pct ?? 20,
        b.sunday_bonus_pct ?? 100, b.holiday_bonus_pct ?? 100,
        b.overtime_weekday_pct ?? 50, b.dsr_enabled !== false,
        b.night_reduced_hour !== false, b.active !== false]);
    res.json(r.rows[0]);
  } catch (err) { logError('timeclock.ws.post', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/work-schedules/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await query(
      `UPDATE work_schedules SET
         name=COALESCE($2,name), kind=COALESCE($3,kind),
         schedule_json=COALESCE($4::jsonb,schedule_json),
         cycle_pattern=$5::jsonb, cycle_start_date=$6,
         tolerance_minutes=COALESCE($7,tolerance_minutes),
         night_bonus_pct=COALESCE($8,night_bonus_pct),
         sunday_bonus_pct=COALESCE($9,sunday_bonus_pct),
         holiday_bonus_pct=COALESCE($10,holiday_bonus_pct),
         overtime_weekday_pct=COALESCE($11,overtime_weekday_pct),
         dsr_enabled=COALESCE($12,dsr_enabled),
         night_reduced_hour=COALESCE($13,night_reduced_hour),
         active=COALESCE($14,active), company_id=$15,
         updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, b.name, b.kind,
        b.schedule_json ? JSON.stringify(b.schedule_json) : null,
        b.cycle_pattern ? JSON.stringify(b.cycle_pattern) : null,
        b.cycle_start_date || null,
        b.tolerance_minutes, b.night_bonus_pct, b.sunday_bonus_pct, b.holiday_bonus_pct,
        b.overtime_weekday_pct, b.dsr_enabled, b.night_reduced_hour, b.active,
        b.company_id || null]);
    res.json(r.rows[0]);
  } catch (err) { logError('timeclock.ws.put', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/work-schedules/:id', async (req, res) => {
  try {
    await query(`UPDATE employees SET work_schedule_id = NULL WHERE work_schedule_id = $1`, [req.params.id]);
    await query(`DELETE FROM work_schedules WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Vincular colaboradores em massa
router.post('/work-schedules/:id/assign', async (req, res) => {
  try {
    const { employee_ids = [] } = req.body || {};
    if (!Array.isArray(employee_ids) || !employee_ids.length) return res.status(400).json({ error: 'employee_ids obrigatório' });
    await query(`UPDATE employees SET work_schedule_id = $1 WHERE id = ANY($2::uuid[])`, [req.params.id, employee_ids]);
    res.json({ ok: true, count: employee_ids.length });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

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

// ============================================
// RELATÓRIOS OPERACIONAIS
// ============================================
async function buildEmployeesReport({ orgId, companyId, start, end, employeeId }) {
  const params = [orgId];
  let sql = `SELECT id, full_name, cpf, registration_number, company_id
             FROM employees WHERE organization_id = $1 AND status = 'ativo'`;
  let i = 2;
  if (companyId) { sql += ` AND company_id = $${i++}`; params.push(companyId); }
  if (employeeId) { sql += ` AND id = $${i++}`; params.push(employeeId); }
  sql += ` ORDER BY full_name`;
  const emps = (await query(sql, params)).rows;

  const rows = [];
  for (const emp of emps) {
    let result = { days: [] };
    try {
      result = await recalcEmployeePeriod({ organizationId: orgId, employeeId: emp.id, startDate: start, endDate: end });
    } catch (err) { logError('reports.recalc', err); }

    let workedMin = 0, expectedMin = 0, overtimeMin = 0, overtimeBonusMin = 0;
    let nightMin = 0, nightBonusMin = 0, creditMin = 0, debitMin = 0;
    let absences = 0, lates = 0, incomplete = 0, holidaysWorked = 0, sundaysWorked = 0, dsrLost = 0;
    const detail = [];

    for (const d of result.days || []) {
      workedMin += d.total_worked_min || 0;
      expectedMin += d.expected_min || 0;
      overtimeMin += d.overtime_min || 0;
      overtimeBonusMin += d.overtime_bonus_min || 0;
      nightMin += d.night_min || 0;
      nightBonusMin += d.night_bonus_min || 0;
      creditMin += d.credit_min || 0;
      debitMin += d.debit_min || 0;
      if (d.status === 'falta') absences++;
      if (d.status === 'atraso') lates++;
      if (d.odd_punch) incomplete++;
      if (d.is_holiday && (d.total_worked_min || 0) > 0) holidaysWorked++;
      if (d.is_sunday && (d.total_worked_min || 0) > 0) sundaysWorked++;
      if (d.dsr_lost) dsrLost++;
      if (['falta', 'atraso'].includes(d.status) || d.odd_punch) {
        detail.push({
          date: d.date, status: d.status, odd_punch: !!d.odd_punch,
          worked_min: d.total_worked_min || 0, expected_min: d.expected_min || 0,
          balance_min: d.balance_min || 0,
        });
      }
    }

    const tbBal = await query(
      `SELECT COALESCE(SUM(minutes),0)::int AS bal FROM time_bank_entries WHERE employee_id = $1`,
      [emp.id]
    );

    rows.push({
      employee_id: emp.id, full_name: emp.full_name, cpf: emp.cpf,
      registration_number: emp.registration_number,
      worked_min: workedMin, expected_min: expectedMin,
      overtime_min: overtimeMin, overtime_bonus_min: overtimeBonusMin,
      night_min: nightMin, night_bonus_min: nightBonusMin,
      credit_min: creditMin, debit_min: debitMin,
      balance_min: workedMin - expectedMin,
      tb_balance_min: tbBal.rows[0]?.bal || 0,
      absences, lates, incomplete, holidays_worked: holidaysWorked,
      sundays_worked: sundaysWorked, dsr_lost: dsrLost,
      detail,
    });
  }
  return rows;
}

// Extrato consolidado (banco de horas + horas do período)
router.get('/reports/summary', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { start, end, company_id, employee_id } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Período obrigatório' });
    const rows = await buildEmployeesReport({ orgId, companyId: company_id, start, end, employeeId: employee_id });
    res.json({ start, end, rows });
  } catch (err) { logError('reports.summary', err); res.status(500).json({ error: 'Erro ao gerar relatório' }); }
});

// Faltas e atrasos detalhado
router.get('/reports/absences-lates', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { start, end, company_id, employee_id } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Período obrigatório' });
    const rows = await buildEmployeesReport({ orgId, companyId: company_id, start, end, employeeId: employee_id });
    const items = [];
    for (const r of rows) {
      for (const d of r.detail) {
        items.push({
          employee_id: r.employee_id, full_name: r.full_name, cpf: r.cpf,
          registration_number: r.registration_number, ...d,
        });
      }
    }
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.full_name.localeCompare(b.full_name)));
    res.json({ start, end, items });
  } catch (err) { logError('reports.abslates', err); res.status(500).json({ error: 'Erro' }); }
});

// Extrato banco de horas por colaborador (movimentações)
router.get('/reports/time-bank-statement', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id, start, end } = req.query;
    if (!employee_id || !start || !end) return res.status(400).json({ error: 'Parâmetros obrigatórios' });
    const r = await query(
      `SELECT tb.*, u.name AS created_by_name
       FROM time_bank_entries tb
       LEFT JOIN users u ON u.id = tb.created_by
       WHERE tb.organization_id = $1 AND tb.employee_id = $2 AND tb.entry_date BETWEEN $3 AND $4
       ORDER BY tb.entry_date, tb.created_at`,
      [orgId, employee_id, start, end]
    );
    const prev = await query(
      `SELECT COALESCE(SUM(minutes),0)::int AS bal FROM time_bank_entries
       WHERE employee_id = $1 AND entry_date < $2`,
      [employee_id, start]
    );
    res.json({ opening_min: prev.rows[0]?.bal || 0, entries: r.rows });
  } catch (err) { logError('reports.tb.statement', err); res.status(500).json({ error: 'Erro' }); }
});

function toCsv(headers, rows) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n');
}
const minToHours = (min) => (Math.round((min || 0) / 60 * 100) / 100).toFixed(2).replace('.', ',');

// Export CSV para folha
router.get('/reports/payroll.csv', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { start, end, company_id } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Período obrigatório' });
    const rows = await buildEmployeesReport({ orgId, companyId: company_id, start, end });
    const headers = [
      'Matricula', 'CPF', 'Colaborador', 'Horas Trabalhadas', 'Horas Previstas',
      'HE 50%', 'Adic. HE 50%', 'Adic. Noturno', 'Horas Noturnas',
      'Domingos Trab.', 'Feriados Trab.', 'DSR Perdidos',
      'Faltas', 'Atrasos', 'Incompletos', 'Saldo Periodo', 'Saldo Banco Horas'
    ];
    const csvRows = rows.map(r => [
      r.registration_number || '', r.cpf || '', r.full_name,
      minToHours(r.worked_min), minToHours(r.expected_min),
      minToHours(r.overtime_min), minToHours(r.overtime_bonus_min),
      minToHours(r.night_bonus_min), minToHours(r.night_min),
      r.sundays_worked, r.holidays_worked, r.dsr_lost,
      r.absences, r.lates, r.incomplete,
      minToHours(r.balance_min), minToHours(r.tb_balance_min),
    ]);
    const csv = '\uFEFF' + toCsv(headers, csvRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="folha-${start}_${end}.csv"`);
    res.send(csv);
  } catch (err) { logError('reports.payroll.csv', err); res.status(500).json({ error: 'Erro ao gerar CSV' }); }
});

// Export CSV faltas/atrasos
router.get('/reports/absences-lates.csv', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { start, end, company_id, employee_id } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Período obrigatório' });
    const rows = await buildEmployeesReport({ orgId, companyId: company_id, start, end, employeeId: employee_id });
    const items = [];
    for (const r of rows) for (const d of r.detail) items.push({ ...r, ...d });
    const headers = ['Data', 'Matricula', 'CPF', 'Colaborador', 'Status', 'Batidas Impares', 'Trabalhado', 'Previsto', 'Saldo'];
    const csvRows = items.map(it => [
      it.date, it.registration_number || '', it.cpf || '', it.full_name,
      it.status, it.odd_punch ? 'Sim' : 'Nao',
      minToHours(it.worked_min), minToHours(it.expected_min), minToHours(it.balance_min),
    ]);
    const csv = '\uFEFF' + toCsv(headers, csvRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="faltas-atrasos-${start}_${end}.csv"`);
    res.send(csv);
  } catch (err) { logError('reports.abslates.csv', err); res.status(500).json({ error: 'Erro' }); }
});

// ==== ESPELHO DE PONTO (PDF) - RH ====
import { generateMirrorPDF, generateReceiptPDF } from '../services/receipt-pdf.js';

router.get('/mirror.pdf', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    const { employee_id, start, end } = req.query;
    if (!employee_id || !start || !end) return res.status(400).json({ error: 'Parâmetros obrigatórios' });
    const bytes = await generateMirrorPDF({ organizationId: orgId, employeeId: employee_id, startDate: start, endDate: end });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="espelho-${employee_id}-${start}_${end}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) { logError('timeclock.mirror.pdf', err); res.status(500).json({ error: err.message || 'Erro ao gerar espelho' }); }
});

router.get('/receipt/:punchId.pdf', async (req, res) => {
  try {
    const bytes = await generateReceiptPDF(req.params.punchId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="comprovante-${req.params.punchId}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) { logError('timeclock.receipt.pdf', err); res.status(500).json({ error: err.message || 'Erro' }); }
});

export default router;

