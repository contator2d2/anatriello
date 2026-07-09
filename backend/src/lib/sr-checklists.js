// SmartRoute — Motor de checklists configuráveis (Onda 2)
import { query } from '../db.js';

// Resolve todos os templates aplicáveis para um stop, com snapshot de itens.
export async function resolveTemplatesForStop(stopId, organizationId) {
  const s = await query(
    `SELECT s.id, s.pdv_id, s.order_id, s.template_snapshot_id,
            p.pdv_type, p.channel, p.category, p.region, p.state, p.city,
            p.client_id
     FROM smartroute_route_stops s
     LEFT JOIN smartroute_pdvs p ON p.id = s.pdv_id
     WHERE s.id = $1`, [stopId]
  );
  const stop = s.rows[0];
  if (!stop) return { templates: [], items: [] };

  const assigns = await query(
    `SELECT a.*, t.name, t.description
     FROM smartroute_checklist_assignments a
     JOIN smartroute_checklist_templates t ON t.id = a.template_id
     WHERE a.organization_id = $1 AND a.active = true AND t.active = true
     ORDER BY a.priority ASC, t.priority ASC`,
    [organizationId]
  );

  const matches = [];
  for (const a of assigns.rows) {
    const sc = a.scope || {};
    const ok =
      inArr(sc.client_ids, stop.client_id) &&
      inArr(sc.pdv_types, stop.pdv_type) &&
      inArr(sc.channels, stop.channel) &&
      inArr(sc.categories, stop.category) &&
      inArr(sc.regions, stop.region) &&
      inArr(sc.states, stop.state) &&
      inArr(sc.cities, stop.city);
    if (ok) matches.push(a);
  }

  if (!matches.length) return { templates: [], items: [] };

  const tplIds = [...new Set(matches.map((m) => m.template_id))];
  const items = await query(
    `SELECT * FROM smartroute_checklist_template_items
     WHERE template_id = ANY($1::uuid[])
     ORDER BY seq ASC, created_at ASC`,
    [tplIds]
  );

  const templates = matches.map((m) => ({
    id: m.template_id, name: m.name, description: m.description, priority: m.priority,
  }));

  return { templates, items: items.rows };
}

function inArr(arr, val) {
  if (!arr || !arr.length) return true;
  return arr.includes(val);
}

// Retorna itens obrigatórios ainda sem resposta
export async function getPendingRequiredItems(stopId, organizationId) {
  const { items } = await resolveTemplatesForStop(stopId, organizationId);
  const required = items.filter((i) => i.required);
  if (!required.length) return [];
  const responses = await query(
    `SELECT item_id FROM smartroute_stop_checklist_responses WHERE stop_id = $1`,
    [stopId]
  );
  const done = new Set(responses.rows.map((r) => r.item_id));
  return required.filter((i) => !done.has(i.id)).map((i) => i.label);
}

// ============ OCR via provedor configurado (OpenAI / Gemini / OpenRouter) ============
// Usa a configuração global da Anatriello (Superadmin → IA Anatriello).
import { loadDocValidationConfig } from '../routes/ayratech-ai.js';

const OCR_PROMPT =
  'Você é um extrator de dados de embalagens de produtos. Analise a imagem e retorne APENAS um JSON válido no formato:\n' +
  '{"product":"","brand":"","code":"","ean":"","batch":"","manufactured_at":"YYYY-MM-DD","expires_at":"YYYY-MM-DD","confidence":0.0}\n' +
  'Use null para campos ausentes. Não escreva nada fora do JSON.';

function parseJsonLoose(content) {
  try { return JSON.parse(content); }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

export async function ocrProductImage(imageDataUrl, { model: overrideModel } = {}) {
  const cfg = await loadDocValidationConfig();
  if (!cfg?.apiKey) {
    throw new Error('IA não configurada. Configure em Superadmin → IA Anatriello (OpenAI recomendado para OCR).');
  }
  if (cfg.enabled === false) throw new Error('IA desativada nas configurações da Anatriello');

  const provider = cfg.provider || 'openai';
  const model = overrideModel || cfg.model || (provider === 'openai' ? 'gpt-4o' : provider === 'gemini' ? 'gemini-2.5-pro' : 'openai/gpt-4o');

  let url, headers, body;
  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers = { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
    body = {
      model,
      messages: [
        { role: 'system', content: 'Retorne apenas JSON.' },
        { role: 'user', content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]},
      ],
      response_format: { type: 'json_object' },
    };
  } else if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
    body = {
      model,
      messages: [
        { role: 'system', content: 'Retorne apenas JSON.' },
        { role: 'user', content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]},
      ],
      response_format: { type: 'json_object' },
    };
  } else if (provider === 'gemini') {
    // Converte data URL em inlineData
    let mimeType = 'image/jpeg', data = imageDataUrl;
    const m = /^data:([^;]+);base64,(.+)$/.exec(imageDataUrl);
    if (m) { mimeType = m[1]; data = m[2]; }
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
    headers = { 'Content-Type': 'application/json' };
    body = {
      contents: [{ role: 'user', parts: [
        { text: OCR_PROMPT },
        { inlineData: { mimeType, data } },
      ]}],
      generationConfig: { responseMimeType: 'application/json' },
    };
  } else {
    throw new Error(`Provedor de IA não suportado: ${provider}`);
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${provider} ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = provider === 'gemini'
    ? (data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    : (data.choices?.[0]?.message?.content || '{}');
  return parseJsonLoose(content);
}
