import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, Plane, Stethoscope, PencilLine, Loader2, RefreshCw, Building2 } from 'lucide-react';

type Pending = {
  overtime: any[]; vacations: any[]; medical: any[]; adjustments: any[]; total: number;
};

const KIND_META: Record<string, { label: string; icon: any; endpoint: string }> = {
  overtime: { label: 'Hora Extra', icon: Clock, endpoint: 'overtime' },
  vacation: { label: 'Férias', icon: Plane, endpoint: 'vacation' },
  medical: { label: 'Atestado', icon: Stethoscope, endpoint: 'medical' },
  adjustment: { label: 'Ajuste de Ponto', icon: PencilLine, endpoint: 'adjustment' },
};

export default function ManagerApp() {
  const [data, setData] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overtime');
  const [action, setAction] = useState<null | { kind: string; id: string; type: 'approve' | 'reject'; label: string }>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<Pending>('/api/manager/pending', { auth: true });
      setData(r);
    } catch (e: any) { toast.error(e.message || 'Erro'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!action) return;
    if (action.type === 'reject' && !note.trim()) { toast.error('Informe o motivo'); return; }
    setBusy(true);
    try {
      await api(`/api/manager/${KIND_META[action.kind].endpoint}/${action.id}/${action.type}`, {
        method: 'POST', body: JSON.stringify({ note }), auth: true,
      });
      toast.success(action.type === 'approve' ? 'Aprovado' : 'Reprovado');
      setAction(null); setNote(''); load();
    } catch (e: any) { toast.error(e.message || 'Erro'); }
    finally { setBusy(false); }
  };

  const renderItem = (kind: string, item: any) => {
    let title = '', subtitle = '';
    if (kind === 'overtime') { title = `${item.request_date} · ${item.requested_start || ''}-${item.requested_end || ''}`; subtitle = item.reason || ''; }
    if (kind === 'vacation') { title = `${item.start_date} → ${item.end_date} (${item.days_total} dias)`; subtitle = item.notes || item.vacation_type || ''; }
    if (kind === 'medical') { title = `${item.start_date} → ${item.end_date} (${item.days} dias)`; subtitle = `${item.cid ? 'CID ' + item.cid + ' · ' : ''}${item.reason || ''}`; }
    if (kind === 'adjustment') { title = `${item.punch_date} · ${item.requested_times}`; subtitle = item.justification || ''; }
    return (
      <Card key={item.id} className="overflow-hidden">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={item.photo_url} />
              <AvatarFallback>{(item.employee_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-sm">{item.employee_name}</div>
              {item.company_name && <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{item.company_name}</div>}
            </div>
          </div>
          <div className="text-sm">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground line-clamp-2">{subtitle}</div>}
          {kind === 'medical' && item.file_url && (
            <a href={item.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver documento</a>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setAction({ kind, id: item.id, type: 'reject', label: item.employee_name }); setNote(''); }}>
              <XCircle className="h-4 w-4 mr-1" /> Recusar
            </Button>
            <Button size="sm" className="flex-1" onClick={() => { setAction({ kind, id: item.id, type: 'approve', label: item.employee_name }); setNote(''); }}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const counts = data
    ? { overtime: data.overtime.length, vacation: data.vacations.length, medical: data.medical.length, adjustment: data.adjustments.length }
    : { overtime: 0, vacation: 0, medical: 0, adjustment: 0 };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-3 shadow flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80">App Gestor</div>
          <h1 className="text-lg font-semibold">Aprovações {data && <Badge variant="secondary" className="ml-2">{data.total}</Badge>}</h1>
        </div>
        <Button size="icon" variant="ghost" className="text-primary-foreground" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </Button>
      </header>

      <div className="p-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            {(['overtime', 'vacation', 'medical', 'adjustment'] as const).map(k => {
              const Icon = KIND_META[k].icon;
              return (
                <TabsTrigger key={k} value={k} className="flex flex-col gap-0.5 py-2 text-[11px]">
                  <div className="flex items-center gap-1"><Icon className="h-4 w-4" />{counts[k as keyof typeof counts] > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{counts[k as keyof typeof counts]}</Badge>}</div>
                  <span>{KIND_META[k].label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overtime" className="mt-3 space-y-2">
            {data?.overtime.length ? data.overtime.map(i => renderItem('overtime', i)) : <Empty />}
          </TabsContent>
          <TabsContent value="vacation" className="mt-3 space-y-2">
            {data?.vacations.length ? data.vacations.map(i => renderItem('vacation', i)) : <Empty />}
          </TabsContent>
          <TabsContent value="medical" className="mt-3 space-y-2">
            {data?.medical.length ? data.medical.map(i => renderItem('medical', i)) : <Empty />}
          </TabsContent>
          <TabsContent value="adjustment" className="mt-3 space-y-2">
            {data?.adjustments.length ? data.adjustments.map(i => renderItem('adjustment', i)) : <Empty />}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{action?.type === 'approve' ? 'Aprovar' : 'Recusar'} — {action?.label}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder={action?.type === 'reject' ? 'Motivo (obrigatório)' : 'Observação (opcional)'} value={note} onChange={e => setNote(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAction(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'Enviando…' : 'Confirmar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty() {
  return <div className="text-center text-sm text-muted-foreground py-10">Nenhuma solicitação pendente 🎉</div>;
}
