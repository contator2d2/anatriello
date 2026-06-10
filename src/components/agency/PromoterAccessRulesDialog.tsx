import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, MapPin, Clock, Shield, Save, X, Loader2, AlertTriangle } from 'lucide-react';

const WEEKDAYS = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' },
];

const getHeaders = () => {
  const token = localStorage.getItem('agency_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promoter: any | null;
}

type RuleForm = {
  unit_ids: string[]; // multi for create; single for edit
  allowed_weekdays: number[];
  start_time: string;
  end_time: string;
  brand_ids: string[];
};

const defaultRuleForm: RuleForm = {
  unit_ids: [],
  allowed_weekdays: [1, 2, 3, 4, 5],
  start_time: '08:00',
  end_time: '18:00',
  brand_ids: [],
};

export default function PromoterAccessRulesDialog({ open, onOpenChange, promoter }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RuleForm>(defaultRuleForm);

  const { data: allRules = [], isLoading } = useQuery({
    queryKey: ['agency-access-rules'],
    queryFn: () => api<any[]>('/api/access-control/agency/access-rules', { headers: getHeaders() }),
    enabled: open,
  });
  const { data: units = [] } = useQuery({
    queryKey: ['agency-allowed-units'],
    queryFn: () => api<any[]>('/api/access-control/agency/allowed-units', { headers: getHeaders() }),
    enabled: open,
  });
  const { data: brands = [] } = useQuery({
    queryKey: ['agency-brands'],
    queryFn: () => api<any[]>('/api/access-control/agency/brands', { headers: getHeaders() }),
    enabled: open,
  });
  // Active blocks for this promoter (returns all, filter active)
  const { data: blockHistory = [] } = useQuery<any[]>({
    queryKey: ['promoter-block-history', promoter?.id],
    queryFn: () => api<any[]>(`/api/pdv-blocks/promoter/${promoter.id}/history`, { headers: getHeaders() }),
    enabled: open && !!promoter?.id,
  });
  const blockedUnitMap = useMemo(() => {
    const map: Record<string, { reason?: string }> = {};
    for (const b of blockHistory) {
      if (b.active) map[b.supermarket_unit_id] = { reason: b.reason };
    }
    return map;
  }, [blockHistory]);

  const promoterRules = useMemo(
    () => allRules.filter((r: any) => r.agency_promoter_id === promoter?.id),
    [allRules, promoter?.id]
  );

  const resetForm = () => { setForm(defaultRuleForm); setEditingId(null); setCreating(false); };
  useEffect(() => { if (!open) resetForm(); }, [open]);

  const startEdit = (rule: any) => {
    setEditingId(rule.id);
    setCreating(false);
    setForm({
      unit_ids: [rule.supermarket_unit_id],
      allowed_weekdays: rule.allowed_weekdays || [1, 2, 3, 4, 5],
      start_time: (rule.start_time || '08:00').slice(0, 5),
      end_time: (rule.end_time || '18:00').slice(0, 5),
      brand_ids: (rule.brands || []).map((b: any) => b.brand_id).filter(Boolean),
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: RuleForm) => {
      // create one rule per selected PDV
      const results: any[] = [];
      for (const unit_id of data.unit_ids) {
        const r = await api('/api/access-control/agency/access-rules', {
          method: 'POST',
          body: {
            agency_promoter_id: promoter.id,
            supermarket_unit_id: unit_id,
            allowed_weekdays: data.allowed_weekdays,
            start_time: data.start_time,
            end_time: data.end_time,
            brand_ids: data.brand_ids,
          },
          headers: getHeaders(),
        });
        results.push(r);
      }
      return results;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['agency-access-rules'] });
      toast({ title: `${r.length} regra(s) criada(s)` });
      resetForm();
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api(`/api/access-control/agency/access-rules/${id}`, { method: 'PUT', body: data, headers: getHeaders() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-access-rules'] }); toast({ title: 'Regra atualizada' }); resetForm(); },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/access-control/agency/access-rules/${id}`, { method: 'DELETE', headers: getHeaders() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agency-access-rules'] }); toast({ title: 'Regra removida' }); },
  });

  const toggleWeekday = (d: number) => {
    setForm(f => ({
      ...f,
      allowed_weekdays: f.allowed_weekdays.includes(d) ? f.allowed_weekdays.filter(x => x !== d) : [...f.allowed_weekdays, d].sort(),
    }));
  };
  const toggleBrand = (id: string) => {
    setForm(f => ({ ...f, brand_ids: f.brand_ids.includes(id) ? f.brand_ids.filter(b => b !== id) : [...f.brand_ids, id] }));
  };
  const toggleUnit = (id: string) => {
    setForm(f => ({ ...f, unit_ids: f.unit_ids.includes(id) ? f.unit_ids.filter(x => x !== id) : [...f.unit_ids, id] }));
  };
  const toggleAllUnits = () => {
    setForm(f => ({
      ...f,
      unit_ids: f.unit_ids.length === units.length ? [] : units.map((u: any) => u.id),
    }));
  };
  const toggleAllBrands = () => {
    const active = brands.filter((b: any) => b.active !== false);
    setForm(f => ({
      ...f,
      brand_ids: f.brand_ids.length === active.length ? [] : active.map((b: any) => b.id),
    }));
  };

  const handleSave = () => {
    if (form.unit_ids.length === 0) {
      toast({ title: 'Selecione pelo menos uma unidade', variant: 'destructive' });
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          supermarket_unit_id: form.unit_ids[0],
          allowed_weekdays: form.allowed_weekdays,
          start_time: form.start_time,
          end_time: form.end_time,
          brand_ids: form.brand_ids,
        },
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const showForm = creating || !!editingId;
  const blockedSelected = form.unit_ids.filter(id => blockedUnitMap[id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Regras de Acesso — {promoter?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              💡 Um promotor pode atender vários PDVs (manhã em um, tarde em outro) e várias marcas aprovadas pela agência.
              Selecione múltiplos PDVs de uma vez para criar regras em lote.
            </AlertDescription>
          </Alert>

          {!showForm && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setCreating(true); setForm(defaultRuleForm); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Regra
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : promoterRules.length === 0 && !showForm ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Shield className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma regra configurada para este promotor</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione as unidades, dias e horários permitidos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {promoterRules.map((rule: any) => {
                const blocked = blockedUnitMap[rule.supermarket_unit_id];
                return (
                  <Card key={rule.id} className={`${editingId === rule.id ? 'border-primary' : ''} ${blocked ? 'border-yellow-500/60 bg-yellow-500/5' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium text-sm truncate">{rule.unit_name}</p>
                            {blocked && (
                              <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-700 dark:text-yellow-400">
                                <AlertTriangle className="h-3 w-3 mr-0.5" /> Bloqueado pelo PDV
                              </Badge>
                            )}
                          </div>
                          {blocked?.reason && (
                            <p className="text-[11px] text-yellow-700 dark:text-yellow-400">Motivo: {blocked.reason}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {rule.start_time?.slice(0, 5)} - {rule.end_time?.slice(0, 5)}
                            </div>
                            <div className="flex gap-0.5 flex-wrap">
                              {(rule.allowed_weekdays || []).map((d: number) => (
                                <Badge key={d} variant="outline" className="text-[10px] px-1 py-0">{WEEKDAYS.find(w => w.value === d)?.label}</Badge>
                              ))}
                            </div>
                          </div>
                          {rule.brands && rule.brands.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {rule.brands.map((b: any) => (
                                <Badge key={b.brand_id} variant="secondary" className="text-[10px]">{b.brand_name}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(rule)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {showForm && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-semibold">{editingId ? 'Editar Regra' : 'Nova(s) Regra(s)'}</p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">
                      Unidades / PDVs * {editingId && <span className="text-muted-foreground">(edição: 1 PDV)</span>}
                    </label>
                    {!editingId && units.length > 0 && (
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={toggleAllUnits}>
                        {form.unit_ids.length === units.length ? 'Limpar' : 'Selecionar todos'}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-md border bg-muted/30 max-h-48 overflow-y-auto">
                    {units.length === 0 && (
                      <p className="text-xs text-muted-foreground col-span-2 py-2 text-center">
                        Nenhum PDV liberado para esta agência ainda.
                      </p>
                    )}
                    {units.map((u: any) => {
                      const isBlocked = !!blockedUnitMap[u.id];
                      const checked = form.unit_ids.includes(u.id);
                      const disabled = !!editingId && !checked;
                      return (
                        <label key={u.id} className={`flex items-center gap-1.5 text-sm p-1 rounded ${isBlocked ? 'bg-yellow-500/10' : ''} ${disabled ? 'opacity-40' : ''}`}>
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => {
                              if (editingId) {
                                setForm(f => ({ ...f, unit_ids: [u.id] }));
                              } else {
                                toggleUnit(u.id);
                              }
                            }}
                          />
                          <span className="truncate flex-1">{u.name}{u.network_name ? ` — ${u.network_name}` : ''}</span>
                          {isBlocked && <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                  {blockedSelected.length > 0 && (
                    <Alert className="border-yellow-500/60 bg-yellow-500/10">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-xs">
                        Atenção: {blockedSelected.length} PDV(s) selecionado(s) possuem bloqueio ativo para este promotor.
                        A entrada será negada no totem até o desbloqueio pelo PDV.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Dias permitidos</label>
                  <div className="flex gap-2 flex-wrap">
                    {WEEKDAYS.map(w => (
                      <label key={w.value} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={form.allowed_weekdays.includes(w.value)} onCheckedChange={() => toggleWeekday(w.value)} />
                        {w.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Hora início</label>
                    <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Hora fim</label>
                    <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                  </div>
                </div>
                {brands.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">Marcas que pode atender</label>
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={toggleAllBrands}>
                        {form.brand_ids.length === brands.filter((b: any) => b.active !== false).length ? 'Limpar' : 'Selecionar todas'}
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap p-2 rounded-md border bg-muted/30 max-h-32 overflow-y-auto">
                      {brands.filter((b: any) => b.active !== false).map((b: any) => (
                        <label key={b.id} className="flex items-center gap-1.5 text-sm">
                          <Checkbox checked={form.brand_ids.includes(b.id)} onCheckedChange={() => toggleBrand(b.id)} />
                          {b.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    {editingId
                      ? 'Salvar alterações'
                      : form.unit_ids.length > 1
                        ? `Criar ${form.unit_ids.length} regras`
                        : 'Criar regra'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
