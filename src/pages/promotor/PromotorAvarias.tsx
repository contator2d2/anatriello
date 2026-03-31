import { useState, useMemo } from "react";
import { PromotorLayout } from "./PromotorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePromotorDamages, usePromotorRequestReturn, usePromotorUploadInvoice } from "@/hooks/use-promotor-routes";
import { toast } from "sonner";
import { AlertTriangle, Camera, FileText, Send, Upload } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  registered: 'Registrada', awaiting_invoice: 'Aguardando Nota', invoice_sent: 'Nota Enviada',
  in_review: 'Em Conferência', completed: 'Concluída', cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  registered: 'bg-yellow-500/20 text-yellow-700', awaiting_invoice: 'bg-orange-500/20 text-orange-700',
  invoice_sent: 'bg-blue-500/20 text-blue-700', in_review: 'bg-purple-500/20 text-purple-700',
  completed: 'bg-green-500/20 text-green-700', cancelled: 'bg-muted text-muted-foreground',
};

export default function PromotorAvarias() {
  const { data: damages = [] } = usePromotorDamages();
  const requestReturn = usePromotorRequestReturn();
  const uploadInvoice = usePromotorUploadInvoice();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<any>({});

  const selectableDamages = useMemo(() =>
    damages.filter((d: any) => d.status === 'registered'), [damages]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleRequestReturn = () => {
    const selected = damages.filter((d: any) => selectedIds.has(d.id));
    if (!selected.length) return;

    const pdv_id = selected[0].pdv_id;
    const brand_id = selected[0].brand_id;

    requestReturn.mutate({
      damage_ids: Array.from(selectedIds),
      pdv_id, brand_id,
    }, {
      onSuccess: () => {
        toast.success('Solicitação de devolução enviada');
        setSelectedIds(new Set());
        setShowReturnDialog(false);
      },
    });
  };

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = { registered: [], awaiting: [], other: [] };
    damages.forEach((d: any) => {
      if (d.status === 'registered') groups.registered.push(d);
      else if (d.status === 'awaiting_invoice') groups.awaiting.push(d);
      else groups.other.push(d);
    });
    return groups;
  }, [damages]);

  return (
    <PromotorLayout>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" /> Avarias
          </h2>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={() => setShowReturnDialog(true)}>
              <Send className="h-4 w-4 mr-1" /> Solicitar Nota ({selectedIds.size})
            </Button>
          )}
        </div>

        {/* Registered (selectable) */}
        {grouped.registered.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-yellow-700 mb-2">Registradas</h3>
            {grouped.registered.map((d: any) => (
              <Card key={d.id} className="mb-2">
                <CardContent className="p-3 flex items-start gap-3">
                  <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} className="mt-1" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{d.product_name}</div>
                    <div className="text-xs text-muted-foreground">{d.pdv_name} • {d.brand_name}</div>
                    <div className="text-xs mt-0.5">Loja: {d.qty_store} | Estoque: {d.qty_stock} | <strong>Total: {d.qty_total}</strong></div>
                    {d.reason && <div className="text-xs text-muted-foreground mt-0.5">{d.reason}</div>}
                  </div>
                  <Badge className={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status]}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Awaiting Invoice */}
        {grouped.awaiting.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-orange-700 mb-2">Aguardando Nota de Devolução</h3>
            {grouped.awaiting.map((d: any) => (
              <Card key={d.id} className="mb-2 border-orange-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{d.product_name}</div>
                      <div className="text-xs text-muted-foreground">{d.pdv_name} • Qtd: {d.qty_total}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setInvoiceForm({ damage_id: d.id }); setShowInvoiceDialog(true); }}>
                      <Upload className="h-3 w-3 mr-1" /> Enviar Nota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Other statuses */}
        {grouped.other.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Histórico</h3>
            {grouped.other.map((d: any) => (
              <Card key={d.id} className="mb-2">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{d.product_name}</div>
                    <div className="text-xs text-muted-foreground">{d.pdv_name} • Qtd: {d.qty_total}</div>
                  </div>
                  <Badge className={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status]}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {damages.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma avaria registrada</p>
          </div>
        )}

        {/* Return Request Dialog */}
        <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Solicitar Nota de Devolução</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} avaria(s) selecionada(s) serão agrupadas na solicitação.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReturnDialog(false)}>Cancelar</Button>
              <Button onClick={handleRequestReturn} disabled={requestReturn.isPending}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Invoice Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Enviar Nota de Devolução</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nº da Nota</Label><Input placeholder="Número" onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} /></div>
              <div><Label className="text-xs">Data da Nota</Label><Input type="date" onChange={e => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} /></div>
              <div><Label className="text-xs">Emitente</Label><Input placeholder="Nome do emitente" onChange={e => setInvoiceForm({ ...invoiceForm, issuer_name: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancelar</Button>
              <Button onClick={() => {
                uploadInvoice.mutate(invoiceForm, {
                  onSuccess: () => { toast.success('Nota enviada'); setShowInvoiceDialog(false); },
                });
              }}>Enviar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PromotorLayout>
  );
}
