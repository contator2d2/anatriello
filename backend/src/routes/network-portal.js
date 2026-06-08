// Network Portal — 360° view for an entire supermarket network (rede)
// A network has many supermarket_units (PDVs). Network users see aggregated data
// across all their PDVs and can request inauguration of new PDVs.

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ---------- schema ----------
let schemaReady = null;
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await query(`CREATE TABLE IF NOT EXISTS network_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      network_id UUID NOT NULL,
      organization_id UUID,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(30) DEFAULT 'admin',
      last_login TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_network_users_net ON network_users(network_id)`);

    await query(`CREATE TABLE IF NOT EXISTS pdv_inauguration_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      network_id UUID NOT NULL,
      organization_id UUID,
      requested_by UUID,
      requested_by_name VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      cnpj VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(2),
      zip_code VARCHAR(10),
      contact_name VARCHAR(255),
      contact_phone VARCHAR(30),
      contact_email VARCHAR(255),
      expected_opening DATE,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      review_notes TEXT,
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      created_unit_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_pdv_inaug_network ON pdv_inauguration_requests(network_id, status, created_at DESC)`);

    // Extend agencies → partners (type)
    await query(`ALTER TABLE agencies
      ADD COLUMN IF NOT EXISTS partner_type VARCHAR(30) DEFAULT 'agency',
      ADD COLUMN IF NOT EXISTS category_label VARCHAR(100)`).catch(() => {});

    // Required documents configuration on supermarket_networks (set by network admin)
    await query(`ALTER TABLE supermarket_networks
      ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS required_documents_freelance JSONB,
      ADD COLUMN IF NOT EXISTS required_documents_substituto JSONB,
      ADD COLUMN IF NOT EXISTS docs_block_submission BOOLEAN DEFAULT true`).catch(() => {});
  })();

  try { await schemaReady; } catch (e) { schemaReady = null; throw e; }
  return schemaReady;
}

// ---------- auth ----------
function authenticateNetwork(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (decoded.type !== 'network') return res.status(403).json({ error: 'Acesso restrito a rede' });
    req.networkUserId = decoded.userId;
    req.networkId = decoded.networkId;
    req.orgId = decoded.orgId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ---------- login / me ----------
router.post('/login', async (req, res) => {
  try {
    await ensureSchema();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const r = await query(
      `SELECT nu.*, sn.organization_id, sn.name AS network_name
         FROM network_users nu
         JOIN supermarket_networks sn ON sn.id = nu.network_id
        WHERE nu.email = $1 AND nu.active = true`,
      [String(email).trim().toLowerCase()]
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign(
      { userId: user.id, networkId: user.network_id, orgId: user.organization_id, type: 'network' },
      process.env.JWT_SECRET, { expiresIn: '24h' }
    );
    await query('UPDATE network_users SET last_login = NOW() WHERE id = $1', [user.id]);
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        network_id: user.network_id, network_name: user.network_name,
        organization_id: user.organization_id,
      },
    });
  } catch (e) { console.error('network login', e); res.status(500).json({ error: 'Erro no login' }); }
});

router.get('/me', authenticateNetwork, async (req, res) => {
  try {
    const r = await query(
      `SELECT nu.id, nu.email, nu.name, nu.role, nu.network_id,
              sn.name AS network_name, sn.organization_id
         FROM network_users nu
         JOIN supermarket_networks sn ON sn.id = nu.network_id
        WHERE nu.id = $1 AND nu.active = true`,
      [req.networkUserId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user: r.rows[0] });
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// ---------- dashboard ----------
router.get('/dashboard', authenticateNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const nid = req.networkId;

    const units = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE active = true)::int AS active,
         COUNT(*) FILTER (WHERE active = false)::int AS inactive
       FROM supermarket_units WHERE network_id = $1`, [nid]
    );

    const entriesToday = await query(
      `SELECT COUNT(*)::int AS c
         FROM pdv_entry_logs el
         JOIN supermarket_units su ON su.id = el.supermarket_unit_id
        WHERE su.network_id = $1 AND el.entry_at::date = CURRENT_DATE`, [nid]
    ).catch(() => ({ rows: [{ c: 0 }] }));

    const entriesWeek = await query(
      `SELECT COUNT(*)::int AS c
         FROM pdv_entry_logs el
         JOIN supermarket_units su ON su.id = el.supermarket_unit_id
        WHERE su.network_id = $1 AND el.entry_at >= NOW() - INTERVAL '7 days'`, [nid]
    ).catch(() => ({ rows: [{ c: 0 }] }));

    const partners = await query(
      `SELECT COALESCE(partner_type, 'agency') AS partner_type, COUNT(DISTINCT a.id)::int AS c
         FROM agencies a
         JOIN agency_allowed_units aau ON aau.agency_id = a.id
         JOIN supermarket_units su ON su.id = aau.supermarket_unit_id
        WHERE su.network_id = $1
        GROUP BY partner_type`, [nid]
    ).catch(() => ({ rows: [] }));

    const totalPromoters = await query(
      `SELECT COUNT(DISTINCT ap.id)::int AS c
         FROM agency_promoters ap
         JOIN agency_allowed_units aau ON aau.agency_id = ap.agency_id
         JOIN supermarket_units su ON su.id = aau.supermarket_unit_id
        WHERE su.network_id = $1 AND ap.status = 'active'`, [nid]
    ).catch(() => ({ rows: [{ c: 0 }] }));

    const totalBrands = await query(
      `SELECT COUNT(DISTINCT pbp.brand_id)::int AS c
         FROM promoter_brand_permissions pbp
         JOIN pdv_access_rules par ON par.id = pbp.access_rule_id
         JOIN supermarket_units su ON su.id = par.supermarket_unit_id
        WHERE su.network_id = $1`, [nid]
    ).catch(() => ({ rows: [{ c: 0 }] }));

    const activeBlocks = await query(
      `SELECT COUNT(*)::int AS c
         FROM pdv_promoter_blocks b
         JOIN supermarket_units su ON su.id = b.supermarket_unit_id
        WHERE su.network_id = $1 AND b.active = true`, [nid]
    ).catch(() => ({ rows: [{ c: 0 }] }));

    const pendingRequests = await query(
      `SELECT COUNT(*)::int AS c FROM pdv_inauguration_requests
        WHERE network_id = $1 AND status = 'pending'`, [nid]
    );

    res.json({
      units: units.rows[0],
      entries: { today: entriesToday.rows[0].c, week: entriesWeek.rows[0].c },
      partners_by_type: partners.rows,
      total_active_promoters: totalPromoters.rows[0].c,
      total_brands: totalBrands.rows[0].c,
      active_blocks: activeBlocks.rows[0].c,
      pending_inauguration_requests: pendingRequests.rows[0].c,
    });
  } catch (e) { console.error('network dashboard', e); res.status(500).json({ error: 'Erro' }); }
});

// ---------- units ----------
router.get('/units', authenticateNetwork, async (req, res) => {
  try {
    const r = await query(
      `SELECT su.id, su.name, su.cnpj, su.city, su.state, su.active, su.created_at,
              (SELECT COUNT(*)::int FROM pdv_entry_logs el
                 WHERE el.supermarket_unit_id = su.id
                   AND el.entry_at::date = CURRENT_DATE) AS entries_today,
              (SELECT COUNT(*)::int FROM pdv_promoter_blocks b
                 WHERE b.supermarket_unit_id = su.id AND b.active = true) AS active_blocks,
              (SELECT COUNT(DISTINCT aau.agency_id)::int FROM agency_allowed_units aau
                 WHERE aau.supermarket_unit_id = su.id) AS partners_count
         FROM supermarket_units su
        WHERE su.network_id = $1
        ORDER BY su.active DESC, su.name ASC`, [req.networkId]
    );
    res.json(r.rows);
  } catch (e) { console.error('network units', e); res.status(500).json({ error: 'Erro' }); }
});

router.get('/units/:id/overview', authenticateNetwork, async (req, res) => {
  try {
    const unit = await query(
      `SELECT * FROM supermarket_units WHERE id = $1 AND network_id = $2`,
      [req.params.id, req.networkId]
    );
    if (!unit.rows[0]) return res.status(404).json({ error: 'PDV não encontrado' });

    const logs = await query(
      `SELECT id, cpf, entry_at, exit_at, status, block_reason, origin
         FROM pdv_entry_logs WHERE supermarket_unit_id = $1
        ORDER BY entry_at DESC LIMIT 50`, [req.params.id]
    ).catch(() => ({ rows: [] }));

    const blocks = await query(
      `SELECT b.*, ap.name AS promoter_name, ap.cpf AS promoter_cpf, ag.name AS agency_name
         FROM pdv_promoter_blocks b
         LEFT JOIN agency_promoters ap ON ap.id = b.agency_promoter_id
         LEFT JOIN agencies ag ON ag.id = ap.agency_id
        WHERE b.supermarket_unit_id = $1 AND b.active = true
        ORDER BY b.blocked_at DESC LIMIT 100`, [req.params.id]
    ).catch(() => ({ rows: [] }));

    const promoters = await query(
      `SELECT ap.id, ap.name, ap.cpf, ag.name AS agency_name
         FROM agency_promoters ap
         JOIN agencies ag ON ag.id = ap.agency_id
         JOIN agency_allowed_units aau ON aau.agency_id = ag.id AND aau.supermarket_unit_id = $1
        WHERE ap.status = 'active'
        ORDER BY ap.name ASC LIMIT 500`, [req.params.id]
    );

    res.json({ unit: unit.rows[0], logs: logs.rows, blocks: blocks.rows, promoters: promoters.rows });
  } catch (e) { console.error('unit overview', e); res.status(500).json({ error: 'Erro' }); }
});

// ---------- partners (agencies + third parties) ----------
router.get('/partners', authenticateNetwork, async (req, res) => {
  try {
    const params = [req.networkId];
    let extra = '';
    if (req.query.partner_type) {
      params.push(req.query.partner_type);
      extra = ` AND COALESCE(a.partner_type, 'agency') = $${params.length}`;
    }
    const r = await query(
      `SELECT DISTINCT a.id, a.name, a.cnpj, a.responsible_name, a.responsible_phone, a.responsible_email,
              COALESCE(a.partner_type, 'agency') AS partner_type, a.category_label, a.status,
              (SELECT COUNT(*)::int FROM agency_promoters ap WHERE ap.agency_id = a.id AND ap.status='active') AS active_promoters,
              (SELECT COUNT(DISTINCT aau2.supermarket_unit_id)::int
                 FROM agency_allowed_units aau2
                 JOIN supermarket_units su2 ON su2.id = aau2.supermarket_unit_id
                WHERE aau2.agency_id = a.id AND su2.network_id = $1) AS units_count
         FROM agencies a
         JOIN agency_allowed_units aau ON aau.agency_id = a.id
         JOIN supermarket_units su ON su.id = aau.supermarket_unit_id
        WHERE su.network_id = $1 ${extra}
        ORDER BY a.name ASC`, params
    );
    res.json(r.rows);
  } catch (e) { console.error('network partners', e); res.status(500).json({ error: 'Erro' }); }
});

// ---------- brands ----------
router.get('/brands', authenticateNetwork, async (req, res) => {
  try {
    const r = await query(
      `SELECT b.id, b.name,
              COUNT(DISTINCT par.agency_promoter_id)::int AS promoters,
              COUNT(DISTINCT par.supermarket_unit_id)::int AS units
         FROM brands b
         JOIN promoter_brand_permissions pbp ON pbp.brand_id = b.id
         JOIN pdv_access_rules par ON par.id = pbp.access_rule_id
         JOIN supermarket_units su ON su.id = par.supermarket_unit_id
        WHERE su.network_id = $1
        GROUP BY b.id, b.name
        ORDER BY promoters DESC, b.name ASC`, [req.networkId]
    ).catch(() => ({ rows: [] }));
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// ---------- blocks (any unit in network) ----------
router.get('/blocks', authenticateNetwork, async (req, res) => {
  try {
    const r = await query(
      `SELECT b.*, ap.name AS promoter_name, ap.cpf AS promoter_cpf,
              ag.name AS agency_name, su.name AS unit_name
         FROM pdv_promoter_blocks b
         JOIN supermarket_units su ON su.id = b.supermarket_unit_id
         LEFT JOIN agency_promoters ap ON ap.id = b.agency_promoter_id
         LEFT JOIN agencies ag ON ag.id = ap.agency_id
        WHERE su.network_id = $1
        ORDER BY b.blocked_at DESC LIMIT 500`, [req.networkId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// ---------- audit ----------
router.get('/audit', authenticateNetwork, async (req, res) => {
  try {
    const r = await query(
      `SELECT aal.*, su.name AS unit_name, ap.name AS promoter_name, ag.name AS agency_name
         FROM access_audit_logs aal
         LEFT JOIN supermarket_units su ON su.id = aal.supermarket_unit_id
         LEFT JOIN agency_promoters ap ON ap.id = aal.agency_promoter_id
         LEFT JOIN agencies ag ON ag.id = aal.agency_id
        WHERE su.network_id = $1
        ORDER BY aal.created_at DESC LIMIT 300`, [req.networkId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// ---------- inauguration requests ----------
router.get('/inauguration-requests', authenticateNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT * FROM pdv_inauguration_requests
        WHERE network_id = $1 ORDER BY created_at DESC LIMIT 200`, [req.networkId]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

router.post('/inauguration-requests', authenticateNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: 'Nome do PDV é obrigatório' });
    const sn = await query(
      `SELECT organization_id FROM supermarket_networks WHERE id = $1`, [req.networkId]
    );
    const orgId = sn.rows[0]?.organization_id || req.orgId;
    const u = await query(`SELECT name FROM network_users WHERE id = $1`, [req.networkUserId]);
    const r = await query(
      `INSERT INTO pdv_inauguration_requests
        (network_id, organization_id, requested_by, requested_by_name,
         name, cnpj, address, city, state, zip_code,
         contact_name, contact_phone, contact_email, expected_opening, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.networkId, orgId, req.networkUserId, u.rows[0]?.name || null,
       b.name.trim(), b.cnpj || null, b.address || null, b.city || null, b.state || null, b.zip_code || null,
       b.contact_name || null, b.contact_phone || null, b.contact_email || null,
       b.expected_opening || null, b.notes || null]
    );
    res.json(r.rows[0]);
  } catch (e) { console.error('create inaug request', e); res.status(500).json({ error: 'Erro' }); }
});

// ---------- admin endpoints (Ayratech main app) ----------
// List + review inauguration requests
router.get('/admin/inauguration-requests', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT pir.*, sn.name AS network_name
         FROM pdv_inauguration_requests pir
         JOIN supermarket_networks sn ON sn.id = pir.network_id
         JOIN organization_members om ON om.organization_id = sn.organization_id
        WHERE om.user_id = $1
        ORDER BY pir.created_at DESC LIMIT 300`, [req.userId]
    );
    res.json(r.rows);
  } catch (e) { console.error('admin inaug list', e); res.status(500).json({ error: 'Erro' }); }
});

router.post('/admin/inauguration-requests/:id/review', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { decision, review_notes } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision deve ser approved ou rejected' });
    }
    const cur = await query(`SELECT * FROM pdv_inauguration_requests WHERE id = $1`, [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Solicitação não encontrada' });
    const reqRow = cur.rows[0];
    let createdUnitId = null;
    if (decision === 'approved') {
      const ins = await query(
        `INSERT INTO supermarket_units
           (organization_id, network_id, name, cnpj, address, city, state, zip_code, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING id`,
        [reqRow.organization_id, reqRow.network_id, reqRow.name, reqRow.cnpj,
         reqRow.address, reqRow.city, reqRow.state, reqRow.zip_code]
      );
      createdUnitId = ins.rows[0].id;
    }
    await query(
      `UPDATE pdv_inauguration_requests
         SET status=$1, review_notes=$2, reviewed_by=$3, reviewed_at=NOW(),
             created_unit_id=$4, updated_at=NOW()
       WHERE id=$5`,
      [decision, review_notes || null, req.userId, createdUnitId, req.params.id]
    );
    res.json({ success: true, created_unit_id: createdUnitId });
  } catch (e) { console.error('admin inaug review', e); res.status(500).json({ error: 'Erro' }); }
});

// Network users CRUD (admin)
router.get('/admin/network-users', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { network_id } = req.query;
    const params = [req.userId];
    let where = `om.user_id = $1`;
    if (network_id) { params.push(network_id); where += ` AND nu.network_id = $${params.length}`; }
    const r = await query(
      `SELECT nu.id, nu.email, nu.name, nu.role, nu.active, nu.last_login, nu.created_at,
              nu.network_id, sn.name AS network_name
         FROM network_users nu
         JOIN supermarket_networks sn ON sn.id = nu.network_id
         JOIN organization_members om ON om.organization_id = sn.organization_id
        WHERE ${where}
        ORDER BY nu.created_at DESC`, params
    );
    res.json(r.rows);
  } catch (e) { console.error('list network users', e); res.status(500).json({ error: 'Erro' }); }
});

router.post('/admin/network-users', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { network_id, email, password, name, role } = req.body || {};
    if (!network_id || !email || !password || !name) return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    const sn = await query(
      `SELECT sn.organization_id FROM supermarket_networks sn
         JOIN organization_members om ON om.organization_id = sn.organization_id
        WHERE sn.id = $1 AND om.user_id = $2`,
      [network_id, req.userId]
    );
    if (!sn.rows[0]) return res.status(404).json({ error: 'Rede não encontrada' });
    const hash = await bcrypt.hash(password, 10);
    const r = await query(
      `INSERT INTO network_users (network_id, organization_id, email, password_hash, name, role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, name, role, network_id`,
      [network_id, sn.rows[0].organization_id, String(email).trim().toLowerCase(), hash, name.trim(), role || 'admin']
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    console.error('create network user', e); res.status(500).json({ error: 'Erro' });
  }
});

router.put('/admin/network-users/:id', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { name, role, active, password } = req.body || {};
    const updates = [];
    const params = [];
    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (role !== undefined) { params.push(role); updates.push(`role = $${params.length}`); }
    if (active !== undefined) { params.push(active); updates.push(`active = $${params.length}`); }
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ error: 'Senha mínima 6 caracteres' });
      params.push(await bcrypt.hash(password, 10));
      updates.push(`password_hash = $${params.length}`);
    }
    if (!updates.length) return res.json({ success: true });
    params.push(req.params.id);
    await query(
      `UPDATE network_users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );
    res.json({ success: true });
  } catch (e) { console.error('update network user', e); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/admin/network-users/:id', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    await query(`DELETE FROM network_users WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// ---------- Required documents configuration (network admin) ----------
router.get('/doc-config', authenticateNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const r = await query(
      `SELECT id, name, required_documents, required_documents_freelance, required_documents_substituto, docs_block_submission
         FROM supermarket_networks WHERE id = $1`,
      [req.networkId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Rede não encontrada' });
    const row = r.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      required_documents: Array.isArray(row.required_documents) ? row.required_documents : [],
      required_documents_freelance: Array.isArray(row.required_documents_freelance) ? row.required_documents_freelance : null,
      required_documents_substituto: Array.isArray(row.required_documents_substituto) ? row.required_documents_substituto : null,
      docs_block_submission: row.docs_block_submission !== false,
    });
  } catch (e) { console.error('get doc-config', e); res.status(500).json({ error: 'Erro' }); }
});

router.put('/doc-config', authenticateNetwork, async (req, res) => {
  try {
    await ensureSchema();
    const {
      required_documents = [],
      required_documents_freelance = null,
      required_documents_substituto = null,
      docs_block_submission = true,
    } = req.body || {};
    const norm = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : null);
    await query(
      `UPDATE supermarket_networks
         SET required_documents = $1::jsonb,
             required_documents_freelance = $2::jsonb,
             required_documents_substituto = $3::jsonb,
             docs_block_submission = $4,
             updated_at = NOW()
       WHERE id = $5`,
      [
        JSON.stringify(norm(required_documents) || []),
        required_documents_freelance == null ? null : JSON.stringify(norm(required_documents_freelance) || []),
        required_documents_substituto == null ? null : JSON.stringify(norm(required_documents_substituto) || []),
        !!docs_block_submission,
        req.networkId,
      ]
    );
    res.json({ success: true });
  } catch (e) { console.error('put doc-config', e); res.status(500).json({ error: 'Erro' }); }
});

export default router;
