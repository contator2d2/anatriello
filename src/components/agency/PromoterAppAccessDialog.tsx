import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Copy, MessageCircle, KeyRound, Loader2, Smartphone } from 'lucide-react';
import { formatCpf, onlyDigits } from '@/lib/br-utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promoter: { id: string; name: string; cpf: string; whatsapp?: string } | null;
}

// Padrão de senha: "anatri" + 3 números + 2 letras
function generateDefaultPassword() {
  const nums = Math.floor(100 + Math.random() * 900).toString();
  const letters = Array.from({ length: 2 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
  return `anatri${nums}${letters}`;
}

export default function PromoterAppAccessDialog({ open, onOpenChange, promoter }: Props) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const url = `${window.location.origin}/p/login`;
  const cpfDigits = onlyDigits(promoter?.cpf || '');

  const handleGenerate = () => {
    setPassword(generateDefaultPassword());
    setSaved(false);
  };

  const handleSave = async () => {
    if (!promoter) return;
    if (!password || password.length < 6) {
      toast({ title: 'Senha mínima de 6 caracteres', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('agency_auth_token');
      await api(`/api/agency/promoter-credentials/${promoter.id}`, {
        method: 'POST',
        body: { password },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setSaved(true);
      toast({ title: 'Credenciais salvas!', description: 'O promotor já pode acessar o app.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const message = promoter
    ? `Olá ${promoter.name.split(' ')[0]}! Seu acesso ao app de PDV:\n\n🔗 Link: ${url}\n👤 CPF: ${formatCpf(cpfDigits)}\n🔑 Senha: ${password}\n\nDica: ao abrir, instale o app na tela de início do celular.`
    : '';

  const copy = (txt: string, label = 'Copiado!') => {
    navigator.clipboard.writeText(txt);
    toast({ title: label });
  };

  const sendWhats = () => {
    const phone = onlyDigits(promoter?.whatsapp || '');
    const base = phone ? `https://wa.me/55${phone}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Acesso ao App do Promotor
          </DialogTitle>
        </DialogHeader>

        {promoter && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{promoter.name}</p>
              <p className="text-xs text-muted-foreground">CPF: {formatCpf(cpfDigits)}</p>
            </div>

            <div>
              <Label>Link do App</Label>
              <div className="flex gap-2 mt-1">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copy(url, 'Link copiado!')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Definir / Redefinir Senha</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setSaved(false); }}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button variant="outline" onClick={handleGenerate} title="Gerar senha padrão">
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Padrão sugerido: <span className="font-mono">anatri</span> + 3 números + 2 letras.
              </p>
            </div>

            {saved && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <p className="font-semibold text-primary">✓ Credenciais ativas</p>
                <p><span className="text-muted-foreground">CPF:</span> {formatCpf(cpfDigits)}</p>
                <p><span className="text-muted-foreground">Senha:</span> <span className="font-mono">{password}</span></p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button
            variant="secondary"
            disabled={!saved}
            onClick={sendWhats}
            className="gap-1.5"
          >
            <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
          </Button>
          <Button onClick={handleSave} disabled={saving || !password}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
