// SmartRoute AI - Phase 2 + 3
// Phase 2: OCR de lote/validade, análise de gôndola, alertas automáticos (via OpenAI/Gemini)
// Phase 3: Otimizador multi-critério (peso, volume, janela, prioridade) + Gestor IA (recomendações)

import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';
import { loadDocValidationConfig } from './ayratech-ai.js';

const router = express.Router();

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS smartroute_ai_analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      stop_id UUID,
      photo_id UUID,
      route_id UUID,
      kind TEXT NOT NULL,
      image_url TEXT,
      result JSONB DEFAULT '{}'::jsonb,
      confidence NUMERIC(4,3),
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_ai_org ON smartroute_ai_analyses(organization_id, kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sr_ai_stop ON smartroute_ai_analyses(stop_id);

    CREATE TABLE IF NOT EXISTS smartroute_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      entity_type TEXT,
      entity_id UUID,
      route_id UUID,
      stop_id UUID,
      driver_id UUID,
      data JSONB DEFAULT '{}'::jsonb,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMPTZ,
      resolved_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_alerts_org ON smartroute_alerts(organization_id, resolved, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sr_alerts_dedupe
      ON smartroute_alerts(organization_id, type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE resolved = false;

    CREATE TABLE IF NOT EXISTS smartroute_ai_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      route_id UUID,
      scope TEXT NOT NULL DEFAULT 'operacional',
      title TEXT NOT NULL,
      body TEXT,
      data JSONB DEFAULT '{}'::jsonb,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sr_reco_org ON smartroute_ai_recommendations(organization_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS smartroute_ai_prompts (
      organization_id UUID NOT NULL,
      key TEXT NOT NULL,
      instructions TEXT,
      updated_by UUID,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (organization_id, key)
    );

    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS time_window_start TIME;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS time_window_end TIME;
    ALTER TABLE smartroute_orders ADD COLUMN IF NOT EXISTS service_time_min INTEGER DEFAULT 15;
  `);
  ensured = true;
}

// ---------- Custom prompts (per-org overrides) ----------
export const AI_PROMPT_DEFS = {
  advisor: {
    label: 'Gestor IA (recomendações)',
    description: 'Como a IA deve analisar a operação e sugerir ações. Ex: priorize custo, foque em janela de horário, evite motoristas específicos.',
    system_default: 'Você é um gestor sênior de logística e distribuição no Brasil, atuando como consultor operacional para a plataforma Anatriello SmartRoute AI. Analise dados operacionais reais e forneça recomendações práticas, específicas e priorizadas em português do Brasil. Sempre responda APENAS com JSON válido.',
  },
  post_route: {
    label: 'Análise Pós-Rota',
    description: 'Como avaliar a execução de rotas concluídas. Ex: peso maior em pontualidade, tolerância a atrasos, foco em checklist.',
    system_default: 'Você é um analista sênior de operações logísticas no Brasil. Analise a execução de uma rota concluída e gere um relatório objetivo e acionável em português do Brasil. Responda APENAS com JSON válido.',
  },
  ocr_batch_expiry: {
    label: 'OCR de Lote e Validade',
    description: 'Regras extras para leitura de rótulos. Ex: aceitar formatos DD/MM/AA, ignorar códigos EAN, priorizar data mais próxima.',
    system_default: 'Extrair informações de rótulos de produtos brasileiros com precisão. Responda apenas em JSON válido.',
  },
  shelf_analysis: {
    label: 'Análise de Gôndola',
    description: 'Como avaliar fotos de prateleiras. Ex: marcas prioritárias, critérios de share, tolerância a ruptura.',
    system_default: 'Analista visual de merchandising no varejo brasileiro. Responda apenas em JSON válido.',
  },
};

async function getCustomInstructions(org, key) {
  if (!org) return '';
  try {
    await ensureTables();
    const r = await query(`SELECT instructions FROM smartroute_ai_prompts WHERE organization_id=$1 AND key=$2`, [org, key]);
    return (r.rows[0]?.instructions || '').trim();
  } catch { return ''; }
}

function composeSystem(baseSystem, custom) {
  if (!custom) return baseSystem;
  return `${baseSystem}\n\n===== INSTRUÇÕES ADICIONAIS DO GESTOR (obedeça sempre) =====\n${custom}\n=====`;
}

// ---------- AI provider (OpenAI / Gemini / OpenRouter) ----------
async function getAIConfig() {
  const cfg = await loadDocValidationConfig();
  if (!cfg?.apiKey) throw new Error('IA não configurada. Configure em Admin > IA Anatriello.');
  if (!cfg.enabled) throw new Error('IA está desativada nas configurações.');
  return cfg;
}

async function callVisionAI({ prompt, imageUrl, imageBase64, mimeType }) {
  const cfg = await getAIConfig();
  const mime = mimeType || 'image/jpeg';

  if (cfg.provider === 'openai' || cfg.provider === 'openrouter') {
    const url = cfg.provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

    const imgBlock = imageUrl
      ? { type: 'image_url', image_url: { url: imageUrl } }
      : { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } };

    const body = {
      model: cfg.model,
      messages: [
        { role: 'system', content: 'Você é um assistente de visão computacional para logística e trade marketing. Responda APENAS com JSON válido, sem markdown, sem crases.' },
        { role: 'user', content: [{ type: 'text', text: prompt }, imgBlock] },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${cfg.provider} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    return parseJSONish(j?.choices?.[0]?.message?.content);
  }

  if (cfg.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
    const parts = [{ text: prompt }];
    if (imageUrl) {
      const fetched = await fetch(imageUrl);
      const buf = Buffer.from(await fetched.arrayBuffer());
      parts.push({ inlineData: { mimeType: fetched.headers.get('content-type') || mime, data: buf.toString('base64') } });
    } else {
      parts.push({ inlineData: { mimeType: mime, data: imageBase64 } });
    }
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1500 },
    };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    return parseJSONish(j?.candidates?.[0]?.content?.parts?.[0]?.text);
  }

  throw new Error(`Provedor ${cfg.provider} não suportado`);
}

async function callTextAI({ system, prompt, maxTokens = 1200 }) {
  const cfg = await getAIConfig();
  if (cfg.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: `${system}\n\n${prompt}` }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  const url = cfg.provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  });
  if (!r.ok) throw new Error(`${cfg.provider} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || '';
}

function parseJSONish(text) {
  if (!text) return {};
  const cleaned = String(text).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { return { raw_text: text }; }
}

async function createAlert(a) {
  try {
    await query(
      `INSERT INTO smartroute_alerts (organization_id, type, severity, title, message, entity_type, entity_id, route_id, stop_id, driver_id, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [a.organizationId, a.type, a.severity || 'info', a.title, a.message || null, a.entity_type || null, a.entity_id || null, a.route_id || null, a.stop_id || null, a.driver_id || null, a.data || {}]
    );
  } catch (e) { logError('createAlert', e); }
}

// ---------- Middleware ----------
router.use(authenticate);
router.use(async (_req, _res, next) => { await ensureTables(); next(); });

// ============ FASE 2: OCR / VISION ============
router.post('/ocr/batch-expiry', async (req, res) => {
  try {
    const { image_url, image_base64, mime_type, stop_id, photo_id } = req.body || {};
    if (!image_url && !image_base64) return res.status(400).json({ error: 'image_url ou image_base64 obrigatório' });

    const extra = await getCustomInstructions(req.organizationId, 'ocr_batch_expiry');
    const prompt = `${extra ? `INSTRUÇÕES DO GESTOR:\n${extra}\n\n` : ''}Analise o rótulo do produto na imagem. Extraia e responda APENAS o JSON:
{
  "batch": "código do LOTE (procure LOTE/L./BATCH/L:)",
  "expiry_date": "YYYY-MM-DD (procure VAL/VALIDADE/VENC)",
  "manufacture_date": "YYYY-MM-DD ou null",
  "product_name": "nome do produto se legível ou null",
  "readable": true/false,
  "confidence": 0.0-1.0,
  "warnings": []
}`;
    const result = await callVisionAI({ prompt, imageUrl: image_url, imageBase64: image_base64, mimeType: mime_type });

    const warnings = Array.isArray(result.warnings) ? [...result.warnings] : [];
    let severity = 'info';
    if (result.expiry_date) {
      const days = Math.floor((new Date(result.expiry_date) - new Date()) / 86400000);
      if (days < 0) { warnings.push('PRODUTO VENCIDO'); severity = 'critical'; }
      else if (days <= 15) { warnings.push(`Vence em ${days} dias`); severity = 'high'; }
      else if (days <= 30) { warnings.push(`Vence em ${days} dias`); severity = 'medium'; }
      result.days_to_expiry = days;
    }
    result.warnings = warnings;

    const ins = await query(
      `INSERT INTO smartroute_ai_analyses (organization_id, stop_id, photo_id, kind, image_url, result, confidence, created_by)
       VALUES ($1,$2,$3,'batch_expiry',$4,$5,$6,$7) RETURNING *`,
      [req.organizationId, stop_id || null, photo_id || null, image_url || null, result, result.confidence || null, req.userId]
    );

    if (severity === 'critical' || severity === 'high') {
      await createAlert({
        organizationId: req.organizationId, type: 'product_expiry', severity,
        title: severity === 'critical' ? 'Produto vencido detectado' : 'Produto próximo do vencimento',
        message: `${result.product_name || 'Produto'} — lote ${result.batch || '?'} vence em ${result.days_to_expiry} dia(s)`,
        entity_type: 'analysis', entity_id: ins.rows[0].id, stop_id: stop_id || null,
        data: { batch: result.batch, expiry_date: result.expiry_date, days: result.days_to_expiry },
      });
    }
    res.json(ins.rows[0]);
  } catch (e) { logError('ocr/batch-expiry', e); res.status(500).json({ error: e.message }); }
});

router.post('/analysis/shelf', async (req, res) => {
  try {
    const { image_url, image_base64, mime_type, stop_id, photo_id, expected_brands } = req.body || {};
    if (!image_url && !image_base64) return res.status(400).json({ error: 'image_url ou image_base64 obrigatório' });

    const extra = await getCustomInstructions(req.organizationId, 'shelf_analysis');
    const prompt = `${extra ? `INSTRUÇÕES DO GESTOR:\n${extra}\n\n` : ''}Analise a foto da gôndola/prateleira do PDV. Responda APENAS o JSON:
{
  "fill_percent": 0-100,
  "out_of_stock": true/false,
  "brands_detected": [],
  "expected_brands_present": ${JSON.stringify(expected_brands || [])},
  "missing_brands": [],
  "planogram_score": 0-100,
  "cleanliness_score": 0-100,
  "price_tags_visible": true/false,
  "issues": [],
  "recommendations": [],
  "summary": "resumo em 1-2 frases",
  "confidence": 0.0-1.0
}`;
    const result = await callVisionAI({ prompt, imageUrl: image_url, imageBase64: image_base64, mimeType: mime_type });

    const ins = await query(
      `INSERT INTO smartroute_ai_analyses (organization_id, stop_id, photo_id, kind, image_url, result, confidence, created_by)
       VALUES ($1,$2,$3,'shelf',$4,$5,$6,$7) RETURNING *`,
      [req.organizationId, stop_id || null, photo_id || null, image_url || null, result, result.confidence || null, req.userId]
    );

    if (result.out_of_stock || (typeof result.fill_percent === 'number' && result.fill_percent < 40)) {
      await createAlert({
        organizationId: req.organizationId, type: 'shelf_out_of_stock', severity: 'high',
        title: 'Ruptura de gôndola detectada', message: result.summary || `Ocupação em ${result.fill_percent}%`,
        entity_type: 'analysis', entity_id: ins.rows[0].id, stop_id: stop_id || null,
        data: { fill_percent: result.fill_percent, missing: result.missing_brands },
      });
    }
    if (Array.isArray(result.missing_brands) && result.missing_brands.length > 0) {
      await createAlert({
        organizationId: req.organizationId, type: 'shelf_missing_brand', severity: 'medium',
        title: 'Marcas esperadas ausentes', message: `Ausentes: ${result.missing_brands.join(', ')}`,
        entity_type: 'analysis', entity_id: ins.rows[0].id, stop_id: stop_id || null,
        data: { missing: result.missing_brands },
      });
    }
    res.json(ins.rows[0]);
  } catch (e) { logError('analysis/shelf', e); res.status(500).json({ error: e.message }); }
});

router.get('/analyses', async (req, res) => {
  try {
    const { kind, limit = 50 } = req.query;
    const params = [req.organizationId];
    let sql = `SELECT a.*, s.pdv_name, s.order_number, r.code as route_code
               FROM smartroute_ai_analyses a
               LEFT JOIN smartroute_route_stops s ON s.id = a.stop_id
               LEFT JOIN smartroute_routes r ON r.id = a.route_id
               WHERE a.organization_id=$1`;
    if (kind) { params.push(kind); sql += ` AND a.kind=$${params.length}`; }
    sql += ` ORDER BY a.created_at DESC LIMIT ${Math.min(+limit, 200)}`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ ALERTS ============
router.get('/alerts', async (req, res) => {
  try {
    const { resolved = 'false', severity, type, limit = 100 } = req.query;
    const params = [req.organizationId];
    let sql = `SELECT * FROM smartroute_alerts WHERE organization_id=$1`;
    if (resolved === 'false' || resolved === 'true') { params.push(resolved === 'true'); sql += ` AND resolved=$${params.length}`; }
    if (severity) { params.push(severity); sql += ` AND severity=$${params.length}`; }
    if (type) { params.push(type); sql += ` AND type=$${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT ${Math.min(+limit, 500)}`;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    await query(`UPDATE smartroute_alerts SET resolved=true, resolved_at=NOW(), resolved_by=$2 WHERE id=$1 AND organization_id=$3`,
      [req.params.id, req.userId, req.organizationId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/alerts/:id', async (req, res) => {
  try {
    await query(`DELETE FROM smartroute_alerts WHERE id=$1 AND organization_id=$2`, [req.params.id, req.organizationId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/alerts/scan', async (req, res) => {
  try {
    const org = req.organizationId;
    let generated = 0;
    const offline = await query(`
      SELECT DISTINCT d.id, d.full_name, r.id as route_id, r.code
      FROM smartroute_drivers d JOIN smartroute_routes r ON r.driver_id=d.id AND r.status='em_andamento'
      WHERE d.organization_id=$1 AND (d.last_location_at IS NULL OR d.last_location_at < NOW() - INTERVAL '30 minutes')`, [org]);
    for (const row of offline.rows) { generated++; await createAlert({ organizationId: org, type: 'driver_offline', severity: 'high',
      title: 'Motorista sem sinal', message: `${row.full_name} está sem atualização há mais de 30 min (rota ${row.code})`,
      entity_type: 'driver', entity_id: row.id, route_id: row.route_id, driver_id: row.id }); }

    const late = await query(`SELECT id, code FROM smartroute_routes
      WHERE organization_id=$1 AND status='planejada' AND planned_date::date=CURRENT_DATE AND NOW()::time > TIME '14:00'`, [org]);
    for (const row of late.rows) { generated++; await createAlert({ organizationId: org, type: 'route_late_start', severity: 'medium',
      title: 'Rota não iniciada', message: `Rota ${row.code} ainda não foi iniciada hoje`, entity_type: 'route', entity_id: row.id, route_id: row.id }); }

    const failed = await query(`SELECT s.id, s.pdv_name, s.route_id, r.code, s.notes
      FROM smartroute_route_stops s JOIN smartroute_routes r ON r.id=s.route_id
      WHERE r.organization_id=$1 AND s.status='nao_entregue' AND s.updated_at > NOW() - INTERVAL '24 hours'`, [org]);
    for (const row of failed.rows) { generated++; await createAlert({ organizationId: org, type: 'delivery_failed', severity: 'high',
      title: 'Entrega não realizada', message: `${row.pdv_name} (rota ${row.code}): ${row.notes || 'sem motivo'}`,
      entity_type: 'stop', entity_id: row.id, route_id: row.route_id, stop_id: row.id }); }

    const cnh = await query(`SELECT id, full_name, license_expires_at FROM smartroute_drivers
      WHERE organization_id=$1 AND active=true AND license_expires_at IS NOT NULL AND license_expires_at <= CURRENT_DATE + INTERVAL '30 days'`, [org]);
    for (const row of cnh.rows) {
      const days = Math.max(0, Math.ceil((new Date(row.license_expires_at) - new Date()) / 86400000));
      generated++;
      await createAlert({ organizationId: org, type: 'driver_license_expiring',
        severity: days <= 0 ? 'critical' : days <= 7 ? 'high' : 'medium',
        title: days <= 0 ? 'CNH vencida' : 'CNH próxima do vencimento',
        message: `${row.full_name}: vence em ${days} dia(s)`, entity_type: 'driver', entity_id: row.id, driver_id: row.id });
    }
    res.json({ ok: true, generated });
  } catch (e) { logError('alerts/scan', e); res.status(500).json({ error: e.message }); }
});

router.get('/summary', async (req, res) => {
  try {
    const org = req.organizationId;
    const [alerts, analyses, expiring] = await Promise.all([
      query(`SELECT severity, COUNT(*)::int n FROM smartroute_alerts WHERE organization_id=$1 AND resolved=false GROUP BY severity`, [org]),
      query(`SELECT kind, COUNT(*)::int n FROM smartroute_ai_analyses WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '30 days' GROUP BY kind`, [org]),
      query(`SELECT COUNT(*)::int n FROM smartroute_ai_analyses WHERE organization_id=$1 AND kind='batch_expiry' AND (result->>'days_to_expiry')::int <= 30 AND created_at > NOW() - INTERVAL '30 days'`, [org]),
    ]);
    res.json({
      alerts_by_severity: alerts.rows,
      analyses_by_kind: analyses.rows,
      products_expiring_soon: expiring.rows[0]?.n || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ FASE 3: OTIMIZADOR MULTI-CRITÉRIO ============
// Considera: capacidade (kg/m3), janela de horário, prioridade, distância (nearest neighbor)
router.post('/routes/:id/optimize-advanced', async (req, res) => {
  try {
    const org = req.organizationId;
    const r = await query(`SELECT * FROM smartroute_routes WHERE id=$1 AND organization_id=$2`, [req.params.id, org]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });
    const route = r.rows[0];

    const vehicle = route.vehicle_id
      ? (await query(`SELECT capacity_kg, capacity_m3, km_per_liter, fuel_price_per_liter, fuel_type FROM smartroute_vehicles WHERE id=$1`, [route.vehicle_id])).rows[0]
      : null;
    const capKg = Number(vehicle?.capacity_kg) || Infinity;
    const capM3 = Number(vehicle?.capacity_m3) || Infinity;
    const kmPerL = Number(vehicle?.km_per_liter) || null;
    const pricePerL = Number(vehicle?.fuel_price_per_liter) || null;

    const stops = await query(
      `SELECT s.id, s.pdv_id, p.lat, p.lng, p.name,
              o.weight_kg, o.volume_m3, o.priority, o.time_window_start, o.time_window_end, o.service_time_min
       FROM smartroute_route_stops s
       LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
       LEFT JOIN smartroute_orders o ON o.id=s.order_id
       WHERE s.route_id=$1`, [req.params.id]);

    const pts = stops.rows.filter((s) => s.lat != null && s.lng != null);
    const warnings = [];
    const totalKg = pts.reduce((a, s) => a + Number(s.weight_kg || 0), 0);
    const totalM3 = pts.reduce((a, s) => a + Number(s.volume_m3 || 0), 0);
    if (totalKg > capKg) warnings.push(`Excesso de peso: ${totalKg.toFixed(1)}kg > capacidade ${capKg}kg`);
    if (totalM3 > capM3) warnings.push(`Excesso de volume: ${totalM3.toFixed(2)}m³ > capacidade ${capM3}m³`);

    const dist = (a, b) => {
      const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };
    const timeMinutes = (t) => t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null;

    let cur = { lat: route.depot_lat ?? pts[0]?.lat, lng: route.depot_lng ?? pts[0]?.lng };
    const startClock = 8 * 60;
    let clock = startClock;
    const speed = 30; // km/h médio urbano
    const remaining = [...pts]; const order = []; let totalKm = 0;

    while (remaining.length) {
      remaining.sort((a, b) => {
        const dA = dist(cur, a), dB = dist(cur, b);
        const etaA = clock + (dA / speed) * 60, etaB = clock + (dB / speed) * 60;
        const wStartA = timeMinutes(a.time_window_start), wStartB = timeMinutes(b.time_window_start);
        const wEndA = timeMinutes(a.time_window_end), wEndB = timeMinutes(b.time_window_end);
        const lateA = wEndA != null && etaA > wEndA ? 1000 : 0;
        const lateB = wEndB != null && etaB > wEndB ? 1000 : 0;
        const earlyA = wStartA != null && etaA < wStartA ? (wStartA - etaA) : 0;
        const earlyB = wStartB != null && etaB < wStartB ? (wStartB - etaB) : 0;
        const prioA = (a.priority || 5) * -2, prioB = (b.priority || 5) * -2;
        return (dA + earlyA / 5 + prioA + lateA) - (dB + earlyB / 5 + prioB + lateB);
      });
      const next = remaining.shift();
      const km = dist(cur, next); totalKm += km;
      clock += (km / speed) * 60;
      const wStart = timeMinutes(next.time_window_start), wEnd = timeMinutes(next.time_window_end);
      if (wStart != null && clock < wStart) clock = wStart;
      if (wEnd != null && clock > wEnd) warnings.push(`${next.name || 'PDV'} fora da janela (chegada ${Math.floor(clock/60)}:${String(Math.floor(clock%60)).padStart(2,'0')})`);
      order.push({ ...next, eta_min: Math.round(clock) });
      clock += Number(next.service_time_min) || 15;
      cur = next;
    }

    for (let i = 0; i < order.length; i++) {
      await query(`UPDATE smartroute_route_stops SET sequence=$2, eta_min=$3, updated_at=NOW() WHERE id=$1`, [order[i].id, i + 1, order[i].eta_min]);
    }

    const totalKmRounded = Math.round(totalKm * 10) / 10;
    const durationMin = Math.round(clock - startClock);
    const fuelLiters = kmPerL ? Math.round((totalKm / kmPerL) * 100) / 100 : null;
    const costBRL = fuelLiters != null && pricePerL ? Math.round(fuelLiters * pricePerL * 100) / 100 : null;

    await query(
      `UPDATE smartroute_routes SET total_distance_km=$2, estimated_fuel_liters=$3, estimated_cost_brl=$4, estimated_duration_min=$5, updated_at=NOW() WHERE id=$1`,
      [route.id, totalKmRounded, fuelLiters, costBRL, durationMin]
    );

    if (!kmPerL) warnings.push('Consumo (km/l) não cadastrado no veículo — custo de combustível não estimado.');
    else if (!pricePerL) warnings.push('Preço do combustível não cadastrado no veículo — custo não calculado.');

    res.json({
      ok: true,
      sequenced: order.length,
      total_km: totalKmRounded,
      estimated_duration_min: durationMin,
      estimated_fuel_liters: fuelLiters,
      estimated_cost_brl: costBRL,
      total_weight_kg: Math.round(totalKg * 10) / 10,
      total_volume_m3: Math.round(totalM3 * 100) / 100,
      capacity_used_kg_pct: capKg === Infinity ? null : Math.round((totalKg / capKg) * 100),
      capacity_used_m3_pct: capM3 === Infinity ? null : Math.round((totalM3 / capM3) * 100),
      warnings,
    });
  } catch (e) { logError('optimize-advanced', e); res.status(500).json({ error: e.message }); }
});

// ============ FASE 3: GESTOR IA (recomendações) ============
router.post('/advisor/analyze', async (req, res) => {
  try {
    const org = req.organizationId;
    const { scope = 'operacional', route_id } = req.body || {};

    // Coleta dados de contexto
    const [dashboard, activeRoutes, drivers, alerts, recentEvents] = await Promise.all([
      query(`SELECT status, COUNT(*)::int c FROM smartroute_routes WHERE organization_id=$1 AND planned_date >= CURRENT_DATE - INTERVAL '7 days' GROUP BY status`, [org]),
      query(`SELECT id, code, status, total_stops, completed_stops FROM smartroute_routes WHERE organization_id=$1 AND planned_date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY planned_date DESC LIMIT 20`, [org]),
      query(`SELECT id, full_name, current_status, last_location_at FROM smartroute_drivers WHERE organization_id=$1 AND active=true`, [org]),
      query(`SELECT type, severity, title, message FROM smartroute_alerts WHERE organization_id=$1 AND resolved=false ORDER BY created_at DESC LIMIT 30`, [org]),
      query(`SELECT event_type, COUNT(*)::int c FROM smartroute_events WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '7 days' GROUP BY event_type`, [org]),
    ]);

    let routeContext = null;
    if (route_id) {
      const rr = await query(
        `SELECT r.code, r.status, r.total_stops, r.completed_stops, r.planned_date,
                d.full_name as driver_name, v.plate, v.capacity_kg, v.capacity_m3
         FROM smartroute_routes r
         LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
         LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
         WHERE r.id=$1 AND r.organization_id=$2`, [route_id, org]);
      routeContext = rr.rows[0] || null;
    }

    const context = {
      escopo: scope,
      dashboard_7d: dashboard.rows,
      rotas_recentes: activeRoutes.rows,
      motoristas: drivers.rows,
      alertas_abertos: alerts.rows,
      eventos_7d: recentEvents.rows,
      rota_focada: routeContext,
    };

    const system = composeSystem(AI_PROMPT_DEFS.advisor.system_default, await getCustomInstructions(org, 'advisor'));
    const prompt = `Analise o contexto operacional abaixo e retorne recomendações do "gestor IA".

CONTEXTO:
${JSON.stringify(context, null, 2)}

Responda APENAS com JSON no formato:
{
  "resumo_executivo": "1-2 frases sobre saúde geral da operação",
  "score_operacional": 0-100,
  "principais_riscos": ["risco 1", "risco 2"],
  "recomendacoes": [
    {"prioridade": "alta|media|baixa", "titulo": "curto", "descricao": "acionável", "impacto": "curto"}
  ],
  "oportunidades": ["oportunidade 1"],
  "proximos_passos_24h": ["passo 1", "passo 2"]
}`;

    const raw = await callTextAI({ system, prompt, maxTokens: 1500 });
    const parsed = parseJSONish(raw);

    const title = parsed.resumo_executivo?.slice(0, 200) || 'Análise do Gestor IA';
    const ins = await query(
      `INSERT INTO smartroute_ai_recommendations (organization_id, route_id, scope, title, body, data, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [org, route_id || null, scope, title, raw, parsed, req.userId]
    );
    res.json({ ...ins.rows[0], parsed });
  } catch (e) { logError('advisor/analyze', e); res.status(500).json({ error: e.message }); }
});

router.get('/advisor/history', async (req, res) => {
  try {
    const r = await query(
      `SELECT * FROM smartroute_ai_recommendations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [req.organizationId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/advisor/:id', async (req, res) => {
  try {
    await query(`DELETE FROM smartroute_ai_recommendations WHERE id=$1 AND organization_id=$2`,
      [req.params.id, req.organizationId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ ONDA 5: ANÁLISE PÓS-ROTA ============
router.post('/routes/:id/post-analysis', async (req, res) => {
  try {
    const org = req.organizationId;
    const rid = req.params.id;

    const rr = await query(
      `SELECT r.*, d.full_name AS driver_name, d.cpf AS driver_cpf,
              v.plate, v.model AS vehicle_model, v.capacity_kg, v.capacity_m3, v.km_per_liter
       FROM smartroute_routes r
       LEFT JOIN smartroute_drivers d ON d.id=r.driver_id
       LEFT JOIN smartroute_vehicles v ON v.id=r.vehicle_id
       WHERE r.id=$1 AND r.organization_id=$2`, [rid, org]);
    if (!rr.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });
    const route = rr.rows[0];

    const stops = await query(
      `SELECT s.id, s.sequence, s.status, s.state, s.arrived_at, s.departed_at, s.eta_min,
              s.notes, s.pdv_name
       FROM smartroute_route_stops s
       WHERE s.route_id=$1 ORDER BY s.sequence`, [rid]);

    const stopIds = stops.rows.map((s) => s.id);
    const [occRes, alertsRes, chkRes, chkTplRes, evtRes] = await Promise.all([
      stopIds.length
        ? query(`SELECT stop_id, type_code, severity, status, sla_deadline, resolved_at
                 FROM smartroute_stop_occurrences WHERE stop_id = ANY($1::uuid[])`, [stopIds])
        : Promise.resolve({ rows: [] }),
      query(`SELECT type, severity, title, message, created_at, resolved
             FROM smartroute_alerts WHERE route_id=$1 ORDER BY created_at`, [rid]),
      stopIds.length
        ? query(`SELECT stop_id, item_id, template_id, value, ok
                 FROM smartroute_stop_checklist_responses WHERE stop_id = ANY($1::uuid[])`, [stopIds])
        : Promise.resolve({ rows: [] }),
      query(`SELECT ti.id, ti.template_id, ti.required, ti.label
             FROM smartroute_checklist_template_items ti
             JOIN smartroute_checklist_templates t ON t.id = ti.template_id
             WHERE t.organization_id=$1`, [org]).catch(() => ({ rows: [] })),
      query(`SELECT event_type, COUNT(*)::int n FROM smartroute_events
             WHERE route_id=$1 GROUP BY event_type`, [rid]),
    ]);

    const done = stops.rows.filter((s) => s.status === 'concluida').length;
    const failed = stops.rows.filter((s) => s.status === 'nao_entregue').length;
    const total = stops.rows.length;
    const successRate = total ? Math.round((done / total) * 100) : 0;

    const serviceTimes = stops.rows
      .filter((s) => s.arrived_at && s.departed_at)
      .map((s) => (new Date(s.departed_at) - new Date(s.arrived_at)) / 60000);
    const avgServiceMin = serviceTimes.length
      ? Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length)
      : null;

    const etaDeltas = stops.rows
      .filter((s) => s.arrived_at && s.eta_min != null && route.started_at)
      .map((s) => (new Date(s.arrived_at) - new Date(route.started_at)) / 60000 - Number(s.eta_min || 0));
    const avgEtaDelta = etaDeltas.length
      ? Math.round(etaDeltas.reduce((a, b) => a + b, 0) / etaDeltas.length)
      : null;

    const occByType = {}; const occBySeverity = {}; let slaBreaches = 0;
    for (const o of occRes.rows) {
      occByType[o.type_code || 'outro'] = (occByType[o.type_code || 'outro'] || 0) + 1;
      occBySeverity[o.severity || 'info'] = (occBySeverity[o.severity || 'info'] || 0) + 1;
      if (o.sla_deadline && o.resolved_at && new Date(o.resolved_at) > new Date(o.sla_deadline)) slaBreaches++;
      else if (o.sla_deadline && !o.resolved_at && new Date() > new Date(o.sla_deadline)) slaBreaches++;
    }

    const requiredIds = new Set(chkTplRes.rows.filter((i) => i.required).map((i) => i.id));
    const respondedRequired = new Set(
      chkRes.rows.filter((r) => requiredIds.has(r.item_id) && r.value !== null).map((r) => `${r.stop_id}:${r.item_id}`)
    );
    const expectedRequired = stopIds.length * requiredIds.size;
    const checklistCompliance = expectedRequired
      ? Math.round((respondedRequired.size / expectedRequired) * 100)
      : null;

    const durationMin = route.started_at && route.ended_at
      ? Math.round((new Date(route.ended_at) - new Date(route.started_at)) / 60000)
      : null;

    const metrics = {
      rota: {
        codigo: route.code, status: route.status,
        planejada_em: route.planned_date, iniciada_em: route.started_at, encerrada_em: route.ended_at,
        duracao_min: durationMin, km_total: route.total_distance_km,
        combustivel_l: route.estimated_fuel_liters, custo_brl: route.estimated_cost_brl,
      },
      motorista: { nome: route.driver_name, cpf: route.driver_cpf },
      veiculo: { placa: route.plate, modelo: route.vehicle_model, capacidade_kg: route.capacity_kg, capacidade_m3: route.capacity_m3 },
      paradas: {
        total, concluidas: done, nao_entregues: failed,
        taxa_sucesso_pct: successRate,
        tempo_medio_atendimento_min: avgServiceMin,
        atraso_medio_vs_eta_min: avgEtaDelta,
      },
      checklist: { aderencia_pct: checklistCompliance, itens_obrigatorios: requiredIds.size },
      ocorrencias: { por_tipo: occByType, por_severidade: occBySeverity, sla_estourados: slaBreaches, total: occRes.rows.length },
      alertas: alertsRes.rows.map((a) => ({ tipo: a.type, severidade: a.severity, titulo: a.title, resolvido: a.resolved })),
      eventos: evtRes.rows,
      paradas_detalhe: stops.rows.map((s) => ({
        seq: s.sequence, pdv: s.pdv_name, status: s.status,
        chegada: s.arrived_at, saida: s.departed_at, eta_min: s.eta_min, notas: s.notes,
      })),
    };

    const system = composeSystem(AI_PROMPT_DEFS.post_route.system_default, await getCustomInstructions(org, 'post_route'));
    const prompt = `Analise a execução da rota abaixo e produza um relatório pós-rota.

MÉTRICAS:
${JSON.stringify(metrics, null, 2)}

Responda APENAS com JSON no formato:
{
  "resumo_executivo": "2-3 frases sobre a execução",
  "score_execucao": 0-100,
  "produtividade": {"nota": 0-100, "comentario": "curto"},
  "cumprimento_checklist": {"nota": 0-100, "comentario": "curto"},
  "qualidade_atendimento": {"nota": 0-100, "comentario": "curto"},
  "pontos_positivos": ["..."],
  "gargalos": [{"titulo": "curto", "descricao": "onde ocorreu", "impacto": "curto"}],
  "ocorrencias_criticas": ["..."],
  "recomendacoes": [{"prioridade": "alta|media|baixa", "titulo": "curto", "acao": "acionável"}],
  "aprendizados_para_proxima_rota": ["..."]
}`;

    const raw = await callTextAI({ system, prompt, maxTokens: 1800 });
    const parsed = parseJSONish(raw);
    parsed.metricas_calculadas = metrics;

    const title = parsed.resumo_executivo?.slice(0, 200) || `Análise pós-rota ${route.code}`;
    const ins = await query(
      `INSERT INTO smartroute_ai_recommendations (organization_id, route_id, scope, title, body, data, created_by)
       VALUES ($1,$2,'pos_rota',$3,$4,$5,$6) RETURNING *`,
      [org, rid, title, raw, parsed, req.userId]
    );
    res.json({ ...ins.rows[0], parsed, metrics });
  } catch (e) { logError('post-analysis', e); res.status(500).json({ error: e.message }); }
});

router.get('/routes/:id/post-analysis', async (req, res) => {
  try {
    const r = await query(
      `SELECT * FROM smartroute_ai_recommendations
       WHERE organization_id=$1 AND route_id=$2 AND scope='pos_rota'
       ORDER BY created_at DESC`, [req.organizationId, req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/post-analyses', async (req, res) => {
  try {
    const r = await query(
      `SELECT rec.*, rt.code AS route_code, rt.planned_date, d.full_name AS driver_name
       FROM smartroute_ai_recommendations rec
       LEFT JOIN smartroute_routes rt ON rt.id = rec.route_id
       LEFT JOIN smartroute_drivers d ON d.id = rt.driver_id
       WHERE rec.organization_id=$1 AND rec.scope='pos_rota'
       ORDER BY rec.created_at DESC LIMIT 100`, [req.organizationId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ PROMPTS CUSTOMIZÁVEIS ============
router.get('/prompts', async (req, res) => {
  try {
    await ensureTables();
    const org = req.organizationId;
    const r = await query(`SELECT key, instructions, updated_at, updated_by FROM smartroute_ai_prompts WHERE organization_id=$1`, [org]);
    const byKey = Object.fromEntries(r.rows.map((x) => [x.key, x]));
    const out = Object.entries(AI_PROMPT_DEFS).map(([key, def]) => ({
      key,
      label: def.label,
      description: def.description,
      system_default: def.system_default,
      instructions: byKey[key]?.instructions || '',
      updated_at: byKey[key]?.updated_at || null,
    }));
    res.json(out);
  } catch (e) { logError('prompts.list', e); res.status(500).json({ error: e.message }); }
});

router.put('/prompts/:key', async (req, res) => {
  try {
    await ensureTables();
    const { key } = req.params;
    if (!AI_PROMPT_DEFS[key]) return res.status(400).json({ error: 'Chave inválida' });
    const instructions = (req.body?.instructions || '').toString();
    await query(
      `INSERT INTO smartroute_ai_prompts (organization_id, key, instructions, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (organization_id, key)
       DO UPDATE SET instructions=EXCLUDED.instructions, updated_by=EXCLUDED.updated_by, updated_at=NOW()`,
      [req.organizationId, key, instructions, req.userId]
    );
    res.json({ ok: true });
  } catch (e) { logError('prompts.save', e); res.status(500).json({ error: e.message }); }
});

export default router;
