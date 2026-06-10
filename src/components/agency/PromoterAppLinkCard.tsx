import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, MessageCircle, Mail, Smartphone, QrCode, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Card visível no Dashboard da Agência: gera/encaminha o link do app do promotor
 * para que ele faça check-in/check-out no PDV.
 */
export default function PromoterAppLinkCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const url = `${window.location.origin}/p/login`;
  const msg = `Olá! Use este app para registrar sua entrada e saída no PDV:\n${url}\n\nDica: ao abrir, instale o app na tela de início do celular.`;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast({ title: 'Link copiado!', description: url });
  };

  const sendWhats = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent('App de Acesso ao PDV')}&body=${encodeURIComponent(msg)}`;
  };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" />
          App do Promotor — Acesso ao PDV
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Encaminhe este link aos seus promotores. Ao abrir, eles receberão o convite para instalar o app no celular.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button size="icon" variant="outline" onClick={copy} title="Copiar link">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button variant="secondary" onClick={sendWhats} className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="secondary" onClick={sendEmail} className="gap-1.5">
            <Mail className="h-4 w-4" /> E-mail
          </Button>
          <Button variant="secondary" onClick={() => setQrOpen(true)} className="gap-1.5">
            <QrCode className="h-4 w-4" /> QR Code
          </Button>
          <Button variant="default" onClick={copy} className="gap-1.5">
            <Copy className="h-4 w-4" /> Copiar
          </Button>
        </div>
      </CardContent>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code do App</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img src={qrSrc} alt="QR Code para o app do promotor" className="rounded-lg border" />
            <p className="text-xs text-center text-muted-foreground break-all">{url}</p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
