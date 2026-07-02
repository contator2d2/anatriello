import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';
import {
  COLAB_CAPABILITIES,
  CAPABILITY_KEYS,
  ensureAppTemplatesSchema,
  seedDefaultTemplates,
} from '../lib/colab-capabilities.js';

const router = express.Router();
router.use(authenticate);

async function getUserOrgId(userId) {
  const r = await query(
    `SELECT organization_id FROM organization_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.organization_id || null;
}

// Catálogo (para popular o editor)
router.get('/capabilities', (_req, res) => {
  res.json(COLAB_CAPABILITIES);
});

// Listar templates da org (com contagem de colaboradores vinculados)
router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || await getUserOrgId(req.userId);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
    await ensureAppTemplatesSchema(query);
    await seedDefaultTemplates(query, orgId).catch(() => {});

    const r = await query(
      `SELECT t.id, t.name, t.description, t.is_default, t.created_at, t.updated_at,
              COALESCE(
                (SELECT array_agg(c.capability) FROM app_access_template_caps c WHERE c.template_id = t.id),
                ARRAY[]::text[]
              ) AS capabilities,
              (SELECT COUNT(*)::int FROM employees e WHERE e.app_access_template_id = t.id) AS employees_count
         FROM app_access_templates t
        WHERE t.organization_id = $1
        ORDER BY t.is_default DESC, t.name ASC`,
      [orgId]
    );
    res.json(r.rows);
  } catch (err) {
    logError('app-templates.list', err);
    res.status(500).json({ error: err.message });
  }
});

// Criar novo template
router.post('/', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || await getUserOrgId(req.userId);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
    await ensureAppTemplatesSchema(query);

    const { name, description, capabilities = [], is_default = false } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    if (is_default) {
      await query(`UPDATE app_access_templates SET is_default = false WHERE organization_id = $1`, [orgId]);
    }

    const inserted = await query(
      `INSERT INTO app_access_templates (organization_id, name, description, is_default)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, String(name).trim(), description || null, !!is_default]
    );
    const id = inserted.rows[0].id;
    const validCaps = (capabilities || []).filter(c => CAPABILITY_KEYS.includes(c));
    for (const cap of validCaps) {
      await query(
        `INSERT INTO app_access_template_caps (template_id, capability) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, cap]
      );
    }
    res.json({ ok: true, id });
  } catch (err) {
    logError('app-templates.create', err);
    res.status(500).json({ error: err.message });
  }
});

// Atualizar template
router.put('/:id', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || await getUserOrgId(req.userId);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
    await ensureAppTemplatesSchema(query);

    const { name, description, capabilities, is_default } = req.body || {};
    const owns = await query(
      `SELECT id FROM app_access_templates WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!owns.rows[0]) return res.status(404).json({ error: 'Template não encontrado' });

    if (is_default === true) {
      await query(`UPDATE app_access_templates SET is_default = false WHERE organization_id = $1`, [orgId]);
    }

    await query(
      `UPDATE app_access_templates
         SET name = COALESCE($2, name),
             description = COALESCE($3, description),
             is_default = COALESCE($4, is_default),
             updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, name ?? null, description ?? null, typeof is_default === 'boolean' ? is_default : null]
    );

    if (Array.isArray(capabilities)) {
      const validCaps = capabilities.filter(c => CAPABILITY_KEYS.includes(c));
      await query(`DELETE FROM app_access_template_caps WHERE template_id = $1`, [req.params.id]);
      for (const cap of validCaps) {
        await query(
          `INSERT INTO app_access_template_caps (template_id, capability) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.params.id, cap]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logError('app-templates.update', err);
    res.status(500).json({ error: err.message });
  }
});

// Deletar (desliga vínculo dos colaboradores primeiro)
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || await getUserOrgId(req.userId);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
    await ensureAppTemplatesSchema(query);

    const owns = await query(
      `SELECT id FROM app_access_templates WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );
    if (!owns.rows[0]) return res.status(404).json({ error: 'Template não encontrado' });

    await query(`UPDATE employees SET app_access_template_id = NULL WHERE app_access_template_id = $1`, [req.params.id]);
    await query(`DELETE FROM app_access_templates WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    logError('app-templates.delete', err);
    res.status(500).json({ error: err.message });
  }
});

// Vincular colaborador a um template (ou desvincular passando null)
router.put('/assign/:employeeId', async (req, res) => {
  try {
    const orgId = req.user?.organization_id || await getUserOrgId(req.userId);
    if (!orgId) return res.status(400).json({ error: 'Organização não identificada' });
    await ensureAppTemplatesSchema(query);

    const { template_id } = req.body || {};
    if (template_id) {
      const owns = await query(
        `SELECT id FROM app_access_templates WHERE id = $1 AND organization_id = $2`,
        [template_id, orgId]
      );
      if (!owns.rows[0]) return res.status(404).json({ error: 'Template não encontrado' });
    }
    await query(
      `UPDATE employees SET app_access_template_id = $2, updated_at = NOW()
        WHERE id = $1 AND organization_id = $3`,
      [req.params.employeeId, template_id || null, orgId]
    );
    res.json({ ok: true });
  } catch (err) {
    logError('app-templates.assign', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
