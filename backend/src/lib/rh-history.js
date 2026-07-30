import { query } from '../db.js';
import { logError } from '../logger.js';

let ready = false;

export async function ensureHistoryTables() {
  if (ready) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS rh_employee_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        employee_id UUID NOT NULL,
        period_id UUID,
        event_type VARCHAR(40) NOT NULL,
        title VARCHAR(255),
        description TEXT,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        effective_date DATE DEFAULT CURRENT_DATE,
        source VARCHAR(20) DEFAULT 'auto',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_rh_emp_history_emp ON rh_employee_history(employee_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_rh_emp_history_date ON rh_employee_history(effective_date)`);

    await query(`
      CREATE TABLE IF NOT EXISTS rh_employment_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID,
        employee_id UUID NOT NULL,
        sequence INTEGER DEFAULT 1,
        start_date DATE,
        end_date DATE,
        employment_type VARCHAR(40),
        position VARCHAR(255),
        role_level VARCHAR(100),
        department_id UUID,
        company_id UUID,
        salary NUMERIC(12,2),
        termination_reason TEXT,
        status VARCHAR(20) DEFAULT 'ativo',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_rh_emp_periods_emp ON rh_employment_periods(employee_id)`);
    ready = true;
  } catch (err) {
    logError('rh.history.ensureTables', err);
  }
}

export async function getOpenPeriod(employeeId) {
  try {
    const r = await query(
      `SELECT * FROM rh_employment_periods
       WHERE employee_id = $1 AND end_date IS NULL
       ORDER BY COALESCE(start_date, created_at::date) DESC, created_at DESC LIMIT 1`,
      [employeeId]
    );
    return r.rows[0] || null;
  } catch (err) {
    logError('rh.history.getOpenPeriod', err, { employeeId });
    return null;
  }
}

export async function openPeriod(emp, { start_date, userId, sequence } = {}) {
  await ensureHistoryTables();
  try {
    let seq = sequence;
    if (!seq) {
      const c = await query(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM rh_employment_periods WHERE employee_id = $1`, [emp.id]);
      seq = Number(c.rows[0]?.next || 1);
    }
    const r = await query(
      `INSERT INTO rh_employment_periods
        (organization_id, employee_id, sequence, start_date, employment_type, position, role_level, department_id, company_id, salary, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ativo',$11) RETURNING *`,
      [
        emp.organization_id || null, emp.id, seq,
        start_date || emp.admission_date || new Date().toISOString().slice(0, 10),
        emp.employment_type || null, emp.position || null, emp.role_level || null,
        emp.department_id || null, emp.company_id || null,
        emp.salary ?? null, userId || null,
      ]
    );
    return r.rows[0];
  } catch (err) {
    logError('rh.history.openPeriod', err, { employeeId: emp?.id });
    return null;
  }
}

export async function closePeriod(employeeId, { end_date, reason, userId } = {}) {
  await ensureHistoryTables();
  try {
    const open = await getOpenPeriod(employeeId);
    if (!open) return null;
    const r = await query(
      `UPDATE rh_employment_periods
       SET end_date = $2, termination_reason = COALESCE($3, termination_reason), status = 'encerrado', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [open.id, end_date || new Date().toISOString().slice(0, 10), reason || null]
    );
    return r.rows[0];
  } catch (err) {
    logError('rh.history.closePeriod', err, { employeeId });
    return null;
  }
}

export async function recordEvent(event) {
  await ensureHistoryTables();
  try {
    const openPeriodRow = event.period_id ? null : await getOpenPeriod(event.employee_id);
    const r = await query(
      `INSERT INTO rh_employee_history
        (organization_id, employee_id, period_id, event_type, title, description, field_name, old_value, new_value, effective_date, source, metadata, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::date, CURRENT_DATE),$11,$12,$13) RETURNING *`,
      [
        event.organization_id || null,
        event.employee_id,
        event.period_id || openPeriodRow?.id || null,
        event.event_type || 'outro',
        event.title || null,
        event.description || null,
        event.field_name || null,
        event.old_value == null ? null : String(event.old_value),
        event.new_value == null ? null : String(event.new_value),
        event.effective_date || null,
        event.source || 'auto',
        JSON.stringify(event.metadata || {}),
        event.created_by || null,
      ]
    );
    return r.rows[0];
  } catch (err) {
    logError('rh.history.recordEvent', err, { employeeId: event?.employee_id });
    return null;
  }
}

const EMPLOYMENT_TYPE_LABELS = {
  clt: 'CLT', pj: 'PJ', freelancer: 'Freelancer',
  temporario: 'Temporário', estagiario: 'Estagiário', aprendiz: 'Aprendiz',
};

export const TRACKED_FIELDS = {
  position: { type: 'promocao', label: 'Cargo' },
  role_level: { type: 'promocao', label: 'Nível' },
  salary: { type: 'mudanca_salario', label: 'Salário' },
  employment_type: { type: 'mudanca_contrato', label: 'Tipo de contratação' },
  department_id: { type: 'transferencia', label: 'Departamento' },
  branch_id: { type: 'transferencia', label: 'Filial' },
  company_id: { type: 'transferencia', label: 'Empresa' },
  cost_center_id: { type: 'transferencia', label: 'Centro de custo' },
  work_schedule: { type: 'mudanca_jornada', label: 'Jornada' },
  status: { type: 'mudanca_status', label: 'Status' },
};

function pretty(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'employment_type') return EMPLOYMENT_TYPE_LABELS[String(value)] || String(value);
  if (field === 'salary') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(value);
  }
  return String(value);
}

async function resolveLabel(field, value) {
  if (!value) return '—';
  const map = {
    department_id: 'rh_departments', branch_id: 'branches',
    company_id: 'companies', cost_center_id: 'cost_centers',
  };
  const table = map[field];
  if (!table) return pretty(field, value);
  try {
    const r = await query(`SELECT name FROM ${table} WHERE id = $1 LIMIT 1`, [value]);
    return r.rows[0]?.name || String(value);
  } catch (_) {
    return String(value);
  }
}

/**
 * Registra automaticamente eventos de trilha a partir das mudanças do colaborador.
 * Também abre/encerra vínculos em desligamento e readmissão.
 */
export async function trackEmployeeChanges({ before, after, changes, userId, effective_date }) {
  await ensureHistoryTables();
  try {
    if (!before || !after) return;

    // Garante que exista um vínculo aberto para colaboradores ativos legados
    if (String(before.status || '') !== 'desligado') {
      const open = await getOpenPeriod(before.id);
      if (!open) await openPeriod(before, { userId, start_date: before.admission_date });
    }

    const statusChange = (changes || []).find(c => c.field === 'status');
    const wasTerminated = String(before.status || '') === 'desligado';
    const isTerminated = String(after.status || '') === 'desligado';

    for (const ch of changes || []) {
      const meta = TRACKED_FIELDS[ch.field];
      if (!meta) continue;
      if (ch.field === 'status') continue; // tratado abaixo
      const oldLabel = await resolveLabel(ch.field, ch.oldVal);
      const newLabel = await resolveLabel(ch.field, ch.newVal);
      let type = meta.type;
      if (ch.field === 'salary') {
        const oldN = Number(ch.oldVal || 0), newN = Number(ch.newVal || 0);
        type = newN < oldN ? 'reducao_salario' : 'mudanca_salario';
      }
      await recordEvent({
        organization_id: after.organization_id,
        employee_id: after.id,
        event_type: type,
        title: `${meta.label}: ${oldLabel} → ${newLabel}`,
        field_name: ch.field,
        old_value: ch.oldVal,
        new_value: ch.newVal,
        effective_date,
        created_by: userId,
      });
    }

    if (statusChange && !wasTerminated && isTerminated) {
      const endDate = effective_date || (after.termination_date ? String(after.termination_date).slice(0, 10) : null);
      await closePeriod(after.id, { end_date: endDate, reason: after.termination_reason, userId });
      await recordEvent({
        organization_id: after.organization_id,
        employee_id: after.id,
        event_type: 'desligamento',
        title: 'Desligamento',
        description: after.termination_reason || null,
        effective_date: endDate,
        created_by: userId,
      });
    } else if (statusChange && wasTerminated && !isTerminated) {
      const startDate = effective_date || new Date().toISOString().slice(0, 10);
      await closePeriod(after.id, { end_date: startDate, userId });
      const period = await openPeriod(after, { start_date: startDate, userId });
      await recordEvent({
        organization_id: after.organization_id,
        employee_id: after.id,
        period_id: period?.id,
        event_type: 'readmissao',
        title: 'Readmissão',
        effective_date: startDate,
        created_by: userId,
      });
    } else if (statusChange) {
      await recordEvent({
        organization_id: after.organization_id,
        employee_id: after.id,
        event_type: 'mudanca_status',
        title: `Status: ${pretty('status', statusChange.oldVal)} → ${pretty('status', statusChange.newVal)}`,
        field_name: 'status',
        old_value: statusChange.oldVal,
        new_value: statusChange.newVal,
        effective_date,
        created_by: userId,
      });
    }

    // Mantém o vínculo aberto sincronizado com os dados atuais
    const open = await getOpenPeriod(after.id);
    if (open && !isTerminated) {
      await query(
        `UPDATE rh_employment_periods
         SET employment_type = $2, position = $3, role_level = $4, department_id = $5,
             company_id = $6, salary = $7, updated_at = NOW()
         WHERE id = $1`,
        [open.id, after.employment_type || null, after.position || null, after.role_level || null,
          after.department_id || null, after.company_id || null, after.salary ?? null]
      );
    }
  } catch (err) {
    logError('rh.history.trackChanges', err, { employeeId: after?.id });
  }
}
