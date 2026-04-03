import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Send } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  promoters?: { id: string; name: string; agency_name?: string }[];
  agencies?: { id: string; name: string }[];
  isSubmitting?: boolean;
}

const INCIDENT_TYPES = [
  { value: 'delay', label: 'Atraso' },
  { value: 'misconduct', label: 'Comportamento Inadequado' },
  { value: 'non_execution', label: 'Não Execução' },
  { value: 'product_issue', label: 'Problema com Produto' },
  { value: 'other', label: 'Outro' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Leve', color: 'text-yellow-600' },
  { value: 'medium', label: 'Médio', color: 'text-orange-600' },
  { value: 'high', label: 'Grave', color: 'text-destructive' },
];

export const IncidentCreateDialog = ({ open, onOpenChange, onSubmit, promoters = [], agencies = [], isSubmitting }: Props) => {
  const [form, setForm] = useState({
    agency_promoter_id: '',
    agency_id: '',
    incident_type: 'other' as string,
    severity: 'low' as string,
    description: '',
    incident_date: new Date().toISOString().slice(0, 16),
  });

  const handleSubmit = () => {
    if (!form.description.trim()) return;
    onSubmit(form);
    setForm({ agency_promoter_id: '', agency_id: '', incident_type: 'other', severity: 'low', description: '', incident_date: new Date().toISOString().slice(0, 16) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Registrar Ocorrência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {promoters.length > 0 && (
            <div className="space-y-1.5">
              <Label>Promotor</Label>
              <Select value={form.agency_promoter_id} onValueChange={v => setForm(f => ({ ...f, agency_promoter_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar promotor" /></SelectTrigger>
                <SelectContent>
                  {promoters.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.agency_name ? `(${p.agency_name})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {agencies.length > 0 && (
            <div className="space-y-1.5">
              <Label>Agência</Label>
              <Select value={form.agency_id} onValueChange={v => setForm(f => ({ ...f, agency_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar agência" /></SelectTrigger>
                <SelectContent>
                  {agencies.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.incident_type} onValueChange={v => setForm(f => ({ ...f, incident_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Gravidade</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_LEVELS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={s.color}>{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Data/Hora</Label>
            <Input type="datetime-local" value={form.incident_date} onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição detalhada *</Label>
            <Textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descreva a ocorrência em detalhes..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.description.trim() || isSubmitting} className="gap-2">
            <Send className="h-4 w-4" /> Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
