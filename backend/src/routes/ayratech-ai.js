// Ayratech Global AI Config (Superadmin only)
// Used for cross-organization features like promoter document validation.

import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'whatsale-email-key-32chars!!';

function encrypt(text) {
  if (!text) return null;
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

export function decrypt(encrypted) {
  if (!encrypted) return null;
  try {
    const [ivHex, enc] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return null;
  }
}

async function requireSuperadmin(req, res, next) {
  try {
    const r = await query('SELECT is_superadmin FROM users WHERE id = $1', [req.userId]);
    if (!r.rows[0]?.is_superadmin) return res.status(403).json({ error: 'Acesso negado' });
    next();
  } catch (e) {
    res.status(500).json({ error: 'Erro' });
  }
}

async function ensureSettings() {
  await query(`CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

// Load config used by other backend modules
export async function loadDocValidationConfig() {
  await ensureSettings();
  const r = await query(`SELECT value FROM system_settings WHERE key = 'doc_validation_ai'`);
  if (!r.rows[0]?.value) return null;
  try {
    const cfg = JSON.parse(r.rows[0].value);
    return {
      provider: cfg.provider,
      model: cfg.model,
      apiKey: decrypt(cfg.api_key_encrypted),
      enabled: cfg.enabled !== false,
    };
  } catch {
    return null;
  }
}

router.get('/config', requireSuperadmin, async (req, res) => {
  try {
    await ensureSettings();
    const r = await query(`SELECT value, updated_at FROM system_settings WHERE key = 'doc_validation_ai'`);
    if (!r.rows[0]?.value) {
      return res.json({ provider: 'openai', model: 'gpt-4o', enabled: true, has_key: false });
    }
    const cfg = JSON.parse(r.rows[0].value);
    res.json({
      provider: cfg.provider || 'openai',
      model: cfg.model || 'gpt-4o',
      enabled: cfg.enabled !== false,
      has_key: !!cfg.api_key_encrypted,
      updated_at: r.rows[0].updated_at,
    });
  } catch (e) {
    console.error('get ai config', e);
    res.status(500).json({ error: 'Erro ao carregar configuração' });
  }
});

router.put('/config', requireSuperadmin, async (req, res) => {
  try {
    await ensureSettings();
    const { provider, model, api_key, enabled } = req.body;
    if (!provider || !model) return res.status(400).json({ error: 'provider/model obrigatórios' });

    const existing = await query(`SELECT value FROM system_settings WHERE key = 'doc_validation_ai'`);
    let existingKey = null;
    if (existing.rows[0]?.value) {
      try { existingKey = JSON.parse(existing.rows[0].value).api_key_encrypted; } catch {}
    }

    const value = JSON.stringify({
      provider,
      model,
      api_key_encrypted: api_key ? encrypt(api_key) : existingKey,
      enabled: enabled !== false,
    });

    if (existing.rows.length > 0) {
      await query(
        `UPDATE system_settings SET value=$1, updated_by=$2, updated_at=NOW() WHERE key='doc_validation_ai'`,
        [value, req.userId]
      );
    } else {
      await query(
        `INSERT INTO system_settings (key, value, updated_by) VALUES ('doc_validation_ai', $1, $2)`,
        [value, req.userId]
      );
    }
    res.json({ success: true });
  } catch (e) {
    console.error('save ai config', e);
    res.status(500).json({ error: 'Erro ao salvar' });
  }
});

router.post('/test', requireSuperadmin, async (req, res) => {
  try {
    const cfg = await loadDocValidationConfig();
    if (!cfg?.apiKey) return res.status(400).json({ error: 'Chave de API não configurada' });

    let url, headers, body;
    if (cfg.provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
      body = { model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 };
    } else if (cfg.provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 5 } };
    } else if (cfg.provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers = { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
      body = { model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 };
    } else {
      return res.status(400).json({ error: 'Provedor não suportado' });
    }

    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) {
      const t = await r.text();
      return res.status(400).json({ error: `Falha: ${r.status}`, detail: t.slice(0, 300) });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
