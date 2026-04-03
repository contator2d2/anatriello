import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Mail, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatPhone, onlyDigits } from "@/lib/br-utils";

interface SendAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalType: "agency" | "supermarket";
  entityName: string;
  loginEmail?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const SendAccessDialog = ({
  open, onOpenChange, portalType, entityName, loginEmail, contactEmail, contactPhone,
}: SendAccessDialogProps) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const portalPath = portalType === "agency" ? "/agencia/login" : "/supermercado/login";
  const portalUrl = `${window.location.origin}${portalPath}`;
  const portalLabel = portalType === "agency" ? "Portal da Agência" : "Portal do Supermercado";

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setEmail(contactEmail || loginEmail || "");
      setPhone(contactPhone ? formatPhone(contactPhone) : "");
    }
    onOpenChange(isOpen);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    toast({ title: "Link copiado!" });
  };

  const send = async (channel: "email" | "whatsapp") => {
    setSending(true);
    try {
      await api("/api/access-control/send-access", {
        method: "POST",
        body: {
          channel,
          recipient_email: channel === "email" ? email : undefined,
          recipient_phone: channel === "whatsapp" ? onlyDigits(phone) : undefined,
          recipient_name: entityName,
          portal_type: portalType,
          portal_url: portalUrl,
          login_email: loginEmail || email,
        },
      });
      toast({ title: "Acesso enviado!", description: channel === "email" ? `E-mail enviado para ${email}` : "Mensagem enviada via WhatsApp" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" /> Enviar Acesso — {portalLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Destinatário</Label>
            <p className="font-medium">{entityName}</p>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Link de acesso</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded break-all">{portalUrl}</code>
              <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {loginEmail && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Login:</span>
                <Badge variant="outline">{loginEmail}</Badge>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label>E-mail do destinatário</Label>
              <div className="flex gap-2 mt-1">
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" className="flex-1" />
                <Button size="sm" onClick={() => send("email")} disabled={!email || sending} className="gap-1 shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Enviar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Usa o SMTP configurado nas configurações</p>
            </div>

            <div>
              <Label>WhatsApp do destinatário</Label>
              <div className="flex gap-2 mt-1">
                <Input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="flex-1" />
                <Button size="sm" variant="secondary" onClick={() => send("whatsapp")} disabled={!phone || onlyDigits(phone).length < 10 || sending} className="gap-1 shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Enviar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Usa a conexão WhatsApp padrão</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendAccessDialog;
