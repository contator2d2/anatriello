import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAgencyAuth } from '@/contexts/AgencyAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Shield, MapPin, Clock, Trash2 } from 'lucide-react';

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const getHeaders = () => {
  const token = localStorage.getItem('agency_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export default function AgencyAccessRules() {
  const { user } = useAgencyAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    agency_promoter_id: '',
    supermarket_unit_id: '',
    allowed_weekdays: [1, 2, 3, 4, 5] as number[],
    start_time: '08:00',
    end_time: '18:00',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['agency-access-rules'],
    queryFn: () => api<any[]>('/api/access-control/agency-portal/access-rules', { headers: getHeaders() }),
    enabled: !!user,
  });

  const { data: promoters = [] } = useQuery({
    queryKey: ['agency-promoters'],
    queryFn: () => api<any[]>('/api/access-control/agency-portal/promoters', { headers: getHeaders() }),
    enabled: !!user,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['agency-available-units'],
    queryFn: () => api<any[]>('/api/access-control/agency-portal/available-units', { headers: getHeaders() }),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api('/api/access-control/agency-portal/access-rules', { method: 'POST', body: data, headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-access-rules'] });
      toast({ title: 'Regra criada' });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/access-control/agency-portal/access-rules/${id}`, { method: 'DELETE', headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-access-rules'] });
      toast({ title: 'Regra removida' });
    },
  });

  const toggleWeekday = (day: number) => {
    setForm((f) => ({
      ...f,
      allowed_weekdays: f.allowed_weekdays.includes(day)
        ? f.allowed_weekdays.filter((d) => d !== day)
        : [...f.allowed_weekdays, day].sort(),
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regras de Acesso</h1>
          <p className="text-muted-foreground">Configure quais promotores podem acessar cada unidade</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma regra de acesso configurada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{rule.promoter_name}</p>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{rule.unit_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {rule.start_time?.slice(0, 5)} - {rule.end_time?.slice(0, 5)}
                      </div>
                      <div className="flex gap-1">
                        {(rule.allowed_weekdays || []).map((d: number) => (
                          <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">
                            {WEEKDAYS.find((w) => w.value === d)?.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.active ? 'default' : 'secondary'}>
                      {rule.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Regra de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Promotor *</label>
              <Select value={form.agency_promoter_id} onValueChange={(v) => setForm({ ...form, agency_promoter_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {promoters.filter((p: any) => p.status === 'active').map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.cpf})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Unidade *</label>
              <Select value={form.supermarket_unit_id} onValueChange={(v) => setForm({ ...form, supermarket_unit_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias Permitidos</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map((w) => (
                  <label key={w.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.allowed_weekdays.includes(w.value)}
                      onCheckedChange={() => toggleWeekday(w.value)}
                    />
                    {w.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora Início</label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora Fim</label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.agency_promoter_id || !form.supermarket_unit_id || createMutation.isPending}
            >
              Criar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
