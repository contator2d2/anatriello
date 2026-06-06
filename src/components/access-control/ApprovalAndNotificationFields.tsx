import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Brain, User as UserIcon } from 'lucide-react';

export type ApprovalMode = 'ai' | 'hybrid' | 'manual';

interface Props {
  approvalMode: ApprovalMode | null;
  setApprovalMode: (m: ApprovalMode) => void;
  notifyEnabled: boolean;
  setNotifyEnabled: (v: boolean) => void;
  notifyWhatsapp: string[];
  setNotifyWhatsapp: (v: string[]) => void;
  notifyEmails: string[];
  setNotifyEmails: (v: string[]) => void;
  notifyEvents: string[];
  setNotifyEvents: (v: string[]) => void;
}

const EVENT_LABELS: { key: string; label: string }[] = [
  { key: 'approved', label: 'Aprovação' },
  { key: 'rejected', label: 'Rejeição' },
  { key: 'divergent', label: 'Divergente (revisão)' },
  { key: 'failed', label: 'Falha na análise' },
];

export function ApprovalAndNotificationFields(p: Props) {
  const toggleEvent = (key: string) => {
    p.setNotifyEvents(
      p.notifyEvents.includes(key)
        ? p.notifyEvents.filter(x => x !== key)
        : [...p.notifyEvents, key],
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Modo de aprovação</Label>
        <Select value={p.approvalMode ?? 'ai'} onValueChange={(v) => p.setApprovalMode(v as ApprovalMode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ai">IA decide (automático conforme score)</SelectItem>
            <SelectItem value="hybrid">Híbrido — IA analisa, humano decide</SelectItem>
            <SelectItem value="manual">Somente manual (sem IA)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Define se a IA pode aprovar/rejeitar automaticamente, apenas sugerir, ou se tudo é decidido manualmente.
        </p>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notificações externas</Label>
          <Switch checked={p.notifyEnabled} onCheckedChange={p.setNotifyEnabled} />
        </div>
        {p.notifyEnabled && (
          <>
            <div>
              <Label className="text-xs">Eventos que disparam notificação</Label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {EVENT_LABELS.map(ev => (
                  <label key={ev.key} className="flex items-center gap-2 text-sm rounded-md border p-1.5 cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={p.notifyEvents.includes(ev.key)}
                      onChange={() => toggleEvent(ev.key)}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">WhatsApp (um por linha, com DDI)</Label>
              <Textarea
                rows={2}
                placeholder="5511999999999"
                value={p.notifyWhatsapp.join('\n')}
                onChange={e => p.setNotifyWhatsapp(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
              />
            </div>
            <div>
              <Label className="text-xs">E-mails (um por linha)</Label>
              <Textarea
                rows={2}
                placeholder="responsavel@empresa.com"
                value={p.notifyEmails.join('\n')}
                onChange={e => p.setNotifyEmails(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
