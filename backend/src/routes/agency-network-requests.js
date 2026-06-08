// Agency ↔ Network access-request flow + brand conflict detection
//
// Concept:
// - An Agency requests access to operate a set of (PDV, Brand) pairs in a Network.
// - The Network reviews and approves/rejects.
// - The "approved matrix" lives in agency_brand_assignments (UNIQUE per pdv+brand,
//   so a brand can only be served by one agency in a PDV at a time).
// - When a new request includes a (PDV, Brand) already assigned to a different
//   agency, it is flagged as conflict. The network can resolve by overriding
//   (revokes prior assignment) or rejecting the conflicting item.

import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();

// ---------- schema ----------
let schemaReady = null;
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await query(`CREATE TABLE IF NOT EXISTS agency_brand_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id UUID NOT NULL,
      supermarket_unit_id UUID NOT NULL,
      brand_id UUID NOT NULL,
      network_id UUID,
      organization_id UUID,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      assigned_via UUID,
      active BOOLEAN NOT NULL DEFAULT true,
      UNIQUE(supermarket_unit_id, brand_id, active) DEFERRABLE INITIALLY IMMEDIATE
    )`).catch(async () => {
      // fallback if partial unique not supported via constraint above
      await query(`CREATE TABLE IF NOT EXISTS agency_brand_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agency_id UUID NOT NULL,
        supermarket_unit_id UUID NOT NULL,
        brand_id UUID NOT NULL,
        network_id UUID,
        organization_id UUID,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        assigned_via UUID,
        active BOOLEAN NOT NULL DEFAULT true
      )`);
    });
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_aba_active
      ON agency_brand_assignments(supermarket_unit_id, brand_id) WHERE active = true`).catch(() => {});
    await query(`CREATE INDEX IF NOT EXISTS idx_aba_agency ON agency_brand_assignments(agency_id, active)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aba_network ON agency_brand_assignments(network_id, active)`);

    await query(`CREATE TABLE IF NOT EXISTS agency_access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id UUID NOT NULL,
      network_id UUID NOT NULL,
      organization_id UUID,
      message TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      review_notes TEXT,
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      has_conflict BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aar_network ON agency_access_requests(network_id, status, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aar_agency ON agency_access_requests(agency_id, status, created_at DESC)`);

    await query(`CREATE TABLE IF NOT EXISTS agency_access_request_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES agency_access_requests(id) ON DELETE CASCADE,
      supermarket_unit_id UUID NOT NULL,
      brand_id UUID NOT NULL,
      conflict_with_agency_id UUID,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      decision VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(request_id, supermarket_unit_id, brand_id)
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aari_req ON agency_access_request_items(request_id)`);

    await query(`CREATE TABLE IF NOT EXISTS agency_conflict_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id UUID NOT NULL,
      supermarket_unit_id UUID NOT NULL,
      brand_id UUID NOT NULL,
      other_agency_id UUID,
      kind VARCHAR(30) NOT NULL,
      message TEXT,
      acknowledged BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_acn_agency ON agency_conflict_notifications(agency_id, acknowledged, created_at DESC)`);
  })();
  try { await schemaReady; } catch (e) { schemaReady = null; throw e; }
  return schemaReady;
}

// ---------- auth helpers ----------
function authAgency(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (d.type !== 'agency') return res.status(403).json({ error: 'Acesso restrito a agências' });
    req.agencyUserId = d.userId; req.agencyId = d.agencyId; req.orgId = d.orgId;
    next();
  } catch { res.status(401).json({ error: 'Token inválido' }); }
}

function authNetwork(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (d.type !== 'network') return res.status(403).json({ error: 'Acesso restrito a rede' });
    req.networkUserId = d.userId; req.networkId = d.networkId; req.orgId = d.orgId;
    next();
  } catch { res.status(401).json({ error: 'Token inválido' }); }
}

// =====================================================================
// AGENCY SIDE
// =====================================================================

// List networks the agency can request to (all networks in same org)
router.get('/agency/network-requests/available-networks', authAgency, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT sn.id, sn.name,
              (SELECT COUNT(*)::int FROM supermarket_units su WHERE su.network_id = sn.id AND su.active=true) AS units_count
         FROM supermarket_networks sn
        WHERE sn.organization_id = $1
        ORDER BY sn.name ASC`, [req.orgId]
    );
    res.json(r.rows);
  } catch (e) { console.error('agency available-networks', e); res.status(500).json({ error: 'Erro' }); }
});

// List PDVs of a given network
router.get('/agency/network-requests/networks/:networkId/units', authAgency, async (req, res) => {
  try {
    const r = await query(
      `SELECT id, name, city, state, active FROM supermarket_units
        WHERE network_id = $1 AND organization_id = $2
        ORDER BY name ASC`, [req.params.networkId, req.orgId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// List brands available to the agency
router.get('/agency/network-requests/brands', authAgency, async (req, res) => {
  try {
    const r = await query(
      `SELECT b.id, b.name FROM brands b
        WHERE b.organization_id = $1 AND COALESCE(b.status,'active')='active'
        ORDER BY b.name ASC`, [req.orgId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// Preflight conflict check
// body: { items: [{supermarket_unit_id, brand_id}] }
router.post('/agency/network-requests/check-conflict', authAgency, async (req, res) => {
  try {
    await ensureSchema();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json({ conflicts: [] });
    const conflicts = [];
    for (const it of items) {
      if (!it.supermarket_unit_id || !it.brand_id) continue;
      const r = await query(
        `SELECT aba.agency_id, a.name AS agency_name, su.name AS unit_name, b.name AS brand_name
           FROM agency_brand_assignments aba
           JOIN agencies a ON a.id = aba.agency_id
           JOIN supermarket_units su ON su.id = aba.supermarket_unit_id
           JOIN brands b ON b.id = aba.brand_id
          WHERE aba.supermarket_unit_id = $1 AND aba.brand_id = $2
            AND aba.active = true AND aba.agency_id <> $3`,
        [it.supermarket_unit_id, it.brand_id, req.agencyId]
      );
      if (r.rows[0]) {
        conflicts.push({
          supermarket_unit_id: it.supermarket_unit_id,
          brand_id: it.brand_id,
          conflict_with_agency_id: r.rows[0].agency_id,
          conflict_with_agency_name: r.rows[0].agency_name,
          unit_name: r.rows[0].unit_name,
          brand_name: r.rows[0].brand_name,
        });
      }
    }
    res.json({ conflicts });
  } catch (e) { console.error('check-conflict', e); res.status(500).json({ error: 'Erro' }); }
});

// Create access request
// body: { network_id, message?, items: [{supermarket_unit_id, brand_id}] }
router.post('/agency/network-requests', authAgency, async (req, res) => {
  try {
    await ensureSchema();
    const { network_id, message, items } = req.body || {};
    if (!network_id) return res.status(400).json({ error: 'Rede obrigatória' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Selecione ao menos um item (PDV + Marca)' });

    // Validate network belongs to org
    const sn = await query(`SELECT id FROM supermarket_networks WHERE id=$1 AND organization_id=$2`, [network_id, req.orgId]);
    if (!sn.rows[0]) return res.status(404).json({ error: 'Rede não encontrada' });

    // Compute conflicts
    let hasConflict = false;
    const enriched = [];
    for (const it of items) {
      if (!it.supermarket_unit_id || !it.brand_id) continue;
      const c = await query(
        `SELECT agency_id FROM agency_brand_assignments
          WHERE supermarket_unit_id=$1 AND brand_id=$2 AND active=true AND agency_id <> $3
          LIMIT 1`, [it.supermarket_unit_id, it.brand_id, req.agencyId]
      );
      const conflictAgency = c.rows[0]?.agency_id || null;
      if (conflictAgency) hasConflict = true;
      enriched.push({ ...it, conflict_with_agency_id: conflictAgency });
    }

    const ins = await query(
      `INSERT INTO agency_access_requests (agency_id, network_id, organization_id, message, has_conflict)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.agencyId, network_id, req.orgId, message || null, hasConflict]
    );
    const request = ins.rows[0];

    for (const it of enriched) {
      await query(
        `INSERT INTO agency_access_request_items (request_id, supermarket_unit_id, brand_id, conflict_with_agency_id, status)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (request_id, supermarket_unit_id, brand_id) DO NOTHING`,
        [request.id, it.supermarket_unit_id, it.brand_id, it.conflict_with_agency_id,
         it.conflict_with_agency_id ? 'conflict_pending' : 'pending']
      );
      if (it.conflict_with_agency_id) {
        await query(
          `INSERT INTO agency_conflict_notifications
             (agency_id, supermarket_unit_id, brand_id, other_agency_id, kind, message)
           VALUES ($1,$2,$3,$4,'incoming_conflict',$5),
                  ($4,$2,$3,$1,'pending_review',$6)`,
          [req.agencyId, it.supermarket_unit_id, it.brand_id, it.conflict_with_agency_id,
           'Sua solicitação tem conflito com outra agência. Aguardando decisão da rede.',
           'Outra agência solicitou atender uma marca em PDV que você já atende. Aguardando decisão da rede.']
        );
      }
    }

    res.json({ request, has_conflict: hasConflict });
  } catch (e) { console.error('create access request', e); res.status(500).json({ error: 'Erro ao criar solicitação' }); }
});

// List agency's own requests
router.get('/agency/network-requests', authAgency, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT aar.*, sn.name AS network_name,
              (SELECT COUNT(*)::int FROM agency_access_request_items i WHERE i.request_id = aar.id) AS items_count,
              (SELECT COUNT(*)::int FROM agency_access_request_items i WHERE i.request_id = aar.id AND i.conflict_with_agency_id IS NOT NULL) AS conflict_items
         FROM agency_access_requests aar
         JOIN supermarket_networks sn ON sn.id = aar.network_id
        WHERE aar.agency_id = $1
        ORDER BY aar.created_at DESC LIMIT 200`, [req.agencyId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

router.get('/agency/network-requests/:id', authAgency, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(`SELECT * FROM agency_access_requests WHERE id=$1 AND agency_id=$2`, [req.params.id, req.agencyId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    const items = await query(
      `SELECT i.*, su.name AS unit_name, b.name AS brand_name, ca.name AS conflict_agency_name
         FROM agency_access_request_items i
         JOIN supermarket_units su ON su.id = i.supermarket_unit_id
         JOIN brands b ON b.id = i.brand_id
         LEFT JOIN agencies ca ON ca.id = i.conflict_with_agency_id
        WHERE i.request_id = $1 ORDER BY su.name, b.name`, [req.params.id]
    );
    res.json({ request: r.rows[0], items: items.rows });
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// Agency conflict notifications
router.get('/agency/network-requests/notifications/conflicts', authAgency, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT n.*, su.name AS unit_name, b.name AS brand_name, oa.name AS other_agency_name
         FROM agency_conflict_notifications n
         LEFT JOIN supermarket_units su ON su.id = n.supermarket_unit_id
         LEFT JOIN brands b ON b.id = n.brand_id
         LEFT JOIN agencies oa ON oa.id = n.other_agency_id
        WHERE n.agency_id = $1
        ORDER BY n.acknowledged ASC, n.created_at DESC LIMIT 100`, [req.agencyId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/agency/network-requests/notifications/:id/ack', authAgency, async (req, res) => {
  try {
    await query(`UPDATE agency_conflict_notifications SET acknowledged=true WHERE id=$1 AND agency_id=$2`,
      [req.params.id, req.agencyId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// NETWORK SIDE
// =====================================================================

router.get('/network-portal/access-requests', authNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT aar.*, a.name AS agency_name, a.cnpj AS agency_cnpj,
              COALESCE(a.responsible_email, a.email) AS agency_email,
              (SELECT COUNT(*)::int FROM agency_access_request_items i WHERE i.request_id = aar.id) AS items_count,
              (SELECT COUNT(*)::int FROM agency_access_request_items i WHERE i.request_id = aar.id AND i.conflict_with_agency_id IS NOT NULL) AS conflict_items
         FROM agency_access_requests aar
         JOIN agencies a ON a.id = aar.agency_id
        WHERE aar.network_id = $1
        ORDER BY aar.status='pending' DESC, aar.created_at DESC LIMIT 300`, [req.networkId]
    );
    res.json(r.rows);
  } catch (e) { console.error('network list requests', e); res.status(500).json({ error: 'Erro' }); }
});

router.get('/network-portal/access-requests/:id', authNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT aar.*, a.name AS agency_name, a.cnpj AS agency_cnpj
         FROM agency_access_requests aar
         JOIN agencies a ON a.id = aar.agency_id
        WHERE aar.id=$1 AND aar.network_id=$2`, [req.params.id, req.networkId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    const items = await query(
      `SELECT i.*, su.name AS unit_name, b.name AS brand_name, ca.name AS conflict_agency_name
         FROM agency_access_request_items i
         JOIN supermarket_units su ON su.id = i.supermarket_unit_id
         JOIN brands b ON b.id = i.brand_id
         LEFT JOIN agencies ca ON ca.id = i.conflict_with_agency_id
        WHERE i.request_id = $1 ORDER BY su.name, b.name`, [req.params.id]
    );
    res.json({ request: r.rows[0], items: items.rows });
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// Review a request — body:
// {
//   decision: 'approved' | 'rejected',
//   review_notes?,
//   item_decisions?: { [item_id]: 'approved' | 'rejected' | 'override' }
//     override = approve and revoke conflicting prior assignment
// }
router.post('/network-portal/access-requests/:id/review', authNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const { decision, review_notes, item_decisions = {} } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision inválida' });
    }
    const cur = await query(`SELECT * FROM agency_access_requests WHERE id=$1 AND network_id=$2`,
      [req.params.id, req.networkId]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    const reqRow = cur.rows[0];

    const items = (await query(
      `SELECT * FROM agency_access_request_items WHERE request_id=$1`, [req.params.id]
    )).rows;

    if (decision === 'approved') {
      for (const it of items) {
        const dec = item_decisions[it.id] || (it.conflict_with_agency_id ? 'rejected' : 'approved');
        if (dec === 'approved' || dec === 'override') {
          if (dec === 'override' && it.conflict_with_agency_id) {
            // revoke conflicting prior assignment
            const prev = await query(
              `UPDATE agency_brand_assignments SET active=false
                WHERE supermarket_unit_id=$1 AND brand_id=$2 AND active=true
                RETURNING agency_id`,
              [it.supermarket_unit_id, it.brand_id]
            );
            const prevAgency = prev.rows[0]?.agency_id;
            if (prevAgency) {
              await query(
                `INSERT INTO agency_conflict_notifications
                   (agency_id, supermarket_unit_id, brand_id, other_agency_id, kind, message)
                 VALUES ($1,$2,$3,$4,'override_lost',$5)`,
                [prevAgency, it.supermarket_unit_id, it.brand_id, reqRow.agency_id,
                 'A rede transferiu o atendimento desta marca neste PDV para outra agência.']
              );
            }
          }
          await query(
            `INSERT INTO agency_brand_assignments
               (agency_id, supermarket_unit_id, brand_id, network_id, organization_id, assigned_via, active)
             VALUES ($1,$2,$3,$4,$5,$6,true)
             ON CONFLICT DO NOTHING`,
            [reqRow.agency_id, it.supermarket_unit_id, it.brand_id, req.networkId, reqRow.organization_id, reqRow.id]
          );
          // Ensure agency_allowed_units (compat with existing flows)
          await query(
            `INSERT INTO agency_allowed_units (agency_id, supermarket_unit_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [reqRow.agency_id, it.supermarket_unit_id]
          );
          await query(`UPDATE agency_access_request_items SET status='approved', decision=$1 WHERE id=$2`,
            [dec, it.id]);
        } else {
          await query(`UPDATE agency_access_request_items SET status='rejected', decision='rejected' WHERE id=$1`,
            [it.id]);
        }
      }
    } else {
      await query(`UPDATE agency_access_request_items SET status='rejected', decision='rejected' WHERE request_id=$1`,
        [req.params.id]);
    }

    await query(
      `UPDATE agency_access_requests SET status=$1, review_notes=$2, reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
        WHERE id=$4`,
      [decision, review_notes || null, req.networkUserId, req.params.id]
    );

    res.json({ success: true });
  } catch (e) { console.error('review request', e); res.status(500).json({ error: 'Erro ao revisar' }); }
});

// Current brand matrix for the network (who serves what where)
router.get('/network-portal/brand-matrix', authNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT aba.id, aba.agency_id, a.name AS agency_name,
              aba.supermarket_unit_id, su.name AS unit_name,
              aba.brand_id, b.name AS brand_name, aba.assigned_at
         FROM agency_brand_assignments aba
         JOIN agencies a ON a.id = aba.agency_id
         JOIN supermarket_units su ON su.id = aba.supermarket_unit_id
         JOIN brands b ON b.id = aba.brand_id
        WHERE aba.network_id = $1 AND aba.active = true
        ORDER BY su.name, b.name`, [req.networkId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

export default router;
