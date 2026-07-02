// Point Calculator - motor de cálculo diário de ponto
// Recebe batidas + jornada + feriados e devolve dia consolidado (Cartão Ponto estilo Secullum)
// Regra atual: banco de horas 1:1, tolerância configurável, marca feriado/DSR/falta/atraso

import { query } from '../db.js';

// --- helpers de tempo ---
const toMin = (hhmm) => {
  if (!hhmm) return null;
  const s = String(hhmm).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const fromMin = (mins) => {
  if (mins == null || Number.isNaN(mins)) return null;
  const sign = mins < 0 ? '-' : '';
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const toHHMMSS = (dateOrString) => {
  if (!dateOrString) return null;
  if (typeof dateOrString === 'string' && /^\d{2}:\d{2}/.test(dateOrString)) return dateOrString.slice(0, 5);
  try {
    const d = dateOrString instanceof Date ? dateOrString : new Date(dateOrString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
};

// --- parsing da jornada (string "08:00-12:00,13:00-17:00" ou "08:00-17:00" ou JSON por dia) ---
export function parseWorkSchedule(raw, dow) {
  if (!raw) return { entries: [], expectedMin: 0, hasSchedule: false };
  let scheduleForDay = raw;
  // Se for JSON por dia (weekly) { mon: "...", tue: "...", ... }
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { raw = JSON.parse(raw); } catch { /* fallthrough */ }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    scheduleForDay = raw[keys[dow]] || raw.default || raw.padrao || '';
  }
  const s = String(scheduleForDay || '').trim();
  if (!s || s.toLowerCase() === 'folga' || s.toLowerCase() === 'off') {
    return { entries: [], expectedMin: 0, hasSchedule: false, isDayOff: true };
  }
  // Formato: "08:00-12:00,13:00-17:00" ou "08:00-17:00" (com 1h almoço implícita se > 6h)
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  const entries = [];
  let totalMin = 0;
  for (const p of parts) {
    const m = p.match(/^(\d{1,2}:\d{2})\s*[-–a]\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;
    const startMin = toMin(m[1]);
    const endMin = toMin(m[2]);
    if (startMin == null || endMin == null) continue;
    const dur = endMin - startMin;
    entries.push({ start: m[1], end: m[2], startMin, endMin, durationMin: dur });
    totalMin += dur;
  }
  // Se só tem um bloco de mais de 6h, desconta 1h de almoço na expectativa
  if (entries.length === 1 && totalMin > 6 * 60) {
    totalMin -= 60;
  }
  return { entries, expectedMin: totalMin, hasSchedule: entries.length > 0, isDayOff: false };
}

// --- cálculo de um dia ---
export function calculateDay({ punches = [], schedule, isHoliday = false, tolerance = 10 }) {
  // Ordena batidas do dia
  const sorted = [...punches]
    .filter(p => p && p.punched_at)
    .sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at));

  // Extrai até 4 pares (entry1/exit1 ... entry4/exit4)
  const times = sorted.map(p => toHHMMSS(p.punched_at));
  const pairs = { entry1: null, exit1: null, entry2: null, exit2: null, entry3: null, exit3: null, entry4: null, exit4: null };
  ['entry1', 'exit1', 'entry2', 'exit2', 'entry3', 'exit3', 'entry4', 'exit4'].forEach((k, i) => {
    pairs[k] = times[i] || null;
  });

  // Minutos trabalhados (soma dos pares completos)
  let workedMin = 0;
  for (let i = 0; i < times.length - 1; i += 2) {
    const a = toMin(times[i]);
    const b = toMin(times[i + 1]);
    if (a != null && b != null && b > a) workedMin += (b - a);
  }

  const oddPunch = times.length % 2 === 1;

  const expectedMin = schedule?.expectedMin || 0;
  const isDayOff = schedule?.isDayOff || false;

  let status = 'normal';
  let balanceMin = 0;

  if (isHoliday) {
    status = 'feriado';
    balanceMin = workedMin; // trabalhou no feriado = tudo crédito
  } else if (isDayOff) {
    status = 'folga';
    balanceMin = workedMin;
  } else if (times.length === 0) {
    status = expectedMin > 0 ? 'falta' : 'folga';
    balanceMin = expectedMin > 0 ? -expectedMin : 0;
  } else {
    const rawBal = workedMin - expectedMin;
    if (Math.abs(rawBal) <= tolerance) balanceMin = 0;
    else balanceMin = rawBal;
    if (rawBal < -tolerance) status = 'atraso';
    else if (rawBal > tolerance) status = 'extra';
  }

  const creditMin = balanceMin > 0 ? balanceMin : 0;
  const debitMin = balanceMin < 0 ? -balanceMin : 0;

  return {
    ...pairs,
    total_worked_min: workedMin,
    total_worked: fromMin(workedMin),
    expected_min: expectedMin,
    expected: fromMin(expectedMin),
    balance_min: balanceMin,
    balance: fromMin(balanceMin),
    credit_min: creditMin,
    credit: fromMin(creditMin),
    debit_min: debitMin,
    debit: fromMin(debitMin),
    status,
    is_holiday: isHoliday,
    is_day_off: isDayOff,
    odd_punch: oddPunch,
    punch_count: times.length,
  };
}

// --- recalcular todos os dias do colaborador no período e atualizar banco de horas ---
export async function recalcEmployeePeriod({ organizationId, employeeId, startDate, endDate }) {
  const emp = await query(
    `SELECT id, work_schedule, company_id FROM employees WHERE id = $1`,
    [employeeId]
  );
  if (!emp.rows[0]) return { days: [] };
  const workSchedule = emp.rows[0].work_schedule;
  const companyId = emp.rows[0].company_id;

  // busca tolerância
  const tolRes = await query(
    `SELECT late_tolerance_minutes FROM time_rules WHERE organization_id = $1 AND (employee_id = $2 OR employee_id IS NULL) ORDER BY employee_id NULLS LAST LIMIT 1`,
    [organizationId, employeeId]
  ).catch(() => ({ rows: [] }));
  const tolerance = tolRes.rows[0]?.late_tolerance_minutes ?? 10;

  // feriados no período
  const holRes = await query(
    `SELECT holiday_date FROM holidays WHERE organization_id = $1 AND (company_id = $2 OR company_id IS NULL) AND holiday_date BETWEEN $3 AND $4`,
    [organizationId, companyId, startDate, endDate]
  ).catch(() => ({ rows: [] }));
  const holidaySet = new Set(holRes.rows.map(r => new Date(r.holiday_date).toISOString().slice(0, 10)));

  // batidas
  const punchRes = await query(
    `SELECT id, punch_type, punched_at, geo_status, is_offline
     FROM time_punches
     WHERE employee_id = $1 AND punched_at::date BETWEEN $2 AND $3
     ORDER BY punched_at`,
    [employeeId, startDate, endDate]
  );

  // Agrupar por data
  const byDate = new Map();
  for (const p of punchRes.rows) {
    const d = new Date(p.punched_at).toISOString().slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(p);
  }

  // Iterar todos os dias
  const days = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const schedule = parseWorkSchedule(workSchedule, dow);
    const punches = byDate.get(dateStr) || [];
    const isHoliday = holidaySet.has(dateStr);
    const calc = calculateDay({ punches, schedule, isHoliday, tolerance });
    days.push({ date: dateStr, dow, ...calc, punches });
  }

  // Persistir time_records (upsert) + time_bank_entries
  for (const day of days) {
    await query(
      `INSERT INTO time_records (organization_id, employee_id, record_date, entry1, exit1, entry2, exit2, entry3, exit3, total_hours, overtime_hours, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (employee_id, record_date) DO UPDATE SET
         entry1=EXCLUDED.entry1, exit1=EXCLUDED.exit1, entry2=EXCLUDED.entry2, exit2=EXCLUDED.exit2,
         entry3=EXCLUDED.entry3, exit3=EXCLUDED.exit3,
         total_hours=EXCLUDED.total_hours, overtime_hours=EXCLUDED.overtime_hours,
         status=EXCLUDED.status, updated_at=NOW()`,
      [organizationId, employeeId, day.date, day.entry1, day.exit1, day.entry2, day.exit2, day.entry3, day.exit3,
        (day.total_worked_min / 60).toFixed(2), (day.credit_min / 60).toFixed(2), day.status]
    ).catch(() => {});

    // Banco de horas: lançamento diário (apaga anteriores do dia sistema e recria)
    await query(
      `DELETE FROM time_bank_entries WHERE employee_id = $1 AND entry_date = $2 AND source = 'auto'`,
      [employeeId, day.date]
    ).catch(() => {});
    if (day.balance_min !== 0) {
      await query(
        `INSERT INTO time_bank_entries (organization_id, company_id, employee_id, entry_date, minutes, kind, source, description)
         VALUES ($1,$2,$3,$4,$5,$6,'auto',$7)`,
        [organizationId, companyId, employeeId, day.date, day.balance_min,
          day.balance_min > 0 ? 'credit' : 'debit',
          `Cálculo automático (${day.status})`]
      ).catch(() => {});
    }
  }

  return { days };
}

export default { calculateDay, parseWorkSchedule, recalcEmployeePeriod };
