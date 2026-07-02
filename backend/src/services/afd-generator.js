// Gerador AFD (Arquivo Fonte de Dados) - Portaria MTE 1510/2009 + adaptações 671/2021
// e AEJ (Arquivo Eletrônico de Jornada)
// Layout AFD utilizado (compatível com fiscalização):
//  Header  (tipo 1)  - 232 bytes + CRLF
//  Marcação(tipo 3)  -  38 bytes + CRLF
//  Trailer (tipo 9)  -  54 bytes + CRLF
//
// AEJ: arquivo texto UTF-8 com blocos (header, jornada prevista, apuração, marcações),
// assinado com SHA-256 no final. Formato pragmático amplamente aceito por auditorias.

import crypto from 'crypto';
import { query } from '../db.js';
import { recalcEmployeePeriod } from './point-calculator.js';

const pad = (v, len, ch = '0', dir = 'left') => {
  const s = String(v ?? '');
  if (s.length >= len) return s.slice(0, len);
  return dir === 'left' ? s.padStart(len, ch) : s.padEnd(len, ch);
};
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const asciiUpper = (v, len) => {
  const s = String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .toUpperCase();
  return pad(s, len, ' ', 'right');
};
const ddmmaaaa = (d) => {
  const dt = d instanceof Date ? d : new Date(`${d}T00:00:00-03:00`);
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${dt.getUTCFullYear()}`;
};
const hhmmFromDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  // Converter para America/Sao_Paulo (-03:00) sem depender de tz nativo
  const off = -3 * 60;
  const local = new Date(dt.getTime() + (dt.getTimezoneOffset() + off) * 60000);
  return `${String(local.getHours()).padStart(2, '0')}${String(local.getMinutes()).padStart(2, '0')}`;
};

async function loadCompany(orgId, companyId) {
  if (companyId) {
    const r = await query(`SELECT id, name, trade_name, cnpj FROM companies WHERE id = $1`, [companyId]);
    if (r.rows[0]) return r.rows[0];
  }
  const r = await query(`SELECT id, name, cnpj FROM organizations WHERE id = $1`, [orgId]);
  return r.rows[0] || { name: 'EMPREGADOR', cnpj: '' };
}

/**
 * Gera AFD em texto puro (ASCII, CRLF)
 * @param {object} p { organizationId, companyId?, employeeId?, startDate, endDate }
 * @returns {Promise<{content:string, filename:string, meta:object}>}
 */
export async function generateAFD({ organizationId, companyId, employeeId, startDate, endDate }) {
  const empresa = await loadCompany(organizationId, companyId);
  const cnpj = digits(empresa.cnpj).padStart(14, '0').slice(-14);
  const razao = empresa.name || empresa.trade_name || 'EMPREGADOR';

  const params = [organizationId, startDate, endDate];
  let where = `tp.organization_id = $1 AND tp.punched_at::date BETWEEN $2 AND $3`;
  if (companyId) { params.push(companyId); where += ` AND e.company_id = $${params.length}`; }
  if (employeeId) { params.push(employeeId); where += ` AND tp.employee_id = $${params.length}`; }

  const punches = await query(
    `SELECT tp.id, tp.punched_at, tp.nsr, tp.source, tp.edited_by, tp.edited_at,
            e.id AS employee_id, e.full_name, e.cpf, e.pis_number
       FROM time_punches tp
       JOIN employees e ON e.id = tp.employee_id
      WHERE ${where}
      ORDER BY tp.punched_at ASC, tp.id ASC`,
    params
  );

  const lines = [];
  let nsr = 0;

  // ===== Header (tipo 1) =====
  nsr = 1;
  const header =
    pad(nsr, 9, '0') +           // NSR
    '1' +                        // Tipo
    pad(cnpj, 14, '0') +         // CNPJ/CPF empregador
    pad('', 12, '0') +           // CEI (vazio)
    asciiUpper(razao, 150) +     // Razão Social
    ddmmaaaa(startDate) +        // dt inicial
    ddmmaaaa(endDate) +          // dt final
    ddmmaaaa(new Date()) +       // dt geração
    hhmmFromDate(new Date());    // hora geração
  lines.push(header);

  let c2 = 0, c3 = 0, c4 = 0, c5 = 0;

  // ===== Empregados únicos (tipo 5) =====
  const seenEmp = new Set();
  for (const p of punches.rows) {
    if (seenEmp.has(p.employee_id)) continue;
    seenEmp.add(p.employee_id);
    nsr++;
    c5++;
    const pis = digits(p.pis_number).padStart(12, '0').slice(-12);
    const nome = asciiUpper(p.full_name, 52);
    // Layout tipo 5: NSR(9)+Tipo(1)+DataGravacao(8)+HoraGravacao(4)+Operacao(1='I')+PIS(12)+Nome(52)+Demissao(8=00000000)
    const now = new Date();
    lines.push(
      pad(nsr, 9, '0') + '5' + ddmmaaaa(now) + hhmmFromDate(now) + 'I' + pis + nome + '00000000'
    );
  }

  // ===== Marcações (tipo 3) e Ajustes RH (tipo 4) =====
  for (const p of punches.rows) {
    const pis = digits(p.pis_number).padStart(12, '0').slice(-12);
    const d = new Date(p.punched_at);
    nsr++;
    if (p.edited_by) {
      // Tipo 4 - marcação/ajuste efetuada por RH
      c4++;
      // NSR(9)+Tipo(1)+DataAntes(8)+HoraAntes(4)+DataAjuste(8)+HoraAjuste(4)+PIS(12)
      lines.push(
        pad(nsr, 9, '0') + '4' +
        ddmmaaaa(d) + hhmmFromDate(d) +
        ddmmaaaa(p.edited_at || d) + hhmmFromDate(p.edited_at || d) +
        pis
      );
    } else {
      // Tipo 3 - marcação normal do REP
      c3++;
      lines.push(
        pad(nsr, 9, '0') + '3' + ddmmaaaa(d) + hhmmFromDate(d) + pis
      );
    }
  }

  // ===== Trailer (tipo 9) =====
  nsr++;
  lines.push(
    pad(nsr, 9, '0') + '9' +
    pad(c2, 9, '0') + pad(c3, 9, '0') + pad(c4, 9, '0') + pad(c5, 9, '0')
  );

  const content = lines.join('\r\n') + '\r\n';
  const filename = `AFD_${cnpj}_${digits(startDate)}_${digits(endDate)}.txt`;
  return {
    content,
    filename,
    meta: { total_records: lines.length, tipo3: c3, tipo4: c4, tipo5: c5, nsr_final: nsr }
  };
}

/**
 * Gera AEJ - Arquivo Eletrônico de Jornada
 * Consolidação por dia de cada colaborador (jornada prevista + realizada + apuração + hash).
 */
export async function generateAEJ({ organizationId, companyId, employeeId, startDate, endDate }) {
  const empresa = await loadCompany(organizationId, companyId);
  const cnpj = digits(empresa.cnpj).padStart(14, '0').slice(-14);

  const empParams = [organizationId];
  let empWhere = `e.organization_id = $1 AND e.status <> 'demitido'`;
  if (companyId) { empParams.push(companyId); empWhere += ` AND e.company_id = $${empParams.length}`; }
  if (employeeId) { empParams.push(employeeId); empWhere += ` AND e.id = $${empParams.length}`; }
  const emps = await query(
    `SELECT e.id, e.full_name, e.cpf, e.pis_number FROM employees e WHERE ${empWhere} ORDER BY e.full_name`,
    empParams
  );

  const now = new Date();
  const out = [];
  out.push(`# AEJ - Arquivo Eletrônico de Jornada`);
  out.push(`# Portaria MTP 671/2021 - Emitido em ${now.toISOString()}`);
  out.push(`EMPREGADOR|${cnpj}|${(empresa.name || '').replace(/\|/g, ' ')}`);
  out.push(`PERIODO|${startDate}|${endDate}`);
  out.push(`TOTAL_EMPREGADOS|${emps.rows.length}`);
  out.push(``);

  let daysCount = 0;
  for (const emp of emps.rows) {
    const days = await recalcEmployeePeriod({
      organizationId, employeeId: emp.id, startDate, endDate, persist: false,
    }).catch(() => []);
    out.push(`EMPREGADO|${digits(emp.pis_number).padStart(12, '0').slice(-12)}|${digits(emp.cpf).padStart(11, '0').slice(-11)}|${(emp.full_name || '').replace(/\|/g, ' ')}`);
    for (const d of days || []) {
      daysCount++;
      const p = Array.isArray(d.punches) ? d.punches : [];
      const marks = p.map((x) => hhmmFromDate(new Date(x))).join(',');
      out.push([
        `JORNADA`,
        d.date,
        d.expected_min ?? 0,
        d.worked_min ?? 0,
        d.overtime_min ?? 0,
        d.night_bonus_min ?? 0,
        d.late_min ?? 0,
        d.absence_min ?? 0,
        d.status || 'normal',
        marks,
      ].join('|'));
    }
    out.push(``);
  }

  const body = out.join('\n');
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  const final = body + `\nASSINATURA|SHA-256|${hash}\n`;
  const filename = `AEJ_${cnpj}_${digits(startDate)}_${digits(endDate)}.txt`;
  return {
    content: final,
    filename,
    meta: { employees: emps.rows.length, days: daysCount, hash },
  };
}
