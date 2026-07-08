// ============================================================
// FASE 5 — INTEGRAÇÃO FOLHA (Export Layouts)
//   Formatos: dominio | folhamatic | senior | sap | adp | generic
//   GET  /api/rh/payroll-export/preview?month=YYYY-MM&format=&company_id=
//   GET  /api/rh/payroll-export/download?month=YYYY-MM&format=&company_id=
//   GET  /api/rh/payroll-export/formats
// ============================================================
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

async function getUserOrgId(userId) {
  const r = await query(
    `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.organization_id;
}

// -------- helpers --------
function pad(s, n, ch = ' ', dir = 'right') {
  const str = String(s ?? '');
  if (str.length >= n) return str.slice(0, n);
  return dir === 'left' ? ch.repeat(n - str.length) + str : str + ch.repeat(n - str.length);
}
function num(n, decimals = 2, width = 0, cents = false) {
  const v = Number(n || 0);
  if (cents) {
    const s = String(Math.round(v * 100));
    return width ? pad(s, width, '0', 'left') : s;
  }
  const s = v.toFixed(decimals).replace('.', ',');
  return width ? pad(s, width, '0', 'left') : s;
}
function digits(s = '') { return String(s || '').replace(/\D/g, ''); }

function collectEvents(payslip) {
  // Retorna [{code, kind (P|D), reference, value, description}]
  const out = [];
  for (const e of (payslip.earnings || [])) {
    out.push({
      code: e.code || '001',
      kind: 'P',
      description: e.description || 'Provento',
      reference: e.reference || '30',
      value: Number(e.value || 0),
    });
  }
  for (const d of (payslip.deductions || [])) {
    out.push({
      code: d.code || '900',
      kind: 'D',
      description: d.description || 'Desconto',
      reference: d.reference || '',
      value: Number(d.value || 0),
    });
  }
  if (!out.length && Number(payslip.gross_salary || 0) > 0) {
    out.push({ code: '001', kind: 'P', description: 'Salário', reference: '30', value: Number(payslip.gross_salary) });
  }
  return out;
}

// -------- Layout builders --------
// Cada builder recebe rows [{ payslip, employee, events }] e retorna { content, filename, mime }

function buildDominio(rows, month) {
  const header = ['MATRICULA', 'CPF', 'NOME', 'COD_EVENTO', 'DESCRICAO', 'REFERENCIA', 'VALOR', 'TIPO', 'COMPETENCIA'];
  const lines = [header.join(';')];
  for (const r of rows) {
    for (const ev of r.events) {
      lines.push([
        r.employee.registration_number || '',
        digits(r.employee.cpf),
        (r.employee.full_name || '').toUpperCase(),
        ev.code,
        ev.description,
        ev.reference || '',
        num(ev.value, 2),
        ev.kind,
        month.replace('-', ''),
      ].join(';'));
    }
  }
  return { content: lines.join('\r\n'), filename: `folha-dominio-${month}.csv`, mime: 'text/csv' };
}

function buildFolhamatic(rows, month) {
  // Posicional: matricula(6) codigo(4) referencia(6,2) valor(11,2) tipo(1)  competencia(6)
  const lines = [];
  for (const r of rows) {
    for (const ev of r.events) {
      const line =
        pad(r.employee.registration_number || '0', 6, '0', 'left') +
        pad(ev.code, 4, '0', 'left') +
        num(ev.reference || 0, 2, 8, true) +   // 6 int + 2 dec = 8 dígitos
        num(ev.value, 2, 11, true) +           // 9 int + 2 dec
        (ev.kind === 'P' ? '1' : '2') +
        month.replace('-', '').slice(-6);
      lines.push(line);
    }
  }
  return { content: lines.join('\r\n'), filename: `folha-folhamatic-${month}.txt`, mime: 'text/plain' };
}

function buildSenior(rows, month) {
  const header = ['CHAPA', 'PERIODO', 'EVENTO', 'REFERENCIA', 'VALOR', 'TIPO'];
  const lines = [header.join('|')];
  for (const r of rows) {
    for (const ev of r.events) {
      lines.push([
        r.employee.registration_number || '',
        month.replace('-', ''),
        ev.code,
        ev.reference || '0',
        num(ev.value, 2),
        ev.kind,
      ].join('|'));
    }
  }
  return { content: lines.join('\r\n'), filename: `folha-senior-${month}.csv`, mime: 'text/csv' };
}

function buildSap(rows, month) {
  // SAP SuccessFactors / SAP HR PA30 CSV
  const header = ['EMPLOYEE_ID', 'WAGE_TYPE', 'AMOUNT', 'CURRENCY', 'START_DATE', 'END_DATE', 'IND'];
  const lines = [header.join(',')];
  const [y, m] = month.split('-');
  const start = `${y}-${m}-01`;
  const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
  for (const r of rows) {
    for (const ev of r.events) {
      lines.push([
        r.employee.registration_number || r.employee.id.slice(0, 8),
        ev.code,
        num(ev.value, 2),
        'BRL',
        start,
        end,
        ev.kind === 'P' ? '+' : '-',
      ].join(','));
    }
  }
  return { content: lines.join('\r\n'), filename: `folha-sap-${month}.csv`, mime: 'text/csv' };
}

function buildAdp(rows, month) {
  // ADP GlobalView layout simplificado
  const header = ['File #', 'Employee Name', 'Reg Hours', 'OT Hours', 'Earnings Code', 'Earnings Amount', 'Deduction Code', 'Deduction Amount', 'Period'];
  const lines = [header.join(',')];
  const period = month.replace('-', '');
  for (const r of rows) {
    const regHours = 220;
    const otHours = r.events.filter(e => /HE|H\.EXTRA|OVERTIME|EXTRA/i.test(e.description)).reduce((a, e) => a + Number(e.reference || 0), 0);
    for (const ev of r.events) {
      const isP = ev.kind === 'P';
      lines.push([
        r.employee.registration_number || '',
        `"${(r.employee.full_name || '').replace(/"/g, '')}"`,
        regHours, otHours,
        isP ? ev.code : '', isP ? num(ev.value, 2) : '',
        !isP ? ev.code : '', !isP ? num(ev.value, 2) : '',
        period,
      ].join(','));
    }
  }
  return { content: lines.join('\r\n'), filename: `folha-adp-${month}.csv`, mime: 'text/csv' };
}

function buildGeneric(rows, month, columns) {
  const cols = columns && columns.length ? columns : ['matricula', 'cpf', 'nome', 'evento', 'descricao', 'referencia', 'valor', 'tipo', 'competencia'];
  const lines = [cols.join(';')];
  for (const r of rows) {
    for (const ev of r.events) {
      const map = {
        matricula: r.employee.registration_number || '',
        cpf: digits(r.employee.cpf),
        nome: r.employee.full_name || '',
        evento: ev.code,
        descricao: ev.description,
        referencia: ev.reference || '',
        valor: num(ev.value, 2),
        tipo: ev.kind,
        competencia: month,
        salario_base: num(r.payslip.gross_salary, 2),
        total_proventos: num(r.payslip.total_earnings, 2),
        total_descontos: num(r.payslip.total_deductions, 2),
        liquido: num(r.payslip.net_salary, 2),
        admissao: r.employee.admission_date || '',
        cargo: r.employee.position || '',
        departamento: r.employee.department_name || '',
        empresa: r.employee.company_name || '',
      };
      lines.push(cols.map(c => String(map[c] ?? '').replace(/;/g, ',')).join(';'));
    }
  }
  return { content: lines.join('\r\n'), filename: `folha-generico-${month}.csv`, mime: 'text/csv' };
}

const BUILDERS = {
  dominio: buildDominio,
  folhamatic: buildFolhamatic,
  senior: buildSenior,
  sap: buildSap,
  adp: buildAdp,
  generic: buildGeneric,
};

async function loadRows(orgId, month, companyId) {
  const params = [orgId, month];
  let filter = `WHERE p.organization_id = $1 AND p.reference_month = $2`;
  if (companyId) { params.push(companyId); filter += ` AND e.company_id = $${params.length}`; }
  let sql;
  try {
    sql = `SELECT p.*,
             e.id AS emp_id, e.full_name, e.cpf, e.registration_number, e.admission_date,
             e.position, e.company_id,
             d.name AS department_name, c.name AS company_name
           FROM payslips p
           JOIN employees e ON e.id = p.employee_id
           LEFT JOIN rh_departments d ON d.id = e.department_id
           LEFT JOIN companies c ON c.id = e.company_id
           ${filter}
           ORDER BY e.full_name`;
    const { rows } = await query(sql, params);
    return rows.map(row => ({
      payslip: {
        gross_salary: row.gross_salary, earnings: row.earnings || [],
        deductions: row.deductions || [], total_earnings: row.total_earnings,
        total_deductions: row.total_deductions, net_salary: row.net_salary,
      },
      employee: {
        id: row.emp_id, full_name: row.full_name, cpf: row.cpf,
        registration_number: row.registration_number, admission_date: row.admission_date,
        position: row.position, department_name: row.department_name,
        company_id: row.company_id, company_name: row.company_name,
      },
      events: collectEvents({
        earnings: row.earnings || [],
        deductions: row.deductions || [],
        gross_salary: row.gross_salary,
      }),
    }));
  } catch (e) {
    // companies table may not exist
    sql = `SELECT p.*, e.id AS emp_id, e.full_name, e.cpf, e.registration_number,
             e.admission_date, e.position,
             d.name AS department_name
           FROM payslips p
           JOIN employees e ON e.id = p.employee_id
           LEFT JOIN rh_departments d ON d.id = e.department_id
           WHERE p.organization_id = $1 AND p.reference_month = $2
           ORDER BY e.full_name`;
    const { rows } = await query(sql, [orgId, month]);
    return rows.map(row => ({
      payslip: {
        gross_salary: row.gross_salary, earnings: row.earnings || [],
        deductions: row.deductions || [], total_earnings: row.total_earnings,
        total_deductions: row.total_deductions, net_salary: row.net_salary,
      },
      employee: {
        id: row.emp_id, full_name: row.full_name, cpf: row.cpf,
        registration_number: row.registration_number, admission_date: row.admission_date,
        position: row.position, department_name: row.department_name,
      },
      events: collectEvents({
        earnings: row.earnings || [],
        deductions: row.deductions || [],
        gross_salary: row.gross_salary,
      }),
    }));
  }
}

router.get('/formats', (_req, res) => {
  res.json([
    { key: 'dominio', label: 'Domínio Sistemas', ext: 'csv', description: 'CSV separado por ; — layout Domínio/Contmatic' },
    { key: 'folhamatic', label: 'Folhamatic', ext: 'txt', description: 'TXT posicional — matrícula(6) evento(4) ref(8) valor(11) tipo(1)' },
    { key: 'senior', label: 'Senior HCM', ext: 'csv', description: 'CSV separado por | — layout Senior' },
    { key: 'sap', label: 'SAP SuccessFactors', ext: 'csv', description: 'CSV padrão SAP PA30 wage types' },
    { key: 'adp', label: 'ADP GlobalView', ext: 'csv', description: 'CSV com colunas ADP earnings/deductions' },
    { key: 'generic', label: 'CSV Genérico (configurável)', ext: 'csv', description: 'Colunas escolhidas por você' },
  ]);
});

router.get('/preview', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    if (!orgId) return res.json({ rows: [], sample: '' });
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const format = String(req.query.format || 'dominio');
    const companyId = req.query.company_id || null;
    const columns = req.query.columns ? String(req.query.columns).split(',') : null;
    const builder = BUILDERS[format];
    if (!builder) return res.status(400).json({ error: 'Formato inválido' });
    const rows = await loadRows(orgId, month, companyId);
    const built = format === 'generic' ? builder(rows, month, columns) : builder(rows, month);
    const preview = built.content.split('\r\n').slice(0, 30).join('\n');
    res.json({
      month, format, employees_count: rows.length,
      events_count: rows.reduce((s, r) => s + r.events.length, 0),
      total_lines: built.content.split('\r\n').length,
      filename: built.filename,
      sample: preview,
    });
  } catch (err) {
    logError('rh.payroll-export.preview', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/download', async (req, res) => {
  try {
    const orgId = await getUserOrgId(req.userId);
    if (!orgId) return res.status(400).send('Sem organização');
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const format = String(req.query.format || 'dominio');
    const companyId = req.query.company_id || null;
    const columns = req.query.columns ? String(req.query.columns).split(',') : null;
    const builder = BUILDERS[format];
    if (!builder) return res.status(400).send('Formato inválido');
    const rows = await loadRows(orgId, month, companyId);
    if (!rows.length) return res.status(404).send('Nenhum holerite encontrado para o período');
    const built = format === 'generic' ? builder(rows, month, columns) : builder(rows, month);
    res.setHeader('Content-Type', `${built.mime}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`);
    // BOM para CSV abrir corretamente no Excel
    if (built.mime === 'text/csv') res.write('\uFEFF');
    res.end(built.content);
  } catch (err) {
    logError('rh.payroll-export.download', err);
    res.status(500).send('Erro ao gerar arquivo');
  }
});

export default router;
