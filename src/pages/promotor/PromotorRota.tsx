import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PromotorLayout } from "./PromotorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadInput } from "@/components/ui/file-upload-input";
import {
  usePromotorRouteDetail, usePromotorCheckin, usePromotorCheckout,
  usePromotorUpdateExecution, usePromotorReportDamage, usePromotorReportRupture,
  usePromotorAddValidity, usePromotorReportDiscard,
} from "@/hooks/use-promotor-routes";
import { toast } from "sonner";
import {
  MapPin, Camera, Check, AlertTriangle, Archive, Clock,
  CheckCircle2, Circle, Calendar as CalendarIcon, Trash2, MoreVertical
} from "lucide-react";

const EXEC_STATUS_ICON: Record<string, any> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-yellow-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

type ActionType = 'validity' | 'rupture' | 'damage' | 'discard' | null;

export default function PromotorRota() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: route, isLoading } = usePromotorRouteDetail(id);
  const checkin = usePromotorCheckin();
  const checkout = usePromotorCheckout();
  const updateExec = usePromotorUpdateExecution();
  const reportDamage = usePromotorReportDamage();
  const reportRupture = usePromotorReportRupture();
  const addValidity = usePromotorAddValidity();
  const reportDiscard = usePromotorReportDiscard();

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [selectedExec, setSelectedExec] = useState<any>(null);
  const [actionForm, setActionForm] = useState<any>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkinPhotoUrl, setCheckinPhotoUrl] = useState('');

  const groupedExecs = useMemo(() => {
    if (!route?.executions) return {};
    const groups: Record<string, any[]> = {};
    route.executions.forEach((e: any) => {
      const cat = e.category_name || 'Sem Categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    return groups;
  }, [route?.executions]);

  const handleCheckin = useCallback(async () => {
    if (!id) return;
    if (route?.require_checkin_photo && !checkinPhotoUrl) {
      toast.error('Esta rota exige foto obrigatória no check-in');
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      checkin.mutate({
        id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        device: navigator.userAgent,
        photo_url: checkinPhotoUrl || undefined,
      }, {
        onSuccess: () => toast.success('Check-in realizado!'),
        onError: (err: any) => toast.error(err.message),
      });
    } catch {
      toast.error('Não foi possível obter localização');
    }
  }, [id, checkin, route?.require_checkin_photo, checkinPhotoUrl]);

  const handleCheckout = useCallback(() => {
    if (!id) return;
    checkout.mutate({ id, notes: actionForm.notes }, {
      onSuccess: () => { toast.success('Rota finalizada!'); navigate('/promotor/agenda'); },
      onError: (err: any) => toast.error(err.message),
    });
  }, [id, checkout, actionForm, navigate]);

  const handleToggleExec = useCallback((exec: any) => {
    const newStatus = exec.status === 'completed' ? 'pending' : 'completed';
    updateExec.mutate({ id: exec.id, status: newStatus, checked: newStatus === 'completed' });
  }, [updateExec]);

  const handleSubmitAction = useCallback(() => {
    if (!selectedExec || !activeAction) return;
    const execId = selectedExec.id;

    if (activeAction === 'validity') {
      addValidity.mutate({ executionId: execId, ...actionForm }, { onSuccess: () => { toast.success('Validade registrada'); setActiveAction(null); } });
    } else if (activeAction === 'rupture') {
      reportRupture.mutate({ executionId: execId, ...actionForm }, { onSuccess: () => { toast.success('Ruptura registrada'); setActiveAction(null); } });
    } else if (activeAction === 'damage') {
      reportDamage.mutate({ executionId: execId, ...actionForm }, { onSuccess: () => { toast.success('Avaria registrada'); setActiveAction(null); } });
    } else if (activeAction === 'discard') {
      reportDiscard.mutate({ executionId: execId, ...actionForm }, { onSuccess: () => { toast.success('Descarte registrado'); setActiveAction(null); } });
    }
  }, [selectedExec, activeAction, actionForm, addValidity, reportRupture, reportDamage, reportDiscard]);

  if (isLoading) return <PromotorLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div></PromotorLayout>;
  if (!route) return <PromotorLayout><div className="text-center py-12 text-muted-foreground">Rota não encontrada</div></PromotorLayout>;

  const needsCheckin = route.status === 'scheduled' || route.status === 'confirmed';
  const isActive = route.status === 'in_progress';
  const isCompleted = route.status === 'completed';

  return (
    <PromotorLayout>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="font-bold text-lg">{route.pdv_name}</h2>
                <p className="text-sm text-muted-foreground">{route.brand_name}</p>
                {route.checklist_name && <p className="text-xs text-muted-foreground mt-1">Checklist: {route.checklist_name}</p>}
              </div>
              <Badge className={route.status === 'in_progress' ? 'bg-orange-500/20 text-orange-700' : route.status === 'completed' ? 'bg-green-500/20 text-green-700' : 'bg-blue-500/20 text-blue-700'}>
                {route.status === 'in_progress' ? 'Em Andamento' : route.status === 'completed' ? 'Concluída' : 'Agendada'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{route.pdv_address || route.pdv_city}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{route.scheduled_time?.slice(0, 5)}</span>
            </div>
            {isActive && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Progresso</span>
                  <span className="font-mono font-bold">{Math.round(route.progress_pct || 0)}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${route.progress_pct || 0}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {needsCheckin && route.require_checkin_photo && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Camera className="h-4 w-4 text-primary" />
                Foto obrigatória para check-in
              </div>
              <FileUploadInput
                value={checkinPhotoUrl}
                onChange={setCheckinPhotoUrl}
                accept="image/*,.jpg,.jpeg,.png,.webp"
                placeholder="Envie a foto do check-in"
                previewType="image"
                customTokenGetter={() => localStorage.getItem('promotor_token')}
              />
            </CardContent>
          </Card>
        )}

        {needsCheckin && (
          <Button className="w-full h-14 text-lg" onClick={handleCheckin} disabled={checkin.isPending || (route.require_checkin_photo && !checkinPhotoUrl)}>
            <MapPin className="h-5 w-5 mr-2" />
            {checkin.isPending ? 'Realizando check-in...' : route.require_checkin_photo ? 'Enviar foto e fazer check-in' : 'Fazer Check-in'}
          </Button>
        )}

        {isActive && route.executions?.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum produto foi carregado para esta rota.
            </CardContent>
          </Card>
        )}

        {isActive && (
          <div className="space-y-4">
            {Object.entries(groupedExecs).map(([category, execs]) => {
              const doneCount = (execs as any[]).filter((e: any) => e.status === 'completed').length;
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold">{category}</h3>
                    <Badge variant="outline" className="text-[10px]">{doneCount}/{(execs as any[]).length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {(execs as any[]).map((exec: any) => (
                      <Card key={exec.id} className={exec.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : ''}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleToggleExec(exec)} className="flex-shrink-0">
                              {EXEC_STATUS_ICON[exec.status] || EXEC_STATUS_ICON.pending}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{exec.product_name}</div>
                              {exec.exposure_point !== 'natural' && <Badge variant="secondary" className="text-[9px] mt-0.5">{exec.exposure_point}</Badge>}
                              {(exec.qty_store > 0 || exec.qty_stock > 0) && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Loja: {exec.qty_store} | Estoque: {exec.qty_stock} | Total: {exec.qty_total}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {exec.has_rupture && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                              {exec.has_damage && <Archive className="h-3.5 w-3.5 text-orange-500" />}
                              <button onClick={() => { setSelectedExec(exec); setActionForm({}); }} className="p-1 hover:bg-muted rounded">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            <Button className="w-full h-12" onClick={() => setShowCheckout(true)} disabled={checkout.isPending}>
              <Check className="h-5 w-5 mr-2" /> Finalizar Rota
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-700">Rota concluída</p>
            <p className="text-xs text-muted-foreground">
              {route.checkin_at && `Check-in: ${new Date(route.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              {route.checkout_at && ` • Check-out: ${new Date(route.checkout_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        )}

        <Dialog open={!!selectedExec && !activeAction} onOpenChange={() => setSelectedExec(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-sm">{selectedExec?.product_name}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'validity', label: 'Validade', icon: CalendarIcon, color: 'text-blue-600' },
                { key: 'rupture', label: 'Ruptura', icon: AlertTriangle, color: 'text-red-600' },
                { key: 'damage', label: 'Avaria', icon: Archive, color: 'text-orange-600' },
                { key: 'discard', label: 'Descarte', icon: Trash2, color: 'text-purple-600' },
              ].map(a => (
                <Button key={a.key} variant="outline" className="h-16 flex-col gap-1" onClick={() => { setActiveAction(a.key as ActionType); setActionForm({}); }}>
                  <a.icon className={`h-5 w-5 ${a.color}`} />
                  <span className="text-xs">{a.label}</span>
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Qtd Loja</Label><Input type="number" placeholder="0" onChange={e => updateExec.mutate({ id: selectedExec?.id, qty_store: parseInt(e.target.value) || 0 })} /></div>
              <div><Label className="text-xs">Qtd Estoque</Label><Input type="number" placeholder="0" onChange={e => updateExec.mutate({ id: selectedExec?.id, qty_stock: parseInt(e.target.value) || 0 })} /></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!activeAction} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {activeAction === 'validity' ? 'Registrar Validade' : activeAction === 'rupture' ? 'Registrar Ruptura' : activeAction === 'damage' ? 'Registrar Avaria' : 'Registrar Descarte'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {activeAction === 'validity' && (
                <>
                  <div><Label className="text-xs">Data de Validade</Label><Input type="date" onChange={e => setActionForm({ ...actionForm, expiry_date: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Qtd Loja</Label><Input type="number" placeholder="0" onChange={e => setActionForm({ ...actionForm, qty_store: parseInt(e.target.value) || 0 })} /></div>
                    <div><Label className="text-xs">Qtd Estoque</Label><Input type="number" placeholder="0" onChange={e => setActionForm({ ...actionForm, qty_stock: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                </>
              )}
              {(activeAction === 'rupture' || activeAction === 'damage' || activeAction === 'discard') && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Qtd Loja</Label><Input type="number" placeholder="0" onChange={e => setActionForm({ ...actionForm, qty_store: parseInt(e.target.value) || 0 })} /></div>
                    <div><Label className="text-xs">Qtd Estoque</Label><Input type="number" placeholder="0" onChange={e => setActionForm({ ...actionForm, qty_stock: parseInt(e.target.value) || 0 })} /></div>
                  </div>
                  <div><Label className="text-xs">Motivo</Label><Input placeholder="Motivo" onChange={e => setActionForm({ ...actionForm, reason: e.target.value })} /></div>
                  <div><Label className="text-xs">Observação</Label><Textarea rows={2} placeholder="Observação" onChange={e => setActionForm({ ...actionForm, observation: e.target.value, description: e.target.value })} /></div>
                  {activeAction === 'damage' && (
                    <div>
                      <Label className="text-xs">Local</Label>
                      <Select onValueChange={v => setActionForm({ ...actionForm, location: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="store">Loja</SelectItem>
                          <SelectItem value="stock">Estoque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Cancelar</Button>
              <Button onClick={handleSubmitAction}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Finalizar Rota</DialogTitle></DialogHeader>
            <div>
              <Label className="text-xs">Observação de encerramento</Label>
              <Textarea rows={3} placeholder="Observações finais..." onChange={e => setActionForm({ ...actionForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCheckout(false)}>Cancelar</Button>
              <Button onClick={handleCheckout} disabled={checkout.isPending}>Confirmar Finalização</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PromotorLayout>
  );
}
