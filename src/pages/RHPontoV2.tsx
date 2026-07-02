import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useEmployees } from '@/hooks/use-rh';
import {
  useCartaoPonto, useEditCartaoPonto, useCartaoPontoAudit,
  useTimeBankSummary, useTimeBankEntries, useAddTimeBankManual,
  useHolidays, useCreateHoliday, useDeleteHoliday, useImportNationalHolidays,
  useAdjustmentRequests, useReviewAdjustmentRequest,
} from '@/hooks/use-timeclock';
import { WorkSchedulesTab } from '@/components/rh/WorkSchedulesTab';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle, Pencil, History, Trash2, Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  normal: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  extra: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  atraso: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  falta: 'bg-red-500/10 text-red-700 dark:text-red-300',
  feriado: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  folga: 'bg-muted text-muted-foreground',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function fmtMin(min?: number | null) {
  if (min == null) return '--:--';
  const sign = min < 0 ? '-' : (min > 0 ? '+' : '');
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ============ CARTÃO PONTO TAB ============
function CartaoPontoTab() {
  const { data: employees = [] } = useEmployees({ status: 'ativo' });
  const [employeeId, setEmployeeId] = useState<string>('');
  const [start, setStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const { data, isLoading } = useCartaoPonto({ employee_id: employeeId, start, end });
  const [editDay, setEditDay] = useState<any | null>(null);
  const [auditDay, setAuditDay] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Início</Label>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setStart(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                setEnd(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
              }}
            >
              Mês atual
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatBox label="Trabalhado" value={fmtMin(data.totals.worked_min)} icon={Clock} />
              <StatBox label="Previsto" value={fmtMin(data.totals.expected_min)} icon={Calendar} />
              <StatBox label="Crédito" value={fmtMin(data.totals.credit_min)} icon={TrendingUp} color="text-emerald-600" />
              <StatBox label="Débito" value={fmtMin(data.totals.debit_min)} icon={TrendingDown} color="text-red-600" />
              <StatBox
                label="Saldo período"
                value={fmtMin(data.totals.balance_min)}
                icon={TrendingUp}
                color={data.totals.balance_min >= 0 ? 'text-emerald-600' : 'text-red-600'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cartão Ponto — {data.employee.full_name}</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ent 1</TableHead>
                    <TableHead>Saí 1</TableHead>
                    <TableHead>Ent 2</TableHead>
                    <TableHead>Saí 2</TableHead>
                    <TableHead>Ent 3</TableHead>
                    <TableHead>Saí 3</TableHead>
                    <TableHead>Normais</TableHead>
                    <TableHead className="text-emerald-600">BCred</TableHead>
                    <TableHead className="text-red-600">BDeb</TableHead>
                    <TableHead>BSaldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.days.map((d: any) => {
                    const isWeekend = d.dow === 0 || d.dow === 6;
                    return (
                      <TableRow key={d.date} className={isWeekend ? 'bg-muted/30' : d.is_holiday ? 'bg-purple-500/5' : ''}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {format(new Date(d.date + 'T12:00:00'), 'dd/MM')} - {WEEKDAYS[d.dow]}
                        </TableCell>
                        <TableCell className="font-mono">{d.entry1 || '--'}</TableCell>
                        <TableCell className="font-mono">{d.exit1 || '--'}</TableCell>
                        <TableCell className="font-mono">{d.entry2 || '--'}</TableCell>
                        <TableCell className="font-mono">{d.exit2 || '--'}</TableCell>
                        <TableCell className="font-mono">{d.entry3 || '--'}</TableCell>
                        <TableCell className="font-mono">{d.exit3 || '--'}</TableCell>
                        <TableCell className="font-mono">{fmtMin(d.total_worked_min)}</TableCell>
                        <TableCell className="font-mono text-emerald-600">{d.credit_min ? fmtMin(d.credit_min) : '--'}</TableCell>
                        <TableCell className="font-mono text-red-600">{d.debit_min ? fmtMin(d.debit_min) : '--'}</TableCell>
                        <TableCell className={`font-mono font-semibold ${d.balance_min > 0 ? 'text-emerald-600' : d.balance_min < 0 ? 'text-red-600' : ''}`}>
                          {fmtMin(d.balance_min)}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[d.status] || ''} variant="secondary">{d.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditDay(d)} title="Editar">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setAuditDay(d.date)} title="Histórico">
                              <History className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {editDay && (
        <EditDayDialog
          employeeId={employeeId}
          day={editDay}
          onClose={() => setEditDay(null)}
        />
      )}
      {auditDay && (
        <AuditDialog employeeId={employeeId} date={auditDay} onClose={() => setAuditDay(null)} />
      )}
      {isLoading && <p className="text-center text-muted-foreground">Carregando...</p>}
      {!employeeId && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Selecione um colaborador para ver o cartão ponto.</CardContent></Card>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color = '' }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-muted ${color}`}><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function EditDayDialog({ employeeId, day, onClose }: any) {
  const { toast } = useToast();
  const edit = useEditCartaoPonto();
  const initial = [day.entry1, day.exit1, day.entry2, day.exit2, day.entry3, day.exit3].map((t: any) => t ? String(t).slice(0, 5) : '');
  const [times, setTimes] = useState<string[]>(initial);
  const [reason, setReason] = useState('');

  const save = async () => {
    if (!reason.trim()) { toast({ title: 'Informe o motivo do ajuste', variant: 'destructive' }); return; }
    const clean = times.filter(t => /^\d{1,2}:\d{2}$/.test(t));
    await edit.mutateAsync({ employee_id: employeeId, date: day.date, times: clean, reason });
    toast({ title: 'Batidas atualizadas' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar Batidas — {format(new Date(day.date + 'T12:00:00'), 'dd/MM/yyyy')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {times.map((t, i) => (
              <div key={i}>
                <Label className="text-xs">{i % 2 === 0 ? `Entrada ${Math.floor(i / 2) + 1}` : `Saída ${Math.floor(i / 2) + 1}`}</Label>
                <Input type="time" value={t} onChange={e => {
                  const copy = [...times]; copy[i] = e.target.value; setTimes(copy);
                }} />
              </div>
            ))}
          </div>
          <div>
            <Label>Motivo do ajuste *</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Esqueceu de bater na saída, confirmado com testemunhas" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={edit.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditDialog({ employeeId, date, onClose }: any) {
  const { data = [] } = useCartaoPontoAudit(employeeId, date);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Histórico de edições — {format(new Date(date + 'T12:00:00'), 'dd/MM/yyyy')}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma edição registrada.</p>}
          {data.map((a: any) => (
            <div key={a.id} className="border rounded p-3 text-sm">
              <div className="font-medium">{a.editor_name || 'Sistema'} — {format(new Date(a.edited_at), 'dd/MM/yyyy HH:mm')}</div>
              <div className="text-xs text-muted-foreground">Ação: {a.action}</div>
              {a.old_value && <div className="text-xs">De: <span className="font-mono">{a.old_value}</span></div>}
              {a.new_value && <div className="text-xs">Para: <span className="font-mono">{a.new_value}</span></div>}
              {a.reason && <div className="text-xs italic mt-1">"{a.reason}"</div>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ BANCO DE HORAS TAB ============
function BancoHorasTab() {
  const { toast } = useToast();
  const { data: summary = [] } = useTimeBankSummary();
  const [selected, setSelected] = useState<string>('');
  const [start, setStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const { data: entries = [] } = useTimeBankEntries(selected, start, end);
  const addManual = useAddTimeBankManual();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ entry_date: format(new Date(), 'yyyy-MM-dd'), minutes: 0, description: '' });

  const sorted = useMemo(() => [...summary].sort((a: any, b: any) => (b.balance_min || 0) - (a.balance_min || 0)), [summary]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Saldo por colaborador</CardTitle></CardHeader>
        <CardContent className="p-0 max-h-[600px] overflow-y-auto">
          {sorted.map((e: any) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              className={`w-full flex justify-between items-center px-4 py-2 hover:bg-muted text-left ${selected === e.id ? 'bg-muted' : ''}`}
            >
              <span className="text-sm">{e.full_name}</span>
              <span className={`font-mono font-bold ${e.balance_min > 0 ? 'text-emerald-600' : e.balance_min < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {fmtMin(e.balance_min)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Extrato do banco</CardTitle>
          {selected && <Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4 mr-1" /> Lançamento manual</Button>}
        </CardHeader>
        <CardContent>
          {!selected && <p className="text-muted-foreground text-sm">Selecione um colaborador</p>}
          {selected && (
            <>
              <div className="flex gap-2 mb-3">
                <Input type="date" value={start} onChange={e => setStart(e.target.value)} />
                <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Minutos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{format(new Date(e.entry_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell><Badge variant={e.kind === 'credit' ? 'default' : 'destructive'}>{e.kind}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{e.source}</Badge></TableCell>
                      <TableCell className="text-sm">{e.description}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${e.minutes > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMin(e.minutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {modal && (
        <Dialog open onOpenChange={() => setModal(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Lançamento manual</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div>
                <Label>Minutos (use negativo para débito)</Label>
                <Input type="number" value={form.minutes} onChange={e => setForm({ ...form, minutes: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button onClick={async () => {
                await addManual.mutateAsync({ employee_id: selected, ...form });
                toast({ title: 'Lançamento adicionado' });
                setModal(false);
              }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============ FERIADOS TAB ============
function FeriadosTab() {
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: holidays = [] } = useHolidays({ year });
  const create = useCreateHoliday();
  const del = useDeleteHoliday();
  const importNat = useImportNationalHolidays();
  const [form, setForm] = useState({ holiday_date: '', description: '', scope: 'nacional' });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-2 items-end">
          <div>
            <Label>Ano</Label>
            <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || year)} className="w-28" />
          </div>
          <Button onClick={async () => {
            await importNat.mutateAsync({ year });
            toast({ title: 'Feriados nacionais importados' });
          }}>Importar feriados nacionais</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Adicionar feriado</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.holiday_date} onChange={e => setForm({ ...form, holiday_date: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Abrangência</Label>
              <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nacional">Nacional</SelectItem>
                  <SelectItem value="estadual">Estadual</SelectItem>
                  <SelectItem value="municipal">Municipal</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                await create.mutateAsync(form);
                toast({ title: 'Feriado adicionado' });
                setForm({ holiday_date: '', description: '', scope: 'nacional' });
              }}
            >
              Salvar
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Feriados {year}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Abrangência</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell>{format(new Date(h.holiday_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{h.description}</TableCell>
                    <TableCell><Badge variant="outline">{h.scope}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(h.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ SOLICITAÇÕES DE AJUSTE TAB ============
function SolicitacoesTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>('pending');
  const { data: reqs = [] } = useAdjustmentRequests(status);
  const review = useReviewAdjustmentRequest();
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [note, setNote] = useState('');

  const act = async (kind: 'approved' | 'rejected') => {
    await review.mutateAsync({ id: reviewing.id, status: kind, review_note: note });
    toast({ title: kind === 'approved' ? 'Aprovado' : 'Reprovado' });
    setReviewing(null); setNote('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="approved">Aprovadas</TabsTrigger>
              <TabsTrigger value="rejected">Reprovadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {reqs.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma solicitação {status === 'pending' ? 'pendente' : ''}.</p>}
        {reqs.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="pt-4 flex flex-col md:flex-row gap-4 justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.employee_name}</span>
                  {r.company_name && <Badge variant="outline">{r.company_name}</Badge>}
                  <Badge className={STATUS_COLORS[r.status === 'approved' ? 'normal' : r.status === 'rejected' ? 'falta' : 'extra']}>{r.status}</Badge>
                </div>
                <div className="text-sm">Data: <span className="font-mono">{format(new Date(r.punch_date), 'dd/MM/yyyy')}</span></div>
                {r.requested_times && <div className="text-sm">Horários: <span className="font-mono">{r.requested_times}</span></div>}
                <div className="text-sm text-muted-foreground">{r.justification}</div>
                {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver anexo</a>}
                {r.review_note && <div className="text-xs italic mt-1">Nota RH: "{r.review_note}"</div>}
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 md:flex-col">
                  <Button size="sm" onClick={() => setReviewing(r)}>Revisar</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {reviewing && (
        <Dialog open onOpenChange={() => { setReviewing(null); setNote(''); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Revisar solicitação — {reviewing.employee_name}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div>Data: <span className="font-mono">{format(new Date(reviewing.punch_date), 'dd/MM/yyyy')}</span></div>
              {reviewing.requested_times && <div>Horários solicitados: <span className="font-mono font-semibold">{reviewing.requested_times}</span></div>}
              <div className="p-3 bg-muted rounded">{reviewing.justification}</div>
              <div>
                <Label>Nota (opcional)</Label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: OK, batidas ajustadas conforme escala" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={() => act('rejected')}><XCircle className="h-4 w-4 mr-1" /> Reprovar</Button>
              <Button onClick={() => act('approved')}><CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar e aplicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============ PÁGINA PRINCIPAL ============
export default function RHPontoV2() {
  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Ponto Eletrônico</h1>
          <p className="text-muted-foreground text-sm">Cartão ponto, banco de horas 1:1, feriados e ajustes.</p>
        </div>

        <Tabs defaultValue="cartao">
          <TabsList>
            <TabsTrigger value="cartao">Cartão Ponto</TabsTrigger>
            <TabsTrigger value="banco">Banco de Horas</TabsTrigger>
            <TabsTrigger value="jornadas">Jornadas</TabsTrigger>
            <TabsTrigger value="feriados">Feriados</TabsTrigger>
            <TabsTrigger value="ajustes">Solicitações</TabsTrigger>
          </TabsList>
          <TabsContent value="cartao" className="mt-4"><CartaoPontoTab /></TabsContent>
          <TabsContent value="banco" className="mt-4"><BancoHorasTab /></TabsContent>
          <TabsContent value="jornadas" className="mt-4"><WorkSchedulesTab /></TabsContent>
          <TabsContent value="feriados" className="mt-4"><FeriadosTab /></TabsContent>
          <TabsContent value="ajustes" className="mt-4"><SolicitacoesTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
