// Promoter Document Validation - AI-driven cross-checking
// Validates CNH, Contract, Address, CTPS, Selfie vs agency registration data.

import express from 'express';
import pdfParse from 'pdf-parse';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { loadDocValidationConfig } from './ayratech-ai.js';
import * as whatsappProvider from '../lib/whatsapp-provider.js';

const router = express.Router();

// === Audit + notifications helpers ===
async function ensureAuditTables() {
  await query(`CREATE TABLE IF NOT EXISTS promoter_validation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id UUID NOT NULL,
    agency_promoter_id UUID,
    rede_id UUID,
    supermarket_unit_id UUID,
    event_type VARCHAR(40) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    actor_id UUID,
    actor_name VARCHAR(255),
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pva_validation ON promoter_validation_audit(validation_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pva_unit ON promoter_validation_audit(supermarket_unit_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pva_rede ON promoter_validation_audit(rede_id, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS promoter_validation_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id UUID NOT NULL,
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
  await query(`CREATE INDEX IF NOT EXISTS idx_pvn_validation ON promoter_validation_notifications(validation_id, created_at DESC)`);
}

async function logAudit({ validationId, promoterId, redeId, unitId, eventType, actorType, actorId, actorName, fromStatus, toStatus, reason, metadata }) {
  try {
    await ensureAuditTables();
    await query(
      `INSERT INTO promoter_validation_audit
        (validation_id, agency_promoter_id, rede_id, supermarket_unit_id, event_type, actor_type, actor_id, actor_name, from_status, to_status, reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [validationId, promoterId || null, redeId || null, unitId || null, eventType, actorType, actorId || null, actorName || null, fromStatus || null, toStatus || null, reason || null, JSON.stringify(metadata || {})]
    );
  } catch (e) { console.error('[promoter-validations] audit log error', e); }
}

async function getActiveConnection(organizationId) {
  try {
    const r = await query(
      `SELECT * FROM connections WHERE organization_id = $1 AND status = 'connected' ORDER BY created_at ASC LIMIT 1`,
      [organizationId]
    );
    return r.rows[0] || null;
  } catch { return null; }
}

function formatValidationMessage({ promoter, validation, status, reason, actorName }) {
  const statusLabel = {
    approved: '✅ APROVADO', rejected: '❌ REJEITADO', divergent: '⚠️ DIVERGENTE',
    pre_approved: '🟡 PRÉ-APROVADO', analyzing: '🔍 EM ANÁLISE', failed: '⚠️ FALHOU',
  }[status] || status;
  const score = validation?.score != null ? `\n📊 Score IA: ${Math.round(Number(validation.score))}` : '';
  const by = actorName ? `\n👤 Decisão por: ${actorName}` : '';
  const why = reason ? `\n📝 Motivo: ${reason}` : '';
  return `🛡️ *Ayratech Access - Validação de Promotor*\n\n` +
    `👤 *Promotor:* ${promoter?.name || '-'}\n` +
    `📋 *CPF:* ${promoter?.cpf || '-'}\n` +
    `🏢 *Agência:* ${promoter?.agency_name || '-'}\n\n` +
    `*Status:* ${statusLabel}${score}${by}${why}`;
}

async function dispatchNotifications({ validationId, organizationId, redeId, unitId, eventType, promoter, validation, reason, actorName }) {
  try {
    await ensureAuditTables();
    const targets = [];
    if (unitId) {
      const u = await query(
        `SELECT notify_enabled, notify_events, notify_whatsapp, notify_emails
         FROM supermarket_units WHERE id = $1`,
        [unitId]
      ).catch(() => ({ rows: [] }));
      const row = u.rows[0];
      if (row?.notify_enabled && Array.isArray(row.notify_events) && row.notify_events.includes(eventType)) {
        (row.notify_whatsapp || []).forEach(p => targets.push({ channel: 'whatsapp', target: p }));
        (row.notify_emails || []).forEach(e => targets.push({ channel: 'email', target: e }));
      }
    }
    if (redeId && targets.length === 0) {
      const r = await query(
        `SELECT notify_enabled, notify_events, notify_whatsapp, notify_emails
         FROM merch_redes WHERE id = $1`,
        [redeId]
      ).catch(() => ({ rows: [] }));
      const row = r.rows[0];
      if (row?.notify_enabled && Array.isArray(row.notify_events) && row.notify_events.includes(eventType)) {
        (row.notify_whatsapp || []).forEach(p => targets.push({ channel: 'whatsapp', target: p }));
        (row.notify_emails || []).forEach(e => targets.push({ channel: 'email', target: e }));
      }
    }
    if (!targets.length) return;

    const message = formatValidationMessage({ promoter, validation, status: eventType, reason, actorName });
    const connection = organizationId ? await getActiveConnection(organizationId) : null;

    for (const t of targets) {
      const ins = await query(
        `INSERT INTO promoter_validation_notifications
          (validation_id, organization_id, channel, target, event_type, payload)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [validationId, organizationId || null, t.channel, t.target, eventType, JSON.stringify({ message, reason })]
      );
      const notifId = ins.rows[0].id;
      if (t.channel === 'whatsapp' && connection) {
        try {
          await whatsappProvider.sendMessage(connection, t.target, message, 'text', null);
          await query(`UPDATE promoter_validation_notifications SET dispatched=true, dispatched_at=NOW() WHERE id=$1`, [notifId]);
        } catch (e) {
          await query(`UPDATE promoter_validation_notifications SET error=$1 WHERE id=$2`, [String(e.message || e).slice(0, 300), notifId]);
        }
      }
    }
  } catch (e) {
    console.error('[promoter-validations] dispatch notifications error', e);
  }
}

router.use(authenticate);

// Document categories supported
export const DOC_CATEGORIES = ['cnh', 'contrato_trabalho', 'comprovante_endereco', 'ctps', 'selfie'];

async function ensureTables() {
  await query(`CREATE TABLE IF NOT EXISTS promoter_document_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_promoter_id UUID NOT NULL REFERENCES agency_promoters(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    rede_id UUID,
    supermarket_unit_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    score NUMERIC(5,2) DEFAULT 0,
    divergences JSONB DEFAULT '[]',
    extracted_data JSONB DEFAULT '{}',
    recommendation VARCHAR(20),
    documents_analyzed JSONB DEFAULT '[]',
    ai_provider VARCHAR(20),
    ai_model VARCHAR(100),
    ai_raw_response TEXT,
    auto_applied BOOLEAN DEFAULT false,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    override_status VARCHAR(20),
    override_reason TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pdv_promoter ON promoter_document_validations(agency_promoter_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pdv_status ON promoter_document_validations(status)`);

  // Add columns to merch_redes for requirements + approval mode + notifications
  await query(`ALTER TABLE merch_redes
    ADD COLUMN IF NOT EXISTS doc_validation_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS facial_required BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_approve_on_match BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS auto_approve_min_score NUMERIC(5,2) DEFAULT 95,
    ADD COLUMN IF NOT EXISTS required_documents_freelance JSONB,
    ADD COLUMN IF NOT EXISTS required_documents_substituto JSONB,
    ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(20) DEFAULT 'ai',
    ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS notify_events JSONB DEFAULT '["approved","rejected","divergent"]'::jsonb,
    ADD COLUMN IF NOT EXISTS notify_whatsapp JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS notify_emails JSONB DEFAULT '[]'::jsonb`);

  // Per-PDV config on supermarket_units (overrides rede)
  await query(`ALTER TABLE supermarket_units
    ADD COLUMN IF NOT EXISTS doc_validation_enabled BOOLEAN,
    ADD COLUMN IF NOT EXISTS required_documents JSONB,
    ADD COLUMN IF NOT EXISTS facial_required BOOLEAN,
    ADD COLUMN IF NOT EXISTS auto_approve_on_match BOOLEAN,
    ADD COLUMN IF NOT EXISTS auto_approve_min_score NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS required_documents_freelance JSONB,
    ADD COLUMN IF NOT EXISTS required_documents_substituto JSONB,
    ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN,
    ADD COLUMN IF NOT EXISTS notify_events JSONB,
    ADD COLUMN IF NOT EXISTS notify_whatsapp JSONB,
    ADD COLUMN IF NOT EXISTS notify_emails JSONB`).catch(() => {});

  // Promoter type column for downstream selection
  await query(`ALTER TABLE agency_promoters
    ADD COLUMN IF NOT EXISTS promoter_type VARCHAR(20) DEFAULT 'fixo'`).catch(() => {});

  await ensureAuditTables();
}

// Defaults per promoter type
const DEFAULT_DOCS_BY_TYPE = {
  fixo: DOC_CATEGORIES,
  freelance: ['cnh', 'selfie'],
  substituto: ['cnh', 'selfie'],
};

function pickDocsForType(row, promoterType) {
  if (promoterType === 'freelance' && Array.isArray(row?.required_documents_freelance)) return row.required_documents_freelance;
  if (promoterType === 'substituto' && Array.isArray(row?.required_documents_substituto)) return row.required_documents_substituto;
  if (Array.isArray(row?.required_documents)) return row.required_documents;
  return null;
}

// Resolve requirements for a rede
async function loadRedeRequirements(redeId, promoterType) {
  if (!redeId) return null;
  const r = await query(
    `SELECT id, doc_validation_enabled, required_documents, required_documents_freelance, required_documents_substituto,
            facial_required, auto_approve_on_match, auto_approve_min_score, approval_mode
     FROM merch_redes WHERE id = $1`,
    [redeId]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  const docs = pickDocsForType(row, promoterType);
  return {
    enabled: !!row.doc_validation_enabled,
    requiredDocs: docs ?? [],
    facialRequired: !!row.facial_required,
    autoApprove: row.auto_approve_on_match !== false,
    autoApproveMinScore: Number(row.auto_approve_min_score ?? 95),
    approvalMode: row.approval_mode || 'ai',
  };
}

async function loadUnitRequirements(unitId, promoterType) {
  if (!unitId) return null;
  try {
    const r = await query(
      `SELECT doc_validation_enabled, required_documents, required_documents_freelance, required_documents_substituto,
              facial_required, auto_approve_on_match, auto_approve_min_score, approval_mode
       FROM supermarket_units WHERE id = $1`,
      [unitId]
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    const out = {};
    if (row.doc_validation_enabled !== null) out.enabled = !!row.doc_validation_enabled;
    const docs = pickDocsForType(row, promoterType);
    if (docs) out.requiredDocs = docs;
    if (row.facial_required !== null) out.facialRequired = !!row.facial_required;
    if (row.auto_approve_on_match !== null) out.autoApprove = !!row.auto_approve_on_match;
    if (row.auto_approve_min_score !== null) out.autoApproveMinScore = Number(row.auto_approve_min_score);
    if (row.approval_mode) out.approvalMode = row.approval_mode;
    return out;
  } catch { return null; }
}

// Merge: defaults < rede < unit (all aware of promoter type)
async function loadValidationRequirements(redeId, unitId, promoterType = 'fixo') {
  const defaults = {
    enabled: true,
    requiredDocs: DEFAULT_DOCS_BY_TYPE[promoterType] || DOC_CATEGORIES,
    facialRequired: false,
    autoApprove: true,
    autoApproveMinScore: 95,
    approvalMode: 'ai',
  };
  const rede = (await loadRedeRequirements(redeId, promoterType)) || {};
  const unit = (await loadUnitRequirements(unitId, promoterType)) || {};
  return { ...defaults, ...rede, ...unit };
}




async function loadPromoter(agencyPromoterId) {
  const r = await query(
    `SELECT ap.*, a.name as agency_name, a.cnpj as agency_cnpj, a.organization_id
     FROM agency_promoters ap
     LEFT JOIN agencies a ON a.id = ap.agency_id
     WHERE ap.id = $1`,
    [agencyPromoterId]
  );
  return r.rows[0] || null;
}

async function loadPromoterDocuments(agencyPromoterId) {
  // Ensure document URL columns exist on agency_promoters
  try {
    await query(`ALTER TABLE agency_promoters
      ADD COLUMN IF NOT EXISTS cnh_url TEXT,
      ADD COLUMN IF NOT EXISTS contrato_url TEXT,
      ADD COLUMN IF NOT EXISTS comprovante_endereco_url TEXT,
      ADD COLUMN IF NOT EXISTS ctps_url TEXT,
      ADD COLUMN IF NOT EXISTS selfie_url TEXT`);
  } catch {}

  // 1) Try optional table promotor_documents
  try {
    const r = await query(
      `SELECT id, category, title, file_url, created_at
       FROM promotor_documents
       WHERE agency_promoter_id = $1 AND file_url IS NOT NULL
       ORDER BY created_at DESC`,
      [agencyPromoterId]
    );
    if (r.rows.length) return r.rows;
  } catch {}

  // 2) Fallback: read from agency_promoters columns
  try {
    const r = await query(
      `SELECT id, cnh_url, contrato_url, comprovante_endereco_url, ctps_url, selfie_url, photo_url, document_url
       FROM agency_promoters WHERE id = $1`,
      [agencyPromoterId]
    );
    const row = r.rows[0];
    if (!row) return [];
    const map = [
      ['cnh', row.cnh_url || row.document_url],
      ['contrato_trabalho', row.contrato_url],
      ['comprovante_endereco', row.comprovante_endereco_url],
      ['ctps', row.ctps_url],
      ['selfie', row.selfie_url || row.photo_url],
    ];
    return map
      .filter(([, url]) => !!url)
      .map(([category, file_url], i) => ({ id: `${row.id}-${category}-${i}`, category, title: category, file_url, created_at: new Date() }));
  } catch {
    return [];
  }
}

function buildPrompt(promoter, documents, requirements) {
  const cadastro = {
    nome_cadastro: promoter.name,
    cpf_cadastro: promoter.cpf,
    telefone: promoter.phone,
    agencia: promoter.agency_name,
    cnpj_agencia: promoter.agency_cnpj,
  };

  return `Você é um auditor de documentos trabalhistas brasileiros. Analise os documentos abaixo de um promotor de vendas e cruze TODOS os dados.

CADASTRO INFORMADO PELA AGÊNCIA:
${JSON.stringify(cadastro, null, 2)}

DOCUMENTOS A VALIDAR (categorias exigidas: ${requirements.requiredDocs.join(', ') || 'todas'}):
${documents.map(d => `- [${d.category}] ${d.title || d.category}: ${d.file_url}`).join('\n')}

RETORNE EXCLUSIVAMENTE JSON no formato:
{
  "extracted": {
    "cnh": { "nome": "...", "cpf": "...", "rg": "...", "validade": "...", "categoria": "..." },
    "contrato_trabalho": { "nome_funcionario": "...", "cpf": "...", "nome_empresa": "...", "cnpj_empresa": "...", "cargo": "...", "data_admissao": "..." },
    "comprovante_endereco": { "nome": "...", "endereco": "...", "cidade": "...", "uf": "...", "cep": "..." },
    "ctps": { "nome": "...", "cpf": "...", "numero": "...", "serie": "..." }
  },
  "divergences": [
    { "field": "cpf", "sources": ["cnh","contrato_trabalho"], "values": ["111.111.111-11","222.222.222-22"], "severity": "critical|warning|info", "message": "..." }
  ],
  "score": 0-100,
  "recommendation": "approve" | "review" | "reject",
  "summary": "explicação curta em português"
}

REGRAS:
- score 100 = nenhuma divergência. score < 70 = recomenda recusa.
- Cruze CPF e nome entre TODOS os documentos e o cadastro da agência.
- Confira se o nome da empresa no contrato == nome da agência informado.
- Se documento exigido estiver ausente, considere divergence critical.
- Retorne SOMENTE o JSON, sem texto antes ou depois.`;
}

// Fetch a doc URL once and classify by mime
async function fetchDoc(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const mime = (resp.headers.get('content-type') || '').toLowerCase();
    const isPdf = mime.includes('pdf') || /\.pdf(\?|$)/i.test(url);
    return { buf, mime: mime || (isPdf ? 'application/pdf' : 'image/jpeg'), isPdf };
  } catch { return null; }
}

async function pdfToText(buf) {
  try {
    const data = await pdfParse(buf, { max: 5 });
    return (data.text || '').slice(0, 6000);
  } catch { return ''; }
}

async function callOpenAIVision(cfg, prompt, documents) {
  const content = [{ type: 'text', text: prompt }];
  const pdfTexts = [];
  for (const d of documents.slice(0, 8)) {
    const doc = await fetchDoc(d.file_url);
    if (!doc) continue;
    if (doc.isPdf) {
      const text = await pdfToText(doc.buf);
      if (text) pdfTexts.push(`\n--- TEXTO DO PDF [${d.category}] ${d.title || ''} ---\n${text}`);
    } else {
      const b64 = doc.buf.toString('base64');
      content.push({ type: 'image_url', image_url: { url: `data:${doc.mime};base64,${b64}` } });
    }
  }
  if (pdfTexts.length) content[0].text += '\n\n' + pdfTexts.join('\n');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '{}';
}

async function callGeminiVision(cfg, prompt, documents) {
  const parts = [{ text: prompt }];
  for (const d of documents.slice(0, 8)) {
    const doc = await fetchDoc(d.file_url);
    if (!doc) continue;
    parts.push({ inline_data: { mime_type: doc.isPdf ? 'application/pdf' : doc.mime, data: doc.buf.toString('base64') } });
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2000, temperature: 0.1 },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '{}';
}

async function runAIValidation(cfg, prompt, documents) {
  if (cfg.provider === 'openai' || cfg.provider === 'openrouter') {
    return callOpenAIVision(cfg, prompt, documents);
  }
  if (cfg.provider === 'gemini') {
    return callGeminiVision(cfg, prompt, documents);
  }
  throw new Error('Provedor não suportado');
}

// === ROUTES ===

// List validations
router.get('/', async (req, res) => {
  try {
    await ensureTables();
    const { agency_promoter_id, status, limit = 50 } = req.query;
    const where = [];
    const params = [];
    if (agency_promoter_id) { params.push(agency_promoter_id); where.push(`agency_promoter_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    const sql = `SELECT v.*, ap.name as promoter_name, ap.cpf as promoter_cpf
                 FROM promoter_document_validations v
                 LEFT JOIN agency_promoters ap ON ap.id = v.agency_promoter_id
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY v.created_at DESC LIMIT ${parseInt(limit, 10) || 50}`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) {
    console.error('list validations', e);
    res.status(500).json({ error: 'Erro ao listar validações' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureTables();
    const r = await query(
      `SELECT v.*, ap.name as promoter_name, ap.cpf as promoter_cpf
       FROM promoter_document_validations v
       LEFT JOIN agency_promoters ap ON ap.id = v.agency_promoter_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Erro' });
  }
});

// Core: start a validation and return its id. Used by HTTP route and by auto-triggers.
export async function triggerValidation({ agency_promoter_id, rede_id, supermarket_unit_id, actor = {} }) {
  await ensureTables();
  if (!agency_promoter_id) throw new Error('agency_promoter_id obrigatório');

  const promoter = await loadPromoter(agency_promoter_id);
  if (!promoter) throw new Error('Promotor não encontrado');

  const requirements = await loadValidationRequirements(rede_id, supermarket_unit_id, promoter.promoter_type || 'fixo');
  if (!requirements.enabled) throw new Error('Validação desativada para esta rede/PDV');

  const allDocs = await loadPromoterDocuments(agency_promoter_id);
  const relevantDocs = allDocs.filter(d => requirements.requiredDocs.length === 0 || requirements.requiredDocs.includes(d.category));

  // Manual mode: skip AI, just open a pending request for human review
  if (requirements.approvalMode === 'manual') {
    const insertR = await query(
      `INSERT INTO promoter_document_validations
        (agency_promoter_id, organization_id, rede_id, supermarket_unit_id, status, documents_analyzed)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id`,
      [
        agency_promoter_id, promoter.organization_id, rede_id || null, supermarket_unit_id || null,
        JSON.stringify(relevantDocs.map(d => ({ id: d.id, category: d.category, title: d.title }))),
      ]
    );
    const validationId = insertR.rows[0].id;
    await logAudit({
      validationId, promoterId: agency_promoter_id, redeId: rede_id, unitId: supermarket_unit_id,
      eventType: 'created', actorType: actor.type || 'system', actorId: actor.id, actorName: actor.name,
      toStatus: 'pending', metadata: { approval_mode: 'manual' },
    });
    return { id: validationId, status: 'pending', approval_mode: 'manual' };
  }

  // AI / hybrid mode: run AI
  const cfg = await loadDocValidationConfig();
  if (!cfg?.apiKey || !cfg.enabled) throw new Error('IA Ayratech não configurada');

  const insertR = await query(
    `INSERT INTO promoter_document_validations
      (agency_promoter_id, organization_id, rede_id, supermarket_unit_id, status,
       ai_provider, ai_model, documents_analyzed)
     VALUES ($1, $2, $3, $4, 'analyzing', $5, $6, $7) RETURNING id`,
    [
      agency_promoter_id, promoter.organization_id, rede_id || null, supermarket_unit_id || null,
      cfg.provider, cfg.model,
      JSON.stringify(relevantDocs.map(d => ({ id: d.id, category: d.category, title: d.title }))),
    ]
  );
  const validationId = insertR.rows[0].id;

  await logAudit({
    validationId, promoterId: agency_promoter_id, redeId: rede_id, unitId: supermarket_unit_id,
    eventType: 'created', actorType: actor.type || 'system', actorId: actor.id, actorName: actor.name,
    toStatus: 'analyzing', metadata: { approval_mode: requirements.approvalMode, ai_provider: cfg.provider, ai_model: cfg.model },
  });

  processValidation(validationId, cfg, promoter, relevantDocs, requirements, { rede_id, supermarket_unit_id }).catch(err => {
    console.error('[promoter-validations] processValidation error', err);
    query(
      `UPDATE promoter_document_validations SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
      [String(err.message || err).slice(0, 500), validationId]
    ).catch(() => {});
    logAudit({
      validationId, promoterId: agency_promoter_id, redeId: rede_id, unitId: supermarket_unit_id,
      eventType: 'failed', actorType: 'system', toStatus: 'failed', reason: String(err.message || err).slice(0, 300),
    });
  });
  return { id: validationId, status: 'analyzing', approval_mode: requirements.approvalMode };
}

// Trigger validation (HTTP)
router.post('/run', async (req, res) => {
  try {
    const result = await triggerValidation({
      ...(req.body || {}),
      actor: { type: 'admin', id: req.userId, name: req.user?.name },
    });
    res.json(result);
  } catch (e) {
    console.error('run validation', e);
    res.status(400).json({ error: e.message || 'Erro ao iniciar validação' });
  }
});

async function processValidation(validationId, cfg, promoter, documents, requirements, ctx = {}) {
  const prompt = buildPrompt(promoter, documents, requirements);
  const docs = documents.filter(d => d.file_url);
  const raw = await runAIValidation(cfg, prompt, docs);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = { score: 0, divergences: [{ message: 'Resposta inválida da IA' }], recommendation: 'review' }; }

  const score = Number(parsed.score ?? 0);
  const divergences = Array.isArray(parsed.divergences) ? parsed.divergences : [];
  const criticalCount = divergences.filter(d => d.severity === 'critical').length;
  let status;
  if (parsed.recommendation === 'reject' || score < 60) status = 'rejected';
  else if (parsed.recommendation === 'approve' && criticalCount === 0 && score >= requirements.autoApproveMinScore) status = 'approved';
  else if (criticalCount > 0) status = 'divergent';
  else status = 'pre_approved';

  // In hybrid mode, AI never finalizes — always sends to human review
  if (requirements.approvalMode === 'hybrid' && status === 'approved') {
    status = 'pre_approved';
  }

  const autoApplied = requirements.approvalMode === 'ai' && requirements.autoApprove && status === 'approved';

  await query(
    `UPDATE promoter_document_validations SET
       status=$1, score=$2, divergences=$3, extracted_data=$4,
       recommendation=$5, ai_raw_response=$6, auto_applied=$7,
       validated_at=NOW(), updated_at=NOW()
     WHERE id=$8`,
    [status, score, JSON.stringify(divergences), JSON.stringify(parsed.extracted || {}),
     parsed.recommendation || null, raw.slice(0, 10000), autoApplied, validationId]
  );

  await logAudit({
    validationId, promoterId: promoter.id, redeId: ctx.rede_id, unitId: ctx.supermarket_unit_id,
    eventType: 'ai_completed', actorType: 'ai', actorName: `${cfg.provider}/${cfg.model}`,
    fromStatus: 'analyzing', toStatus: status, reason: parsed.summary || parsed.recommendation,
    metadata: { score, divergences_count: divergences.length, critical_count: criticalCount, auto_applied: autoApplied },
  });

  if (autoApplied) {
    try { await query(`UPDATE agency_promoters SET status='active', updated_at=NOW() WHERE id=$1`, [promoter.id]); }
    catch (e) { console.error('auto-apply failed', e); }
  }

  await dispatchNotifications({
    validationId, organizationId: promoter.organization_id, redeId: ctx.rede_id, unitId: ctx.supermarket_unit_id,
    eventType: status, promoter, validation: { score }, reason: parsed.summary, actorName: `IA (${cfg.provider})`,
  });
}


// Manual override (approve/reject) — shared helper used by admin + portals
async function applyReview({ validationId, decision, reason, actor }) {
  const cur = await query(`SELECT * FROM promoter_document_validations WHERE id = $1`, [validationId]);
  if (!cur.rows[0]) throw new Error('Validação não encontrada');
  const v = cur.rows[0];
  await query(
    `UPDATE promoter_document_validations
     SET override_status=$1, override_reason=$2, reviewed_by=$3, reviewed_at=NOW(),
         status=$1, updated_at=NOW()
     WHERE id=$4`,
    [decision, reason || null, actor?.id || null, validationId]
  );
  if (decision === 'approved') {
    try { await query(`UPDATE agency_promoters SET status='active', updated_at=NOW() WHERE id=$1`, [v.agency_promoter_id]); } catch {}
  } else if (decision === 'rejected') {
    try { await query(`UPDATE agency_promoters SET status='blocked', updated_at=NOW() WHERE id=$1`, [v.agency_promoter_id]); } catch {}
  }
  const promoter = await loadPromoter(v.agency_promoter_id);
  await logAudit({
    validationId, promoterId: v.agency_promoter_id, redeId: v.rede_id, unitId: v.supermarket_unit_id,
    eventType: decision === 'approved' ? 'manual_approved' : 'manual_rejected',
    actorType: actor?.type || 'admin', actorId: actor?.id, actorName: actor?.name,
    fromStatus: v.status, toStatus: decision, reason,
    metadata: { ai_recommended: v.recommendation, ai_score: Number(v.score || 0), ai_status: v.status },
  });
  await dispatchNotifications({
    validationId, organizationId: promoter?.organization_id, redeId: v.rede_id, unitId: v.supermarket_unit_id,
    eventType: decision, promoter, validation: v, reason, actorName: actor?.name || 'Revisor manual',
  });
}

router.post('/:id/review', async (req, res) => {
  try {
    await ensureTables();
    const { decision, reason } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision deve ser approved ou rejected' });
    }
    await applyReview({
      validationId: req.params.id, decision, reason,
      actor: { type: 'admin', id: req.userId, name: req.user?.name },
    });
    res.json({ success: true });
  } catch (e) {
    console.error('review error', e);
    res.status(500).json({ error: e.message || 'Erro ao revisar' });
  }
});

// Audit trail
router.get('/:id/audit', async (req, res) => {
  try {
    await ensureAuditTables();
    const r = await query(`SELECT * FROM promoter_validation_audit WHERE validation_id = $1 ORDER BY created_at ASC`, [req.params.id]);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Erro' }); }
});

router.get('/:id/notifications', async (req, res) => {
  try {
    await ensureAuditTables();
    const r = await query(`SELECT * FROM promoter_validation_notifications WHERE validation_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Erro' }); }
});

// Compliance metrics (IA vs humano)
router.get('/compliance/metrics', async (req, res) => {
  try {
    await ensureTables();
    const { from, to, rede_id, supermarket_unit_id } = req.query;
    const where = [`1=1`];
    const params = [];
    if (from) { params.push(from); where.push(`v.created_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`v.created_at <= $${params.length}`); }
    if (rede_id) { params.push(rede_id); where.push(`v.rede_id = $${params.length}`); }
    if (supermarket_unit_id) { params.push(supermarket_unit_id); where.push(`v.supermarket_unit_id = $${params.length}`); }
    const wsql = 'WHERE ' + where.join(' AND ');
    const totals = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE v.status='approved')::int AS approved,
         COUNT(*) FILTER (WHERE v.status='rejected')::int AS rejected,
         COUNT(*) FILTER (WHERE v.status='divergent')::int AS divergent,
         COUNT(*) FILTER (WHERE v.status='pre_approved')::int AS pre_approved,
         COUNT(*) FILTER (WHERE v.status='failed')::int AS failed,
         COUNT(*) FILTER (WHERE v.auto_applied=true)::int AS auto_applied,
         COUNT(*) FILTER (WHERE v.override_status IS NOT NULL)::int AS overridden,
         AVG(v.score)::numeric(5,2) AS avg_score
       FROM promoter_document_validations v ${wsql}`, params
    );
    const agreement = await query(
      `SELECT
         COUNT(*) FILTER (WHERE v.override_status IS NOT NULL AND v.recommendation IS NOT NULL)::int AS reviewed_after_ai,
         COUNT(*) FILTER (WHERE v.override_status='approved' AND v.recommendation='approve')::int AS agreed_approve,
         COUNT(*) FILTER (WHERE v.override_status='rejected' AND v.recommendation='reject')::int AS agreed_reject,
         COUNT(*) FILTER (WHERE v.override_status='rejected' AND v.recommendation='approve')::int AS false_positive,
         COUNT(*) FILTER (WHERE v.override_status='approved' AND v.recommendation='reject')::int AS false_negative
       FROM promoter_document_validations v ${wsql}`, params
    );
    const divs = await query(
      `SELECT field, COUNT(*)::int AS count FROM (
         SELECT (d->>'field') AS field
         FROM promoter_document_validations v, jsonb_array_elements(COALESCE(v.divergences,'[]'::jsonb)) d
         ${wsql}
       ) x WHERE field IS NOT NULL GROUP BY field ORDER BY count DESC LIMIT 10`, params
    );
    res.json({ totals: totals.rows[0], agreement: agreement.rows[0], top_divergences: divs.rows });
  } catch (e) { console.error('compliance metrics', e); res.status(500).json({ error: 'Erro' }); }
});

// Rede config
router.get('/rede/:redeId/config', async (req, res) => {
  try {
    await ensureTables();
    const r = await query(
      `SELECT id, name, doc_validation_enabled, required_documents,
              required_documents_freelance, required_documents_substituto,
              facial_required, auto_approve_on_match, auto_approve_min_score,
              approval_mode, notify_enabled, notify_events, notify_whatsapp, notify_emails
       FROM merch_redes WHERE id = $1`, [req.params.redeId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Rede não encontrada' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Erro' }); }
});

router.put('/rede/:redeId/config', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    await query(
      `UPDATE merch_redes SET
        doc_validation_enabled = COALESCE($1, doc_validation_enabled),
        required_documents = COALESCE($2, required_documents),
        required_documents_freelance = COALESCE($3, required_documents_freelance),
        required_documents_substituto = COALESCE($4, required_documents_substituto),
        facial_required = COALESCE($5, facial_required),
        auto_approve_on_match = COALESCE($6, auto_approve_on_match),
        auto_approve_min_score = COALESCE($7, auto_approve_min_score),
        approval_mode = COALESCE($8, approval_mode),
        notify_enabled = COALESCE($9, notify_enabled),
        notify_events = COALESCE($10, notify_events),
        notify_whatsapp = COALESCE($11, notify_whatsapp),
        notify_emails = COALESCE($12, notify_emails),
        updated_at = NOW()
       WHERE id = $13`,
      [
        b.doc_validation_enabled,
        b.required_documents ? JSON.stringify(b.required_documents) : null,
        b.required_documents_freelance ? JSON.stringify(b.required_documents_freelance) : null,
        b.required_documents_substituto ? JSON.stringify(b.required_documents_substituto) : null,
        b.facial_required, b.auto_approve_on_match, b.auto_approve_min_score,
        b.approval_mode || null,
        b.notify_enabled,
        b.notify_events ? JSON.stringify(b.notify_events) : null,
        b.notify_whatsapp ? JSON.stringify(b.notify_whatsapp) : null,
        b.notify_emails ? JSON.stringify(b.notify_emails) : null,
        req.params.redeId,
      ]
    );
    res.json({ success: true });
  } catch (e) { console.error('save rede config', e); res.status(500).json({ error: 'Erro' }); }
});

// Per-PDV config
router.get('/unit/:unitId/config', async (req, res) => {
  try {
    await ensureTables();
    const r = await query(
      `SELECT id, name, doc_validation_enabled, required_documents,
              required_documents_freelance, required_documents_substituto,
              facial_required, auto_approve_on_match, auto_approve_min_score,
              approval_mode, notify_enabled, notify_events, notify_whatsapp, notify_emails
       FROM supermarket_units WHERE id = $1`, [req.params.unitId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'PDV não encontrado' });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Erro' }); }
});

router.put('/unit/:unitId/config', async (req, res) => {
  try {
    await ensureTables();
    const b = req.body || {};
    await query(
      `UPDATE supermarket_units SET
        doc_validation_enabled = $1, required_documents = $2,
        required_documents_freelance = $3, required_documents_substituto = $4,
        facial_required = $5, auto_approve_on_match = $6, auto_approve_min_score = $7,
        approval_mode = $8, notify_enabled = $9, notify_events = $10,
        notify_whatsapp = $11, notify_emails = $12
       WHERE id = $13`,
      [
        b.doc_validation_enabled ?? null,
        b.required_documents ? JSON.stringify(b.required_documents) : null,
        b.required_documents_freelance ? JSON.stringify(b.required_documents_freelance) : null,
        b.required_documents_substituto ? JSON.stringify(b.required_documents_substituto) : null,
        b.facial_required ?? null, b.auto_approve_on_match ?? null, b.auto_approve_min_score ?? null,
        b.approval_mode ?? null, b.notify_enabled ?? null,
        b.notify_events ? JSON.stringify(b.notify_events) : null,
        b.notify_whatsapp ? JSON.stringify(b.notify_whatsapp) : null,
        b.notify_emails ? JSON.stringify(b.notify_emails) : null,
        req.params.unitId,
      ]
    );
    res.json({ success: true });
  } catch (e) { console.error('save unit config', e); res.status(500).json({ error: 'Erro' }); }
});

// Portal: supermarket lists validations of its PDV
router.get('/portal/supermarket', async (req, res) => {
  try {
    await ensureTables();
    const unitId = req.headers['x-supermarket-unit-id'] || req.query.unit_id;
    if (!unitId) return res.status(400).json({ error: 'unit_id obrigatório' });
    const r = await query(
      `SELECT v.*, ap.name as promoter_name, ap.cpf as promoter_cpf, ag.name as agency_name
       FROM promoter_document_validations v
       LEFT JOIN agency_promoters ap ON ap.id = v.agency_promoter_id
       LEFT JOIN agencies ag ON ag.id = ap.agency_id
       WHERE v.supermarket_unit_id = $1
       ORDER BY v.created_at DESC LIMIT 200`, [unitId]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Erro' }); }
});

router.post('/portal/supermarket/:id/review', async (req, res) => {
  try {
    await ensureTables();
    const unitId = req.headers['x-supermarket-unit-id'] || req.body.unit_id;
    const { decision, reason } = req.body;
    if (!unitId) return res.status(400).json({ error: 'unit_id obrigatório' });
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision inválida' });
    const check = await query(`SELECT supermarket_unit_id FROM promoter_document_validations WHERE id=$1`, [req.params.id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    if (String(check.rows[0].supermarket_unit_id) !== String(unitId)) return res.status(403).json({ error: 'Sem permissão' });
    await applyReview({
      validationId: req.params.id, decision, reason,
      actor: { type: 'supermarket', name: req.headers['x-supermarket-user-name'] || 'PDV' },
    });
    res.json({ success: true });
  } catch (e) { console.error('portal sm review', e); res.status(500).json({ error: e.message || 'Erro' }); }
});

// Portal: agency lists validations for its promoters
router.get('/portal/agency/:agencyId', async (req, res) => {
  try {
    await ensureTables();
    const r = await query(
      `SELECT v.*, ap.name as promoter_name, ap.cpf as promoter_cpf
       FROM promoter_document_validations v
       JOIN agency_promoters ap ON ap.id = v.agency_promoter_id
       WHERE ap.agency_id = $1
       ORDER BY v.created_at DESC LIMIT 200`, [req.params.agencyId]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Erro' }); }
});

export default router;
