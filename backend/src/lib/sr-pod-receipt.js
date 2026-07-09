// SmartRoute — Comprovante de Entrega (POD) em PDF
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { query } from '../db.js';

async function fetchPngBytes(url) {
  if (!url) return null;
  try {
    if (url.startsWith('data:image/')) {
      const b64 = url.split(',')[1] || '';
      return Uint8Array.from(Buffer.from(b64, 'base64'));
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

export async function generatePodReceiptPDF(stopId) {
  const r = await query(
    `SELECT s.*, p.name AS pdv_name, p.address AS pdv_address, p.city AS pdv_city,
            o.order_number, o.value_cents,
            rt.code AS route_code,
            org.name AS org_name
     FROM smartroute_route_stops s
     LEFT JOIN smartroute_pdvs p ON p.id=s.pdv_id
     LEFT JOIN smartroute_orders o ON o.id=s.order_id
     LEFT JOIN smartroute_routes rt ON rt.id=s.route_id
     LEFT JOIN organizations org ON org.id=s.organization_id
     WHERE s.id=$1`, [stopId]
  );
  const s = r.rows[0];
  if (!s) throw new Error('Parada não encontrada');

  const media = await query(
    `SELECT kind, url FROM smartroute_stop_media WHERE stop_id=$1 ORDER BY taken_at`,
    [stopId]
  );
  const sig = media.rows.find((m) => m.kind === 'signature')?.url || s.signature_url;
  const invoice = media.rows.find((m) => m.kind === 'invoice')?.url;
  const facade = media.rows.find((m) => m.kind === 'facade')?.url;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (t, x, y, o = {}) =>
    page.drawText(String(t ?? ''), { x, y, size: o.size || 10, font: o.bold ? bold : font, color: o.color || rgb(0, 0, 0) });

  let y = 800;
  draw('COMPROVANTE DE ENTREGA (POD)', 40, y, { bold: true, size: 14 }); y -= 22;
  draw(s.org_name || '-', 40, y, { size: 9 }); y -= 18;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); y -= 16;

  draw('Rota:', 40, y, { bold: true }); draw(s.route_code || '-', 90, y); y -= 14;
  if (s.order_number) { draw('Pedido:', 40, y, { bold: true }); draw(s.order_number, 90, y); y -= 14; }
  draw('PDV:', 40, y, { bold: true }); draw(s.pdv_name || '-', 90, y); y -= 14;
  draw('Endereço:', 40, y, { bold: true }); draw(`${s.pdv_address || ''} - ${s.pdv_city || ''}`, 110, y); y -= 20;

  const dt = s.checkout_at ? new Date(s.checkout_at) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const when = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())} (GMT-3)`;
  draw('Data/Hora da entrega:', 40, y, { bold: true }); draw(when, 175, y); y -= 20;

  draw('Recebido por:', 40, y, { bold: true }); draw(s.receiver_name || '-', 130, y); y -= 14;
  if (s.receiver_document) {
    const label = (s.receiver_document_type || 'cpf').toUpperCase();
    draw(`${label}:`, 40, y, { bold: true }); draw(s.receiver_document, 90, y); y -= 14;
  }
  if (s.checkout_lat && s.checkout_lng) {
    draw('GPS entrega:', 40, y, { bold: true });
    draw(`${Number(s.checkout_lat).toFixed(5)}, ${Number(s.checkout_lng).toFixed(5)}`, 120, y); y -= 14;
  }
  if (s.notes) { draw('Observações:', 40, y, { bold: true }); draw(String(s.notes).slice(0, 80), 120, y); y -= 14; }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) }); y -= 16;

  // Assinatura
  draw('Assinatura do recebedor:', 40, y, { bold: true }); y -= 8;
  const sigBytes = sig ? await fetchPngBytes(sig) : null;
  if (sigBytes) {
    try {
      const img = await pdf.embedPng(sigBytes).catch(() => pdf.embedJpg(sigBytes));
      page.drawImage(img, { x: 40, y: y - 90, width: 220, height: 90 });
    } catch { /* ignore */ }
  }
  page.drawRectangle({ x: 40, y: y - 90, width: 220, height: 90, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
  y -= 110;

  // Mini imagens (fachada / NF)
  const embedThumb = async (url, x, yy, w, h, label) => {
    draw(label, x, yy + h + 4, { size: 8, bold: true });
    page.drawRectangle({ x, y: yy, width: w, height: h, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
    const bytes = await fetchPngBytes(url);
    if (!bytes) return;
    try {
      const img = await pdf.embedJpg(bytes).catch(() => pdf.embedPng(bytes));
      page.drawImage(img, { x: x + 2, y: yy + 2, width: w - 4, height: h - 4 });
    } catch { /* ignore */ }
  };
  if (facade) await embedThumb(facade, 300, y - 90, 120, 90, 'Fachada');
  if (invoice) await embedThumb(invoice, 435, y - 90, 120, 90, 'Nota fiscal');

  y = 90;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) }); y -= 14;
  draw('Este comprovante foi gerado eletronicamente pelo SmartRoute.', 40, y, { size: 8, color: rgb(0.3, 0.3, 0.3) }); y -= 10;
  draw(`ID: ${s.id}`, 40, y, { size: 7, color: rgb(0.5, 0.5, 0.5) });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
