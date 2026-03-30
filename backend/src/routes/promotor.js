import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();

// ===== MIDDLEWARE: Promotor Auth =====
const authenticatePromotor = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.appType !== 'promotor') return res.status(403).json({ error: 'Token inválido para este app' });
    req.employeeId = decoded.employeeId;
    req.organizationId = decoded.organizationId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// =============================================
// PUBLIC: LOGIN DO COLABORADOR
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body; // login = CPF ou email
    if (!login || !password) return res.status(400).json({ error: 'Login e senha obrigatórios' });

    const cleaned = login.replace(/\D/g, '');
    const isCpf = cleaned.length === 11;

    const emp = await query(
      `SELECT e.id, e.full_name, e.cpf, e.email, e.organization_id, e.worker_profile, e.photo_url,
              a.password_hash, a.access_status, a.temp_password, a.force_password_change
       FROM employees e
       JOIN collaborator_app_access a ON a.employee_id = e.id
       WHERE ${isCpf ? 'REPLACE(REPLACE(REPLACE(e.cpf, \'.\', \'\'), \'-\', \'\'), \' \', \'\') = $1' : 'LOWER(e.email) = LOWER($1)'}
         AND a.access_status IN ('liberado', 'aguardando_login', 'ativo')`,
      [isCpf ? cleaned : login]
    );

    if (!emp.rows[0]) return res.status(401).json({ error: 'Credenciais inválidas ou acesso não liberado' });
    const employee = emp.rows[0];

    const valid = await bcrypt.compare(password, employee.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    // Update access status
    await query(
      `UPDATE collaborator_app_access SET access_status = 'ativo', last_login = NOW(), last_device = $2, last_ip = $3, updated_at = NOW() WHERE employee_id = $1`,
      [employee.id, req.headers['user-agent'] || '', req.ip]
    );

    const token = jwt.sign(
      { employeeId: employee.id, organizationId: employee.organization_id, appType: 'promotor' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      employee: {
        id: employee.id,
        name: employee.full_name,
        cpf: employee.cpf,
        email: employee.email,
        photo_url: employee.photo_url,
        profile: employee.worker_profile,
        organization_id: employee.organization_id,
        force_password_change: employee.force_password_change && employee.temp_password,
      },
    });
  } catch (err) {
    logError('promotor.login', err);
    res.status(500).json({ error: 'Erro no login' });
  }
});

// =============================================
// PROMOTOR: CHANGE PASSWORD
// =============================================
router.post('/change-password', authenticatePromotor, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const acc = await query(`SELECT password_hash FROM collaborator_app_access WHERE employee_id = $1`, [req.employeeId]);
    if (!acc.rows[0]) return res.status(404).json({ error: 'Acesso não encontrado' });

    if (current_password) {
      const valid = await bcrypt.compare(current_password, acc.rows[0].password_hash);
      if (!valid) return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query(
      `UPDATE collaborator_app_access SET password_hash = $2, temp_password = false, force_password_change = false, updated_at = NOW() WHERE employee_id = $1`,
      [req.employeeId, hash]
    );
    await query(`INSERT INTO collaborator_password_resets (employee_id, reset_by, ip_address) VALUES ($1, 'proprio', $2)`, [req.employeeId, req.ip]);
    res.json({ ok: true });
  } catch (err) {
    logError('promotor.change-password', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// PROMOTOR: HOME / STATUS DO DIA
// =============================================
router.get('/home', authenticatePromotor, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const empId = req.employeeId;

    const [employee, punches, pendingDocs, notifications, assignment, settings] = await Promise.all([
      query(`SELECT id, full_name, email, cpf, photo_url, worker_profile, work_schedule, position FROM employees WHERE id = $1`, [empId]),
      query(`SELECT * FROM time_punches WHERE employee_id = $1 AND punched_at::date = $2 ORDER BY punched_at`, [empId, today]),
      query(`SELECT COUNT(*) as count FROM rh_document_deliveries WHERE employee_id = $1 AND status IN ('enviado', 'entregue', 'visualizado') AND (requires_signature = true OR requires_confirmation = true)`, [empId]),
      query(`SELECT * FROM collaborator_notifications WHERE employee_id = $1 AND read = false ORDER BY created_at DESC LIMIT 10`, [empId]),
      query(`SELECT da.*, p.name as pdv_name, p.latitude, p.longitude, p.radius_meters FROM collaborator_daily_assignments da LEFT JOIN pdvs p ON p.id = da.pdv_id WHERE da.employee_id = $1 AND da.assignment_date = $2 LIMIT 1`, [empId, today]),
      query(`SELECT * FROM collaborator_app_settings WHERE employee_id = $1`, [empId]),
    ]);

    // Get linked PDVs if no daily assignment
    let pdvs = [];
    if (!assignment.rows[0]) {
      const pdvRes = await query(
        `SELECT p.* FROM collaborator_pdvs cp JOIN pdvs p ON p.id = cp.pdv_id WHERE cp.employee_id = $1 AND cp.active = true`, [empId]
      );
      pdvs = pdvRes.rows;
    }

    // Check schedule status
    const ws = employee.rows[0]?.work_schedule || '08:00-17:00';
    const wsParts = String(ws).split('-');
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const startMin = wsParts[0] ? wsParts[0].split(':').reduce((h, m) => parseInt(h) * 60 + parseInt(m), 0) : 480;
    const endMin = wsParts[1] ? wsParts[1].split(':').reduce((h, m) => parseInt(h) * 60 + parseInt(m), 0) : 1020;
    const isWithinSchedule = currentMin >= (startMin - 30) && currentMin <= (endMin + 15);

    // Check overtime approval for today
    const otRes = await query(
      `SELECT id, status, requested_start, requested_end FROM overtime_requests WHERE employee_id = $1 AND request_date = $2 ORDER BY created_at DESC LIMIT 1`,
      [empId, today]
    );
    const overtimeRequest = otRes.rows[0] || null;
    const hasOvertimeApproval = overtimeRequest?.status === 'aprovado';

    res.json({
      employee: employee.rows[0],
      today_punches: punches.rows,
      pending_docs_count: parseInt(pendingDocs.rows[0]?.count || '0'),
      notifications: notifications.rows,
      daily_assignment: assignment.rows[0] || null,
      available_pdvs: pdvs,
      settings: settings.rows[0] || { theme: 'auto' },
      schedule_status: {
        work_schedule: ws,
        schedule_start: wsParts[0] || '08:00',
        schedule_end: wsParts[1] || '17:00',
        is_within_schedule: isWithinSchedule,
        has_overtime_approval: hasOvertimeApproval,
        overtime_request: overtimeRequest,
      },
    });
  } catch (err) {
    logError('promotor.home', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// PROMOTOR: BATER PONTO
// =============================================
router.post('/punch', authenticatePromotor, async (req, res) => {
  try {
    const { punch_type, latitude, longitude, accuracy_meters, pdv_id, is_offline, offline_local_time, justification, local_id } = req.body;

    // ===== WORK SCHEDULE VALIDATION =====
    const empRes = await query(`SELECT work_schedule FROM employees WHERE id = $1`, [req.employeeId]);
    const workSchedule = empRes.rows[0]?.work_schedule || '08:00-17:00';
    const now = is_offline && offline_local_time ? new Date(offline_local_time) : new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse schedule "HH:MM-HH:MM"
    const scheduleParts = String(workSchedule).split('-');
    const scheduleStart = scheduleParts[0] ? scheduleParts[0].split(':').reduce((h, m) => parseInt(h) * 60 + parseInt(m), 0) : 480;
    const scheduleEnd = scheduleParts[1] ? scheduleParts[1].split(':').reduce((h, m) => parseInt(h) * 60 + parseInt(m), 0) : 1020;

    // Allow 30 min before start and 15 min after end as tolerance
    const toleranceBefore = 30;
    const toleranceAfter = 15;
    const isWithinSchedule = currentMinutes >= (scheduleStart - toleranceBefore) && currentMinutes <= (scheduleEnd + toleranceAfter);

    if (!isWithinSchedule) {
      // Check for approved overtime request for today
      const today = now.toISOString().slice(0, 10);
      const otReq = await query(
        `SELECT id, requested_start, requested_end FROM overtime_requests
         WHERE employee_id = $1 AND request_date = $2 AND status = 'aprovado'
         ORDER BY created_at DESC LIMIT 1`,
        [req.employeeId, today]
      );

      if (!otReq.rows[0]) {
        const startFmt = scheduleParts[0] || '08:00';
        const endFmt = scheduleParts[1] || '17:00';
        return res.status(403).json({
          error: `Fora do horário de trabalho (${startFmt} - ${endFmt}). Solicite autorização de hora extra ao supervisor.`,
          code: 'OUTSIDE_SCHEDULE',
          schedule: { start: startFmt, end: endFmt },
          current_time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
        });
      }

      // Check if overtime window covers current time
      const otStart = otReq.rows[0].requested_start;
      const otEnd = otReq.rows[0].requested_end;
      if (otStart && otEnd) {
        const otStartMin = otStart.split(':').reduce((h, m) => parseInt(h) * 60 + parseInt(m), 0);
        const otEndMin = otEnd.split(':').reduce((h, m) => parseInt(h) * 60 + parseInt(m), 0);
        if (currentMinutes < otStartMin - 15 || currentMinutes > otEndMin + 15) {
          return res.status(403).json({
            error: `Hora extra aprovada apenas de ${otStart} a ${otEnd}.`,
            code: 'OUTSIDE_OVERTIME_WINDOW'
          });
        }
      }
    }

    // ===== GEO VALIDATION =====
    let distance = null;
    let geo_status = 'sem_gps';

    if (latitude && longitude && pdv_id) {
      const pdv = await query(`SELECT latitude, longitude, radius_meters FROM pdvs WHERE id = $1`, [pdv_id]);
      if (pdv.rows[0] && pdv.rows[0].latitude) {
        const R = 6371000;
        const dLat = (pdv.rows[0].latitude - latitude) * Math.PI / 180;
        const dLng = (pdv.rows[0].longitude - longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(latitude * Math.PI / 180) * Math.cos(pdv.rows[0].latitude * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
        distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        geo_status = distance <= pdv.rows[0].radius_meters ? 'dentro_area' : 'fora_area';
      }
    } else if (latitude && longitude) {
      geo_status = 'sem_pdv';
    }

    if (geo_status === 'fora_area') {
      const rules = await query(
        `SELECT allow_exception_punch FROM time_rules WHERE organization_id = $1 AND (employee_id = $2 OR employee_id IS NULL) ORDER BY employee_id NULLS LAST LIMIT 1`,
        [req.organizationId, req.employeeId]
      );
      if (rules.rows[0] && !rules.rows[0].allow_exception_punch && !justification) {
        return res.status(400).json({ error: 'Você está fora da área permitida. Forneça justificativa para registrar.', geo_status, distance });
      }
      if (justification) geo_status = 'excecao';
    }

    const result = await query(
      `INSERT INTO time_punches (organization_id, employee_id, punch_type, punched_at, latitude, longitude, accuracy_meters, pdv_id, distance_from_pdv, geo_status, device_info, ip_address, is_offline, offline_local_time, sync_status, justification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [req.organizationId, req.employeeId, punch_type, is_offline ? offline_local_time : new Date(),
        latitude, longitude, accuracy_meters, pdv_id || null, distance, geo_status,
        req.headers['user-agent'], req.ip, is_offline || false, offline_local_time || null,
        is_offline ? 'synced' : 'synced', justification || null]
    );

    if (geo_status === 'fora_area' || geo_status === 'excecao') {
      await query(
        `INSERT INTO time_alerts (organization_id, employee_id, alert_type, alert_date, description) VALUES ($1,$2,'fora_pdv',$3,$4)`,
        [req.organizationId, req.employeeId, new Date().toISOString().slice(0,10), `Ponto registrado ${Math.round(distance)}m do PDV (${geo_status})`]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    logError('promotor.punch', err);
    res.status(500).json({ error: 'Erro ao registrar ponto' });
  }
});

// =============================================
// PROMOTOR: SOLICITAR HORA EXTRA
// =============================================
router.post('/overtime-request', authenticatePromotor, async (req, res) => {
  try {
    const { reason, request_date, requested_start, requested_end } = req.body;
    if (!reason) return res.status(400).json({ error: 'Informe o motivo da hora extra' });
    const date = request_date || new Date().toISOString().slice(0, 10);

    // Check for existing pending request
    const existing = await query(
      `SELECT id FROM overtime_requests WHERE employee_id = $1 AND request_date = $2 AND status = 'pendente'`,
      [req.employeeId, date]
    );
    if (existing.rows[0]) {
      return res.status(400).json({ error: 'Já existe uma solicitação pendente para esta data' });
    }

    const result = await query(
      `INSERT INTO overtime_requests (organization_id, employee_id, request_date, reason, requested_start, requested_end)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.organizationId, req.employeeId, date, reason, requested_start || null, requested_end || null]
    );

    // Notify supervisor
    const emp = await query(`SELECT full_name, direct_manager_id FROM employees WHERE id = $1`, [req.employeeId]);
    if (emp.rows[0]?.direct_manager_id) {
      await query(
        `INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type)
         VALUES ($1,$2,$3,$4,'overtime_request')`,
        [req.organizationId, emp.rows[0].direct_manager_id,
         'Solicitação de Hora Extra',
         `${emp.rows[0].full_name} solicitou hora extra para ${date}: ${reason}`]
      ).catch(() => {});
    }

    res.json(result.rows[0]);
  } catch (err) {
    logError('promotor.overtime-request', err);
    res.status(500).json({ error: 'Erro ao solicitar hora extra' });
  }
});

// =============================================
// PROMOTOR: MINHAS SOLICITAÇÕES DE HORA EXTRA
// =============================================
router.get('/overtime-requests', authenticatePromotor, async (req, res) => {
  try {
    const r = await query(
      `SELECT ot.*, e.full_name as approved_by_name
       FROM overtime_requests ot
       LEFT JOIN employees e ON e.id = ot.approved_by
       WHERE ot.employee_id = $1
       ORDER BY ot.created_at DESC LIMIT 30`,
      [req.employeeId]
    );
    res.json(r.rows);
  } catch (err) {
    logError('promotor.overtime-requests', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// RH/SUPERVISOR: LISTAR SOLICITAÇÕES DE HORA EXTRA
// =============================================
router.get('/rh/overtime-requests', authenticate, async (req, res) => {
  try {
    const orgId = req.query.org_id || await getUserOrgId(req.userId);
    const { status, employee_id } = req.query;
    let sql = `SELECT ot.*, e.full_name as employee_name, e.position, e.work_schedule, ap.full_name as approved_by_name
      FROM overtime_requests ot
      JOIN employees e ON e.id = ot.employee_id
      LEFT JOIN employees ap ON ap.id = ot.approved_by
      WHERE ot.organization_id = $1`;
    const params = [orgId];
    if (status) { sql += ` AND ot.status = $${params.length + 1}`; params.push(status); }
    if (employee_id) { sql += ` AND ot.employee_id = $${params.length + 1}`; params.push(employee_id); }
    sql += ` ORDER BY ot.created_at DESC LIMIT 100`;
    res.json((await query(sql, params)).rows);
  } catch (err) {
    logError('rh.overtime-requests', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// RH/SUPERVISOR: APROVAR/RECUSAR HORA EXTRA
// =============================================
router.put('/rh/overtime-requests/:id', authenticate, async (req, res) => {
  try {
    const { status, supervisor_notes } = req.body;
    if (!['aprovado', 'recusado'].includes(status)) return res.status(400).json({ error: 'Status inválido' });

    // Get supervisor employee id
    const supEmp = await query(`SELECT id FROM employees WHERE user_id = $1 LIMIT 1`, [req.userId]);
    const approvedBy = supEmp.rows[0]?.id || null;

    const result = await query(
      `UPDATE overtime_requests SET status = $1, supervisor_notes = $2, approved_by = $3, approved_at = NOW() WHERE id = $4 RETURNING *`,
      [status, supervisor_notes || null, approvedBy, req.params.id]
    );

    // Notify employee
    if (result.rows[0]) {
      const ot = result.rows[0];
      const statusLabel = status === 'aprovado' ? '✅ Aprovada' : '❌ Recusada';
      await query(
        `INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type)
         VALUES ($1,$2,$3,$4,'overtime_response')`,
        [ot.organization_id, ot.employee_id,
         `Hora Extra ${statusLabel}`,
         `Sua solicitação para ${ot.request_date} foi ${status}. ${supervisor_notes || ''}`]
      ).catch(() => {});
    }

    res.json(result.rows[0]);
  } catch (err) {
    logError('rh.overtime-approve', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// PROMOTOR: HISTÓRICO DE PONTO
// =============================================
router.get('/punches', authenticatePromotor, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = `SELECT tp.*, p.name as pdv_name FROM time_punches tp LEFT JOIN pdvs p ON p.id = tp.pdv_id WHERE tp.employee_id = $1`;
    const params = [req.employeeId];
    let idx = 2;
    if (start_date) { sql += ` AND tp.punched_at::date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND tp.punched_at::date <= $${idx++}`; params.push(end_date); }
    sql += ` ORDER BY tp.punched_at DESC LIMIT 200`;
    res.json((await query(sql, params)).rows);
  } catch (err) {
    logError('promotor.punches', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// PROMOTOR: MEUS DOCUMENTOS
// =============================================
router.get('/documents', authenticatePromotor, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT dd.*, dt.name as type_name FROM rh_document_deliveries dd LEFT JOIN rh_document_types dt ON dt.id = dd.document_type_id WHERE dd.employee_id = $1`;
    const params = [req.employeeId];
    if (status) { sql += ` AND dd.status = $2`; params.push(status); }
    sql += ` ORDER BY dd.created_at DESC`;
    res.json((await query(sql, params)).rows);
  } catch (err) {
    logError('promotor.documents', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// PROMOTOR: CONFIRMAR RECEBIMENTO / VISUALIZAÇÃO
// =============================================
router.post('/documents/:id/view', authenticatePromotor, async (req, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE rh_document_deliveries SET status = CASE WHEN status IN ('enviado','entregue') THEN 'visualizado' ELSE status END, viewed_at = COALESCE(viewed_at, NOW()), ip_at_view = $2, device_at_view = $3, updated_at = NOW() WHERE id = $1 AND employee_id = $4`,
      [id, req.ip, req.headers['user-agent'], req.employeeId]);
    await query(`INSERT INTO rh_document_delivery_events (delivery_id, event_type, actor_type, ip_address, device_info) VALUES ($1, 'visualizado', 'colaborador', $2, $3)`, [id, req.ip, req.headers['user-agent']]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/documents/:id/confirm', authenticatePromotor, async (req, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE rh_document_deliveries SET status = 'confirmado', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 AND employee_id = $2`, [id, req.employeeId]);
    await query(`INSERT INTO rh_document_delivery_events (delivery_id, event_type, actor_type, ip_address) VALUES ($1, 'confirmado', 'colaborador', $2)`, [id, req.ip]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/documents/:id/refuse', authenticatePromotor, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await query(`UPDATE rh_document_deliveries SET status = 'recusado', refused_at = NOW(), refuse_reason = $3, updated_at = NOW() WHERE id = $1 AND employee_id = $2`, [id, req.employeeId, reason]);
    await query(`INSERT INTO rh_document_delivery_events (delivery_id, event_type, actor_type, notes) VALUES ($1, 'recusado', 'colaborador', $2)`, [id, reason]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// PROMOTOR: ENVIAR DOCUMENTO AO RH (upload reverso)
// =============================================
router.post('/inbound-documents', authenticatePromotor, async (req, res) => {
  try {
    const { category, title, file_url, observation } = req.body;
    const result = await query(
      `INSERT INTO rh_inbound_documents (organization_id, employee_id, category, title, file_url, observation, ip_address, device_info) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.organizationId, req.employeeId, category, title || category, file_url, observation, req.ip, req.headers['user-agent']]
    );
    // Notify RH
    await query(`INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type, reference_type, reference_id) SELECT $1, e.id, 'Documento recebido do colaborador', $3, 'document', 'inbound', $4 FROM employees e WHERE e.organization_id = $1 AND e.worker_profile IN ('administrativo','supervisor') LIMIT 5`,
      [req.organizationId, req.employeeId, `${category} enviado`, result.rows[0].id]);
    res.json(result.rows[0]);
  } catch (err) {
    logError('promotor.inbound-doc', err);
    res.status(500).json({ error: 'Erro' });
  }
});

router.get('/inbound-documents', authenticatePromotor, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM rh_inbound_documents WHERE employee_id = $1 ORDER BY created_at DESC`, [req.employeeId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// PROMOTOR: HOLERITES
// =============================================
router.get('/payslips', authenticatePromotor, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, pd.delivery_status, pd.viewed_at, pd.signed_at FROM payslips p LEFT JOIN payslip_deliveries pd ON pd.payslip_id = p.id AND pd.employee_id = $1 WHERE p.employee_id = $1 AND p.status IN ('gerado','pago') ORDER BY p.reference_month DESC`,
      [req.employeeId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// PROMOTOR: ESPELHO DE PONTO
// =============================================
router.get('/timesheets', authenticatePromotor, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM timesheet_exports WHERE employee_id = $1 AND status IN ('enviado', 'concluido') ORDER BY reference_month DESC`,
      [req.employeeId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// PROMOTOR: NOTIFICAÇÕES
// =============================================
router.get('/notifications', authenticatePromotor, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM collaborator_notifications WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.employeeId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/notifications/:id/read', authenticatePromotor, async (req, res) => {
  try {
    await query(`UPDATE collaborator_notifications SET read = true, read_at = NOW() WHERE id = $1 AND employee_id = $2`, [req.params.id, req.employeeId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// PROMOTOR: CONFIGURAÇÕES
// =============================================
router.get('/settings', authenticatePromotor, async (req, res) => {
  try {
    let result = await query(`SELECT * FROM collaborator_app_settings WHERE employee_id = $1`, [req.employeeId]);
    if (!result.rows[0]) {
      result = await query(`INSERT INTO collaborator_app_settings (employee_id) VALUES ($1) RETURNING *`, [req.employeeId]);
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.put('/settings', authenticatePromotor, async (req, res) => {
  try {
    const { theme, notifications_enabled } = req.body;
    const result = await query(
      `INSERT INTO collaborator_app_settings (employee_id, theme, notifications_enabled) VALUES ($1,$2,$3) ON CONFLICT (employee_id) DO UPDATE SET theme=EXCLUDED.theme, notifications_enabled=EXCLUDED.notifications_enabled, updated_at=NOW() RETURNING *`,
      [req.employeeId, theme || 'auto', notifications_enabled !== false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// PROMOTOR: SYNC OFFLINE QUEUE
// =============================================
router.post('/sync', authenticatePromotor, async (req, res) => {
  try {
    const { events } = req.body; // Array of offline events
    const results = [];
    for (const ev of (events || [])) {
      try {
        if (ev.action_type === 'time_punch') {
          const punch = await query(
            `INSERT INTO time_punches (organization_id, employee_id, punch_type, punched_at, latitude, longitude, accuracy_meters, pdv_id, is_offline, offline_local_time, sync_status, device_info, ip_address)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,'synced',$10,$11) RETURNING id`,
            [req.organizationId, req.employeeId, ev.payload.punch_type, ev.payload.offline_local_time || ev.local_timestamp,
              ev.payload.latitude, ev.payload.longitude, ev.payload.accuracy_meters, ev.payload.pdv_id,
              ev.local_timestamp, req.headers['user-agent'], req.ip]
          );
          results.push({ local_id: ev.local_id, server_id: punch.rows[0].id, status: 'synced' });
        } else if (ev.action_type === 'confirm_receipt') {
          await query(`UPDATE rh_document_deliveries SET status = 'confirmado', confirmed_at = NOW() WHERE id = $1`, [ev.payload.delivery_id]);
          results.push({ local_id: ev.local_id, status: 'synced' });
        } else if (ev.action_type === 'view_document') {
          await query(`UPDATE rh_document_deliveries SET viewed_at = COALESCE(viewed_at, NOW()), status = CASE WHEN status IN ('enviado','entregue') THEN 'visualizado' ELSE status END WHERE id = $1`, [ev.payload.delivery_id]);
          results.push({ local_id: ev.local_id, status: 'synced' });
        } else {
          results.push({ local_id: ev.local_id, status: 'unknown_action' });
        }
      } catch (e) {
        results.push({ local_id: ev.local_id, status: 'failed', error: e.message });
      }
    }
    res.json({ results });
  } catch (err) {
    logError('promotor.sync', err);
    res.status(500).json({ error: 'Erro na sincronização' });
  }
});

// =============================================
// RH: GERENCIAR ACESSO AO APP (autenticado como RH)
// =============================================
router.use('/rh', authenticate);

router.post('/rh/grant-access', async (req, res) => {
  try {
    const { employee_id, password, login_type, force_change } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO collaborator_app_access (employee_id, login_type, password_hash, temp_password, force_password_change, access_status, enabled_at, enabled_by)
       VALUES ($1,$2,$3,true,$4,'liberado',NOW(),$5)
       ON CONFLICT (employee_id) DO UPDATE SET password_hash=$3, temp_password=true, force_password_change=$4, access_status='liberado', enabled_at=NOW(), enabled_by=$5, updated_at=NOW()`,
      [employee_id, login_type || 'cpf', hash, force_change !== false, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    logError('promotor.grant-access', err);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/rh/block-access', async (req, res) => {
  try {
    await query(`UPDATE collaborator_app_access SET access_status = 'bloqueado', updated_at = NOW() WHERE employee_id = $1`, [req.body.employee_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/reset-password', async (req, res) => {
  try {
    const { employee_id, new_password } = req.body;
    const hash = await bcrypt.hash(new_password, 10);
    await query(`UPDATE collaborator_app_access SET password_hash = $2, temp_password = true, force_password_change = true, updated_at = NOW() WHERE employee_id = $1`, [employee_id, hash]);
    await query(`INSERT INTO collaborator_password_resets (employee_id, reset_by, reset_by_user_id, ip_address) VALUES ($1, 'rh', $2, $3)`, [employee_id, req.userId, req.ip]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.get('/rh/app-access', async (req, res) => {
  try {
    const { employee_id } = req.query;
    if (employee_id) {
      const result = await query(`SELECT employee_id, login_type, temp_password, force_password_change, access_status, enabled_at, last_login, last_device FROM collaborator_app_access WHERE employee_id = $1`, [employee_id]);
      return res.json(result.rows[0] || null);
    }
    res.json(null);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: PDVs
// =============================================
router.get('/rh/pdvs', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const result = await query(`SELECT p.*, e.full_name as supervisor_name FROM pdvs p LEFT JOIN employees e ON e.id = p.supervisor_id WHERE p.organization_id = $1 ORDER BY p.name`, [orgId]);
    res.json(result.rows);
  } catch (err) { logError('promotor.pdvs.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/pdvs', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const d = req.body;
    const result = await query(
      `INSERT INTO pdvs (organization_id, name, client_name, address, zip_code, city, state, neighborhood, latitude, longitude, radius_meters, supervisor_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [orgId, d.name, d.client_name, d.address, d.zip_code, d.city, d.state, d.neighborhood, d.latitude, d.longitude, d.radius_meters || 200, d.supervisor_id || null, d.notes]
    );
    res.json(result.rows[0]);
  } catch (err) { logError('promotor.pdvs.create', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/rh/pdvs/:id', async (req, res) => {
  try {
    const d = req.body;
    const result = await query(
      `UPDATE pdvs SET name=$2, client_name=$3, address=$4, zip_code=$5, city=$6, state=$7, neighborhood=$8, latitude=$9, longitude=$10, radius_meters=$11, supervisor_id=$12, notes=$13, active=$14, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id, d.name, d.client_name, d.address, d.zip_code, d.city, d.state, d.neighborhood, d.latitude, d.longitude, d.radius_meters, d.supervisor_id || null, d.notes, d.active !== false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: VÍNCULO COLABORADOR ↔ PDV
// =============================================
router.get('/rh/collaborator-pdvs/:employeeId', async (req, res) => {
  try {
    const result = await query(
      `SELECT cp.*, p.name as pdv_name FROM collaborator_pdvs cp JOIN pdvs p ON p.id = cp.pdv_id WHERE cp.employee_id = $1 ORDER BY cp.active DESC, p.name`,
      [req.params.employeeId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/collaborator-pdvs', async (req, res) => {
  try {
    const d = req.body;
    const result = await query(
      `INSERT INTO collaborator_pdvs (employee_id, pdv_id, assignment_type, weekdays, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.employee_id, d.pdv_id, d.assignment_type || 'fixo', JSON.stringify(d.weekdays || []), d.start_date, d.end_date]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: ENVIAR DOCUMENTO PARA COLABORADOR
// =============================================
router.post('/rh/document-deliveries', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const d = req.body;
    const batch_id = d.employee_ids?.length > 1 ? crypto.randomUUID() : null;
    const employees = d.employee_ids || [d.employee_id];
    const results = [];
    for (const empId of employees) {
      const result = await query(
        `INSERT INTO rh_document_deliveries (organization_id, employee_id, document_type_id, title, description, file_url, file_hash, requires_view_only, requires_confirmation, requires_signature, signature_deadline, block_until_signed, status, sent_by, sent_at, batch_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'enviado',$13,NOW(),$14) RETURNING *`,
        [orgId, empId, d.document_type_id || null, d.title, d.description, d.file_url, d.file_hash,
          d.requires_view_only || false, d.requires_confirmation || false, d.requires_signature || false,
          d.signature_deadline, d.block_until_signed || false, req.userId, batch_id]
      );
      await query(`INSERT INTO rh_document_delivery_events (delivery_id, event_type, actor_type, actor_id) VALUES ($1, 'enviado', 'rh', $2)`, [result.rows[0].id, req.userId]);
      await query(`INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type, reference_type, reference_id) VALUES ($1,$2,'Novo documento','${d.title}','document','delivery',$3)`,
        [orgId, empId, result.rows[0].id]);
      results.push(result.rows[0]);
    }
    res.json(results.length === 1 ? results[0] : results);
  } catch (err) {
    logError('promotor.send-doc', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// RH: ENVIAR RECADO / NOTIFICAÇÃO PARA COLABORADOR
// =============================================
router.post('/rh/send-notice', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const { title, message, employee_ids, type } = req.body;
    if (!title || !employee_ids?.length) return res.status(400).json({ error: 'Título e colaboradores obrigatórios' });

    const results = [];
    for (const empId of employee_ids) {
      const result = await query(
        `INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type, reference_type)
         VALUES ($1,$2,$3,$4,$5,'notice') RETURNING *`,
        [orgId, empId, title, message || '', type || 'info']
      );
      results.push(result.rows[0]);
    }
    res.json(results);
  } catch (err) {
    logError('promotor.send-notice', err);
    res.status(500).json({ error: 'Erro ao enviar recado' });
  }
});

router.get('/rh/document-deliveries', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const { employee_id, status } = req.query;
    let sql = `SELECT dd.*, e.full_name as employee_name, dt.name as type_name FROM rh_document_deliveries dd JOIN employees e ON e.id = dd.employee_id LEFT JOIN rh_document_types dt ON dt.id = dd.document_type_id WHERE dd.organization_id = $1`;
    const params = [orgId]; let idx = 2;
    if (employee_id) { sql += ` AND dd.employee_id = $${idx++}`; params.push(employee_id); }
    if (status) { sql += ` AND dd.status = $${idx++}`; params.push(status); }
    sql += ` ORDER BY dd.created_at DESC`;
    res.json((await query(sql, params)).rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/document-deliveries/:id/cancel', async (req, res) => {
  try {
    await query(`UPDATE rh_document_deliveries SET status = 'cancelado', cancelled_at = NOW(), cancelled_by = $2, updated_at = NOW() WHERE id = $1`, [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/document-deliveries/:id/resend', async (req, res) => {
  try {
    await query(`UPDATE rh_document_deliveries SET status = 'enviado', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [req.params.id]);
    await query(`INSERT INTO rh_document_delivery_events (delivery_id, event_type, actor_type, actor_id) VALUES ($1, 'reenviado', 'rh', $2)`, [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: DOCUMENT DELIVERY EVENTS
// =============================================
router.get('/rh/document-delivery-events/:deliveryId', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM rh_document_delivery_events WHERE delivery_id = $1 ORDER BY event_at`, [req.params.deliveryId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: INBOUND DOCUMENTS (do colaborador)
// =============================================
router.get('/rh/inbound-documents', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const { status, employee_id } = req.query;
    let sql = `SELECT ib.*, e.full_name as employee_name FROM rh_inbound_documents ib JOIN employees e ON e.id = ib.employee_id WHERE ib.organization_id = $1`;
    const params = [orgId]; let idx = 2;
    if (status) { sql += ` AND ib.status = $${idx++}`; params.push(status); }
    if (employee_id) { sql += ` AND ib.employee_id = $${idx++}`; params.push(employee_id); }
    sql += ` ORDER BY ib.created_at DESC`;
    res.json((await query(sql, params)).rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.put('/rh/inbound-documents/:id', async (req, res) => {
  try {
    const { status, process_notes } = req.body;
    const result = await query(
      `UPDATE rh_inbound_documents SET status = $2, process_notes = $3,
        read_by = CASE WHEN $2 IN ('lido','em_analise','aprovado','recusado','concluido') THEN COALESCE(read_by, $4::uuid) ELSE read_by END,
        read_at = CASE WHEN $2 IN ('lido','em_analise','aprovado','recusado','concluido') THEN COALESCE(read_at, NOW()) ELSE read_at END,
        processed_by = CASE WHEN $2 IN ('aprovado','recusado','concluido') THEN $4::uuid ELSE processed_by END,
        processed_at = CASE WHEN $2 IN ('aprovado','recusado','concluido') THEN NOW() ELSE processed_at END,
        updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, status, process_notes, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: MONITORAMENTO DE PONTO EM TEMPO REAL
// =============================================
router.get('/rh/punch-monitor', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const today = new Date().toISOString().slice(0, 10);

    const [punched, notPunched, alerts, outsidePdv] = await Promise.all([
      query(`SELECT DISTINCT ON (tp.employee_id) tp.*, e.full_name, e.position, p.name as pdv_name
             FROM time_punches tp JOIN employees e ON e.id = tp.employee_id LEFT JOIN pdvs p ON p.id = tp.pdv_id
             WHERE tp.organization_id = $1 AND tp.punched_at::date = $2 ORDER BY tp.employee_id, tp.punched_at DESC`, [orgId, today]),
      query(`SELECT e.id, e.full_name, e.position, e.work_schedule, d.name as department_name
             FROM employees e LEFT JOIN rh_departments d ON d.id = e.department_id
             WHERE e.organization_id = $1 AND e.status = 'ativo'
               AND NOT EXISTS (SELECT 1 FROM time_punches tp WHERE tp.employee_id = e.id AND tp.punched_at::date = $2)
             ORDER BY e.full_name`, [orgId, today]),
      query(`SELECT ta.*, e.full_name FROM time_alerts ta JOIN employees e ON e.id = ta.employee_id WHERE ta.organization_id = $1 AND ta.alert_date = $2 AND ta.resolved = false ORDER BY ta.created_at DESC`, [orgId, today]),
      query(`SELECT tp.*, e.full_name, p.name as pdv_name FROM time_punches tp JOIN employees e ON e.id = tp.employee_id LEFT JOIN pdvs p ON p.id = tp.pdv_id WHERE tp.organization_id = $1 AND tp.punched_at::date = $2 AND tp.geo_status IN ('fora_area','excecao') ORDER BY tp.punched_at DESC`, [orgId, today]),
    ]);

    res.json({
      punched_today: punched.rows,
      not_punched: notPunched.rows,
      alerts: alerts.rows,
      outside_pdv: outsidePdv.rows,
    });
  } catch (err) {
    logError('promotor.punch-monitor', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// =============================================
// RH: DOCUMENT TYPES
// =============================================
router.get('/rh/document-types', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const result = await query(`SELECT * FROM rh_document_types WHERE organization_id = $1 ORDER BY name`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/document-types', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const d = req.body;
    const result = await query(
      `INSERT INTO rh_document_types (organization_id, name, slug, requires_signature, requires_confirmation, category) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, d.name, d.slug || d.name.toLowerCase().replace(/\s+/g, '_'), d.requires_signature || false, d.requires_confirmation !== false, d.category || 'geral']
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: TIMESHEET EXPORTS
// =============================================
router.get('/rh/timesheets', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const { employee_id, reference_month, status } = req.query;
    let sql = `SELECT te.*, e.full_name as employee_name FROM timesheet_exports te JOIN employees e ON e.id = te.employee_id WHERE te.organization_id = $1`;
    const params = [orgId]; let idx = 2;
    if (employee_id) { sql += ` AND te.employee_id = $${idx++}`; params.push(employee_id); }
    if (reference_month) { sql += ` AND te.reference_month = $${idx++}`; params.push(reference_month); }
    if (status) { sql += ` AND te.status = $${idx++}`; params.push(status); }
    sql += ` ORDER BY te.reference_month DESC, e.full_name`;
    res.json((await query(sql, params)).rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/timesheets', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const d = req.body;
    const result = await query(
      `INSERT INTO timesheet_exports (organization_id, employee_id, reference_month, status, total_hours, overtime_hours, absences, lates, requires_signature, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, d.employee_id, d.reference_month, d.status || 'rascunho', d.total_hours, d.overtime_hours, d.absences || 0, d.lates || 0, d.requires_signature || false, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.put('/rh/timesheets/:id', async (req, res) => {
  try {
    const d = req.body;
    // If sending to collaborator
    if (d.status === 'enviado') {
      await query(`UPDATE timesheet_exports SET status = 'enviado', sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [req.params.id]);
      // Notify
      const te = await query(`SELECT employee_id, reference_month, organization_id FROM timesheet_exports WHERE id = $1`, [req.params.id]);
      if (te.rows[0]) {
        await query(`INSERT INTO collaborator_notifications (organization_id, employee_id, title, message, type, reference_type, reference_id) VALUES ($1,$2,'Espelho de ponto disponível',$3,'timesheet','timesheet',$4)`,
          [te.rows[0].organization_id, te.rows[0].employee_id, `Referência: ${te.rows[0].reference_month}`, req.params.id]);
      }
    } else {
      await query(`UPDATE timesheet_exports SET status = $2, updated_at = NOW() WHERE id = $1`, [req.params.id, d.status]);
    }
    const result = await query(`SELECT * FROM timesheet_exports WHERE id = $1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: NOTIFICATION RULES
// =============================================
router.get('/rh/notification-rules', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const result = await query(`SELECT * FROM rh_notification_rules WHERE organization_id = $1 ORDER BY event_type`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/notification-rules', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const d = req.body;
    const result = await query(
      `INSERT INTO rh_notification_rules (organization_id, event_type, notify_rh, notify_supervisor, notify_collaborator, channel_system, channel_push, channel_email, channel_whatsapp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING *`,
      [orgId, d.event_type, d.notify_rh !== false, d.notify_supervisor || false, d.notify_collaborator || false, d.channel_system !== false, d.channel_push || false, d.channel_email || false, d.channel_whatsapp || false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// =============================================
// RH: TIME RULES
// =============================================
router.get('/rh/time-rules', async (req, res) => {
  try {
    const orgId = req.query.org_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const result = await query(`SELECT tr.*, e.full_name as employee_name FROM time_rules tr LEFT JOIN employees e ON e.id = tr.employee_id WHERE tr.organization_id = $1 ORDER BY tr.employee_id NULLS FIRST`, [orgId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/rh/time-rules', async (req, res) => {
  try {
    const orgId = req.body.organization_id || (await query(`SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`, [req.userId])).rows[0]?.organization_id;
    const d = req.body;
    const result = await query(
      `INSERT INTO time_rules (organization_id, employee_id, name, late_tolerance_minutes, early_leave_tolerance, break_tolerance, max_late_minutes, require_justification, absence_on_no_punch, punch_window_minutes, allow_manual_adjustment, require_geo, allow_offline_punch, allow_exception_punch)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [orgId, d.employee_id || null, d.name || 'Padrão', d.late_tolerance_minutes || 10, d.early_leave_tolerance || 10, d.break_tolerance || 5, d.max_late_minutes || 30, d.require_justification !== false, d.absence_on_no_punch !== false, d.punch_window_minutes || 60, d.allow_manual_adjustment !== false, d.require_geo !== false, d.allow_offline_punch !== false, d.allow_exception_punch || false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

export default router;
