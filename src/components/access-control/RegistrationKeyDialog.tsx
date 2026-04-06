import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { formatPhone, onlyDigits } from '@/lib/br-utils';
import { Key, Send, Loader2, Clock, CheckCircle, XCircle, Copy, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

interface RegistrationKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getHeaders = () => {
  const token = localStorage.getItem('agency_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export function RegistrationKeyDialog({ open, onOpenChange }: RegistrationKeyDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [whatsapp, setWhatsapp] = useState('');
  const [promoterName, setPromoterName] = useState('');

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['agency-registration-keys'],
    queryFn: () => api<any[]>('/api/access-control/agency/registration-keys', { headers: getHeaders() }),
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: () => api('/api/access-control/agency/registration-keys', {
      method: 'POST',
      body: { whatsapp_number: onlyDigits(whatsapp), promoter_name: promoterName || undefined },
      headers: getHeaders(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-registration-keys'] });
      toast({ title: 'Chave gerada e enviada!', description: 'A chave foi enviada via WhatsApp para o promotor.' });
      setWhatsapp('');
      setPromoterName('');
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const copyKey = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Chave copiada!' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Chave de Cadastro em Loco
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p>Gere uma chave para que um promotor freelance possa se cadastrar diretamente no totem do PDV.</p>
            <p className="mt-1">A chave será enviada via WhatsApp e terá validade de <strong>4 horas</strong>.</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Nome do Promotor (opcional)</Label>
              <Input value={promoterName} onChange={e => setPromoterName(e.target.value)} placeholder="Nome do freelance..." />
            </div>
            <div>
              <Label>WhatsApp do Promotor *</Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={onlyDigits(whatsapp).length < 10 || generateMutation.isPending}
              className="w-full gap-2"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gerar e Enviar Chave
            </Button>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-3">Chaves Geradas</p>
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chave gerada ainda</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {keys.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-lg font-bold font-mono tracking-widest">{k.key_code}</code>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyKey(k.key_code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {k.promoter_name && <span>{k.promoter_name}</span>}
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {formatPhone(k.whatsapp_number)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {format(new Date(k.created_at), 'dd/MM HH:mm')}
                        {k.expires_at && ` — Expira: ${format(new Date(k.expires_at), 'HH:mm')}`}
                      </p>
                    </div>
                    <Badge variant={k.status === 'used' ? 'default' : k.status === 'pending' && new Date(k.expires_at) > new Date() ? 'outline' : 'secondary'}>
                      {k.status === 'used' ? (
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Usada</span>
                      ) : new Date(k.expires_at) > new Date() ? (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Ativa</span>
                      ) : (
                        <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Expirada</span>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
