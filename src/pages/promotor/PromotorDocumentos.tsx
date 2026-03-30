import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePromotorDocuments, usePromotorConfirmDocument, usePromotorViewDocument, usePromotorPayslips, usePromotorTimesheets } from "@/hooks/use-promotor";
import { PromotorLayout } from "./PromotorLayout";
import { FileText, Eye, Check, X, Download, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  enviado: { label: 'Novo', color: 'bg-blue-500' },
  entregue: { label: 'Entregue', color: 'bg-blue-400' },
  visualizado: { label: 'Visualizado', color: 'bg-yellow-500' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500' },
  assinado: { label: 'Assinado', color: 'bg-green-600' },
  recusado: { label: 'Recusado', color: 'bg-red-500' },
  expirado: { label: 'Expirado', color: 'bg-gray-500' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-400' },
};

export default function PromotorDocumentos() {
  const [tab, setTab] = useState("pendentes");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const { data: docs, isLoading } = usePromotorDocuments();
  const { data: payslips } = usePromotorPayslips();
  const { data: timesheets } = usePromotorTimesheets();
  const confirmDoc = usePromotorConfirmDocument();
  const viewDoc = usePromotorViewDocument();
  const { toast } = useToast();

  const pending = (docs || []).filter((d: any) => ['enviado', 'entregue', 'visualizado'].includes(d.status));
  const completed = (docs || []).filter((d: any) => ['confirmado', 'assinado'].includes(d.status));

  const handleView = async (doc: any) => {
    setSelectedDoc(doc);
    if (['enviado', 'entregue'].includes(doc.status)) {
      try { await viewDoc.mutateAsync(doc.id); } catch {}
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmDoc.mutateAsync(id);
      toast({ title: 'Recebimento confirmado!' });
      setSelectedDoc(null);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <PromotorLayout>
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <h1 className="text-lg font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Meus Documentos</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="pendentes" className="text-xs">Pendentes{pending.length > 0 && ` (${pending.length})`}</TabsTrigger>
            <TabsTrigger value="concluidos" className="text-xs">Concluídos</TabsTrigger>
            <TabsTrigger value="holerites" className="text-xs">Holerites</TabsTrigger>
            <TabsTrigger value="espelho" className="text-xs">Espelho</TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-2 mt-3">
            {pending.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum documento pendente</p>}
            {pending.map((doc: any) => (
              <Card key={doc.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleView(doc)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.type_name || 'Documento'} • {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.requires_signature && <Badge variant="outline" className="text-[10px]">Assinar</Badge>}
                    <Badge className={STATUS_MAP[doc.status]?.color || 'bg-gray-400'}>{STATUS_MAP[doc.status]?.label || doc.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="concluidos" className="space-y-2 mt-3">
            {completed.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum documento concluído</p>}
            {completed.map((doc: any) => (
              <Card key={doc.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleView(doc)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                  <Badge className="bg-green-500">{STATUS_MAP[doc.status]?.label}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="holerites" className="space-y-2 mt-3">
            {(payslips || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum holerite disponível</p>}
            {(payslips || []).map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Competência: {p.reference_month}</p>
                    <p className="text-xs text-muted-foreground">Líquido: R$ {Number(p.net_salary || 0).toFixed(2)}</p>
                  </div>
                  {p.pdf_url && <Button size="sm" variant="outline"><Download className="h-3 w-3 mr-1" /> PDF</Button>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="espelho" className="space-y-2 mt-3">
            {(timesheets || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum espelho de ponto</p>}
            {(timesheets || []).map((t: any) => (
              <Card key={t.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Referência: {t.reference_month}</p>
                    <p className="text-xs text-muted-foreground">Total: {t.total_hours}h • Extras: {t.overtime_hours}h</p>
                  </div>
                  <Badge variant="outline">{t.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Document detail dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{selectedDoc?.description || 'Sem descrição'}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Enviado em {selectedDoc?.sent_at ? format(new Date(selectedDoc.sent_at), 'dd/MM/yyyy HH:mm') : '-'}</span>
            </div>
            {selectedDoc?.file_url && (
              <Button variant="outline" className="w-full" onClick={() => window.open(selectedDoc.file_url, '_blank')}>
                <Eye className="h-4 w-4 mr-2" /> Visualizar Documento
              </Button>
            )}
            {selectedDoc?.requires_confirmation && ['enviado', 'entregue', 'visualizado'].includes(selectedDoc?.status) && (
              <Button className="w-full" onClick={() => handleConfirm(selectedDoc.id)} disabled={confirmDoc.isPending}>
                {confirmDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Confirmar Recebimento
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PromotorLayout>
  );
}
