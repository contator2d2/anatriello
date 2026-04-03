import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logInfo, logError } from '../logger.js';

const router = express.Router();

// ============ HELPER: get org from authenticated user ============
async function getOrgId(userId) {
  const r = await query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [userId]);
  return r.rows[0]?.organization_id;
}

// ============ MIDDLEWARE: Totem auth ============
const authenticateTotem = async (req, res, next) => {
  const token = req.headers['x-totem-token'];
  if (!token) return res.status(401).json({ error: 'Token do totem não fornecido' });
  try {
    const r = await query(
      `SELECT su.id as unit_id, su.organization_id FROM supermarket_units su
       WHERE su.totem_token = $1 AND su.totem_enabled = true AND su.active = true`,
      [token]
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Totem não autorizado' });
    req.unitId = r.rows[0].unit_id;
    req.orgId = r.rows[0].organization_id;
    next();
  } catch (err) {
    logError('totem.auth_failed', err);
    res.status(500).json({ error: 'Erro de autenticação do totem' });
  }
};

// ============ MIDDLEWARE: Agency auth ============
const authenticateAgency = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (decoded.type !== 'agency') return res.status(403).json({ error: 'Acesso restrito a agências' });
    req.agencyUserId = decoded.userId;
    req.agencyId = decoded.agencyId;
    req.orgId = decoded.orgId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ============ MIDDLEWARE: Supermarket auth ============
const authenticateSupermarket = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (decoded.type !== 'supermarket') return res.status(403).json({ error: 'Acesso restrito a supermercados' });
    req.supermarketUserId = decoded.userId;
    req.unitId = decoded.unitId;
    req.networkId = decoded.networkId;
    req.canViewAllNetwork = decoded.canViewAllNetwork;
    req.orgId = decoded.orgId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// =====================================================================
// ADMIN ROUTES (authenticated Ayratech users)
// =====================================================================

// --- Supermarket Networks CRUD ---
router.get('/networks', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const r = await query('SELECT * FROM supermarket_networks WHERE organization_id = $1 ORDER BY name', [orgId]);
    res.json(r.rows);
  } catch (err) { logError('access.networks.list', err); res.status(500).json({ error: 'Erro ao listar redes' }); }
});

router.post('/networks', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, cnpj, contact_name, contact_phone, contact_email, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const r = await query(
      `INSERT INTO supermarket_networks (organization_id, name, cnpj, contact_name, contact_phone, contact_email, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, name, cnpj || null, contact_name || null, contact_phone || null, contact_email || null, notes || null]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('access.networks.create', err); res.status(500).json({ error: 'Erro ao criar rede' }); }
});

router.put('/networks/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, cnpj, contact_name, contact_phone, contact_email, notes, active } = req.body;
    const r = await query(
      `UPDATE supermarket_networks SET name=COALESCE($1,name), cnpj=$2, contact_name=$3, contact_phone=$4,
       contact_email=$5, notes=$6, active=COALESCE($7,active), updated_at=NOW()
       WHERE id=$8 AND organization_id=$9 RETURNING *`,
      [name, cnpj||null, contact_name||null, contact_phone||null, contact_email||null, notes||null, active, req.params.id, orgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Rede não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { logError('access.networks.update', err); res.status(500).json({ error: 'Erro ao atualizar rede' }); }
});

router.delete('/networks/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    await query('DELETE FROM supermarket_networks WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    res.json({ ok: true });
  } catch (err) { logError('access.networks.delete', err); res.status(500).json({ error: 'Erro ao excluir rede' }); }
});

// --- Supermarket Units CRUD ---
router.get('/units', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { network_id } = req.query;
    let sql = `SELECT su.*, sn.name as network_name FROM supermarket_units su
               LEFT JOIN supermarket_networks sn ON sn.id = su.network_id
               WHERE su.organization_id = $1`;
    const params = [orgId];
    if (network_id) { sql += ' AND su.network_id = $2'; params.push(network_id); }
    sql += ' ORDER BY su.name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('access.units.list', err); res.status(500).json({ error: 'Erro ao listar unidades' }); }
});

router.post('/units', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, cnpj, network_id, pdv_id, address, city, state, zip_code, neighborhood, latitude, longitude,
            radius_meters, opening_time, closing_time, operating_days, operational_requirements, totem_enabled } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const totemToken = totem_enabled ? require('crypto').randomBytes(32).toString('hex') : null;
    const r = await query(
      `INSERT INTO supermarket_units (organization_id, name, cnpj, network_id, pdv_id, address, city, state, zip_code,
       neighborhood, latitude, longitude, radius_meters, opening_time, closing_time, operating_days,
       operational_requirements, totem_enabled, totem_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [orgId, name, cnpj||null, network_id||null, pdv_id||null, address||null, city||null, state||null, zip_code||null,
       neighborhood||null, latitude||null, longitude||null, radius_meters||200, opening_time||'06:00', closing_time||'22:00',
       JSON.stringify(operating_days || [1,2,3,4,5,6]), operational_requirements||null, totem_enabled||false, totemToken]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('access.units.create', err); res.status(500).json({ error: 'Erro ao criar unidade' }); }
});

router.put('/units/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, cnpj, network_id, pdv_id, address, city, state, zip_code, neighborhood, latitude, longitude,
            radius_meters, opening_time, closing_time, operating_days, operational_requirements, totem_enabled, active } = req.body;
    let totemToken = undefined;
    if (totem_enabled) {
      const existing = await query('SELECT totem_token FROM supermarket_units WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]?.totem_token) totemToken = require('crypto').randomBytes(32).toString('hex');
    }
    const r = await query(
      `UPDATE supermarket_units SET name=COALESCE($1,name), cnpj=$2, network_id=$3, pdv_id=$4, address=$5,
       city=$6, state=$7, zip_code=$8, neighborhood=$9, latitude=$10, longitude=$11, radius_meters=COALESCE($12,radius_meters),
       opening_time=COALESCE($13,opening_time), closing_time=COALESCE($14,closing_time),
       operating_days=COALESCE($15,operating_days), operational_requirements=$16,
       totem_enabled=COALESCE($17,totem_enabled), totem_token=COALESCE($18,totem_token),
       active=COALESCE($19,active), updated_at=NOW()
       WHERE id=$20 AND organization_id=$21 RETURNING *`,
      [name, cnpj||null, network_id||null, pdv_id||null, address||null, city||null, state||null, zip_code||null,
       neighborhood||null, latitude||null, longitude||null, radius_meters, opening_time, closing_time,
       operating_days ? JSON.stringify(operating_days) : undefined, operational_requirements||null,
       totem_enabled, totemToken, active, req.params.id, orgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { logError('access.units.update', err); res.status(500).json({ error: 'Erro ao atualizar unidade' }); }
});

router.delete('/units/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    await query('DELETE FROM supermarket_units WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    res.json({ ok: true });
  } catch (err) { logError('access.units.delete', err); res.status(500).json({ error: 'Erro ao excluir unidade' }); }
});

// Regenerate totem token
router.post('/units/:id/regenerate-token', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const newToken = require('crypto').randomBytes(32).toString('hex');
    const r = await query(
      'UPDATE supermarket_units SET totem_token=$1, updated_at=NOW() WHERE id=$2 AND organization_id=$3 RETURNING totem_token',
      [newToken, req.params.id, orgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json({ totem_token: r.rows[0].totem_token });
  } catch (err) { logError('access.units.regen_token', err); res.status(500).json({ error: 'Erro' }); }
});

// --- Agencies CRUD ---
router.get('/agencies', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const r = await query(
      `SELECT a.*, (SELECT COUNT(*) FROM agency_promoters ap WHERE ap.agency_id = a.id AND ap.status = 'active') as promoter_count
       FROM agencies a WHERE a.organization_id = $1 ORDER BY a.name`, [orgId]);
    res.json(r.rows);
  } catch (err) { logError('access.agencies.list', err); res.status(500).json({ error: 'Erro ao listar agências' }); }
});

router.post('/agencies', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, cnpj, responsible_name, responsible_phone, responsible_email, address, city, state,
            plan_name, max_promoters, price_per_promoter, auto_block_on_overdue, notes, plan_id, contracted_promoters } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    // If plan_id provided, fetch plan to get price
    let finalPrice = price_per_promoter || 0;
    let finalPlanName = plan_name || null;
    let finalMax = max_promoters || 10;
    if (plan_id) {
      const plan = await query('SELECT * FROM agency_billing_plans WHERE id=$1 AND organization_id=$2', [plan_id, orgId]);
      if (plan.rows.length) {
        finalPrice = plan.rows[0].price_per_promoter;
        finalPlanName = plan.rows[0].name;
        if (plan.rows[0].max_promoters) finalMax = plan.rows[0].max_promoters;
      }
    }
    const contractedCount = contracted_promoters || finalMax;

    const r = await query(
      `INSERT INTO agencies (organization_id, name, cnpj, responsible_name, responsible_phone, responsible_email,
       address, city, state, plan_name, max_promoters, price_per_promoter, auto_block_on_overdue, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [orgId, name, cnpj||null, responsible_name||null, responsible_phone||null, responsible_email||null,
       address||null, city||null, state||null, finalPlanName, contractedCount, finalPrice,
       auto_block_on_overdue||false, notes||null]
    );
    const agency = r.rows[0];

    // Auto-create subscription if plan_id provided
    if (plan_id) {
      const amount = contractedCount * parseFloat(finalPrice);
      await query(
        `INSERT INTO agency_subscriptions (agency_id, plan_id, promoter_count, amount_due)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [agency.id, plan_id, contractedCount, amount]
      );
    }

    res.json(agency);
  } catch (err) { logError('access.agencies.create', err); res.status(500).json({ error: 'Erro ao criar agência' }); }
});

router.put('/agencies/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, cnpj, responsible_name, responsible_phone, responsible_email, address, city, state,
            plan_name, max_promoters, price_per_promoter, auto_block_on_overdue, status, billing_status, notes } = req.body;
    const r = await query(
      `UPDATE agencies SET name=COALESCE($1,name), cnpj=$2, responsible_name=$3, responsible_phone=$4,
       responsible_email=$5, address=$6, city=$7, state=$8, plan_name=$9, max_promoters=COALESCE($10,max_promoters),
       price_per_promoter=COALESCE($11,price_per_promoter), auto_block_on_overdue=COALESCE($12,auto_block_on_overdue),
       status=COALESCE($13,status), billing_status=COALESCE($14,billing_status), notes=$15, updated_at=NOW()
       WHERE id=$16 AND organization_id=$17 RETURNING *`,
      [name, cnpj||null, responsible_name||null, responsible_phone||null, responsible_email||null,
       address||null, city||null, state||null, plan_name||null, max_promoters, price_per_promoter,
       auto_block_on_overdue, status, billing_status, notes||null, req.params.id, orgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Agência não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { logError('access.agencies.update', err); res.status(500).json({ error: 'Erro ao atualizar agência' }); }
});

router.delete('/agencies/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    await query('DELETE FROM agencies WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    res.json({ ok: true });
  } catch (err) { logError('access.agencies.delete', err); res.status(500).json({ error: 'Erro ao excluir agência' }); }
});

// --- Agency Allowed Units ---
router.get('/agencies/:id/allowed-units', authenticate, async (req, res) => {
  try {
    const r = await query(
      `SELECT aau.*, su.name as unit_name, su.city, su.state FROM agency_allowed_units aau
       JOIN supermarket_units su ON su.id = aau.supermarket_unit_id
       WHERE aau.agency_id = $1 ORDER BY su.name`, [req.params.id]);
    res.json(r.rows);
  } catch (err) { logError('access.agency_units.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.put('/agencies/:id/allowed-units', authenticate, async (req, res) => {
  try {
    const { unit_ids } = req.body;
    await query('DELETE FROM agency_allowed_units WHERE agency_id = $1', [req.params.id]);
    for (const uid of (unit_ids || [])) {
      await query('INSERT INTO agency_allowed_units (agency_id, supermarket_unit_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, uid]);
    }
    res.json({ ok: true });
  } catch (err) { logError('access.agency_units.update', err); res.status(500).json({ error: 'Erro' }); }
});

// --- Agency Users CRUD (create login for agency) ---
router.post('/agencies/:id/users', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const agency = await query('SELECT id FROM agencies WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    if (!agency.rows.length) return res.status(404).json({ error: 'Agência não encontrada' });
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    const hash = await bcrypt.hash(password, 10);
    const r = await query(
      'INSERT INTO agency_users (agency_id, email, password_hash, name, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role',
      [req.params.id, email, hash, name, role || 'admin']
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    logError('access.agency_users.create', err); res.status(500).json({ error: 'Erro ao criar usuário da agência' });
  }
});

router.get('/agencies/:id/users', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT id, email, name, role, active, last_login, created_at FROM agency_users WHERE agency_id=$1 ORDER BY name', [req.params.id]);
    res.json(r.rows);
  } catch (err) { logError('access.agency_users.list', err); res.status(500).json({ error: 'Erro' }); }
});

// --- Agency Promoters CRUD ---
router.get('/agencies/:id/promoters', authenticate, async (req, res) => {
  try {
    const r = await query(
      `SELECT ap.*, e.full_name as employee_name FROM agency_promoters ap
       LEFT JOIN employees e ON e.id = ap.employee_id
       WHERE ap.agency_id = $1 ORDER BY ap.name`, [req.params.id]);
    res.json(r.rows);
  } catch (err) { logError('access.agency_promoters.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/agencies/:id/promoters', authenticate, async (req, res) => {
  try {
    const { name, cpf, phone, photo_url, document_url, employee_id } = req.body;
    if (!name || !cpf) return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return res.status(400).json({ error: 'CPF inválido' });
    // Check agency limit
    const agency = await query('SELECT max_promoters FROM agencies WHERE id=$1', [req.params.id]);
    const count = await query('SELECT COUNT(*) as c FROM agency_promoters WHERE agency_id=$1 AND status=\'active\'', [req.params.id]);
    if (agency.rows[0] && parseInt(count.rows[0].c) >= agency.rows[0].max_promoters) {
      return res.status(400).json({ error: 'Limite de promotores atingido para esta agência' });
    }
    const r = await query(
      `INSERT INTO agency_promoters (agency_id, name, cpf, phone, photo_url, document_url, employee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, name, cpf, phone||null, photo_url||null, document_url||null, employee_id||null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'CPF já cadastrado nesta agência' });
    logError('access.agency_promoters.create', err); res.status(500).json({ error: 'Erro' });
  }
});

router.put('/agencies/:agencyId/promoters/:id', authenticate, async (req, res) => {
  try {
    const { name, cpf, phone, photo_url, document_url, employee_id, status } = req.body;
    const r = await query(
      `UPDATE agency_promoters SET name=COALESCE($1,name), cpf=COALESCE($2,cpf), phone=$3,
       photo_url=$4, document_url=$5, employee_id=$6, status=COALESCE($7,status), updated_at=NOW()
       WHERE id=$8 AND agency_id=$9 RETURNING *`,
      [name, cpf, phone||null, photo_url||null, document_url||null, employee_id||null, status, req.params.id, req.params.agencyId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Promotor não encontrado' });
    res.json(r.rows[0]);
  } catch (err) { logError('access.agency_promoters.update', err); res.status(500).json({ error: 'Erro' }); }
});

// --- Access Rules CRUD ---
router.get('/access-rules', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { unit_id, agency_promoter_id, employee_id } = req.query;
      let sql = `SELECT ar.*, su.name as unit_name, ap.name as promoter_name, ap.cpf,
                a.name as agency_name, e.full_name as employee_name,
               COALESCE(json_agg(json_build_object('id', bp.id, 'brand_id', bp.brand_id, 'brand_name', b.name))
               FILTER (WHERE bp.id IS NOT NULL), '[]') as brands
               FROM pdv_access_rules ar
               LEFT JOIN supermarket_units su ON su.id = ar.supermarket_unit_id
               LEFT JOIN agency_promoters ap ON ap.id = ar.agency_promoter_id
               LEFT JOIN agencies a ON a.id = ap.agency_id
               LEFT JOIN employees e ON e.id = ar.employee_id
               LEFT JOIN promoter_brand_permissions bp ON bp.access_rule_id = ar.id
               LEFT JOIN brands b ON b.id = bp.brand_id
               WHERE ar.organization_id = $1`;
    const params = [orgId];
    if (unit_id) { params.push(unit_id); sql += ` AND ar.supermarket_unit_id = $${params.length}`; }
    if (agency_promoter_id) { params.push(agency_promoter_id); sql += ` AND ar.agency_promoter_id = $${params.length}`; }
    if (employee_id) { params.push(employee_id); sql += ` AND ar.employee_id = $${params.length}`; }
    sql += ' GROUP BY ar.id, su.name, ap.name, ap.cpf, a.name, e.full_name ORDER BY su.name, ap.name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('access.rules.list', err); res.status(500).json({ error: 'Erro ao listar regras' }); }
});

router.post('/access-rules', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { agency_promoter_id, employee_id, supermarket_unit_id, allowed_weekdays, start_time, end_time,
            max_duration_minutes, require_active_route, require_prior_approval, brand_ids, notes } = req.body;
    if (!supermarket_unit_id) return res.status(400).json({ error: 'Unidade é obrigatória' });
    if (!agency_promoter_id && !employee_id) return res.status(400).json({ error: 'Promotor ou colaborador é obrigatório' });
    const approvalStatus = require_prior_approval ? 'pending' : 'approved';
    const r = await query(
      `INSERT INTO pdv_access_rules (organization_id, agency_promoter_id, employee_id, supermarket_unit_id,
       allowed_weekdays, start_time, end_time, max_duration_minutes, require_active_route,
       require_prior_approval, approval_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [orgId, agency_promoter_id||null, employee_id||null, supermarket_unit_id,
       JSON.stringify(allowed_weekdays || [1,2,3,4,5]), start_time||'08:00', end_time||'18:00',
       max_duration_minutes||null, require_active_route||false, require_prior_approval||false, approvalStatus, notes||null]
    );
    // Add brand permissions
    if (brand_ids?.length) {
      for (const bid of brand_ids) {
        await query('INSERT INTO promoter_brand_permissions (access_rule_id, brand_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, bid]);
      }
    }
    // Audit
    await query(
      `INSERT INTO access_audit_logs (organization_id, action, entity_type, entity_id, agency_promoter_id, employee_id, supermarket_unit_id, performed_by, performed_by_type, details)
       VALUES ($1,'rule_created','rule',$2,$3,$4,$5,$6,'admin',$7)`,
      [orgId, r.rows[0].id, agency_promoter_id||null, employee_id||null, supermarket_unit_id, req.userId, JSON.stringify({ brand_ids })]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('access.rules.create', err); res.status(500).json({ error: 'Erro ao criar regra' }); }
});

router.put('/access-rules/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { allowed_weekdays, start_time, end_time, max_duration_minutes, require_active_route,
            require_prior_approval, approval_status, active, brand_ids, notes } = req.body;
    const r = await query(
      `UPDATE pdv_access_rules SET allowed_weekdays=COALESCE($1,allowed_weekdays), start_time=COALESCE($2,start_time),
       end_time=COALESCE($3,end_time), max_duration_minutes=$4, require_active_route=COALESCE($5,require_active_route),
       require_prior_approval=COALESCE($6,require_prior_approval), approval_status=COALESCE($7,approval_status),
       active=COALESCE($8,active), notes=$9, updated_at=NOW()
       WHERE id=$10 AND organization_id=$11 RETURNING *`,
      [allowed_weekdays ? JSON.stringify(allowed_weekdays) : undefined, start_time, end_time, max_duration_minutes??null,
       require_active_route, require_prior_approval, approval_status, active, notes||null, req.params.id, orgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Regra não encontrada' });
    // Update brands
    if (brand_ids !== undefined) {
      await query('DELETE FROM promoter_brand_permissions WHERE access_rule_id=$1', [req.params.id]);
      for (const bid of (brand_ids || [])) {
        await query('INSERT INTO promoter_brand_permissions (access_rule_id, brand_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, bid]);
      }
    }
    res.json(r.rows[0]);
  } catch (err) { logError('access.rules.update', err); res.status(500).json({ error: 'Erro ao atualizar regra' }); }
});

router.delete('/access-rules/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    await query('DELETE FROM pdv_access_rules WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    res.json({ ok: true });
  } catch (err) { logError('access.rules.delete', err); res.status(500).json({ error: 'Erro' }); }
});

// --- Entry Logs (admin view) ---
router.get('/entry-logs', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { unit_id, date, status } = req.query;
    let sql = `SELECT el.*, su.name as unit_name, ap.name as promoter_name, ap.cpf, ap.photo_url,
               a.name as agency_name, e.full_name as employee_name
               FROM pdv_entry_logs el
               LEFT JOIN supermarket_units su ON su.id = el.supermarket_unit_id
               LEFT JOIN agency_promoters ap ON ap.id = el.agency_promoter_id
               LEFT JOIN agencies a ON a.id = ap.agency_id
               LEFT JOIN employees e ON e.id = el.employee_id
               WHERE el.organization_id = $1`;
    const params = [orgId];
    if (unit_id) { params.push(unit_id); sql += ` AND el.supermarket_unit_id = $${params.length}`; }
    if (date) { params.push(date); sql += ` AND el.entry_at::date = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND el.status = $${params.length}`; }
    sql += ' ORDER BY el.entry_at DESC LIMIT 200';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('access.entry_logs.list', err); res.status(500).json({ error: 'Erro' }); }
});

// --- Audit Logs ---
router.get('/audit-logs', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { unit_id, action, limit: lim } = req.query;
    let sql = 'SELECT * FROM access_audit_logs WHERE organization_id = $1';
    const params = [orgId];
    if (unit_id) { params.push(unit_id); sql += ` AND supermarket_unit_id = $${params.length}`; }
    if (action) { params.push(action); sql += ` AND action = $${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT ${parseInt(lim) || 100}`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('access.audit.list', err); res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// TOTEM ROUTES (public-facing, authenticated by totem token)
// =====================================================================

// Validate CPF at totem
router.post('/totem/validate', authenticateTotem, async (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return res.status(400).json({ authorized: false, reason: 'CPF inválido' });

    const now = new Date();
    const currentDay = now.getDay(); // 0=dom..6=sab
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Find promoter by CPF (agency promoter or internal employee)
    const promoter = await query(
      `SELECT ap.id as agency_promoter_id, ap.name, ap.photo_url, ap.status as promoter_status,
              ap.agency_id, a.name as agency_name, a.status as agency_status, a.billing_status,
              NULL as employee_id
       FROM agency_promoters ap
       JOIN agencies a ON a.id = ap.agency_id
       WHERE ap.cpf = $1
       UNION ALL
       SELECT NULL as agency_promoter_id, e.full_name, e.photo_url, 'active' as promoter_status,
              NULL as agency_id, NULL as agency_name, 'active' as agency_status, 'active' as billing_status,
              e.id as employee_id
       FROM employees e WHERE e.cpf = $1
       LIMIT 1`,
      [cleanCpf]
    );

    if (!promoter.rows.length) {
      await logEntry(req.orgId, req.unitId, null, null, cleanCpf, 'blocked', 'cadastro_inexistente');
      return res.json({ authorized: false, reason: 'Cadastro não encontrado', reason_code: 'cadastro_inexistente' });
    }

    const p = promoter.rows[0];

    // Check promoter status
    if (p.promoter_status !== 'active') {
      await logEntry(req.orgId, req.unitId, p.agency_promoter_id, p.employee_id, cleanCpf, 'blocked', 'promotor_inativo');
      return res.json({ authorized: false, reason: 'Promotor inativo', reason_code: 'promotor_inativo' });
    }

    // Check agency status
    if (p.agency_id && (p.agency_status !== 'active' || p.billing_status === 'blocked')) {
      await logEntry(req.orgId, req.unitId, p.agency_promoter_id, p.employee_id, cleanCpf, 'blocked', 'agencia_bloqueada');
      return res.json({ authorized: false, reason: 'Agência bloqueada ou inadimplente', reason_code: 'agencia_bloqueada' });
    }

    // Find access rules for this unit
    const ruleCondition = p.agency_promoter_id
      ? 'ar.agency_promoter_id = $1'
      : 'ar.employee_id = $1';
    const ruleParam = p.agency_promoter_id || p.employee_id;

    const rules = await query(
      `SELECT ar.* FROM pdv_access_rules ar
       WHERE ${ruleCondition} AND ar.supermarket_unit_id = $2 AND ar.active = true AND ar.approval_status = 'approved'`,
      [ruleParam, req.unitId]
    );

    if (!rules.rows.length) {
      await logEntry(req.orgId, req.unitId, p.agency_promoter_id, p.employee_id, cleanCpf, 'blocked', 'sem_autorizacao');
      return res.json({ authorized: false, reason: 'Sem autorização para este PDV', reason_code: 'sem_autorizacao' });
    }

    // Check any rule that matches current day and time
    const matchingRule = rules.rows.find(r => {
      const weekdays = Array.isArray(r.allowed_weekdays) ? r.allowed_weekdays : JSON.parse(r.allowed_weekdays || '[]');
      if (!weekdays.includes(currentDay)) return false;
      if (currentTime < r.start_time || currentTime > r.end_time) return false;
      return true;
    });

    if (!matchingRule) {
      await logEntry(req.orgId, req.unitId, p.agency_promoter_id, p.employee_id, cleanCpf, 'blocked', 'fora_horario');
      return res.json({ authorized: false, reason: 'Fora do horário permitido', reason_code: 'fora_horario' });
    }

    // Get brands for the matching rule
    const brands = await query(
      `SELECT b.id, b.name FROM promoter_brand_permissions bp
       JOIN brands b ON b.id = bp.brand_id WHERE bp.access_rule_id = $1`,
      [matchingRule.id]
    );

    // Register entry
    const entry = await query(
      `INSERT INTO pdv_entry_logs (organization_id, supermarket_unit_id, agency_promoter_id, employee_id, cpf, status, origin)
       VALUES ($1,$2,$3,$4,$5,'authorized','totem') RETURNING id`,
      [req.orgId, req.unitId, p.agency_promoter_id, p.employee_id, cleanCpf]
    );

    // Audit
    await query(
      `INSERT INTO access_audit_logs (organization_id, action, supermarket_unit_id, agency_promoter_id, employee_id, agency_id, performed_by_type, details)
       VALUES ($1,'entry_authorized',$2,$3,$4,$5,'totem',$6)`,
      [req.orgId, req.unitId, p.agency_promoter_id, p.employee_id, p.agency_id, JSON.stringify({ entry_id: entry.rows[0].id, brands: brands.rows.map(b => b.name) })]
    );

    // Update daily brand presence
    for (const b of brands.rows) {
      await query(
        `INSERT INTO daily_brand_presence (supermarket_unit_id, brand_id, presence_date, agency_id, promoter_count, first_entry)
         VALUES ($1,$2,CURRENT_DATE,$3,1,NOW())
         ON CONFLICT (supermarket_unit_id, brand_id, presence_date)
         DO UPDATE SET promoter_count = daily_brand_presence.promoter_count + 1`,
        [req.unitId, b.id, p.agency_id]
      );
    }

    res.json({
      authorized: true,
      entry_id: entry.rows[0].id,
      promoter: { name: p.name, photo_url: p.photo_url, agency: p.agency_name },
      brands: brands.rows,
      max_duration_minutes: matchingRule.max_duration_minutes,
    });
  } catch (err) { logError('totem.validate', err); res.status(500).json({ error: 'Erro na validação' }); }
});

// Totem checkout
router.post('/totem/checkout', authenticateTotem, async (req, res) => {
  try {
    const { cpf, entry_id } = req.body;
    let condition = 'id = $1';
    let param = entry_id;
    if (!entry_id && cpf) {
      condition = `cpf = $1 AND supermarket_unit_id = $2 AND exit_at IS NULL AND status = 'authorized'`;
      param = cpf.replace(/\D/g, '');
    }
    const sql = entry_id
      ? `UPDATE pdv_entry_logs SET exit_at=NOW(), duration_minutes=EXTRACT(EPOCH FROM (NOW()-entry_at))/60
         WHERE id=$1 AND exit_at IS NULL RETURNING *`
      : `UPDATE pdv_entry_logs SET exit_at=NOW(), duration_minutes=EXTRACT(EPOCH FROM (NOW()-entry_at))/60
         WHERE cpf=$1 AND supermarket_unit_id=$2 AND exit_at IS NULL AND status='authorized'
         RETURNING *`;
    const params = entry_id ? [entry_id] : [cpf.replace(/\D/g, ''), req.unitId];
    const r = await query(sql, params);
    if (!r.rows.length) return res.status(404).json({ error: 'Entrada não encontrada' });
    res.json(r.rows[0]);
  } catch (err) { logError('totem.checkout', err); res.status(500).json({ error: 'Erro no checkout' }); }
});

// Helper: log blocked/authorized entry
async function logEntry(orgId, unitId, agencyPromoterId, employeeId, cpf, status, blockReason) {
  try {
    await query(
      `INSERT INTO pdv_entry_logs (organization_id, supermarket_unit_id, agency_promoter_id, employee_id, cpf, status, block_reason, origin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'totem')`,
      [orgId, unitId, agencyPromoterId||null, employeeId||null, cpf, status, blockReason||null]
    );
    await query(
      `INSERT INTO access_audit_logs (organization_id, action, supermarket_unit_id, agency_promoter_id, employee_id, performed_by_type, details)
       VALUES ($1,$2,$3,$4,$5,'totem',$6)`,
      [orgId, `entry_${status}`, unitId, agencyPromoterId||null, employeeId||null, JSON.stringify({ reason: blockReason, cpf })]
    );
  } catch { /* silent */ }
}

// =====================================================================
// AGENCY LOGIN & ROUTES
// =====================================================================

router.post('/agency/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const r = await query(
      `SELECT au.*, a.organization_id as org_id, a.status as agency_status FROM agency_users au
       JOIN agencies a ON a.id = au.agency_id WHERE au.email = $1 AND au.active = true`, [email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = r.rows[0];
    if (user.agency_status !== 'active') return res.status(403).json({ error: 'Agência bloqueada' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ userId: user.id, agencyId: user.agency_id, orgId: user.org_id, type: 'agency' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    await query('UPDATE agency_users SET last_login=NOW() WHERE id=$1', [user.id]);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, agency_id: user.agency_id } });
  } catch (err) { logError('agency.login', err); res.status(500).json({ error: 'Erro no login' }); }
});

// Agency: list own promoters
router.get('/agency/promoters', authenticateAgency, async (req, res) => {
  try {
    const r = await query('SELECT * FROM agency_promoters WHERE agency_id=$1 ORDER BY name', [req.agencyId]);
    res.json(r.rows);
  } catch (err) { logError('agency.promoters.list', err); res.status(500).json({ error: 'Erro' }); }
});

// Agency: create promoter
router.post('/agency/promoters', authenticateAgency, async (req, res) => {
  try {
    const { name, cpf, phone, photo_url, document_url, employee_id } = req.body;
    if (!name || !cpf) return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
    const agency = await query('SELECT max_promoters FROM agencies WHERE id=$1', [req.agencyId]);
    const count = await query('SELECT COUNT(*) as c FROM agency_promoters WHERE agency_id=$1 AND status=\'active\'', [req.agencyId]);
    if (parseInt(count.rows[0].c) >= agency.rows[0]?.max_promoters) {
      return res.status(400).json({ error: 'Limite de promotores atingido' });
    }
    const r = await query(
      'INSERT INTO agency_promoters (agency_id, name, cpf, phone, photo_url, document_url, employee_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.agencyId, name, cpf, phone||null, photo_url||null, document_url||null, employee_id||null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'CPF já cadastrado' });
    logError('agency.promoters.create', err); res.status(500).json({ error: 'Erro' });
  }
});

// Agency: list access rules for own promoters
router.get('/agency/access-rules', authenticateAgency, async (req, res) => {
  try {
    const r = await query(
      `SELECT ar.*, su.name as unit_name, ap.name as promoter_name, ap.cpf,
       COALESCE(json_agg(json_build_object('brand_id', bp.brand_id, 'brand_name', b.name))
       FILTER (WHERE bp.id IS NOT NULL), '[]') as brands
       FROM pdv_access_rules ar
       JOIN agency_promoters ap ON ap.id = ar.agency_promoter_id
       JOIN supermarket_units su ON su.id = ar.supermarket_unit_id
       LEFT JOIN promoter_brand_permissions bp ON bp.access_rule_id = ar.id
       LEFT JOIN brands b ON b.id = bp.brand_id
       WHERE ap.agency_id = $1
       GROUP BY ar.id, su.name, ap.name, ap.cpf ORDER BY su.name`, [req.agencyId]);
    res.json(r.rows);
  } catch (err) { logError('agency.rules.list', err); res.status(500).json({ error: 'Erro' }); }
});

// Agency: create access rule
router.post('/agency/access-rules', authenticateAgency, async (req, res) => {
  try {
    const { agency_promoter_id, supermarket_unit_id, allowed_weekdays, start_time, end_time, brand_ids } = req.body;
    if (!agency_promoter_id || !supermarket_unit_id) return res.status(400).json({ error: 'Promotor e unidade são obrigatórios' });
    // Verify promoter belongs to agency
    const pCheck = await query('SELECT id FROM agency_promoters WHERE id=$1 AND agency_id=$2', [agency_promoter_id, req.agencyId]);
    if (!pCheck.rows.length) return res.status(403).json({ error: 'Promotor não pertence a esta agência' });
    const r = await query(
      `INSERT INTO pdv_access_rules (organization_id, agency_promoter_id, supermarket_unit_id, allowed_weekdays, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.orgId, agency_promoter_id, supermarket_unit_id, JSON.stringify(allowed_weekdays||[1,2,3,4,5]), start_time||'08:00', end_time||'18:00']
    );
    if (brand_ids?.length) {
      for (const bid of brand_ids) {
        await query('INSERT INTO promoter_brand_permissions (access_rule_id, brand_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, bid]);
      }
    }
    res.json(r.rows[0]);
  } catch (err) { logError('agency.rules.create', err); res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// SUPERMARKET LOGIN & PANEL
// =====================================================================

router.post('/supermarket/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const r = await query(
      `SELECT su_user.*, su.organization_id as org_id, su.name as unit_name FROM supermarket_users su_user
       JOIN supermarket_units su ON su.id = su_user.supermarket_unit_id
       WHERE su_user.email = $1 AND su_user.active = true`, [email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = r.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({
      userId: user.id, unitId: user.supermarket_unit_id, networkId: user.network_id,
      canViewAllNetwork: user.can_view_all_network, orgId: user.org_id, type: 'supermarket'
    }, process.env.JWT_SECRET, { expiresIn: '24h' });
    await query('UPDATE supermarket_users SET last_login=NOW() WHERE id=$1', [user.id]);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, unit_name: user.unit_name } });
  } catch (err) { logError('supermarket.login', err); res.status(500).json({ error: 'Erro no login' }); }
});

// Supermarket: create user (admin)
router.post('/supermarket-users', authenticate, async (req, res) => {
  try {
    const { supermarket_unit_id, network_id, email, password, name, role, can_view_all_network } = req.body;
    if (!email || !password || !name || !supermarket_unit_id) return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    const hash = await bcrypt.hash(password, 10);
    const r = await query(
      `INSERT INTO supermarket_users (supermarket_unit_id, network_id, email, password_hash, name, role, can_view_all_network)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, name, role`,
      [supermarket_unit_id, network_id||null, email, hash, name, role||'manager', can_view_all_network||false]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    logError('supermarket.users.create', err); res.status(500).json({ error: 'Erro' });
  }
});

// Supermarket: dashboard - who is in the store now
router.get('/supermarket/dashboard', authenticateSupermarket, async (req, res) => {
  try {
    const unitIds = [req.unitId];
    if (req.canViewAllNetwork && req.networkId) {
      const network = await query('SELECT id FROM supermarket_units WHERE network_id=$1 AND active=true', [req.networkId]);
      unitIds.length = 0;
      network.rows.forEach(r => unitIds.push(r.id));
    }
    const placeholders = unitIds.map((_, i) => `$${i + 1}`).join(',');

    // Currently in store (entered, not exited)
    const inStore = await query(
      `SELECT el.*, ap.name as promoter_name, ap.photo_url, a.name as agency_name, su.name as unit_name
       FROM pdv_entry_logs el
       LEFT JOIN agency_promoters ap ON ap.id = el.agency_promoter_id
       LEFT JOIN agencies a ON a.id = ap.agency_id
       LEFT JOIN supermarket_units su ON su.id = el.supermarket_unit_id
       WHERE el.supermarket_unit_id IN (${placeholders}) AND el.exit_at IS NULL AND el.status = 'authorized'
       ORDER BY el.entry_at DESC`, unitIds);

    // Today's entries
    const todayEntries = await query(
      `SELECT COUNT(*) FILTER (WHERE status='authorized') as authorized,
              COUNT(*) FILTER (WHERE status='blocked') as blocked,
              COUNT(*) FILTER (WHERE exit_at IS NOT NULL) as exited
       FROM pdv_entry_logs WHERE supermarket_unit_id IN (${placeholders}) AND entry_at::date = CURRENT_DATE`, unitIds);

    // Brands today
    const brands = await query(
      `SELECT dbp.*, b.name as brand_name FROM daily_brand_presence dbp
       JOIN brands b ON b.id = dbp.brand_id
       WHERE dbp.supermarket_unit_id IN (${placeholders}) AND dbp.presence_date = CURRENT_DATE
       ORDER BY b.name`, unitIds);

    res.json({
      in_store: inStore.rows,
      today_stats: todayEntries.rows[0] || { authorized: 0, blocked: 0, exited: 0 },
      brands_today: brands.rows,
    });
  } catch (err) { logError('supermarket.dashboard', err); res.status(500).json({ error: 'Erro' }); }
});

// Supermarket: access history
router.get('/supermarket/history', authenticateSupermarket, async (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = `SELECT el.*, ap.name as promoter_name, ap.photo_url, a.name as agency_name
               FROM pdv_entry_logs el
               LEFT JOIN agency_promoters ap ON ap.id = el.agency_promoter_id
               LEFT JOIN agencies a ON a.id = ap.agency_id
               WHERE el.supermarket_unit_id = $1`;
    const params = [req.unitId];
    if (date) { params.push(date); sql += ` AND el.entry_at::date = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND el.status = $${params.length}`; }
    sql += ' ORDER BY el.entry_at DESC LIMIT 200';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('supermarket.history', err); res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// ADMIN: Unified Promoters list (frontend /promoters endpoint)
// =====================================================================
router.get('/promoters', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const r = await query(
      `SELECT ap.id, ap.name as full_name, ap.cpf, ap.phone, ap.photo_url, ap.status,
              ap.agency_id, a.name as agency_name, ap.employee_id,
              ap.status = 'active' as is_active,
              ap.created_at
       FROM agency_promoters ap
       LEFT JOIN agencies a ON a.id = ap.agency_id
       WHERE a.organization_id = $1
       UNION ALL
       SELECT e.id, e.full_name, e.cpf, e.phone, e.photo_url, 'active' as status,
              NULL as agency_id, NULL as agency_name, e.id as employee_id,
              true as is_active, e.created_at
       FROM employees e WHERE e.organization_id = $1
       ORDER BY full_name`,
      [orgId]
    );
    res.json(r.rows);
  } catch (err) { logError('access.promoters.list', err); res.status(500).json({ error: 'Erro ao listar promotores' }); }
});

router.post('/promoters', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { full_name, cpf, phone, agency_id } = req.body;
    if (!full_name || !cpf) return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
    if (agency_id) {
      const agency = await query('SELECT max_promoters FROM agencies WHERE id=$1 AND organization_id=$2', [agency_id, orgId]);
      if (!agency.rows.length) return res.status(404).json({ error: 'Agência não encontrada' });
      const count = await query("SELECT COUNT(*) as c FROM agency_promoters WHERE agency_id=$1 AND status='active'", [agency_id]);
      if (parseInt(count.rows[0].c) >= agency.rows[0].max_promoters) {
        return res.status(400).json({ error: 'Limite de promotores atingido' });
      }
      const r = await query(
        'INSERT INTO agency_promoters (agency_id, name, cpf, phone) VALUES ($1,$2,$3,$4) RETURNING *, name as full_name, true as is_active',
        [agency_id, full_name, cpf, phone || null]
      );
      res.json(r.rows[0]);
    } else {
      const r = await query(
        `INSERT INTO employees (organization_id, full_name, cpf, phone, worker_profile)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, full_name, cpf, phone, photo_url, status,
                   NULL::uuid as agency_id, NULL::text as agency_name, id as employee_id,
                   true as is_active, created_at`,
        [orgId, full_name, cpf, phone || null, 'operacional']
      );
      res.json(r.rows[0]);
    }
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'CPF já cadastrado' });
    logError('access.promoters.create', err); res.status(500).json({ error: 'Erro' });
  }
});

router.put('/promoters/:id', authenticate, async (req, res) => {
  try {
    const { full_name, cpf, phone, agency_id, is_active } = req.body;
    // Try agency_promoters first
    let r = await query(
      `UPDATE agency_promoters SET name=COALESCE($1,name), cpf=COALESCE($2,cpf), phone=$3,
       status=CASE WHEN $4 THEN 'active' ELSE 'inactive' END, updated_at=NOW()
       WHERE id=$5 RETURNING *, name as full_name, status='active' as is_active`,
      [full_name, cpf, phone || null, is_active !== false, req.params.id]
    );
    if (!r.rows.length) {
      r = await query(
        `UPDATE employees SET full_name=COALESCE($1,full_name), cpf=COALESCE($2,cpf), phone=$3, updated_at=NOW()
         WHERE id=$4
         RETURNING id, full_name, cpf, phone, photo_url, status,
                   NULL::uuid as agency_id, NULL::text as agency_name, id as employee_id,
                   true as is_active, created_at`,
        [full_name, cpf, phone || null, req.params.id]
      );
    }
    if (!r.rows.length) return res.status(404).json({ error: 'Promotor não encontrado' });
    res.json(r.rows[0]);
  } catch (err) { logError('access.promoters.update', err); res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// ADMIN: Unified Rules endpoint (frontend /rules)
// =====================================================================
router.get('/rules', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { promoter_id } = req.query;
    let sql = `SELECT ar.id, ar.supermarket_unit_id as unit_id, su.name as unit_name,
               ar.allowed_weekdays, ar.start_time as time_start, ar.end_time as time_end,
               ar.active, ar.notes, '[]'::jsonb as brands
               FROM pdv_access_rules ar
               LEFT JOIN supermarket_units su ON su.id = ar.supermarket_unit_id
               WHERE ar.organization_id = $1`;
    const params = [orgId];
    if (promoter_id) {
      params.push(promoter_id);
      sql += ` AND (ar.agency_promoter_id = $${params.length} OR ar.employee_id = $${params.length})`;
    }
    sql += ' ORDER BY su.name';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('access.rules.list_unified', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/rules', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { promoter_id, unit_id, allowed_weekdays, time_start, time_end, brands } = req.body;
    if (!promoter_id || !unit_id) return res.status(400).json({ error: 'Promotor e unidade são obrigatórios' });
    // Determine if agency_promoter or employee
    const ap = await query('SELECT id FROM agency_promoters WHERE id=$1', [promoter_id]);
    const isAgencyPromoter = ap.rows.length > 0;
    const r = await query(
      `INSERT INTO pdv_access_rules (organization_id, ${isAgencyPromoter ? 'agency_promoter_id' : 'employee_id'},
       supermarket_unit_id, allowed_weekdays, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, promoter_id, unit_id, JSON.stringify(allowed_weekdays || [1,2,3,4,5]),
       time_start || '08:00', time_end || '18:00']
    );
    res.json(r.rows[0]);
  } catch (err) { logError('access.rules.create_unified', err); res.status(500).json({ error: 'Erro' }); }
});

router.delete('/rules/:id', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    await query('DELETE FROM pdv_access_rules WHERE id=$1 AND organization_id=$2', [req.params.id, orgId]);
    res.json({ ok: true });
  } catch (err) { logError('access.rules.delete_unified', err); res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// ADMIN: Logs endpoint (frontend /logs)
// =====================================================================
router.get('/logs', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { unit_id, date, status } = req.query;
    let sql = `SELECT el.id, el.cpf, el.entry_at as entry_time, el.exit_at as exit_time,
               el.duration_minutes, el.status, el.block_reason,
               COALESCE(ap.name, e.full_name) as promoter_name,
               su.name as unit_name, a.name as agency_name,
               '[]'::jsonb as brands
               FROM pdv_entry_logs el
               LEFT JOIN supermarket_units su ON su.id = el.supermarket_unit_id
               LEFT JOIN agency_promoters ap ON ap.id = el.agency_promoter_id
               LEFT JOIN agencies a ON a.id = ap.agency_id
               LEFT JOIN employees e ON e.id = el.employee_id
               WHERE el.organization_id = $1`;
    const params = [orgId];
    if (unit_id) { params.push(unit_id); sql += ` AND el.supermarket_unit_id = $${params.length}`; }
    if (date) { params.push(date); sql += ` AND el.entry_at::date = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND el.status = $${params.length}`; }
    sql += ' ORDER BY el.entry_at DESC LIMIT 200';
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) { logError('access.logs.list', err); res.status(500).json({ error: 'Erro' }); }
});

// =====================================================================
// ADMIN: Billing routes (frontend /billing/*)
// =====================================================================

// Plans
router.get('/billing/plans', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const r = await query('SELECT * FROM agency_billing_plans WHERE organization_id=$1 ORDER BY name', [orgId]);
    res.json(r.rows);
  } catch (err) { logError('billing.plans.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/billing/plans', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { name, price_per_promoter, max_promoters } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const r = await query(
      'INSERT INTO agency_billing_plans (organization_id, name, price_per_promoter, max_promoters) VALUES ($1,$2,$3,$4) RETURNING *',
      [orgId, name, price_per_promoter || 0, max_promoters || null]
    );
    res.json(r.rows[0]);
  } catch (err) { logError('billing.plans.create', err); res.status(500).json({ error: 'Erro' }); }
});

// Subscriptions
router.get('/billing/subscriptions', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const r = await query(
      `SELECT s.*, a.name as agency_name, p.name as plan_name,
       (SELECT COUNT(*) FROM agency_promoters ap WHERE ap.agency_id = a.id AND ap.status='active') as promoter_count
       FROM agency_subscriptions s
       JOIN agencies a ON a.id = s.agency_id
       LEFT JOIN agency_billing_plans p ON p.id = s.plan_id
       WHERE a.organization_id = $1 ORDER BY a.name`, [orgId]);
    res.json(r.rows);
  } catch (err) { logError('billing.subs.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/billing/subscriptions/:id/block', authenticate, async (req, res) => {
  try {
    const r = await query(
      "UPDATE agency_subscriptions SET status='blocked', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (r.rows.length) {
      await query("UPDATE agencies SET billing_status='blocked', status='blocked' WHERE id=$1", [r.rows[0].agency_id]);
    }
    res.json(r.rows[0] || { ok: true });
  } catch (err) { logError('billing.subs.block', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/billing/subscriptions/:id/unblock', authenticate, async (req, res) => {
  try {
    const r = await query(
      "UPDATE agency_subscriptions SET status='active', updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (r.rows.length) {
      await query("UPDATE agencies SET billing_status='active', status='active' WHERE id=$1", [r.rows[0].agency_id]);
    }
    res.json(r.rows[0] || { ok: true });
  } catch (err) { logError('billing.subs.unblock', err); res.status(500).json({ error: 'Erro' }); }
});

// Invoices
router.get('/billing/invoices', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const r = await query(
      `SELECT i.*, a.name as agency_name
       FROM agency_invoices i
       JOIN agencies a ON a.id = i.agency_id
       WHERE a.organization_id = $1
       ORDER BY i.created_at DESC`, [orgId]);
    res.json(r.rows);
  } catch (err) { logError('billing.invoices.list', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/billing/invoices/:id/pay', authenticate, async (req, res) => {
  try {
    const r = await query(
      "UPDATE agency_invoices SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    res.json(r.rows[0] || { ok: true });
  } catch (err) { logError('billing.invoices.pay', err); res.status(500).json({ error: 'Erro' }); }
});

router.post('/billing/invoices/generate', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { agency_id, months_ahead } = req.body;
    if (!agency_id) return res.status(400).json({ error: 'Agência é obrigatória' });
    const agency = await query('SELECT * FROM agencies WHERE id=$1 AND organization_id=$2', [agency_id, orgId]);
    if (!agency.rows.length) return res.status(404).json({ error: 'Agência não encontrada' });
    const a = agency.rows[0];

    // Use contracted count from subscription or agency max_promoters
    let sub = await query('SELECT * FROM agency_subscriptions WHERE agency_id=$1', [agency_id]);
    let subId;
    const contractedCount = sub.rows.length ? parseInt(sub.rows[0].promoter_count) : parseInt(a.max_promoters) || 0;
    const unitPrice = parseFloat(a.price_per_promoter) || 0;
    const total = contractedCount * unitPrice;

    if (!sub.rows.length) {
      const s = await query(
        "INSERT INTO agency_subscriptions (agency_id, promoter_count, amount_due) VALUES ($1,$2,$3) RETURNING id",
        [agency_id, contractedCount, total]
      );
      subId = s.rows[0].id;
    } else {
      subId = sub.rows[0].id;
      await query('UPDATE agency_subscriptions SET promoter_count=$1, amount_due=$2, updated_at=NOW() WHERE id=$3',
        [contractedCount, total, subId]);
    }

    // Generate invoices for current month + future months
    const totalMonths = Math.min(Math.max(parseInt(months_ahead) || 1, 1), 12);
    const now = new Date();
    const generatedInvoices = [];

    for (let m = 0; m < totalMonths; m++) {
      const refMonth = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const dueDate = new Date(now.getFullYear(), now.getMonth() + m + 1, 10);

      // Skip if invoice already exists for this month
      const existing = await query(
        'SELECT id FROM agency_invoices WHERE agency_id=$1 AND reference_month=$2',
        [agency_id, refMonth]
      );
      if (existing.rows.length) continue;

      const inv = await query(
        `INSERT INTO agency_invoices (subscription_id, agency_id, reference_month, promoter_count, unit_price, total_amount, final_amount, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING *`,
        [subId, agency_id, refMonth, contractedCount, unitPrice, total, dueDate]
      );
      generatedInvoices.push(inv.rows[0]);

      // Log
      await query(
        `INSERT INTO agency_billing_logs (agency_id, action, details) VALUES ($1,'invoice_created',$2)`,
        [agency_id, JSON.stringify({ invoice_id: inv.rows[0].id, reference_month: refMonth, amount: total })]
      );
    }

    res.json({ invoices: generatedInvoices, total_generated: generatedInvoices.length });
  } catch (err) { logError('billing.invoices.generate', err); res.status(500).json({ error: 'Erro' }); }
});

// Assign/update plan for agency subscription
router.post('/billing/subscriptions/assign-plan', authenticate, async (req, res) => {
  try {
    const orgId = await getOrgId(req.userId);
    const { agency_id, plan_id, contracted_promoters } = req.body;
    if (!agency_id || !plan_id) return res.status(400).json({ error: 'Agência e plano são obrigatórios' });

    const plan = await query('SELECT * FROM agency_billing_plans WHERE id=$1 AND organization_id=$2', [plan_id, orgId]);
    if (!plan.rows.length) return res.status(404).json({ error: 'Plano não encontrado' });

    const count = contracted_promoters || plan.rows[0].max_promoters || 10;
    const amount = count * parseFloat(plan.rows[0].price_per_promoter);

    // Update agency
    await query(
      'UPDATE agencies SET plan_name=$1, price_per_promoter=$2, max_promoters=$3, updated_at=NOW() WHERE id=$4 AND organization_id=$5',
      [plan.rows[0].name, plan.rows[0].price_per_promoter, count, agency_id, orgId]
    );

    // Upsert subscription
    let sub = await query('SELECT id FROM agency_subscriptions WHERE agency_id=$1', [agency_id]);
    if (!sub.rows.length) {
      sub = await query(
        'INSERT INTO agency_subscriptions (agency_id, plan_id, promoter_count, amount_due) VALUES ($1,$2,$3,$4) RETURNING *',
        [agency_id, plan_id, count, amount]
      );
    } else {
      sub = await query(
        'UPDATE agency_subscriptions SET plan_id=$1, promoter_count=$2, amount_due=$3, updated_at=NOW() WHERE agency_id=$4 RETURNING *',
        [plan_id, count, amount, agency_id]
      );
    }

    res.json(sub.rows[0]);
  } catch (err) { logError('billing.assign_plan', err); res.status(500).json({ error: 'Erro' }); }
});

export default router;
