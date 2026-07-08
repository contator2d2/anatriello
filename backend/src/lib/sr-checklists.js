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

// ============ OCR via Lovable AI Gateway (OpenAI/Gemini multimodal) ============
export async function ocrProductImage(imageDataUrl, { model } = {}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error('LOVABLE_API_KEY não configurado');

  const chosen = model || 'google/gemini-2.5-flash';
  const prompt =
    'Você é um extrator de dados de embalagens de produtos. Analise a imagem e retorne APENAS um JSON válido no formato:\n' +
    '{"product":"","brand":"","code":"","ean":"","batch":"","manufactured_at":"YYYY-MM-DD","expires_at":"YYYY-MM-DD","confidence":0.0}\n' +
    'Use null para campos ausentes. Não escreva nada fora do JSON.';

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: chosen,
      messages: [
        { role: 'system', content: 'Retorne apenas JSON.' },
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ]},
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(content); }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }
  return parsed;
}
