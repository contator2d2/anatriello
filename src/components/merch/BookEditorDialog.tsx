import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSendEmail } from "@/hooks/use-email";
import { api, API_URL, getAuthToken } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { useBranding } from "@/hooks/use-branding";
import { 
  FileText, Download, Send, Mail, Eye, GripVertical, X, Loader2, 
  Image as ImageIcon, Link2, Copy, Check, MessageSquare
} from "lucide-react";

interface BookPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  product_name?: string;
  category_name?: string;
  brand_name?: string;
  pdv_name?: string;
  promoter_name?: string;
  captured_at?: string;
  caption?: string;
}

interface BrandOption {
  id: string;
  name: string;
  logo_url?: string;
}

interface BookEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: BookPhoto[];
  brandName?: string;
  brandLogoUrl?: string;
  clientEmail?: string;
  clientPhone?: string;
  brands?: BrandOption[];
}

const PHOTO_TYPES: Record<string, string> = {
  checkin: 'Check-in', checkout: 'Check-out', before: 'Antes', after: 'Depois',
  category_before: 'Antes (Categoria)', category_after: 'Depois (Categoria)',
  stock: 'Estoque', shelf: 'Prateleira', extra_point: 'Ponto Extra',
  damage: 'Avaria', expiry: 'Validade', contingency: 'Contingência',
};

export function BookEditorDialog({ open, onOpenChange, photos: initialPhotos, brandName, brandLogoUrl, clientEmail, clientPhone, brands = [] }: BookEditorDialogProps) {
  const { toast } = useToast();
  const { branding } = useBranding();
  const sendEmail = useSendEmail();
  
  const [tab, setTab] = useState("edit");
  const [selectedBrandId, setSelectedBrandId] = useState<string>(() => {
    if (!brandName || !brands.length) return '';
    const match = brands.find(b => b.name === brandName);
    return match?.id || '';
  });
  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const activeBrandName = selectedBrand?.name || brandName || 'Cliente';
  const activeBrandLogo = selectedBrand?.logo_url ? resolveMediaUrl(selectedBrand.logo_url) : (brandLogoUrl ? resolveMediaUrl(brandLogoUrl) : null);

  const [title, setTitle] = useState(`Book de Fotos — ${brandName || 'Cliente'}`);
  const [subtitle, setSubtitle] = useState(`Relatório fotográfico de merchandising`);
  const [notes, setNotes] = useState('');
  const [bookPhotos, setBookPhotos] = useState<BookPhoto[]>(() => 
    initialPhotos.map(p => ({ ...p, caption: '', photo_url: resolveMediaUrl(p.photo_url) || p.photo_url }))
  );
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [webLink, setWebLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendTo, setSendTo] = useState<'whatsapp' | 'email' | ''>('');
  const [recipientEmail, setRecipientEmail] = useState(clientEmail || '');
  const [recipientPhone, setRecipientPhone] = useState(clientPhone || '');

  // Update title when brand changes
  const handleBrandChange = (brandId: string) => {
    setSelectedBrandId(brandId);
    const brand = brands.find(b => b.id === brandId);
    if (brand) {
      setTitle(`Book de Fotos — ${brand.name}`);
    }
  };

  const removePhoto = useCallback((id: string) => {
    setBookPhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateCaption = useCallback((id: string, caption: string) => {
    setBookPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
  }, []);

  const movePhoto = useCallback((fromIdx: number, toIdx: number) => {
    setBookPhotos(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  }, []);

  // Generate and download PDF client-side
  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;
      const margin = 15;
      const contentW = pageW - margin * 2;
      
      // Cover page
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Brand logo (priority) or org logo
      const logoToUse = activeBrandLogo || branding.logo_topbar;
      if (logoToUse) {
        try {
          const img = await loadImage(logoToUse);
          const logoH = 20;
          const logoW = (img.width / img.height) * logoH;
          doc.addImage(img, 'PNG', (pageW - logoW) / 2, 40, logoW, logoH);
        } catch { /* skip logo */ }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.text(title, pageW / 2, 90, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(180, 180, 180);
      doc.text(subtitle, pageW / 2, 105, { align: 'center' });
      
      const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.setFontSize(11);
      doc.text(dateStr, pageW / 2, 120, { align: 'center' });
      
      if (notes) {
        doc.setFontSize(10);
        doc.setTextColor(160, 160, 160);
        const lines = doc.splitTextToSize(notes, contentW - 20);
        doc.text(lines, pageW / 2, 140, { align: 'center' });
      }

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`${bookPhotos.length} fotos`, pageW / 2, pageH - 30, { align: 'center' });
      if (branding.company_name) {
        doc.text(branding.company_name, pageW / 2, pageH - 22, { align: 'center' });
      }

      // Photo pages - 2 photos per page
      for (let i = 0; i < bookPhotos.length; i += 2) {
        doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageW, pageH, 'F');

        // Header line
        doc.setDrawColor(230, 120, 10);
        doc.setLineWidth(1);
        doc.line(margin, 10, pageW - margin, 10);

        for (let j = 0; j < 2; j++) {
          const photo = bookPhotos[i + j];
          if (!photo) break;
          
          const yOffset = j === 0 ? 18 : 155;
          const imgH = 100;
          
          try {
            const img = await loadImage(photo.photo_url);
            const ratio = img.width / img.height;
            let imgW = contentW;
            let actualH = imgH;
            if (ratio > contentW / imgH) {
              actualH = contentW / ratio;
            } else {
              imgW = imgH * ratio;
            }
            doc.addImage(img, 'JPEG', margin + (contentW - imgW) / 2, yOffset, imgW, actualH);
          } catch {
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yOffset, contentW, imgH, 'F');
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(10);
            doc.text('Imagem indisponível', pageW / 2, yOffset + imgH / 2, { align: 'center' });
          }

          // Photo info
          const infoY = yOffset + imgH + 5;
          doc.setTextColor(50, 50, 50);
          doc.setFontSize(9);
          const typeLabel = PHOTO_TYPES[photo.photo_type] || photo.photo_type;
          const label = `${typeLabel} — ${photo.product_name || photo.category_name || 'Geral'}`;
          doc.text(label, margin, infoY);
          
          doc.setTextColor(130, 130, 130);
          doc.setFontSize(8);
          const meta = [
            photo.pdv_name && `PDV: ${photo.pdv_name}`,
            photo.promoter_name && `Promotor: ${photo.promoter_name}`,
            photo.captured_at && `Data: ${new Date(photo.captured_at).toLocaleDateString('pt-BR')}`,
          ].filter(Boolean).join('  |  ');
          doc.text(meta, margin, infoY + 5);

          if (photo.caption) {
            doc.setTextColor(70, 70, 70);
            doc.setFontSize(8);
            const captionLines = doc.splitTextToSize(photo.caption, contentW);
            doc.text(captionLines, margin, infoY + 10);
          }
        }

        // Footer
        doc.setTextColor(180, 180, 180);
        doc.setFontSize(7);
        doc.text(`Página ${Math.floor(i / 2) + 1} de ${Math.ceil(bookPhotos.length / 2)}`, pageW / 2, pageH - 8, { align: 'center' });
      }

      doc.save(`book-fotos-${brandName || 'cliente'}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "PDF gerado!", description: "O download do book foi iniciado" });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Create shareable web link with token
  const handleCreateWebLink = async () => {
    setSharing(true);
    try {
      const result = await api<{ token: string; url: string }>('/api/merch/photo-book/share', {
        method: 'POST',
        body: {
          title, subtitle, notes,
          photo_ids: bookPhotos.map(p => p.id),
          captions: bookPhotos.reduce((acc, p) => ({ ...acc, [p.id]: p.caption || '' }), {}),
          brand_logo_url: activeBrandLogo || undefined,
        },
      });
      const fullUrl = `${window.location.origin}/book/${result.token}`;
      setWebLink(fullUrl);
      toast({ title: "Link criado!", description: "O link do book está pronto para compartilhar" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const copyLink = () => {
    if (webLink) {
      navigator.clipboard.writeText(webLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendWhatsApp = () => {
    if (!webLink) return;
    const text = encodeURIComponent(`📸 ${title}\n\n${subtitle}\n\nVeja o book completo: ${webLink}`);
    const phone = recipientPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleSendEmail = async () => {
    if (!webLink || !recipientEmail) return;
    try {
      await sendEmail.mutateAsync({
        to_email: recipientEmail,
        subject: title,
        body_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">${title}</h1>
            <p style="color: #666;">${subtitle}</p>
            ${notes ? `<p style="color: #888;">${notes}</p>` : ''}
            <p style="margin: 20px 0;">
              <a href="${webLink}" style="background: #e8600a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Ver Book de Fotos (${bookPhotos.length} fotos)
              </a>
            </p>
            <p style="color: #999; font-size: 12px;">${branding.company_name || ''}</p>
          </div>
        `,
        send_immediately: true,
        context_type: 'photo_book',
      });
    } catch { /* toast handled by hook */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Editor do Book de Fotos ({bookPhotos.length} fotos)
          </DialogTitle>
          <DialogDescription>Personalize o título, textos e ordem das fotos antes de exportar</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="edit">✏️ Editar</TabsTrigger>
            <TabsTrigger value="preview">👁️ Preview</TabsTrigger>
            <TabsTrigger value="share">📤 Compartilhar</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4 mt-4">
            <div className="grid gap-3">
              {brands.length > 0 && (
                <div>
                  <Label>Cliente / Marca</Label>
                  <div className="flex items-center gap-3">
                    <Select value={selectedBrandId || '__none__'} onValueChange={v => handleBrandChange(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem marca específica</SelectItem>
                        {brands.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeBrandLogo && (
                      <img src={activeBrandLogo} alt="Logo" className="h-8 w-auto rounded border object-contain" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">A logo do cliente aparecerá na capa do book</p>
                </div>
              )}
              <div>
                <Label>Título do Book</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do relatório" />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtítulo" />
              </div>
              <div>
                <Label>Observações / Notas</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações adicionais para o cliente..." rows={3} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fotos ({bookPhotos.length})</Label>
              <p className="text-xs text-muted-foreground">Arraste para reordenar. Clique no X para remover. Adicione legendas individuais.</p>
              <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                {bookPhotos.map((photo, idx) => (
                  <div key={photo.id} className="flex items-start gap-2 p-2 border rounded-lg bg-card">
                    <div className="flex flex-col items-center gap-1">
                      <button onClick={() => idx > 0 && movePhoto(idx, idx - 1)} className="text-muted-foreground hover:text-foreground text-xs">▲</button>
                      <span className="text-xs text-muted-foreground font-mono">{idx + 1}</span>
                      <button onClick={() => idx < bookPhotos.length - 1 && movePhoto(idx, idx + 1)} className="text-muted-foreground hover:text-foreground text-xs">▼</button>
                    </div>
                    <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                      {photo.photo_url ? (
                        <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">{PHOTO_TYPES[photo.photo_type] || photo.photo_type}</Badge>
                        <span className="text-xs truncate">{photo.product_name || photo.category_name || photo.pdv_name || ''}</span>
                      </div>
                      <Input 
                        value={photo.caption || ''} 
                        onChange={e => updateCaption(photo.id, e.target.value)}
                        placeholder="Legenda (opcional)"
                        className="h-7 text-xs"
                      />
                    </div>
                    <button onClick={() => removePhoto(photo.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* PREVIEW TAB */}
          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              {/* Cover preview */}
              <div className="bg-zinc-900 text-white p-8 text-center space-y-3">
                {(activeBrandLogo || branding.logo_topbar) && (
                  <img src={activeBrandLogo || branding.logo_topbar} alt="Logo" className="h-10 mx-auto mb-4" />
                )}
                <h1 className="text-xl font-bold">{title}</h1>
                <p className="text-sm text-zinc-400">{subtitle}</p>
                <p className="text-xs text-zinc-500">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                {notes && <p className="text-xs text-zinc-500 max-w-md mx-auto">{notes}</p>}
                <p className="text-xs text-zinc-600 mt-4">{bookPhotos.length} fotos</p>
              </div>
              {/* Photos preview grid */}
              <div className="p-4 grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                {bookPhotos.map((photo, idx) => (
                  <div key={photo.id} className="space-y-1">
                    <div className="aspect-[4/3] rounded overflow-hidden bg-muted">
                      {photo.photo_url ? (
                        <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
                      )}
                    </div>
                    <p className="text-[10px] font-medium">{PHOTO_TYPES[photo.photo_type] || photo.photo_type} — {photo.product_name || photo.category_name || 'Geral'}</p>
                    <p className="text-[9px] text-muted-foreground">{photo.pdv_name} • {photo.promoter_name}</p>
                    {photo.caption && <p className="text-[9px] text-muted-foreground italic">{photo.caption}</p>}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* SHARE TAB */}
          <TabsContent value="share" className="mt-4 space-y-4">
            {/* Download PDF */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Download PDF</h3>
                <p className="text-xs text-muted-foreground">Gere o book em PDF profissional com timbrado e faça o download</p>
                <Button onClick={handleDownloadPdf} disabled={generating || bookPhotos.length === 0} className="w-full">
                  {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PDF...</> : <><Download className="h-4 w-4 mr-2" /> Baixar PDF</>}
                </Button>
              </CardContent>
            </Card>

            {/* Web Link */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2"><Link2 className="h-4 w-4" /> Link Web (Token)</h3>
                <p className="text-xs text-muted-foreground">Crie um link seguro com token para o cliente visualizar online</p>
                {!webLink ? (
                  <Button onClick={handleCreateWebLink} disabled={sharing || bookPhotos.length === 0} variant="outline" className="w-full">
                    {sharing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando link...</> : <><Link2 className="h-4 w-4 mr-2" /> Gerar Link</>}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={webLink} readOnly className="text-xs" />
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    {/* Send via WhatsApp */}
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-xs font-medium flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Enviar via WhatsApp</h4>
                      <div className="flex gap-2">
                        <Input 
                          value={recipientPhone} 
                          onChange={e => setRecipientPhone(e.target.value)} 
                          placeholder="5511999999999" 
                          className="text-xs"
                        />
                        <Button size="sm" onClick={handleSendWhatsApp} disabled={!recipientPhone} className="bg-green-600 hover:bg-green-700">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Send via Email */}
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-xs font-medium flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Enviar via Email</h4>
                      <div className="flex gap-2">
                        <Input 
                          value={recipientEmail} 
                          onChange={e => setRecipientEmail(e.target.value)} 
                          placeholder="cliente@email.com" 
                          className="text-xs"
                        />
                        <Button size="sm" onClick={handleSendEmail} disabled={!recipientEmail || sendEmail.isPending}>
                          {sendEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
