import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Check, MessageCircle, Mail, QrCode, ExternalLink,
  Users, Truck, Briefcase, Smartphone, ShoppingBag,
} from "lucide-react";

interface AppInfo {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: any;
  color: string;
  audience: string;
}

const APPS: AppInfo[] = [
  {
    key: "colaborador",
    title: "App do Colaborador",
    description: "Ponto, holerite, férias, documentos e solicitações para funcionários.",
    path: "/colaborador/login",
    icon: Users,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    audience: "Funcionários CLT / RH",
  },
  {
    key: "entregador",
    title: "App do Entregador",
    description: "Jornada SmartRoute: rotas, check-in, checklists e entregas.",
    path: "/entregador/login",
    icon: Truck,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    audience: "Motoristas / Entregadores",
  },
  {
    key: "gestor",
    title: "App do Gestor (Supervisor)",
    description: "Painel de supervisão: equipe, aprovações e acompanhamento em campo.",
    path: "/gestor/login",
    icon: Briefcase,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    audience: "Supervisores / Gerentes",
  },
  {
    key: "promotor",
    title: "App do Promotor (PDV)",
    description: "Check-in em PDV, fotos, pesquisa de preço e merchandising.",
    path: "/p/login",
    icon: ShoppingBag,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    audience: "Promotores de merchandising",
  },
];

function AppCard({ app }: { app: AppInfo }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const Icon = app.icon;

  const url = `${window.location.origin}${app.path}`;
  const msg = `Olá! Acesse o *${app.title}* aqui:\n${url}\n\nDica: no celular, use "Adicionar à tela de início" para instalar como aplicativo.`;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    toast({ title: "Link copiado!", description: url });
  };

  const copyMsg = () => {
    navigator.clipboard.writeText(msg);
    toast({ title: "Mensagem copiada!" });
  };

  const sendWhats = () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  const sendEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(app.title)}&body=${encodeURIComponent(msg)}`;
  };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${app.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="outline" className="text-[10px]">{app.audience}</Badge>
        </div>
        <CardTitle className="text-base mt-2">{app.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{app.description}</p>
      </CardHeader>
      <CardContent className="space-y-3 mt-auto">
        <div className="flex items-center gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button size="icon" variant="outline" onClick={copy} title="Copiar link">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={sendWhats} className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="secondary" size="sm" onClick={sendEmail} className="gap-1.5">
            <Mail className="h-4 w-4" /> E-mail
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setQrOpen(true)} className="gap-1.5">
            <QrCode className="h-4 w-4" /> QR Code
          </Button>
          <Button variant="default" size="sm" onClick={() => window.open(url, "_blank")} className="gap-1.5">
            <ExternalLink className="h-4 w-4" /> Abrir
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={copyMsg} className="w-full text-xs">
          Copiar mensagem pronta
        </Button>
      </CardContent>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">{app.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img src={qrSrc} alt={`QR Code do ${app.title}`} className="rounded-lg border" />
            <p className="text-xs text-center text-muted-foreground break-all">{url}</p>
            <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copiar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function CentralApps() {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => APPS.filter(a =>
      (a.title + a.description + a.audience).toLowerCase().includes(q.toLowerCase())
    ),
    [q]
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Central de Apps</h1>
          <p className="text-sm text-muted-foreground">
            Links diretos, QR Code e mensagens prontas para compartilhar com sua equipe.
            Todos os apps funcionam no navegador do celular e podem ser instalados na tela de início.
          </p>
        </div>
      </div>

      <Input
        placeholder="Buscar app..."
        value={q}
        onChange={e => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {filtered.map(app => <AppCard key={app.key} app={app} />)}
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Como instalar no celular?</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p><strong>Android (Chrome):</strong> menu ⋮ → "Adicionar à tela inicial" ou "Instalar app".</p>
          <p><strong>iPhone (Safari):</strong> botão Compartilhar → "Adicionar à Tela de Início".</p>
          <p>Depois de instalado, o app abre em tela cheia como um aplicativo nativo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
