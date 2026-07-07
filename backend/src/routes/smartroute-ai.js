// SmartRoute AI - Phase 2: OCR de lote/validade, análise de gôndola, alertas automáticos
import express from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { logError } from '../logger.js';

const router = express.Router();

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const VISION_MODEL = 'google/gemini-2.5-flash';

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
  `);
  ensured = true;
}

async function callVision({ prompt, imageUrl, imageBase64, mimeType, jsonSchema }) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error('LOVABLE_API_KEY não configurada');

  const imgBlock = imageUrl
    ? { type: 'image_url', image_url: { url: imageUrl } }
    : { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } };

  const body = {
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: 'Você é um assistente de visão computacional especializado em logística e trade marketing. Sempre responda APENAS com JSON válido, sem markdown.' },
      { role: 'user', content: [{ type: 'text', text: prompt }, imgBlock] },
    ],
    response_format: jsonSchema ? { type: 'json_object' } : undefined,
  };

  const r = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI Gateway ${r.status}: ${t.slice(0, 400)}`);
  }
  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content || '';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { raw_text: text };
  }
}

async function createAlert({ organizationId, type, severity, title, message, entity_type, entity_id, route_id, stop_id, driver_id, data }) {
  try {
    await query(
      `INSERT INTO smartroute_alerts (organization_id, type, severity, title, message, entity_type, entity_id, route_id, stop_id, driver_id, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT DO NOTHING`,
      [organizationId, type, severity || 'info', title, message || null, entity_type || null, entity_id || null, route_id || null, stop_id || null, driver_id || null, data || {}]
    );
  } catch (e) { logError('createAlert', e); }
}

// ---------- Public routes (authenticated) ----------
router.use(authenticate);
router.use(async (_req, _res, next) => { await ensureTables(); next(); });

// OCR: extrair lote e validade de rótulo
router.post('/ocr/batch-expiry', async (req, res) => {
  try {
    const { image_url, image_base64, mime_type, stop_id, photo_id } = req.body || {};
    if (!image_url && !image_base64) return res.status(400).json({ error: 'image_url ou image_base64 obrigatório' });

    const prompt = `Analise esta imagem do rótulo de um produto. Extraia:
- "batch": código do LOTE (procure por "LOTE", "L.", "BATCH", "L:")
- "expiry_date": data de VALIDADE no formato YYYY-MM-DD (procure por "VAL", "VALIDADE", "VENC")
- "manufacture_date": data de fabricação em YYYY-MM-DD se visível
- "product_name": nome do produto se legível
- "readable": true/false se o rótulo está legível
- "confidence": 0.0 a 1.0
- "warnings": array de strings (ex: "produto vencido", "menos de 30 dias para vencer")

Responda APENAS o JSON.`;

    const result = await callVision({ prompt, imageUrl: image_url, imageBase64: image_base64, mimeType: mime_type, jsonSchema: true });

    // Warnings automáticos
    const warnings = Array.isArray(result.warnings) ? [...result.warnings] : [];
    let severity = 'info';
    if (result.expiry_date) {
      const exp = new Date(result.expiry_date);
      const now = new Date();
      const days = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
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
        organizationId: req.organizationId,
        type: 'product_expiry',
        severity,
        title: severity === 'critical' ? 'Produto vencido detectado' : 'Produto próximo do vencimento',
        message: `${result.product_name || 'Produto'} — lote ${result.batch || '?'} vence em ${result.days_to_expiry} dia(s)`,
        entity_type: 'analysis', entity_id: ins.rows[0].id, stop_id: stop_id || null,
        data: { batch: result.batch, expiry_date: result.expiry_date, days: result.days_to_expiry },
      });
    }
    res.json(ins.rows[0]);
  } catch (e) { logError('ocr/batch-expiry', e); res.status(500).json({ error: e.message }); }
});

// Análise de gôndola
router.post('/analysis/shelf', async (req, res) => {
  try {
    const { image_url, image_base64, mime_type, stop_id, photo_id, expected_brands } = req.body || {};
    if (!image_url && !image_base64) return res.status(400).json({ error: 'image_url ou image_base64 obrigatório' });

    const prompt = `Analise esta foto de gôndola / prateleira de PDV. Retorne JSON com:
- "fill_percent": 0 a 100, ocupação estimada da gôndola
- "out_of_stock": true/false (rupturas visíveis)
- "brands_detected": array de marcas identificadas
- "expected_brands_present": array das marcas ${JSON.stringify(expected_brands || [])} que foram encontradas
- "missing_brands": marcas esperadas ausentes
- "planogram_score": 0 a 100 (organização e alinhamento)
- "cleanliness_score": 0 a 100
- "price_tags_visible": true/false
- "issues": array de problemas encontrados (rupturas, desorganização, sujeira, produtos amassados, etc)
- "recommendations": array de recomendações práticas
- "summary": resumo em 1-2 frases em português
- "confidence": 0.0 a 1.0

Responda APENAS o JSON.`;

    const result = await callVision({ prompt, imageUrl: image_url, imageBase64: image_base64, mimeType: mime_type, jsonSchema: true });

    const ins = await query(
      `INSERT INTO smartroute_ai_analyses (organization_id, stop_id, photo_id, kind, image_url, result, confidence, created_by)
       VALUES ($1,$2,$3,'shelf',$4,$5,$6,$7) RETURNING *`,
      [req.organizationId, stop_id || null, photo_id || null, image_url || null, result, result.confidence || null, req.userId]
    );

    if (result.out_of_stock || (typeof result.fill_percent === 'number' && result.fill_percent < 40)) {
      await createAlert({
        organizationId: req.organizationId, type: 'shelf_out_of_stock', severity: 'high',
        title: 'Ruptura de gôndola detectada',
        message: result.summary || `Ocupação em ${result.fill_percent}%`,
        entity_type: 'analysis', entity_id: ins.rows[0].id, stop_id: stop_id || null,
        data: { fill_percent: result.fill_percent, missing: result.missing_brands },
      });
    }
    if (Array.isArray(result.missing_brands) && result.missing_brands.length > 0) {
      await createAlert({
        organizationId: req.organizationId, type: 'shelf_missing_brand', severity: 'medium',
        title: 'Marcas esperadas ausentes',
        message: `Ausentes: ${result.missing_brands.join(', ')}`,
        entity_type: 'analysis', entity_id: ins.rows[0].id, stop_id: stop_id || null,
        data: { missing: result.missing_brands },
      });
    }

    res.json(ins.rows[0]);
  } catch (e) { logError('analysis/shelf', e); res.status(500).json({ error: e.message }); }
});

// Listagem de análises
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

// ---------- Alertas ----------
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
    await query(
      `UPDATE smartroute_alerts SET resolved=true, resolved_at=NOW(), resolved_by=$2
       WHERE id=$1 AND organization_id=$3`,
      [req.params.id, req.userId, req.organizationId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/alerts/:id', async (req, res) => {
  try {
    await query(`DELETE FROM smartroute_alerts WHERE id=$1 AND organization_id=$2`, [req.params.id, req.organizationId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Scan automático - gera alertas operacionais
router.post('/alerts/scan', async (req, res) => {
  try {
    const org = req.organizationId;

    // 1. Motoristas offline há mais de 30 min durante rota em andamento
    const offline = await query(`
      SELECT DISTINCT d.id, d.full_name, r.id as route_id, r.code
      FROM smartroute_drivers d
      JOIN smartroute_routes r ON r.driver_id = d.id AND r.status='em_andamento'
      WHERE d.organization_id=$1
        AND (d.last_location_at IS NULL OR d.last_location_at < NOW() - INTERVAL '30 minutes')
    `, [org]);
    for (const row of offline.rows) {
      await createAlert({ organizationId: org, type: 'driver_offline', severity: 'high',
        title: 'Motorista sem sinal', message: `${row.full_name} está sem atualização há mais de 30 min (rota ${row.code})`,
        entity_type: 'driver', entity_id: row.id, route_id: row.route_id, driver_id: row.id });
    }

    // 2. Rotas atrasadas: planejadas para hoje e ainda pendentes após 14h
    const late = await query(`
      SELECT id, code FROM smartroute_routes
      WHERE organization_id=$1 AND status='planejada'
        AND planned_date::date = CURRENT_DATE
        AND NOW()::time > TIME '14:00'
    `, [org]);
    for (const row of late.rows) {
      await createAlert({ organizationId: org, type: 'route_late_start', severity: 'medium',
        title: 'Rota não iniciada', message: `Rota ${row.code} ainda não foi iniciada hoje`,
        entity_type: 'route', entity_id: row.id, route_id: row.id });
    }

    // 3. Paradas não entregues
    const failed = await query(`
      SELECT s.id, s.pdv_name, s.route_id, r.code, s.notes
      FROM smartroute_route_stops s
      JOIN smartroute_routes r ON r.id=s.route_id
      WHERE r.organization_id=$1 AND s.status='nao_entregue'
        AND s.updated_at > NOW() - INTERVAL '24 hours'
    `, [org]);
    for (const row of failed.rows) {
      await createAlert({ organizationId: org, type: 'delivery_failed', severity: 'high',
        title: 'Entrega não realizada', message: `${row.pdv_name} (rota ${row.code}): ${row.notes || 'sem motivo'}`,
        entity_type: 'stop', entity_id: row.id, route_id: row.route_id, stop_id: row.id });
    }

    // 4. CNH vencendo em 30 dias
    const cnh = await query(`
      SELECT id, full_name, license_expires_at FROM smartroute_drivers
      WHERE organization_id=$1 AND active=true
        AND license_expires_at IS NOT NULL
        AND license_expires_at <= CURRENT_DATE + INTERVAL '30 days'
    `, [org]);
    for (const row of cnh.rows) {
      const days = Math.max(0, Math.ceil((new Date(row.license_expires_at) - new Date()) / 86400000));
      await createAlert({ organizationId: org, type: 'driver_license_expiring',
        severity: days <= 0 ? 'critical' : days <= 7 ? 'high' : 'medium',
        title: days <= 0 ? 'CNH vencida' : 'CNH próxima do vencimento',
        message: `${row.full_name}: vence em ${days} dia(s)`,
        entity_type: 'driver', entity_id: row.id, driver_id: row.id });
    }

    const stats = await query(
      `SELECT severity, COUNT(*)::int as n FROM smartroute_alerts
       WHERE organization_id=$1 AND resolved=false GROUP BY severity`, [org]
    );
    res.json({ ok: true, generated: offline.rows.length + late.rows.length + failed.rows.length + cnh.rows.length, by_severity: stats.rows });
  } catch (e) { logError('alerts/scan', e); res.status(500).json({ error: e.message }); }
});

// KPI resumo para dashboard IA
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

export default router;
