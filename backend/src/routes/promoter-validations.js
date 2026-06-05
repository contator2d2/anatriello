// Promoter Document Validation - AI-driven cross-checking
// Validates CNH, Contract, Address, CTPS, Selfie vs agency registration data.

import express from 'express';
import pdfParse from 'pdf-parse';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { loadDocValidationConfig } from './ayratech-ai.js';

const router = express.Router();
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

  // Add columns to merch_redes for requirements config
  await query(`ALTER TABLE merch_redes
    ADD COLUMN IF NOT EXISTS doc_validation_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS facial_required BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_approve_on_match BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS auto_approve_min_score NUMERIC(5,2) DEFAULT 95`);
}

// Resolve requirements for a rede
async function loadRedeRequirements(redeId) {
  if (!redeId) return null;
  const r = await query(
    `SELECT id, doc_validation_enabled, required_documents, facial_required, auto_approve_on_match, auto_approve_min_score
     FROM merch_redes WHERE id = $1`,
    [redeId]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    enabled: !!row.doc_validation_enabled,
    requiredDocs: Array.isArray(row.required_documents) ? row.required_documents : [],
    facialRequired: !!row.facial_required,
    autoApprove: row.auto_approve_on_match !== false,
    autoApproveMinScore: Number(row.auto_approve_min_score ?? 95),
  };
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
  try {
    const r = await query(
      `SELECT id, category, title, file_url, created_at
       FROM promotor_documents
       WHERE agency_promoter_id = $1 AND file_url IS NOT NULL
       ORDER BY created_at DESC`,
      [agencyPromoterId]
    );
    return r.rows;
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

async function callOpenAIVision(cfg, prompt, imageUrls) {
  const content = [{ type: 'text', text: prompt }];
  for (const url of imageUrls.slice(0, 8)) {
    content.push({ type: 'image_url', image_url: { url } });
  }
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

async function callGeminiVision(cfg, prompt, imageUrls) {
  const parts = [{ text: prompt }];
  for (const url of imageUrls.slice(0, 8)) {
    try {
      const imgResp = await fetch(url);
      if (!imgResp.ok) continue;
      const buf = await imgResp.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const mime = imgResp.headers.get('content-type') || 'image/jpeg';
      parts.push({ inline_data: { mime_type: mime, data: b64 } });
    } catch {}
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

async function runAIValidation(cfg, prompt, imageUrls) {
  if (cfg.provider === 'openai' || cfg.provider === 'openrouter') {
    return callOpenAIVision(cfg, prompt, imageUrls);
  }
  if (cfg.provider === 'gemini') {
    return callGeminiVision(cfg, prompt, imageUrls);
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

// Trigger validation
router.post('/run', async (req, res) => {
  try {
    await ensureTables();
    const { agency_promoter_id, rede_id, supermarket_unit_id } = req.body;
    if (!agency_promoter_id) return res.status(400).json({ error: 'agency_promoter_id obrigatório' });

    const cfg = await loadDocValidationConfig();
    if (!cfg?.apiKey || !cfg.enabled) {
      return res.status(400).json({ error: 'IA Ayratech não configurada. Acesse Admin → IA Ayratech.' });
    }

    const promoter = await loadPromoter(agency_promoter_id);
    if (!promoter) return res.status(404).json({ error: 'Promotor não encontrado' });

    const requirements = (await loadRedeRequirements(rede_id)) || {
      enabled: true,
      requiredDocs: DOC_CATEGORIES,
      facialRequired: false,
      autoApprove: true,
      autoApproveMinScore: 95,
    };

    if (!requirements.enabled) {
      return res.status(400).json({ error: 'Validação automática desativada para esta rede' });
    }

    const allDocs = await loadPromoterDocuments(agency_promoter_id);
    const relevantDocs = allDocs.filter(d => requirements.requiredDocs.length === 0 || requirements.requiredDocs.includes(d.category));

    // Create record in 'analyzing' state
    const insertR = await query(
      `INSERT INTO promoter_document_validations
        (agency_promoter_id, organization_id, rede_id, supermarket_unit_id, status,
         ai_provider, ai_model, documents_analyzed)
       VALUES ($1, $2, $3, $4, 'analyzing', $5, $6, $7) RETURNING id`,
      [
        agency_promoter_id,
        promoter.organization_id,
        rede_id || null,
        supermarket_unit_id || null,
        cfg.provider,
        cfg.model,
        JSON.stringify(relevantDocs.map(d => ({ id: d.id, category: d.category, title: d.title }))),
      ]
    );
    const validationId = insertR.rows[0].id;

    // Async processing - respond immediately
    res.json({ id: validationId, status: 'analyzing' });

    // Fire-and-forget
    processValidation(validationId, cfg, promoter, relevantDocs, requirements).catch(err => {
      console.error('[promoter-validations] processValidation error', err);
      query(
        `UPDATE promoter_document_validations SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
        [String(err.message || err).slice(0, 500), validationId]
      ).catch(() => {});
    });
  } catch (e) {
    console.error('run validation', e);
    res.status(500).json({ error: e.message || 'Erro ao iniciar validação' });
  }
});

async function processValidation(validationId, cfg, promoter, documents, requirements) {
  const prompt = buildPrompt(promoter, documents, requirements);
  const imageUrls = documents
    .map(d => d.file_url)
    .filter(u => u && /\.(jpe?g|png|webp|pdf)(\?|$)/i.test(u));

  const raw = await runAIValidation(cfg, prompt, imageUrls);
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

  const autoApplied = requirements.autoApprove && status === 'approved';

  await query(
    `UPDATE promoter_document_validations SET
       status=$1, score=$2, divergences=$3, extracted_data=$4,
       recommendation=$5, ai_raw_response=$6, auto_applied=$7,
       validated_at=NOW(), updated_at=NOW()
     WHERE id=$8`,
    [
      status,
      score,
      JSON.stringify(divergences),
      JSON.stringify(parsed.extracted || {}),
      parsed.recommendation || null,
      raw.slice(0, 10000),
      autoApplied,
      validationId,
    ]
  );

  // Auto-apply: activate promoter for the rede
  if (autoApplied) {
    try {
      await query(`UPDATE agency_promoters SET status='active', updated_at=NOW() WHERE id=$1`, [promoter.id]);
    } catch (e) { console.error('auto-apply failed', e); }
  }
}

// Manual override (approve/reject)
router.post('/:id/review', async (req, res) => {
  try {
    await ensureTables();
    const { decision, reason } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision deve ser approved ou rejected' });
    }
    await query(
      `UPDATE promoter_document_validations
       SET override_status=$1, override_reason=$2, reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$4`,
      [decision, reason || null, req.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao revisar' });
  }
});

// Rede config
router.get('/rede/:redeId/config', async (req, res) => {
  try {
    await ensureTables();
    const r = await query(
      `SELECT id, name, doc_validation_enabled, required_documents, facial_required,
              auto_approve_on_match, auto_approve_min_score
       FROM merch_redes WHERE id = $1`,
      [req.params.redeId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Rede não encontrada' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Erro' });
  }
});

router.put('/rede/:redeId/config', async (req, res) => {
  try {
    await ensureTables();
    const { doc_validation_enabled, required_documents, facial_required, auto_approve_on_match, auto_approve_min_score } = req.body;
    await query(
      `UPDATE merch_redes SET
        doc_validation_enabled = COALESCE($1, doc_validation_enabled),
        required_documents = COALESCE($2, required_documents),
        facial_required = COALESCE($3, facial_required),
        auto_approve_on_match = COALESCE($4, auto_approve_on_match),
        auto_approve_min_score = COALESCE($5, auto_approve_min_score),
        updated_at = NOW()
       WHERE id = $6`,
      [
        doc_validation_enabled,
        required_documents ? JSON.stringify(required_documents) : null,
        facial_required,
        auto_approve_on_match,
        auto_approve_min_score,
        req.params.redeId,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('save rede config', e);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

export default router;
