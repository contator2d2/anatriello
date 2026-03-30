import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { callAI } from '../lib/ai-caller.js';
import { logInfo, logError } from '../logger.js';


const router = express.Router();
router.use(authenticate);

let holidaysInfraPromise = null;
const seededHolidayYears = new Set();

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatHolidayDate(year, month, day) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function calculateEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function toIsoDate(date) {
  return formatHolidayDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function getBrazilNationalHolidays(year) {
  const safeYear = Number(year);
  if (!Number.isInteger(safeYear) || safeYear < 2000 || safeYear > 2100) {
    return [];
  }

  const easterSunday = calculateEasterSunday(safeYear);
  const goodFriday = addUtcDays(easterSunday, -2);

  return [
    { name: 'Confraternização Universal', holiday_date: formatHolidayDate(safeYear, 1, 1), type: 'nacional', recurring: true },
    { name: 'Paixão de Cristo', holiday_date: toIsoDate(goodFriday), type: 'nacional', recurring: false },
    { name: 'Tiradentes', holiday_date: formatHolidayDate(safeYear, 4, 21), type: 'nacional', recurring: true },
    { name: 'Dia do Trabalho', holiday_date: formatHolidayDate(safeYear, 5, 1), type: 'nacional', recurring: true },
    { name: 'Independência do Brasil', holiday_date: formatHolidayDate(safeYear, 9, 7), type: 'nacional', recurring: true },
    { name: 'Nossa Senhora Aparecida', holiday_date: formatHolidayDate(safeYear, 10, 12), type: 'nacional', recurring: true },
    { name: 'Finados', holiday_date: formatHolidayDate(safeYear, 11, 2), type: 'nacional', recurring: true },
    { name: 'Proclamação da República', holiday_date: formatHolidayDate(safeYear, 11, 15), type: 'nacional', recurring: true },
    { name: 'Natal', holiday_date: formatHolidayDate(safeYear, 12, 25), type: 'nacional', recurring: true },
  ];
}

async function ensureHolidaysInfrastructure() {
  if (!holidaysInfraPromise) {
    holidaysInfraPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS holidays (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          holiday_date DATE NOT NULL,
          type VARCHAR(20) DEFAULT 'nacional',
          state VARCHAR(2),
          city VARCHAR(100),
          recurring BOOLEAN DEFAULT true,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS holiday_date DATE`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'nacional'`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS state VARCHAR(2)`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT true`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
      await query(`ALTER TABLE holidays ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
      await query(`CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(type)`);
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_org_name_date ON holidays(organization_id, name, holiday_date)`);
    })().catch((error) => {
      holidaysInfraPromise = null;
      throw error;
    });
  }

  return holidaysInfraPromise;
}

async function seedNationalHolidays(orgId, year) {
  const safeYear = Number(year);
  const holidays = getBrazilNationalHolidays(safeYear);
  if (!orgId || !holidays.length) {
    return;
  }

  const cacheKey = `${orgId}:${safeYear}`;
  if (seededHolidayYears.has(cacheKey)) {
    return;
  }

  await Promise.all(
    holidays.map((holiday) =>
      query(
        `INSERT INTO holidays (organization_id, name, holiday_date, type, state, city, recurring, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)
         ON CONFLICT (organization_id, name, holiday_date) DO NOTHING`,
        [orgId, holiday.name, holiday.holiday_date, holiday.type, null, null, holiday.recurring]
      )
    )
  );

  seededHolidayYears.add(cacheKey);
}

router.use('/holidays', async (req, res, next) => {
  try {
    await ensureHolidaysInfrastructure();

    if (req.method === 'GET') {
      const orgId = req.query.org_id || await getUserOrgId(req.userId);
      const requestedYear = Number(req.query.year || new Date().getFullYear());
      if (orgId && Number.isInteger(requestedYear)) {
        await seedNationalHolidays(orgId, requestedYear);
      }
    }

    next();
  } catch (err) {
    logError('rh.holidays.bootstrap', err, { user_id: req.userId, path: req.path, method: req.method });
    res.status(500).json({ error: err?.message || 'Erro ao inicializar feriados' });
  }
});

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function normalizeEmployeePayload(body = {}) {
  const workSchedule = body.work_schedule
    ? (typeof body.work_schedule === 'object' ? JSON.stringify(body.work_schedule) : String(body.work_schedule))
    : '08:00-17:00';

  return {
    ...body,
    full_name: typeof body.full_name === 'string' ? body.full_name.trim() : body.full_name,
    social_name: emptyToNull(body.social_name),
    cpf: emptyToNull(body.cpf),
    rg: emptyToNull(body.rg),
    rg_issuer: emptyToNull(body.rg_issuer),
    birth_date: emptyToNull(body.birth_date),
    gender: emptyToNull(body.gender),
    marital_status: emptyToNull(body.marital_status),
    email: emptyToNull(body.email),
    phone: emptyToNull(body.phone),
    phone2: emptyToNull(body.phone2),
    address: emptyToNull(body.address),
    address_number: emptyToNull(body.address_number),
    complement: emptyToNull(body.complement),
    neighborhood: emptyToNull(body.neighborhood),
    city: emptyToNull(body.city),
    state: emptyToNull(body.state),
    zip_code: emptyToNull(body.zip_code),
    registration_number: emptyToNull(body.registration_number),
    worker_profile: emptyToNull(body.worker_profile) || 'operacional',
    employment_type: emptyToNull(body.employment_type) || 'clt',
    position: emptyToNull(body.position),
    role_level: emptyToNull(body.role_level),
    branch_id: emptyToNull(body.branch_id),
    department_id: emptyToNull(body.department_id),
    cost_center_id: emptyToNull(body.cost_center_id),
    direct_manager_id: emptyToNull(body.direct_manager_id),
    admission_date: emptyToNull(body.admission_date),
    contract_end_date: emptyToNull(body.contract_end_date),
    salary: emptyToNull(body.salary) ?? 0,
    work_schedule: workSchedule,
    bank_name: emptyToNull(body.bank_name),
    bank_agency: emptyToNull(body.bank_agency),
    bank_account: emptyToNull(body.bank_account),
    bank_account_type: emptyToNull(body.bank_account_type),
    ctps_number: emptyToNull(body.ctps_number),
    ctps_series: emptyToNull(body.ctps_series),
    pis_pasep: emptyToNull(body.pis_pasep),
    cnpj: emptyToNull(body.cnpj),
    company_name: emptyToNull(body.company_name),
    status: emptyToNull(body.status) || 'ativo',
    photo_url: emptyToNull(body.photo_url),
    salary_items: Array.isArray(body.salary_items) ? body.salary_items : [],
    benefits: Array.isArray(body.benefits) ? body.benefits : [],
    home_latitude: emptyToNull(body.home_latitude) ? Number(body.home_latitude) : null,
    home_longitude: emptyToNull(body.home_longitude) ? Number(body.home_longitude) : null,
  };
}

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
    let sql = `SELECT e.*, d.name as department_name, b.name as branch_name,
               CASE WHEN caa.access_status IN ('liberado','aguardando_login','ativo') THEN true ELSE false END as promotor_access
               FROM employees e
               LEFT JOIN rh_departments d ON d.id = e.department_id
               LEFT JOIN branches b ON b.id = e.branch_id
               LEFT JOIN collaborator_app_access caa ON caa.employee_id = e.id
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
    if (!orgId) return res.status(400).json({ error: 'Organização não encontrada para o usuário' });

    const d = normalizeEmployeePayload(req.body);
    if (!d.full_name) return res.status(400).json({ error: 'Nome do colaborador é obrigatório' });

    const result = await query(
      `INSERT INTO employees (organization_id, full_name, social_name, cpf, rg, rg_issuer, birth_date, gender, marital_status, email, phone, phone2,
        address, address_number, complement, neighborhood, city, state, zip_code,
        registration_number, worker_profile, employment_type, position, role_level,
        branch_id, department_id, cost_center_id, direct_manager_id,
        admission_date, contract_end_date, salary, work_schedule,
        bank_name, bank_agency, bank_account, bank_account_type,
        ctps_number, ctps_series, pis_pasep, cnpj, company_name, status, photo_url, created_by,
        salary_items, benefits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46)
       RETURNING *`,
      [orgId, d.full_name, d.social_name, d.cpf, d.rg, d.rg_issuer, d.birth_date, d.gender, d.marital_status, d.email, d.phone, d.phone2,
        d.address, d.address_number, d.complement, d.neighborhood, d.city, d.state, d.zip_code,
        d.registration_number, d.worker_profile, d.employment_type, d.position, d.role_level,
        d.branch_id, d.department_id, d.cost_center_id, d.direct_manager_id,
        d.admission_date, d.contract_end_date, d.salary, d.work_schedule,
        d.bank_name, d.bank_agency, d.bank_account, d.bank_account_type,
        d.ctps_number, d.ctps_series, d.pis_pasep, d.cnpj, d.company_name, d.status, d.photo_url, req.userId,
        JSON.stringify(d.salary_items), JSON.stringify(d.benefits)]
    );
    await auditLog(orgId, 'employee', result.rows[0].id, 'create', [{ field: 'full_name', oldVal: null, newVal: d.full_name }], req.userId);
    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.employees.create', err, { body: req.body });
    const message = err?.detail || err?.message || 'Erro ao criar colaborador';
    res.status(400).json({ error: message });
  }
});

// Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    // Only process fields actually sent in the request body
    const allowedCols = new Set([
      'full_name','social_name','cpf','rg','rg_issuer','birth_date','gender','marital_status',
      'email','phone','phone2','address','address_number','complement','neighborhood','city',
      'state','zip_code','registration_number','worker_profile','employment_type','position',
      'role_level','branch_id','department_id','cost_center_id','direct_manager_id',
      'admission_date','contract_end_date','salary','work_schedule','bank_name','bank_agency',
      'bank_account','bank_account_type','ctps_number','ctps_series','pis_pasep','cnpj',
      'company_name','status','photo_url','salary_items','benefits',
      'home_latitude','home_longitude'
    ]);

    const sentKeys = Object.keys(req.body).filter(k => allowedCols.has(k));
    if (!sentKeys.length) {
      const existing = await query(`SELECT * FROM employees WHERE id = $1`, [req.params.id]);
      return existing.rows[0] ? res.json(existing.rows[0]) : res.status(404).json({ error: 'Não encontrado' });
    }

    // Normalize only sent fields
    const d = {};
    const jsonbFields = ['salary_items', 'benefits'];
    for (const k of sentKeys) {
      if (k === 'work_schedule') {
        d[k] = typeof req.body[k] === 'object' ? JSON.stringify(req.body[k]) : String(req.body[k] || '08:00-17:00');
      } else if (jsonbFields.includes(k)) {
        d[k] = JSON.stringify(Array.isArray(req.body[k]) ? req.body[k] : []);
      } else {
        d[k] = emptyToNull(req.body[k]);
      }
    }

    const old = await query(`SELECT * FROM employees WHERE id = $1`, [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Não encontrado' });

    const fields = Object.keys(d);
    const sets = fields.map((f, i) => `${f} = $${i + 2}`);
    sets.push(`updated_at = NOW()`);
    const vals = fields.map(f => d[f]);

    const result = await query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      [req.params.id, ...vals]
    );

    const changes = fields
      .filter(f => String(old.rows[0][f]) !== String(d[f]))
      .map(f => ({ field: f, oldVal: String(old.rows[0][f] ?? ''), newVal: String(d[f] ?? '') }));
    if (changes.length) {
      await auditLog(old.rows[0].organization_id, 'employee', req.params.id, 'update', changes, req.userId);
    }

    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.employees.update', err, { body: req.body, employee_id: req.params.id });
    const message = err?.detail || err?.message || 'Erro ao atualizar colaborador';
    res.status(400).json({ error: message, details: err?.detail || err?.hint || '' });
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

// App punches (time_punches from promotor app)
router.get('/app-punches', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, start_date, end_date } = req.query;
    let sql = `SELECT tp.*, e.full_name as employee_name, p.name as pdv_name
               FROM time_punches tp
               JOIN employees e ON e.id = tp.employee_id
               LEFT JOIN pdvs p ON p.id = tp.pdv_id
               WHERE tp.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (employee_id) { sql += ` AND tp.employee_id = $${idx++}`; params.push(employee_id); }
    if (start_date) { sql += ` AND tp.punched_at::date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND tp.punched_at::date <= $${idx++}`; params.push(end_date); }
    sql += ` ORDER BY tp.punched_at DESC LIMIT 500`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.app_punches.list', err);
    res.status(500).json({ error: 'Erro ao listar registros do app' });
  }
});

// Sync diagnostics
router.get('/sync-diagnostics', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json({ total: 0, synced: 0, pending: 0, employees: [] });

    const [stats, byEmployee, recent] = await Promise.all([
      query(`SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE sync_status = 'synced') as synced,
        COUNT(*) FILTER (WHERE sync_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE is_offline = true) as offline_originated,
        MAX(punched_at) as last_punch_at
       FROM time_punches WHERE organization_id = $1`, [orgId]),
      query(`SELECT e.id, e.full_name, e.photo_url,
        COUNT(tp.id) as total_punches,
        COUNT(tp.id) FILTER (WHERE tp.sync_status = 'synced') as synced,
        COUNT(tp.id) FILTER (WHERE tp.sync_status = 'pending') as pending,
        COUNT(tp.id) FILTER (WHERE tp.is_offline = true) as offline,
        MAX(tp.punched_at) as last_punch,
        MAX(CASE WHEN tp.sync_status = 'synced' THEN tp.punched_at END) as last_synced_at
       FROM employees e
       LEFT JOIN time_punches tp ON tp.employee_id = e.id
       WHERE e.organization_id = $1 AND e.status = 'ativo'
       GROUP BY e.id, e.full_name, e.photo_url
       HAVING COUNT(tp.id) > 0
       ORDER BY MAX(tp.punched_at) DESC NULLS LAST`, [orgId]),
      query(`SELECT tp.id, tp.employee_id, e.full_name, tp.punch_type, tp.punched_at, tp.sync_status, tp.is_offline, tp.geo_status, p.name as pdv_name
       FROM time_punches tp JOIN employees e ON e.id = tp.employee_id LEFT JOIN pdvs p ON p.id = tp.pdv_id
       WHERE tp.organization_id = $1 ORDER BY tp.punched_at DESC LIMIT 20`, [orgId]),
    ]);

    res.json({
      ...stats.rows[0],
      employees: byEmployee.rows,
      recent_punches: recent.rows,
    });
  } catch (err) {
    logError('rh.sync_diagnostics', err);
    res.status(500).json({ error: 'Erro' });
  }
});

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

// Consolidated timesheet (app punches grouped by employee+date)
router.get('/consolidated-timesheet', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, start_date, end_date } = req.query;

    let sql = `
      SELECT 
        tp.employee_id,
        e.full_name as employee_name,
        e.cpf,
        e.position,
        e.work_schedule,
        tp.punched_at::date as record_date,
        json_agg(json_build_object(
          'id', tp.id, 'punch_type', tp.punch_type, 'punched_at', tp.punched_at,
          'geo_status', tp.geo_status, 'is_offline', tp.is_offline, 'pdv_name', p.name,
          'sync_status', tp.sync_status
        ) ORDER BY tp.punched_at) as punches,
        COUNT(*) as punch_count,
        MIN(tp.punched_at) as first_punch,
        MAX(tp.punched_at) as last_punch,
        EXTRACT(EPOCH FROM (MAX(tp.punched_at) - MIN(tp.punched_at)))/3600.0 as raw_hours
      FROM time_punches tp
      JOIN employees e ON e.id = tp.employee_id
      LEFT JOIN pdvs p ON p.id = tp.pdv_id
      WHERE tp.organization_id = $1`;
    const params = [orgId];
    let idx = 2;
    if (employee_id) { sql += ` AND tp.employee_id = $${idx++}`; params.push(employee_id); }
    if (start_date) { sql += ` AND tp.punched_at::date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND tp.punched_at::date <= $${idx++}`; params.push(end_date); }
    sql += ` GROUP BY tp.employee_id, e.full_name, e.cpf, e.position, e.work_schedule, tp.punched_at::date
             ORDER BY tp.punched_at::date DESC, e.full_name`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logError('rh.consolidated_timesheet', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// Divergence detection
router.get('/punch-divergences', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { start_date, end_date } = req.query;
    const sd = start_date || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const ed = end_date || new Date().toISOString().slice(0, 10);

    // Find employees who didn't punch on workdays + incomplete punch sequences
    const divergences = [];

    // 1. Employees with no punches on workdays
    const noPunch = await query(`
      SELECT e.id, e.full_name, e.work_schedule, d.dt::date as missing_date
      FROM employees e
      CROSS JOIN generate_series($2::date, $3::date, '1 day'::interval) d(dt)
      WHERE e.organization_id = $1 AND e.status = 'ativo'
        AND EXTRACT(DOW FROM d.dt) NOT IN (0, 6)
        AND NOT EXISTS (
          SELECT 1 FROM time_punches tp WHERE tp.employee_id = e.id AND tp.punched_at::date = d.dt::date
        )
        AND NOT EXISTS (
          SELECT 1 FROM time_records tr WHERE tr.employee_id = e.id AND tr.record_date = d.dt::date
        )
        AND NOT EXISTS (
          SELECT 1 FROM employee_absences ea WHERE ea.employee_id = e.id AND d.dt::date BETWEEN ea.start_date AND ea.end_date
        )
      ORDER BY d.dt DESC, e.full_name
      LIMIT 100
    `, [orgId, sd, ed]);

    for (const r of noPunch.rows) {
      divergences.push({
        employee_id: r.id,
        employee_name: r.full_name,
        date: r.missing_date,
        type: 'sem_registro',
        description: 'Nenhum registro de ponto neste dia',
        severity: 'high',
      });
    }

    // 2. Incomplete punch sequences (odd number of punches = missing entry/exit)
    const incomplete = await query(`
      SELECT tp.employee_id, e.full_name, tp.punched_at::date as punch_date, COUNT(*) as punch_count
      FROM time_punches tp
      JOIN employees e ON e.id = tp.employee_id
      WHERE tp.organization_id = $1 AND tp.punched_at::date BETWEEN $2 AND $3
      GROUP BY tp.employee_id, e.full_name, tp.punched_at::date
      HAVING COUNT(*) % 2 != 0
      ORDER BY tp.punched_at::date DESC
    `, [orgId, sd, ed]);

    for (const r of incomplete.rows) {
      divergences.push({
        employee_id: r.employee_id,
        employee_name: r.full_name,
        date: r.punch_date,
        type: 'incompleto',
        description: `Sequência incompleta (${r.punch_count} registros - ímpar)`,
        severity: 'medium',
      });
    }

    // 3. Outside PDV punches
    const outsidePdv = await query(`
      SELECT tp.employee_id, e.full_name, tp.punched_at::date as punch_date, COUNT(*) as count
      FROM time_punches tp
      JOIN employees e ON e.id = tp.employee_id
      WHERE tp.organization_id = $1 AND tp.punched_at::date BETWEEN $2 AND $3
        AND tp.geo_status = 'fora_area'
      GROUP BY tp.employee_id, e.full_name, tp.punched_at::date
      ORDER BY tp.punched_at::date DESC
    `, [orgId, sd, ed]);

    for (const r of outsidePdv.rows) {
      divergences.push({
        employee_id: r.employee_id,
        employee_name: r.full_name,
        date: r.punch_date,
        type: 'fora_pdv',
        description: `${r.count} registro(s) fora do PDV`,
        severity: 'low',
      });
    }

    res.json(divergences);
  } catch (err) {
    logError('rh.punch_divergences', err);
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

// ===== POSITIONS (CARGOS) =====
router.get('/positions', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const result = await query(`SELECT * FROM rh_positions WHERE organization_id = $1 ORDER BY name`, [orgId]);
    res.json(result.rows);
  } catch (err) {
    // Table may not exist yet — auto-create
    try {
      await query(`CREATE TABLE IF NOT EXISTS rh_positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name VARCHAR(200) NOT NULL,
        department_id UUID REFERENCES rh_departments(id),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
      res.json([]);
    } catch (e2) { res.status(500).json({ error: 'Erro' }); }
  }
});

router.post('/positions', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    // Ensure table exists
    await query(`CREATE TABLE IF NOT EXISTS rh_positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      department_id UUID REFERENCES rh_departments(id),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const result = await query(
      `INSERT INTO rh_positions (organization_id, name, department_id, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [orgId, req.body.name, req.body.department_id || null, req.body.description || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro ao criar cargo' }); }
});

router.delete('/positions/:id', async (req, res) => {
  try {
    await query(`DELETE FROM rh_positions WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.delete('/rh-departments/:id', async (req, res) => {
  try {
    await query(`DELETE FROM rh_departments WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.delete('/branches/:id', async (req, res) => {
  try {
    await query(`DELETE FROM branches WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== WORKER PROFILES (PERFIS FUNCIONAIS) =====
router.get('/worker-profiles', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    await query(`CREATE TABLE IF NOT EXISTS rh_worker_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const result = await query(`SELECT * FROM rh_worker_profiles WHERE organization_id = $1 ORDER BY name`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/worker-profiles', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    await query(`CREATE TABLE IF NOT EXISTS rh_worker_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const result = await query(
      `INSERT INTO rh_worker_profiles (organization_id, name) VALUES ($1,$2) RETURNING *`,
      [orgId, req.body.name]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro ao criar perfil' }); }
});

router.delete('/worker-profiles/:id', async (req, res) => {
  try {
    await query(`DELETE FROM rh_worker_profiles WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// ===== AUDIT LOG =====

// ===== RH DASHBOARD STATS =====
router.get('/dashboard-stats', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json({});
    const today = new Date().toISOString().slice(0, 10);
    const lateRes = await query(
      `SELECT tr.*, e.full_name, e.work_schedule
       FROM time_records tr JOIN employees e ON e.id = tr.employee_id
       WHERE tr.organization_id = $1 AND tr.record_date = $2
         AND tr.entry1 IS NOT NULL AND e.work_schedule IS NOT NULL
         AND tr.entry1 > CAST(SPLIT_PART(e.work_schedule, '-', 1) || ':00' AS TIME) + INTERVAL '5 minutes'
       ORDER BY tr.entry1 DESC`, [orgId, today]);
    const absenceRes = await query(
      `SELECT e.id, e.full_name, e.position, d.name as department_name
       FROM employees e LEFT JOIN rh_departments d ON d.id = e.department_id
       WHERE e.organization_id = $1 AND e.status = 'ativo'
         AND NOT EXISTS (SELECT 1 FROM time_records tr WHERE tr.employee_id = e.id AND tr.record_date = $2)
       ORDER BY e.full_name`, [orgId, today]);
    const vacExpiring = await query(
      `SELECT e.id, e.full_name, e.admission_date, e.position
       FROM employees e WHERE e.organization_id = $1 AND e.status = 'ativo' AND e.admission_date IS NOT NULL
         AND (DATE_PART('month', e.admission_date) = DATE_PART('month', CURRENT_DATE + INTERVAL '30 days')
           AND DATE_PART('day', e.admission_date) <= DATE_PART('day', CURRENT_DATE + INTERVAL '30 days'))
       ORDER BY e.admission_date`, [orgId]);
    let pendingCerts = { rows: [] };
    try {
      pendingCerts = await query(
        `SELECT mc.*, e.full_name FROM rh_medical_certificates mc JOIN employees e ON e.id = mc.employee_id
         WHERE mc.organization_id = $1 AND mc.validated = false ORDER BY mc.created_at DESC LIMIT 20`, [orgId]);
    } catch(e) { /* table may not exist yet */ }
    let activeVacations = { rows: [] };
    try {
      activeVacations = await query(
        `SELECT v.*, e.full_name FROM rh_vacations v JOIN employees e ON e.id = v.employee_id
         WHERE v.organization_id = $1 AND v.status IN ('agendada', 'em_andamento') ORDER BY v.start_date`, [orgId]);
    } catch(e) { /* table may not exist yet */ }
    const countRes = await query(
      `SELECT
         (SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND status = 'ativo') as total_active,
         (SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND status = 'ferias') as on_vacation,
         (SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND status = 'afastado') as on_leave`, [orgId]);
    res.json({
      late_arrivals: lateRes.rows, absences_today: absenceRes.rows,
      vacations_expiring: vacExpiring.rows, pending_certificates: pendingCerts.rows,
      active_vacations: activeVacations.rows, summary: countRes.rows[0] || {},
    });
  } catch (err) { logError('rh.dashboard', err); res.status(500).json({ error: 'Erro ao carregar dashboard' }); }
});

// ===== VACATIONS =====
router.get('/vacations', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, status } = req.query;
    let sql = `SELECT v.*, e.full_name as employee_name, e.position FROM rh_vacations v JOIN employees e ON e.id = v.employee_id WHERE v.organization_id = $1`;
    const params = [orgId]; let idx = 2;
    if (employee_id) { sql += ` AND v.employee_id = $${idx++}`; params.push(employee_id); }
    if (status) { sql += ` AND v.status = $${idx++}`; params.push(status); }
    sql += ` ORDER BY v.start_date DESC`;
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('rh.vacations.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/vacations', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const d = req.body;
    const result = await query(
      `INSERT INTO rh_vacations (organization_id, employee_id, vacation_type, acquisition_start, acquisition_end,
        start_date, end_date, days_total, days_taken, days_remaining, abono_pecuniario, abono_days, status, notes, approved, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [orgId, d.employee_id, d.vacation_type || 'completa', d.acquisition_start, d.acquisition_end,
        d.start_date, d.end_date, d.days_total || 30, d.days_taken || 0,
        (d.days_total || 30) - (d.days_taken || 0), d.abono_pecuniario || false, d.abono_days || 0,
        d.status || 'agendada', d.notes, d.approved || false, req.userId]);
    if (d.start_date <= new Date().toISOString().slice(0, 10)) {
      await query(`UPDATE employees SET status = 'ferias', updated_at = NOW() WHERE id = $1`, [d.employee_id]);
    }
    await auditLog(orgId, 'vacation', result.rows[0].id, 'create', [{ field: 'vacation', oldVal: null, newVal: `${d.vacation_type}: ${d.start_date} - ${d.end_date}` }], req.userId);
    res.json(result.rows[0]);
  } catch (err) { logError('rh.vacations.create', err); res.status(500).json({ error: 'Erro ao registrar férias' }); }
});

router.put('/vacations/:id', async (req, res) => {
  try {
    const d = req.body;
    const result = await query(
      `UPDATE rh_vacations SET vacation_type=$2, start_date=$3, end_date=$4, days_total=$5, days_taken=$6, days_remaining=$7,
        abono_pecuniario=$8, abono_days=$9, status=$10, notes=$11, approved=$12, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id, d.vacation_type, d.start_date, d.end_date, d.days_total, d.days_taken, d.days_remaining, d.abono_pecuniario, d.abono_days, d.status, d.notes, d.approved]);
    res.json(result.rows[0]);
  } catch (err) { logError('rh.vacations.update', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== MEDICAL CERTIFICATES =====
router.get('/medical-certificates', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, validated } = req.query;
    let sql = `SELECT mc.*, e.full_name as employee_name FROM rh_medical_certificates mc JOIN employees e ON e.id = mc.employee_id WHERE mc.organization_id = $1`;
    const params = [orgId]; let idx = 2;
    if (employee_id) { sql += ` AND mc.employee_id = $${idx++}`; params.push(employee_id); }
    if (validated !== undefined) { sql += ` AND mc.validated = $${idx++}`; params.push(validated === 'true'); }
    sql += ` ORDER BY mc.created_at DESC`;
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('rh.medical.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/medical-certificates', async (req, res) => {
  try {
    const orgId = req.body.organization_id || await getUserOrgId(req.userId);
    const d = req.body;
    const result = await query(
      `INSERT INTO rh_medical_certificates (organization_id, employee_id, doctor_name, doctor_crm, cid_code,
        healthcare_unit, absence_start, absence_end, absence_days, absence_hours, is_partial,
        document_url, ai_extracted_data, ai_confidence, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [orgId, d.employee_id, d.doctor_name, d.doctor_crm, d.cid_code, d.healthcare_unit,
        d.absence_start, d.absence_end, d.absence_days, d.absence_hours, d.is_partial || false,
        d.document_url, d.ai_extracted_data ? JSON.stringify(d.ai_extracted_data) : null,
        d.ai_confidence, d.notes, req.userId]);
    // Auto-justify time records
    if (d.absence_start && d.absence_end) {
      const days = Math.ceil((new Date(d.absence_end) - new Date(d.absence_start)) / 86400000) + 1;
      for (let i = 0; i < days; i++) {
        const dt = new Date(d.absence_start); dt.setDate(dt.getDate() + i);
        const dateStr = dt.toISOString().slice(0, 10);
        await query(
          `INSERT INTO time_records (organization_id, employee_id, record_date, status, justification, total_hours, overtime_hours)
           VALUES ($1, $2, $3, 'atestado', $4, 0, 0)
           ON CONFLICT (employee_id, record_date) DO UPDATE SET status = 'atestado', justification = EXCLUDED.justification, updated_at = NOW()`,
          [orgId, d.employee_id, dateStr, `Atestado: CID ${d.cid_code || 'N/I'} - Dr. ${d.doctor_name || 'N/I'}`]);
      }
    }
    await auditLog(orgId, 'medical_certificate', result.rows[0].id, 'create',
      [{ field: 'certificate', oldVal: null, newVal: `CID: ${d.cid_code}, Dr: ${d.doctor_name}` }], req.userId);
    res.json(result.rows[0]);
  } catch (err) { logError('rh.medical.create', err); res.status(500).json({ error: 'Erro ao registrar atestado' }); }
});

router.put('/medical-certificates/:id/validate', async (req, res) => {
  try {
    const { validated, rejection_reason } = req.body;
    const result = await query(
      `UPDATE rh_medical_certificates SET validated = $2, validated_by = $3, validated_at = NOW(), rejection_reason = $4, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, validated, req.userId, rejection_reason || null]);
    res.json(result.rows[0]);
  } catch (err) { logError('rh.medical.validate', err); res.status(500).json({ error: 'Erro' }); }
});

// ===== EMPLOYEE DOCUMENTS =====
router.get('/documents', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const { employee_id, doc_type } = req.query;
    let sql = `SELECT ed.*, e.full_name as employee_name FROM employee_documents ed JOIN employees e ON e.id = ed.employee_id WHERE e.organization_id = $1`;
    const params = [orgId]; let idx = 2;
    if (employee_id) { sql += ` AND ed.employee_id = $${idx++}`; params.push(employee_id); }
    if (doc_type) { sql += ` AND ed.doc_type = $${idx++}`; params.push(doc_type); }
    sql += ` ORDER BY ed.created_at DESC`;
    res.json((await query(sql, params)).rows);
  } catch (err) { logError('rh.documents.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/documents', async (req, res) => {
  try {
    const d = req.body;
    const result = await query(
      `INSERT INTO employee_documents (employee_id, doc_type, title, file_url, expiry_date, notes, status, uploaded_by, ai_extracted_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.employee_id, d.doc_type, d.title, d.file_url, d.expiry_date, d.notes, d.status || 'pendente', req.userId,
        d.ai_extracted_data ? JSON.stringify(d.ai_extracted_data) : null]);
    res.json(result.rows[0]);
  } catch (err) { logError('rh.documents.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/documents/:id/validate', async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const result = await query(
      `UPDATE employee_documents SET status = $2, validated_by = $3, validated_at = NOW(), rejection_reason = $4 WHERE id = $1 RETURNING *`,
      [req.params.id, status || 'aprovado', req.userId, rejection_reason || null]);
    res.json(result.rows[0]);
  } catch (err) { logError('rh.documents.validate', err); res.status(500).json({ error: 'Erro' }); }
});

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

// ===== AI CERTIFICATE ANALYSIS =====
async function getAIConfig(userId) {
  const orgResult = await query(
    `SELECT o.ai_provider, o.ai_model, o.ai_api_key 
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id
     WHERE om.user_id = $1 LIMIT 1`,
    [userId]
  );
  const org = orgResult.rows[0];
  if (!org || !org.ai_api_key || org.ai_provider === 'none') return null;
  return {
    provider: org.ai_provider,
    model: org.ai_model || (org.ai_provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'),
    apiKey: org.ai_api_key,
  };
}

router.post('/analyze-certificate', async (req, res) => {
  try {
    const { document_url } = req.body;
    if (!document_url) return res.status(400).json({ error: 'document_url é obrigatório' });

    const aiConfig = await getAIConfig(req.userId);
    if (!aiConfig) {
      return res.status(400).json({ error: 'IA não configurada. Configure a chave de IA nas configurações da organização.' });
    }

    // Build image/document content for AI
    const resolvedUrl = document_url.startsWith('/') 
      ? `${process.env.BASE_URL || 'http://localhost:3000'}${document_url}`
      : document_url;

    const messages = [
      {
        role: 'system',
        content: `Você é um especialista em análise de atestados médicos brasileiros. Analise a imagem/documento do atestado e extraia as seguintes informações em JSON:
{
  "doctor_name": "nome completo do médico",
  "doctor_crm": "número do CRM (apenas números e UF, ex: 12345/SP)",
  "cid_code": "código CID (ex: J11, Z76.3)",
  "healthcare_unit": "nome do hospital, clínica ou unidade de saúde",
  "absence_start": "data início do afastamento no formato YYYY-MM-DD",
  "absence_end": "data fim do afastamento no formato YYYY-MM-DD",
  "absence_days": número de dias de afastamento,
  "absence_hours": "horários se parcial (ex: 08:00-12:00) ou vazio",
  "is_partial": true ou false se é atestado parcial (horas),
  "notes": "observações relevantes do atestado"
}
Se algum campo não for legível ou não estiver presente, use string vazia "" ou 0 para números. Responda APENAS com o JSON, sem texto adicional.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analise este atestado médico e extraia as informações:' },
          { type: 'image_url', image_url: { url: resolvedUrl } }
        ]
      }
    ];

    const result = await callAI(aiConfig, messages, { temperature: 0.1, maxTokens: 800 });
    
    let parsed = {};
    try {
      const jsonStr = (result.content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      logError('rh.analyze-certificate.parse', { raw: result.content });
      return res.status(422).json({ error: 'Não foi possível extrair dados do atestado. Tente uma imagem mais nítida.' });
    }

    logInfo('rh.analyze-certificate', { parsed });
    res.json({ success: true, data: parsed });
  } catch (err) {
    logError('rh.analyze-certificate', err);
    res.status(500).json({ error: 'Erro ao analisar atestado' });
  }
});

// ===== CRM VALIDATION =====
router.post('/validate-crm', async (req, res) => {
  try {
    const { crm, uf } = req.body;
    if (!crm || !uf) return res.status(400).json({ error: 'CRM e UF são obrigatórios' });

    const cleanCrm = crm.replace(/\D/g, '');
    const cleanUf = uf.toUpperCase().trim();

    // Use CFM portal search
    const url = `https://portal.cfm.org.br/api/public/medicos?crm=${cleanCrm}&uf=${cleanUf}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // Fallback: try alternative endpoint
      const altUrl = `https://www.consultacrm.com.br/api/index.php?tipo=crm&q=${cleanCrm}&chave=1173&destession=&ession=&ession=`;
      try {
        const altResp = await fetch(altUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (altResp.ok) {
          const altData = await altResp.json();
          const items = altData?.item || [];
          const match = items.find(i => i.uf?.toUpperCase() === cleanUf);
          if (match) {
            return res.json({
              valid: match.situacao?.toLowerCase().includes('regular') || match.situacao?.toLowerCase().includes('ativo'),
              doctor_name: match.nome || '',
              situation: match.situacao || 'Desconhecida',
              specialty: match.especialidade || '',
              source: 'consultacrm',
            });
          }
        }
      } catch { /* ignore fallback errors */ }

      return res.json({ valid: null, message: 'Não foi possível verificar o CRM no momento. Tente novamente mais tarde.' });
    }

    const data = await response.json();
    const medicos = data?.dados || data?.items || (Array.isArray(data) ? data : []);
    
    if (medicos.length === 0) {
      return res.json({ valid: false, message: 'CRM não encontrado no CFM.' });
    }

    const medico = medicos[0];
    const situacao = medico.situacao || medico.status || '';
    const isValid = situacao.toLowerCase().includes('regular') || situacao.toLowerCase().includes('ativo');

    res.json({
      valid: isValid,
      doctor_name: medico.nome || medico.name || '',
      situation: situacao,
      specialty: medico.especialidade || medico.specialty || '',
      source: 'cfm',
    });
  } catch (err) {
    logError('rh.validate-crm', err);
    res.json({ valid: null, message: 'Erro ao consultar CRM. Serviço pode estar indisponível.' });
  }
});

// ===== HOLIDAYS =====

// List holidays
router.get('/holidays', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);

    const { year, type } = req.query;
    const params = [orgId];
    let sql = `SELECT * FROM holidays WHERE organization_id = $1 AND active = true`;

    if (year) {
      sql += ` AND EXTRACT(YEAR FROM holiday_date) = $${params.length + 1}`;
      params.push(Number(year));
    }

    if (type) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    sql += ` ORDER BY holiday_date ASC, name ASC`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) {
    logError('rh.holidays.list', err);
    res.status(500).json({ error: err.message });
  }
});

// Create holiday
router.post('/holidays', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const { name, holiday_date, type, state, city, recurring } = req.body;
    if (!name || !holiday_date) return res.status(400).json({ error: 'Nome e data obrigatórios' });

    const r = await query(
      `INSERT INTO holidays (organization_id, name, holiday_date, type, state, city, recurring)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id, name, holiday_date) DO UPDATE SET
         type = EXCLUDED.type,
         state = EXCLUDED.state,
         city = EXCLUDED.city,
         recurring = EXCLUDED.recurring,
         active = true,
         updated_at = NOW()
       RETURNING *`,
      [orgId, name, holiday_date, type || 'nacional', emptyToNull(state), emptyToNull(city), recurring !== false]
    );
    res.json(r.rows[0]);
  } catch (err) {
    logError('rh.holidays.create', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk import holidays (from CSV/Excel)
router.post('/holidays/bulk', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const { holidays } = req.body;
    if (!Array.isArray(holidays) || !holidays.length) return res.status(400).json({ error: 'Lista de feriados vazia' });

    let imported = 0;
    for (const h of holidays) {
      if (!h.name || !h.holiday_date) continue;
      await query(
        `INSERT INTO holidays (organization_id, name, holiday_date, type, state, city, recurring)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (organization_id, name, holiday_date) DO UPDATE SET
           type = EXCLUDED.type,
           state = EXCLUDED.state,
           city = EXCLUDED.city,
           recurring = EXCLUDED.recurring,
           active = true,
           updated_at = NOW()`,
        [orgId, h.name, h.holiday_date, h.type || 'nacional', emptyToNull(h.state), emptyToNull(h.city), h.recurring !== false]
      );
      imported++;
    }

    res.json({ imported });
  } catch (err) {
    logError('rh.holidays.bulk', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete holiday
router.delete('/holidays/:id', async (req, res) => {
  try {
    await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('rh.holidays.delete', err); res.status(500).json({ error: err.message }); }
});

// ===== SERVICE REGIONS =====

// List regions
router.get('/regions', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json([]);
    const r = await query(
      `SELECT sr.*, e.full_name as supervisor_name,
         (SELECT COUNT(*) FROM region_pdvs rp WHERE rp.region_id = sr.id) as pdv_count
       FROM service_regions sr
       LEFT JOIN employees e ON e.id = sr.supervisor_id
       WHERE sr.organization_id = $1
       ORDER BY sr.name`,
      [orgId]
    );
    res.json(r.rows);
  } catch (err) { logError('rh.regions.list', err); res.status(500).json({ error: err.message }); }
});

// Create region
router.post('/regions', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    const { name, color, polygon, cities, states, supervisor_id, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await query(
      `INSERT INTO service_regions (organization_id, name, color, polygon, cities, states, supervisor_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [orgId, name, color || '#3b82f6', JSON.stringify(polygon || []), JSON.stringify(cities || []), JSON.stringify(states || []), emptyToNull(supervisor_id), emptyToNull(notes)]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('rh.regions.create', err); res.status(500).json({ error: err.message }); }
});

// Update region
router.put('/regions/:id', async (req, res) => {
  try {
    const { name, color, polygon, cities, states, supervisor_id, notes, active } = req.body;
    const r = await query(
      `UPDATE service_regions SET name=$1, color=$2, polygon=$3, cities=$4, states=$5, supervisor_id=$6, notes=$7, active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, color, JSON.stringify(polygon || []), JSON.stringify(cities || []), JSON.stringify(states || []), emptyToNull(supervisor_id), emptyToNull(notes), active !== false, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('rh.regions.update', err); res.status(500).json({ error: err.message }); }
});

// Delete region
router.delete('/regions/:id', async (req, res) => {
  try {
    await query(`DELETE FROM service_regions WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { logError('rh.regions.delete', err); res.status(500).json({ error: err.message }); }
});

// Link PDVs to region
router.post('/regions/:id/pdvs', async (req, res) => {
  try {
    const { pdv_ids, auto_assigned } = req.body;
    if (!Array.isArray(pdv_ids)) return res.status(400).json({ error: 'pdv_ids obrigatório' });
    for (const pdvId of pdv_ids) {
      await query(
        `INSERT INTO region_pdvs (region_id, pdv_id, auto_assigned) VALUES ($1,$2,$3) ON CONFLICT (region_id, pdv_id) DO NOTHING`,
        [req.params.id, pdvId, auto_assigned || false]
      );
    }
    res.json({ ok: true });
  } catch (err) { logError('rh.regions.link-pdvs', err); res.status(500).json({ error: err.message }); }
});

// Get PDVs in a region
router.get('/regions/:id/pdvs', async (req, res) => {
  try {
    const r = await query(
      `SELECT p.*, rp.auto_assigned FROM region_pdvs rp JOIN pdvs p ON p.id = rp.pdv_id WHERE rp.region_id = $1 ORDER BY p.name`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) { logError('rh.regions.pdvs', err); res.status(500).json({ error: err.message }); }
});

// Remove PDV from region
router.delete('/regions/:regionId/pdvs/:pdvId', async (req, res) => {
  try {
    await query(`DELETE FROM region_pdvs WHERE region_id = $1 AND pdv_id = $2`, [req.params.regionId, req.params.pdvId]);
    res.json({ ok: true });
  } catch (err) { logError('rh.regions.remove-pdv', err); res.status(500).json({ error: err.message }); }
});

// ===== GEOCODING (via Nominatim - free) =====
router.post('/geocode', async (req, res) => {
  try {
    const { address, city, state, zip_code } = req.body;
    const parts = [address, city, state, zip_code].filter(Boolean).join(', ');
    if (!parts) return res.status(400).json({ error: 'Endereço necessário' });
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(parts)}&format=json&limit=1&countrycodes=br`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'AyratechRH/1.0' } });
    const data = await resp.json();
    if (data.length === 0) return res.json({ found: false });
    res.json({ found: true, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon), display_name: data[0].display_name });
  } catch (err) { logError('rh.geocode', err); res.status(500).json({ error: err.message }); }
});

// ===== MAP DATA: PDVs + Employees with coords =====
router.get('/map-data', async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    if (!orgId) return res.json({ pdvs: [], employees: [], regions: [] });
    const [pdvsR, empsR, regionsR] = await Promise.all([
      query(`SELECT id, name, client_name, address, city, state, latitude, longitude, radius_meters, supervisor_id, active FROM pdvs WHERE organization_id = $1 AND active = true`, [orgId]),
      query(`SELECT id, full_name, position, worker_profile, city, state, home_latitude, home_longitude, photo_url FROM employees WHERE organization_id = $1 AND status = 'ativo'`, [orgId]),
      query(`SELECT sr.*, e.full_name as supervisor_name FROM service_regions sr LEFT JOIN employees e ON e.id = sr.supervisor_id WHERE sr.organization_id = $1 AND sr.active = true`, [orgId]),
    ]);
    res.json({ pdvs: pdvsR.rows, employees: empsR.rows, regions: regionsR.rows });
  } catch (err) { logError('rh.map-data', err); res.status(500).json({ error: err.message }); }
});

export default router;
