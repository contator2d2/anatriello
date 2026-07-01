import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

let appLogsReady = false;

async function ensureAppLogsTable() {
  if (appLogsReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS app_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      user_email TEXT,
      level VARCHAR(20) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      context JSONB DEFAULT '{}'::jsonb,
      page_url TEXT,
      device_info JSONB DEFAULT '{}'::jsonb,
      stack_trace TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_app_logs_created ON app_logs(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_app_logs_org_created ON app_logs(organization_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level)`);

  appLogsReady = true;
}

async function getUserOrgId(userId) {
  if (!userId) return null;
  const result = await query(
    `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.organization_id || null;
}

async function isSuperadmin(userId) {
  if (!userId) return false;
  const result = await query(`SELECT is_superadmin FROM users WHERE id = $1`, [userId]);
  return !!result.rows[0]?.is_superadmin;
}

function decodeOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;

  try {
    return jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function sanitizeJson(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return value;
}

router.post('/', async (req, res) => {
  try {
    await ensureAppLogsTable();

    const decoded = decodeOptionalUser(req);
    const userId = decoded?.userId || null;
    const organizationId = userId ? await getUserOrgId(userId) : null;
    const body = req.body || {};
    const allowedLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
    const level = allowedLevels.has(body.level) ? body.level : 'info';
    const message = String(body.message || '').trim().slice(0, 2000);

    if (!message) {
      return res.status(400).json({ error: 'Mensagem obrigatória' });
    }

    await query(
      `INSERT INTO app_logs (
        organization_id, user_id, user_email, level, message, context, page_url, device_info, stack_trace
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        organizationId,
        userId,
        String(body.user_email || decoded?.email || '').slice(0, 180) || null,
        level,
        message,
        sanitizeJson(body.context),
        String(body.page_url || '').slice(0, 1000) || null,
        sanitizeJson(body.device_info),
        String(body.stack_trace || '').slice(0, 6000) || null,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[app-logs] insert error:', error.message);
    res.status(500).json({ error: 'Erro ao registrar log' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    await ensureAppLogsTable();

    const level = String(req.query.level || 'all');
    const search = String(req.query.search || '').trim();
    const params = [];
    const where = [];

    if (!(await isSuperadmin(req.userId))) {
      params.push(await getUserOrgId(req.userId));
      where.push(`organization_id = $${params.length}`);
    }

    if (level !== 'all') {
      params.push(level);
      where.push(`level = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(message ILIKE $${params.length} OR user_email ILIKE $${params.length})`);
    }

    const result = await query(
      `SELECT * FROM app_logs
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[app-logs] list error:', error.message);
    res.status(500).json({ error: 'Erro ao listar logs' });
  }
});

export default router;