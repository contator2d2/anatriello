// PDV-level promoter blocks
// Document validation/approval is always done at the network (rede) level.
// PDVs only have operational control to block an already-approved promoter
// at their individual unit if a problem arises. Blocks/unblocks notify the
// promoter's agency and the network.

import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import * as whatsappProvider from '../lib/whatsapp-provider.js';

const router = express.Router();

// ---------- schema ----------
let schemaReady = null;
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await query(`CREATE TABLE IF NOT EXISTS pdv_promoter_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID,
      supermarket_unit_id UUID NOT NULL,
      agency_promoter_id UUID NOT NULL,
      reason TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      blocked_by_type VARCHAR(20),
      blocked_by_id UUID,
      blocked_by_name VARCHAR(255),
      blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unblocked_by_type VARCHAR(20),
      unblocked_by_id UUID,
      unblocked_by_name VARCHAR(255),
      unblocked_at TIMESTAMPTZ,
      unblock_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ppb_unit_active
      ON pdv_promoter_blocks(supermarket_unit_id, agency_promoter_id, active)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ppb_promoter
      ON pdv_promoter_blocks(agency_promoter_id, active)`);
    await query(`CREATE TABLE IF NOT EXISTS pdv_block_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      block_id UUID,
      organization_id UUID,
      channel VARCHAR(20) NOT NULL,
      target TEXT NOT NULL,
      event_type VARCHAR(40) NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      dispatched BOOLEAN DEFAULT false,
      dispatched_at TIMESTAMPTZ,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  })();
  try { await schemaReady; } catch (e) { schemaReady = null; throw e; }
  return schemaReady;
}

// ---------- auth: accept supermarket OR main app token ----------
function authFlex(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.tokenType = decoded.type || 'user';
    if (decoded.type === 'supermarket') {
      req.supermarketUserId = decoded.userId;
      req.unitId = decoded.unitId;
      req.networkId = decoded.networkId;
      req.orgId = decoded.orgId;
    } else if (decoded.type === 'agency') {
      req.agencyUserId = decoded.userId;
      req.agencyId = decoded.agencyId;
      req.orgId = decoded.orgId;
    } else if (decoded.type === 'network') {
      req.networkUserId = decoded.userId;
      req.networkId = decoded.networkId;
      req.orgId = decoded.orgId;
    } else {
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ---------- helpers ----------
async function getActiveConnection(orgId) {
  if (!orgId) return null;
  try {
    const r = await query(
      `SELECT * FROM connections WHERE organization_id = $1 AND status = 'connected' ORDER BY created_at ASC LIMIT 1`,
      [orgId]
    );
    return r.rows[0] || null;
  } catch { return null; }
}

function formatBlockMessage({ eventType, promoter, unit, reason, actorName }) {
  const title = eventType === 'pdv_blocked'
    ? '🚫 *Promotor BLOQUEADO em PDV*'
    : '✅ *Promotor DESBLOQUEADO em PDV*';
  return `${title}\n\n` +
    `👤 *Promotor:* ${promoter?.name || '-'}\n` +
    `📋 *CPF:* ${promoter?.cpf || '-'}\n` +
    `🏢 *Agência:* ${promoter?.agency_name || '-'}\n` +
    `🏬 *PDV:* ${unit?.name || '-'}\n` +
    (reason ? `📝 *Motivo:* ${reason}\n` : '') +
    (actorName ? `👤 *Por:* ${actorName}` : '');
}

async function dispatchBlockNotifications({ blockId, orgId, eventType, promoter, unit, agency, rede, reason, actorName }) {
  try {
    const targets = [];

    // Agency: responsible phone/email
    if (agency?.responsible_phone) targets.push({ channel: 'whatsapp', target: String(agency.responsible_phone) });
    if (agency?.responsible_email) targets.push({ channel: 'email', target: String(agency.responsible_email) });

    // Network: configured notify_whatsapp/notify_emails
    if (rede?.notify_enabled) {
      const events = Array.isArray(rede.notify_events) ? rede.notify_events : [];
      if (events.length === 0 || events.includes(eventType)) {
        (rede.notify_whatsapp || []).forEach(p => targets.push({ channel: 'whatsapp', target: String(p) }));
        (rede.notify_emails || []).forEach(e => targets.push({ channel: 'email', target: String(e) }));
      }
    }

    if (!targets.length) return;

    const message = formatBlockMessage({ eventType, promoter, unit, reason, actorName });
    const connection = await getActiveConnection(orgId);

    for (const t of targets) {
      const ins = await query(
        `INSERT INTO pdv_block_notifications (block_id, organization_id, channel, target, event_type, payload)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [blockId, orgId || null, t.channel, t.target, eventType, JSON.stringify({ message, reason })]
      );
      const notifId = ins.rows[0].id;
      if (t.channel === 'whatsapp' && connection) {
        try {
          await whatsappProvider.sendMessage(connection, t.target, message, 'text', null);
          await query(`UPDATE pdv_block_notifications SET dispatched=true, dispatched_at=NOW() WHERE id=$1`, [notifId]);
        } catch (e) {
          await query(`UPDATE pdv_block_notifications SET error=$1 WHERE id=$2`,
            [String(e.message || e).slice(0, 300), notifId]);
        }
      }
    }
  } catch (e) {
    console.error('[pdv-blocks] dispatch notifications error', e);
  }
}

async function logAudit({ orgId, action, unitId, promoterId, agencyId, performedBy, performedByType, details }) {
  try {
    await query(
      `INSERT INTO access_audit_logs
        (organization_id, action, entity_type, entity_id, supermarket_unit_id, agency_id, agency_promoter_id, performed_by, performed_by_type, details)
       VALUES ($1,$2,'promoter',$3,$4,$5,$6,$7,$8,$9)`,
      [orgId || null, action, promoterId || null, unitId || null, agencyId || null, promoterId || null,
       performedBy || null, performedByType || 'system', JSON.stringify(details || {})]
    );
  } catch (e) { console.error('[pdv-blocks] audit', e); }
}

async function loadPromoterFull(promoterId) {
  const r = await query(
    `SELECT ap.*, a.id as agency_id, a.name as agency_name, a.cnpj as agency_cnpj,
            a.responsible_phone, a.responsible_email, a.organization_id as agency_org_id
     FROM agency_promoters ap
     LEFT JOIN agencies a ON a.id = ap.agency_id
     WHERE ap.id = $1`,
    [promoterId]
  );
  return r.rows[0] || null;
}

async function loadUnitWithRede(unitId) {
  const r = await query(
    `SELECT su.id, su.name, su.organization_id, su.network_id,
            sn.id as sn_id, sn.name as sn_name,
            sn.contact_phone as sn_contact_phone, sn.contact_email as sn_contact_email
       FROM supermarket_units su
       LEFT JOIN supermarket_networks sn ON sn.id = su.network_id
      WHERE su.id = $1`,
    [unitId]
  ).catch(() => ({ rows: [] }));
  const unit = r.rows[0] || null;
  if (!unit) return null;
  // Build a "rede" notification object from supermarket_networks contact info.
  unit.notify_enabled = !!(unit.sn_contact_phone || unit.sn_contact_email);
  unit.notify_events = ['pdv_blocked', 'pdv_unblocked'];
  unit.notify_whatsapp = unit.sn_contact_phone ? [unit.sn_contact_phone] : [];
  unit.notify_emails = unit.sn_contact_email ? [unit.sn_contact_email] : [];
  return unit;
}

// =============== ROUTES ===============

// List blocks (PDV portal sees own unit; admin can pass unit_id)
router.get('/blocks', authFlex, async (req, res) => {
  try {
    await ensureSchema();
    const unitId = req.tokenType === 'supermarket' ? req.unitId : (req.query.unit_id || null);
    const params = [];
    let where = '1=1';
    if (unitId) { params.push(unitId); where += ` AND b.supermarket_unit_id = $${params.length}`; }
    if (req.tokenType === 'network') {
      params.push(req.networkId);
      where += ` AND su.network_id = $${params.length}`;
    }
    if (req.query.active === 'true') where += ` AND b.active = true`;
    if (req.query.active === 'false') where += ` AND b.active = false`;
    const r = await query(
      `SELECT b.*, ap.name AS promoter_name, ap.cpf AS promoter_cpf,
              ag.name AS agency_name, su.name AS unit_name
         FROM pdv_promoter_blocks b
         LEFT JOIN agency_promoters ap ON ap.id = b.agency_promoter_id
         LEFT JOIN agencies ag ON ag.id = ap.agency_id
         LEFT JOIN supermarket_units su ON su.id = b.supermarket_unit_id
        WHERE ${where}
        ORDER BY b.blocked_at DESC LIMIT 500`, params
    );
    res.json(r.rows);
  } catch (e) {
    console.error('list blocks', e);
    res.status(500).json({ error: 'Erro ao listar bloqueios' });
  }
});

// List promoters authorized for a unit (approved by the rede + agency_allowed_units)
router.get('/authorized-promoters', authFlex, async (req, res) => {
  try {
    await ensureSchema();
    const unitId = req.tokenType === 'supermarket' ? req.unitId : (req.query.unit_id || null);
    if (!unitId) return res.status(400).json({ error: 'unit_id obrigatório' });
    const r = await query(
      `SELECT ap.id, ap.name, ap.cpf, ap.phone, ap.photo_url, ap.status,
              a.id as agency_id, a.name as agency_name, a.responsible_phone, a.responsible_email,
              (SELECT b.id FROM pdv_promoter_blocks b
                 WHERE b.supermarket_unit_id = $1 AND b.agency_promoter_id = ap.id AND b.active = true
                 LIMIT 1) AS active_block_id,
              (SELECT b.reason FROM pdv_promoter_blocks b
                 WHERE b.supermarket_unit_id = $1 AND b.agency_promoter_id = ap.id AND b.active = true
                 LIMIT 1) AS active_block_reason,
              (SELECT b.blocked_at FROM pdv_promoter_blocks b
                 WHERE b.supermarket_unit_id = $1 AND b.agency_promoter_id = ap.id AND b.active = true
                 LIMIT 1) AS active_block_at
         FROM agency_promoters ap
         JOIN agencies a ON a.id = ap.agency_id
         JOIN agency_allowed_units aau ON aau.agency_id = a.id AND aau.supermarket_unit_id = $1
        WHERE ap.status = 'active'
        ORDER BY ap.name ASC LIMIT 1000`, [unitId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('authorized-promoters', e);
    res.status(500).json({ error: 'Erro ao listar promotores' });
  }
});

// Create block
router.post('/blocks', authFlex, async (req, res) => {
  try {
    await ensureSchema();
    const { agency_promoter_id, reason } = req.body || {};
    if (!agency_promoter_id) return res.status(400).json({ error: 'agency_promoter_id obrigatório' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'Motivo obrigatório' });

    const unitId = req.tokenType === 'supermarket' ? req.unitId : (req.body.supermarket_unit_id || null);
    if (!unitId) return res.status(400).json({ error: 'supermarket_unit_id obrigatório' });

    // Deactivate previous active block (if any) to avoid duplicates
    await query(`UPDATE pdv_promoter_blocks SET active = false, updated_at = NOW()
                  WHERE supermarket_unit_id = $1 AND agency_promoter_id = $2 AND active = true`,
                [unitId, agency_promoter_id]);

    const promoter = await loadPromoterFull(agency_promoter_id);
    const unit = await loadUnitWithRede(unitId);
    const orgId = unit?.organization_id || promoter?.agency_org_id || null;

    const actorType = req.tokenType === 'supermarket' ? 'supermarket'
                    : req.tokenType === 'agency' ? 'agency' : 'admin';
    const actorId = req.supermarketUserId || req.agencyUserId || req.userId || null;
    const actorName = req.headers['x-supermarket-user-name'] || req.userEmail || null;

    const ins = await query(
      `INSERT INTO pdv_promoter_blocks
         (organization_id, supermarket_unit_id, agency_promoter_id, reason, active,
          blocked_by_type, blocked_by_id, blocked_by_name)
       VALUES ($1,$2,$3,$4,true,$5,$6,$7) RETURNING *`,
      [orgId, unitId, agency_promoter_id, reason, actorType, actorId, actorName]
    );
    const block = ins.rows[0];

    await logAudit({
      orgId, action: 'pdv_block_promoter', unitId, promoterId: agency_promoter_id,
      agencyId: promoter?.agency_id, performedBy: actorId, performedByType: actorType,
      details: { reason, block_id: block.id },
    });

    await dispatchBlockNotifications({
      blockId: block.id, orgId, eventType: 'pdv_blocked',
      promoter, unit, agency: promoter, rede: unit, reason, actorName,
    });

    res.json({ success: true, block });
  } catch (e) {
    console.error('create block', e);
    res.status(500).json({ error: 'Erro ao bloquear promotor' });
  }
});

// Unblock
router.post('/blocks/:id/unblock', authFlex, async (req, res) => {
  try {
    await ensureSchema();
    const { reason } = req.body || {};
    const cur = await query(`SELECT * FROM pdv_promoter_blocks WHERE id = $1`, [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Bloqueio não encontrado' });
    const block = cur.rows[0];

    if (req.tokenType === 'supermarket' && String(block.supermarket_unit_id) !== String(req.unitId)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    if (!block.active) return res.status(400).json({ error: 'Bloqueio já está inativo' });

    const actorType = req.tokenType === 'supermarket' ? 'supermarket'
                    : req.tokenType === 'agency' ? 'agency' : 'admin';
    const actorId = req.supermarketUserId || req.agencyUserId || req.userId || null;
    const actorName = req.headers['x-supermarket-user-name'] || req.userEmail || null;

    await query(
      `UPDATE pdv_promoter_blocks
         SET active = false, unblocked_at = NOW(), unblock_reason = $1,
             unblocked_by_type = $2, unblocked_by_id = $3, unblocked_by_name = $4, updated_at = NOW()
       WHERE id = $5`,
      [reason || null, actorType, actorId, actorName, block.id]
    );

    const promoter = await loadPromoterFull(block.agency_promoter_id);
    const unit = await loadUnitWithRede(block.supermarket_unit_id);
    const orgId = unit?.organization_id || promoter?.agency_org_id || null;

    await logAudit({
      orgId, action: 'pdv_unblock_promoter', unitId: block.supermarket_unit_id,
      promoterId: block.agency_promoter_id, agencyId: promoter?.agency_id,
      performedBy: actorId, performedByType: actorType,
      details: { reason, block_id: block.id },
    });

    await dispatchBlockNotifications({
      blockId: block.id, orgId, eventType: 'pdv_unblocked',
      promoter, unit, agency: promoter, rede: unit, reason, actorName,
    });

    res.json({ success: true });
  } catch (e) {
    console.error('unblock', e);
    res.status(500).json({ error: 'Erro ao desbloquear' });
  }
});

// History of blocks for a promoter (any unit) — admin & agency views
router.get('/promoter/:promoterId/history', authFlex, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT b.*, su.name AS unit_name
         FROM pdv_promoter_blocks b
         LEFT JOIN supermarket_units su ON su.id = b.supermarket_unit_id
        WHERE b.agency_promoter_id = $1
        ORDER BY b.blocked_at DESC LIMIT 200`, [req.params.promoterId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// Check if a promoter is currently blocked at a unit (used by totem/check-in)
router.get('/check', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { unit_id, agency_promoter_id } = req.query;
    if (!unit_id || !agency_promoter_id) return res.status(400).json({ error: 'unit_id e agency_promoter_id obrigatórios' });
    const r = await query(
      `SELECT id, reason, blocked_at FROM pdv_promoter_blocks
        WHERE supermarket_unit_id = $1 AND agency_promoter_id = $2 AND active = true LIMIT 1`,
      [unit_id, agency_promoter_id]
    );
    res.json({ blocked: r.rows.length > 0, block: r.rows[0] || null });
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

export default router;
