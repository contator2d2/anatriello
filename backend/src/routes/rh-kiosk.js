import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();
router.use(authenticate);

async function resolveOrgId(req) {
  const fromReq = req.body?.organization_id || req.query?.org_id || req.organizationId || req.headers['x-organization-id'];
  if (fromReq) return fromReq;
  if (!req.userId) return null;
  const r = await query(
    `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
    [req.userId]
  );
  return r.rows[0]?.organization_id || null;
}

// GET enrolled employees (id, name, photo, descriptor) for local matching in the tablet
router.get('/enrollments', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

    const r = await query(
      `SELECT id, full_name, photo_url, face_descriptor
       FROM employees
       WHERE organization_id = $1
         AND status IN ('ativo','active','on_leave')
         AND face_descriptor IS NOT NULL`,
      [orgId]
    );

    const items = r.rows
      .map((row) => {
        let desc = row.face_descriptor;
        try {
          if (typeof desc === 'string') desc = JSON.parse(desc);
          if (desc && !Array.isArray(desc) && Array.isArray(desc.descriptor)) desc = desc.descriptor;
        } catch {
          desc = null;
        }
        if (!Array.isArray(desc) || desc.length === 0) return null;
        return {
          id: row.id,
          full_name: row.full_name,
          photo_url: row.photo_url || null,
          descriptor: desc.map((n) => Number(n)).filter((n) => Number.isFinite(n)),
        };
      })
      .filter(Boolean);

    res.json({ items });
  } catch (err) {
    logError('rh.kiosk.enrollments', err);
    res.status(500).json({ error: 'Erro ao carregar biometrias' });
  }
});

// Suggest next punch type based on today's punches for the employee
router.get('/next-punch/:employeeId', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

    const r = await query(
      `SELECT punch_type FROM time_punches
       WHERE organization_id = $1 AND employee_id = $2
         AND (punched_at AT TIME ZONE 'America/Sao_Paulo')::date =
             (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       ORDER BY punched_at ASC`,
      [orgId, req.params.employeeId]
    );

    const seq = ['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
    const done = r.rows.map((x) => x.punch_type);
    const next = seq.find((t) => !done.includes(t)) || 'entrada';
    res.json({ next, done });
  } catch (err) {
    logError('rh.kiosk.next-punch', err);
    res.status(500).json({ error: 'Erro' });
  }
});

// Register punch on behalf of employee (kiosk / tablet mode)
router.post('/punch', async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });

    const { employee_id, punch_type, latitude, longitude, accuracy_meters, selfie_url, match_score } = req.body || {};
    if (!employee_id) return res.status(400).json({ error: 'employee_id obrigatório' });

    // Verify employee belongs to org
    const emp = await query(
      `SELECT id, full_name FROM employees WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [employee_id, orgId]
    );
    if (!emp.rows[0]) return res.status(404).json({ error: 'Colaborador não encontrado' });

    // Auto-suggest punch type if not provided
    let ptype = punch_type;
    if (!ptype) {
      const seq = ['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
      const done = await query(
        `SELECT punch_type FROM time_punches
         WHERE organization_id = $1 AND employee_id = $2
           AND (punched_at AT TIME ZONE 'America/Sao_Paulo')::date =
               (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
         ORDER BY punched_at ASC`,
        [orgId, employee_id]
      );
      const doneTypes = done.rows.map((r) => r.punch_type);
      ptype = seq.find((t) => !doneTypes.includes(t)) || 'entrada';
    }

    try { await query(`ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS selfie_url TEXT`); } catch {}
    try { await query(`ALTER TABLE time_punches ADD COLUMN IF NOT EXISTS source TEXT`); } catch {}

    // punched_at = timestamp real (UTC). O banco converte para SP quando exibimos.
    // NÃO usar `new Date(toLocaleString('en-US', {timeZone:'SP'}))` — isso quebra em servidores UTC
    // (o horário SP é gravado como se fosse UTC, deslocando o ponto em +3h para o futuro).
    const nowUtc = new Date();

    const ins = await query(
      `INSERT INTO time_punches
        (organization_id, employee_id, punch_type, punched_at,
         latitude, longitude, accuracy_meters,
         geo_status, device_info, ip_address,
         is_offline, sync_status, selfie_url, source, justification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,'synced',$11,'kiosk_tablet',$12)
       RETURNING *`,
      [
        orgId,
        employee_id,
        ptype,
        nowUtc,
        latitude || null,
        longitude || null,
        accuracy_meters || null,
        latitude && longitude ? 'ok' : 'sem_gps',
        req.headers['user-agent'] || 'kiosk',
        req.ip,
        selfie_url || null,
        match_score != null ? `Kiosk facial (match ${match_score}%)` : 'Kiosk facial',
      ]
    );

    // NSR signature (best-effort)
    try {
      const { ensurePunchSignature } = await import('../services/receipt-pdf.js');
      const signed = await ensurePunchSignature(ins.rows[0].id);
      if (signed) {
        ins.rows[0].nsr = signed.nsr;
        ins.rows[0].signature_hash = signed.signature_hash;
      }
    } catch (e) { logError('rh.kiosk.punch.signature', e); }

    res.json({
      ...ins.rows[0],
      employee_name: emp.rows[0].full_name,
      punch_type: ptype,
    });
  } catch (err) {
    logError('rh.kiosk.punch', err);
    res.status(500).json({ error: 'Erro ao registrar ponto' });
  }
});

export default router;
