import jsPDF from 'jspdf';
import { formatCnpj, formatCpf, formatPhone } from '@/lib/br-utils';
import { resolveMediaUrl } from '@/lib/media';

export interface AgencyContractData {
  agencyName: string;
  agencyCnpj?: string;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone?: string;
  responsibleCpf: string;
  address?: string;
  city?: string;
  state?: string;
  planName?: string;
  contractedPromoters?: number;
  pricePerPromoter?: number;
  organizationName?: string;
  organizationCnpj?: string;
  organizationAddress?: string;
  organizationCity?: string;
  organizationState?: string;
  organizationZipCode?: string;
  organizationResponsibleName?: string;
  organizationResponsibleCpf?: string;
  organizationResponsibleEmail?: string;
  organizationResponsiblePhone?: string;
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  bodyClauses?: string[];
}

const DEFAULT_HEADER_BG = '#121624';
const DEFAULT_HEADER_TEXT = '#FFFFFF';
const DEFAULT_SECTION_BG = '#F4F6FA';

const defaultClauses = [
  'Pelo presente instrumento, a empresa {{organization_name}} e a agência {{agency_name}} firmam contrato para operação de promotores em unidades e PDVs previamente autorizados no sistema.',
  'A contratada declara que os promotores vinculados atuarão somente nas lojas, dias, horários e marcas liberados na plataforma, observando as regras operacionais de cada supermercado.',
  'A cobrança recorrente será calculada conforme o plano {{plan_name}}, considerando {{contracted_promoters}} promotor(es) contratado(s), no valor mensal estimado de R$ {{monthly_amount}}.',
  'Em caso de inadimplência, o acesso dos promotores poderá ser bloqueado automaticamente, conforme políticas comerciais e operacionais cadastradas.',
  'Este documento poderá ser assinado eletronicamente, com validade jurídica, permanecendo disponível para auditoria e conferência no sistema.',
];

type RgbColor = { r: number; g: number; b: number };

function hexToRgb(hex: string | undefined, fallback: string): RgbColor {
  const value = String(hex || fallback).trim().replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((char) => `${char}${char}`).join('')
    : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return hexToRgb(fallback, '#121624');
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function safeValue(value?: string | number | null, fallback = '—') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function replaceTokens(template: string, data: AgencyContractData, monthlyAmount: number) {
  const tokens: Record<string, string> = {
    agency_name: safeValue(data.agencyName),
    agency_cnpj: formatCnpj(data.agencyCnpj || ''),
    agency_responsible_name: safeValue(data.responsibleName),
    agency_responsible_email: safeValue(data.responsibleEmail),
    agency_responsible_phone: formatPhone(data.responsiblePhone || ''),
    agency_responsible_cpf: formatCpf(data.responsibleCpf || ''),
    agency_address: safeValue(data.address),
    agency_city: safeValue(data.city),
    agency_state: safeValue(data.state),
    organization_name: safeValue(data.organizationName || 'Ayratech'),
    organization_cnpj: formatCnpj(data.organizationCnpj || ''),
    organization_address: safeValue(data.organizationAddress),
    organization_city: safeValue(data.organizationCity),
    organization_state: safeValue(data.organizationState),
    organization_zip_code: safeValue(data.organizationZipCode),
    organization_responsible_name: safeValue(data.organizationResponsibleName),
    organization_responsible_email: safeValue(data.organizationResponsibleEmail),
    organization_responsible_phone: formatPhone(data.organizationResponsiblePhone || ''),
    organization_responsible_cpf: formatCpf(data.organizationResponsibleCpf || ''),
    plan_name: safeValue(data.planName || 'vigente'),
    contracted_promoters: String(data.contractedPromoters || 0),
    price_per_promoter: (data.pricePerPromoter || 0).toFixed(2),
    monthly_amount: monthlyAmount.toFixed(2),
  };

  return String(template || '').replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, token) => tokens[token] || '');
}

async function loadImageDataUrl(imageUrl?: string) {
  const resolvedUrl = resolveMediaUrl(imageUrl);
  if (!resolvedUrl) return null;

  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function inferImageFormat(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

export async function generateAgencyContractPdfBlob(data: AgencyContractData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const today = new Date().toLocaleDateString('pt-BR');
  const monthlyAmount = (data.contractedPromoters || 0) * (data.pricePerPromoter || 0);
  const headerBg = hexToRgb(data.headerBgColor, DEFAULT_HEADER_BG);
  const headerText = hexToRgb(data.headerTextColor, DEFAULT_HEADER_TEXT);
  const sectionBg = hexToRgb(DEFAULT_SECTION_BG, DEFAULT_SECTION_BG);
  const logoDataUrl = await loadImageDataUrl(data.logoUrl);
  const headerTitle = safeValue(data.headerText, 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS');
  const footerText = safeValue(data.footerText, 'Este documento poderá ser assinado eletronicamente, com validade jurídica, permanecendo disponível para auditoria e conferência no sistema.');

  const startPage = () => {
    doc.setFillColor(headerBg.r, headerBg.g, headerBg.b);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setTextColor(headerText.r, headerText.g, headerText.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(headerTitle, pageWidth / 2, 16, { align: 'center', maxWidth: 140 });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(safeValue(data.organizationName, 'Ayratech'), pageWidth / 2, 24, { align: 'center' });
    doc.text(`Emitido em ${today}`, pageWidth / 2, 30, { align: 'center' });

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, inferImageFormat(logoDataUrl), margin, 7, 22, 22);
      } catch {
        // ignore invalid logo render and continue with PDF generation
      }
    }

    return 44;
  };

  const ensureSpace = (currentY: number, requiredHeight: number) => {
    if (currentY + requiredHeight <= pageHeight - 28) return currentY;
    doc.addPage();
    return startPage();
  };

  let y = startPage();

  y = drawTitle(doc, 'PARTES', margin, y, contentWidth, sectionBg, headerBg);
  y = drawField(doc, 'Contratante', safeValue(data.organizationName, 'Ayratech'), margin, y, contentWidth);
  y = drawField(doc, 'CNPJ', formatCnpj(data.organizationCnpj || ''), margin, y, contentWidth);
  y = drawField(doc, 'Responsável legal', safeValue(data.organizationResponsibleName), margin, y, contentWidth);
  y = drawField(doc, 'CPF do responsável', formatCpf(data.organizationResponsibleCpf || ''), margin, y, contentWidth);
  y = drawField(doc, 'E-mail', safeValue(data.organizationResponsibleEmail), margin, y, contentWidth);
  if (data.organizationResponsiblePhone) y = drawField(doc, 'Telefone', formatPhone(data.organizationResponsiblePhone), margin, y, contentWidth);
  if (data.organizationAddress) y = drawField(doc, 'Endereço', data.organizationAddress, margin, y, contentWidth);
  if (data.organizationCity || data.organizationState) y = drawField(doc, 'Cidade/UF', [data.organizationCity, data.organizationState].filter(Boolean).join('/'), margin, y, contentWidth);

  y += 4;
  y = ensureSpace(y, 52);
  y = drawTitle(doc, 'CONTRATADA', margin, y, contentWidth, sectionBg, headerBg);
  y = drawField(doc, 'Empresa', data.agencyName, margin, y, contentWidth);
  y = drawField(doc, 'CNPJ', formatCnpj(data.agencyCnpj || ''), margin, y, contentWidth);
  y = drawField(doc, 'Responsável', data.responsibleName, margin, y, contentWidth);
  y = drawField(doc, 'CPF do responsável', formatCpf(data.responsibleCpf), margin, y, contentWidth);
  y = drawField(doc, 'E-mail', data.responsibleEmail, margin, y, contentWidth);
  if (data.responsiblePhone) y = drawField(doc, 'Telefone', formatPhone(data.responsiblePhone), margin, y, contentWidth);
  if (data.address) y = drawField(doc, 'Endereço', data.address, margin, y, contentWidth);
  if (data.city || data.state) y = drawField(doc, 'Cidade/UF', [data.city, data.state].filter(Boolean).join('/'), margin, y, contentWidth);

  y += 4;
  y = ensureSpace(y, 30);
  y = drawTitle(doc, 'CONDIÇÕES COMERCIAIS', margin, y, contentWidth, sectionBg, headerBg);
  y = drawField(doc, 'Plano', data.planName || 'Plano comercial vigente', margin, y, contentWidth);
  y = drawField(doc, 'Promotores contratados', String(data.contractedPromoters || 0), margin, y, contentWidth);
  y = drawField(doc, 'Valor por promotor', `R$ ${(data.pricePerPromoter || 0).toFixed(2)}`, margin, y, contentWidth);
  y = drawField(doc, 'Valor mensal estimado', `R$ ${monthlyAmount.toFixed(2)}`, margin, y, contentWidth);

  y += 6;
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const clauses = (Array.isArray(data.bodyClauses) && data.bodyClauses.length > 0 ? data.bodyClauses : defaultClauses)
    .map((clause) => replaceTokens(clause, data, monthlyAmount))
    .filter(Boolean);

  clauses.forEach((clause, index) => {
    y = ensureSpace(y, 18);
    const lines = doc.splitTextToSize(`${index + 1}. ${clause}`, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 3;
  });

  y += 10;
  y = ensureSpace(y, 32);
  doc.setDrawColor(140, 140, 140);
  doc.line(margin, y, margin + 74, y);
  doc.line(pageWidth - margin - 74, y, pageWidth - margin, y);
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(safeValue(data.organizationResponsibleName, data.organizationName || 'Ayratech'), margin + 37, y + 5, { align: 'center', maxWidth: 72 });
  doc.text(safeValue(data.organizationName, 'Ayratech'), margin + 37, y + 10, { align: 'center', maxWidth: 72 });
  doc.text(`CPF: ${formatCpf(data.organizationResponsibleCpf || '') || '—'}`, margin + 37, y + 15, { align: 'center', maxWidth: 72 });
  doc.text(safeValue(data.responsibleName), pageWidth - margin - 37, y + 5, { align: 'center', maxWidth: 72 });
  doc.text(safeValue(data.agencyName), pageWidth - margin - 37, y + 10, { align: 'center', maxWidth: 72 });
  doc.text(`CPF: ${formatCpf(data.responsibleCpf)}`, pageWidth - margin - 37, y + 15, { align: 'center', maxWidth: 72 });

  const footerLines = doc.splitTextToSize(footerText, contentWidth);
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(footerLines, margin, pageHeight - 12, { maxWidth: contentWidth });

  return doc.output('blob');
}

function drawTitle(doc: jsPDF, title: string, x: number, y: number, width: number, background: RgbColor, textColor: RgbColor) {
  doc.setFillColor(background.r, background.g, background.b);
  doc.roundedRect(x, y, width, 8, 2, 2, 'F');
  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, x + 3, y + 5.5);
  return y + 12;
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(88, 94, 112);
  doc.text(`${label}:`, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(34, 34, 34);
  const lines = doc.splitTextToSize(value || '—', width - 42);
  doc.text(lines, x + 42, y);
  return y + lines.length * 4 + 2;
}
