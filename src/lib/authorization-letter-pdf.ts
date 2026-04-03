import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira',
  4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado',
};

export interface AuthorizationLetterData {
  // Promotor
  promoterName: string;
  promoterCpf: string;
  promoterPhone?: string;
  // Agência
  agencyName?: string;
  agencyCnpj?: string;
  agencyResponsible?: string;
  // PDV / Unidade
  unitName: string;
  unitAddress?: string;
  unitCnpj?: string;
  networkName?: string;
  // Autorização
  brands: string[];
  allowedWeekdays: number[];
  startTime: string;
  endTime: string;
  validFrom?: string;
  validUntil?: string;
  // Assinatura digital (promotor interno)
  isDigitallySigned?: boolean;
  signedBy?: string;
  signedAt?: string;
  signatureHash?: string;
  organizationName?: string;
}

export function generateAuthorizationLetterPDF(data: AuthorizationLetterData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ─── Header ───
  doc.setFillColor(20, 20, 35);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CARTA DE AUTORIZAÇÃO', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Acesso de Promotor ao Ponto de Venda', pageWidth / 2, 28, { align: 'center' });

  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.setFontSize(8);
  doc.text(`Emitida em: ${today}`, pageWidth / 2, 36, { align: 'center' });

  if (data.organizationName) {
    doc.text(data.organizationName, pageWidth / 2, 42, { align: 'center' });
  }

  y = 55;
  doc.setTextColor(30, 30, 30);

  // ─── Seção: Dados do Promotor ───
  y = drawSectionTitle(doc, 'DADOS DO PROMOTOR', margin, y, contentWidth);
  y = drawField(doc, 'Nome Completo', data.promoterName, margin, y, contentWidth);
  y = drawField(doc, 'CPF', data.promoterCpf, margin, y, contentWidth);
  if (data.promoterPhone) {
    y = drawField(doc, 'Telefone', data.promoterPhone, margin, y, contentWidth);
  }
  y += 4;

  // ─── Seção: Dados da Agência ───
  if (data.agencyName) {
    y = drawSectionTitle(doc, 'DADOS DA AGÊNCIA', margin, y, contentWidth);
    y = drawField(doc, 'Agência', data.agencyName, margin, y, contentWidth);
    if (data.agencyCnpj) y = drawField(doc, 'CNPJ', data.agencyCnpj, margin, y, contentWidth);
    if (data.agencyResponsible) y = drawField(doc, 'Responsável', data.agencyResponsible, margin, y, contentWidth);
    y += 4;
  }

  // ─── Seção: Ponto de Venda ───
  y = drawSectionTitle(doc, 'PONTO DE VENDA AUTORIZADO', margin, y, contentWidth);
  y = drawField(doc, 'Estabelecimento', data.unitName, margin, y, contentWidth);
  if (data.networkName) y = drawField(doc, 'Rede', data.networkName, margin, y, contentWidth);
  if (data.unitCnpj) y = drawField(doc, 'CNPJ', data.unitCnpj, margin, y, contentWidth);
  if (data.unitAddress) y = drawField(doc, 'Endereço', data.unitAddress, margin, y, contentWidth);
  y += 4;

  // ─── Seção: Autorização ───
  y = drawSectionTitle(doc, 'DETALHES DA AUTORIZAÇÃO', margin, y, contentWidth);
  
  const weekdays = data.allowedWeekdays.map(d => WEEKDAY_NAMES[d] || `${d}`).join(', ');
  y = drawField(doc, 'Dias Autorizados', weekdays, margin, y, contentWidth);
  y = drawField(doc, 'Horário', `${data.startTime} às ${data.endTime}`, margin, y, contentWidth);
  
  if (data.brands.length > 0) {
    y = drawField(doc, 'Marcas Atendidas', data.brands.join(', '), margin, y, contentWidth);
  }

  if (data.validFrom) {
    const validity = data.validUntil
      ? `${data.validFrom} a ${data.validUntil}`
      : `A partir de ${data.validFrom}`;
    y = drawField(doc, 'Validade', validity, margin, y, contentWidth);
  }
  y += 6;

  // ─── Corpo da Carta ───
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const bodyText = data.agencyName
    ? `Pelo presente instrumento, a agência ${data.agencyName}${data.agencyCnpj ? ` (CNPJ: ${data.agencyCnpj})` : ''} autoriza o(a) promotor(a) ${data.promoterName}, portador(a) do CPF ${data.promoterCpf}, a acessar o estabelecimento ${data.unitName} para realizar atividades de merchandising e promoção das marcas acima listadas, nos dias e horários indicados.`
    : `Pelo presente instrumento, autorizamos o(a) promotor(a) ${data.promoterName}, portador(a) do CPF ${data.promoterCpf}, a acessar o estabelecimento ${data.unitName} para realizar atividades de merchandising e promoção das marcas acima listadas, nos dias e horários indicados.`;

  const lines = doc.splitTextToSize(bodyText, contentWidth);
  doc.text(lines, margin, y);
  y += lines.length * 4.5 + 4;

  const bodyText2 = 'Esta carta tem validade enquanto mantidas as condições de autorização acima descritas, podendo ser revogada a qualquer tempo por qualquer uma das partes.';
  const lines2 = doc.splitTextToSize(bodyText2, contentWidth);
  doc.text(lines2, margin, y);
  y += lines2.length * 4.5 + 10;

  // ─── Assinaturas ───
  if (data.isDigitallySigned) {
    // Bloco de assinatura digital
    doc.setFillColor(240, 249, 240);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(margin, y, contentWidth, 35, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('✓ DOCUMENTO ASSINADO DIGITALMENTE', margin + 5, y + 8);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    if (data.signedBy) doc.text(`Assinado por: ${data.signedBy}`, margin + 5, y + 15);
    if (data.signedAt) doc.text(`Data/Hora: ${data.signedAt}`, margin + 5, y + 21);
    if (data.signatureHash) doc.text(`Hash: ${data.signatureHash}`, margin + 5, y + 27);

    doc.setFontSize(7);
    doc.text('Válido nos termos da MP 2.200-2/2001 e Lei 14.063/2020', margin + 5, y + 33);
    y += 40;
  } else {
    // Linha para assinatura manual
    const signY = y + 15;
    const halfWidth = (contentWidth - 20) / 2;

    // Assinatura do responsável (agência ou organização)
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, signY, margin + halfWidth, signY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(data.agencyResponsible || 'Responsável', margin, signY + 5);
    doc.text(data.agencyName || 'Empresa', margin, signY + 10);

    // Assinatura do promotor
    doc.line(margin + halfWidth + 20, signY, margin + contentWidth, signY);
    doc.text(data.promoterName, margin + halfWidth + 20, signY + 5);
    doc.text(`CPF: ${data.promoterCpf}`, margin + halfWidth + 20, signY + 10);

    y = signY + 18;
  }

  // ─── Rodapé ───
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Documento gerado automaticamente pelo sistema Ayratech. Em caso de dúvidas, entre em contato com o administrador.',
    pageWidth / 2,
    285,
    { align: 'center' }
  );

  const docId = `AYR-${Date.now().toString(36).toUpperCase()}`;
  doc.text(`ID: ${docId}`, pageWidth / 2, 290, { align: 'center' });

  return doc;
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, width: number): number {
  doc.setFillColor(245, 245, 250);
  doc.setDrawColor(200, 200, 220);
  doc.roundedRect(x, y, width, 8, 1.5, 1.5, 'FD');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 60);
  doc.text(title, x + 4, y + 5.5);
  return y + 12;
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 120);
  doc.text(`${label}:`, x + 2, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  const valueLines = doc.splitTextToSize(value, width - 50);
  doc.text(valueLines, x + 50, y);
  return y + valueLines.length * 4 + 2;
}

export function downloadAuthorizationLetter(data: AuthorizationLetterData, filename?: string) {
  const doc = generateAuthorizationLetterPDF(data);
  const name = filename || `carta-autorizacao-${data.promoterName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(name);
}
