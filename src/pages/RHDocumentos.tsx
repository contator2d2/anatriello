import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/use-rh";
import { useDocumentDeliveries, useSendDocumentDelivery, useInboundDocumentsRH, useDocumentTypes } from "@/hooks/use-promotor";
import { FileText, Send, Search, Eye, RotateCcw, XCircle, Plus, Upload, Loader2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  criado: { label: 'Criado', variant: 'secondary' },
  pendente: { label: 'Pendente', variant: 'outline' },
  enviado: { label: 'Enviado', variant: 'default' },
  entregue: { label: 'Entregue', variant: 'default' },
  visualizado: { label: 'Visualizado', variant: 'outline' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  assinado: { label: 'Assinado', variant: 'default' },
  recusado: { label: 'Recusado', variant: 'destructive' },
  expirado: { label: 'Expirado', variant: 'secondary' },
  cancelado: { label: 'Cancelado', variant: 'secondary' },
};

export default function RHDocumentos() {
  const [tab, setTab] = useState("enviados");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { data: deliveries, isLoading: loadingDeliveries } = useDocumentDeliveries({ status: statusFilter || undefined });
  const { data: inboundDocs, isLoading: loadingInbound } = useInboundDocumentsRH();
  const { data: employees } = useEmployees();
  const { data: docTypes } = useDocumentTypes();
  const sendDelivery = useSendDocumentDelivery();
  const { toast } = useToast();

  const [sendForm, setSendForm] = useState({ title: '', description: '', employee_id: '', file_url: '', requires_confirmation: true, requires_signature: false, document_type_id: '' });

  const handleSend = async () => {
    if (!sendForm.title || !sendForm.employee_id) { toast({ title: 'Preencha título e selecione colaborador', variant: 'destructive' }); return; }
    try {
      await sendDelivery.mutateAsync(sendForm);
      toast({ title: 'Documento enviado!' });
      setShowSendDialog(false);
      setSendForm({ title: '', description: '', employee_id: '', file_url: '', requires_confirmation: true, requires_signature: false, document_type_id: '' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const filteredDeliveries = (deliveries || []).filter((d: any) => !search || d.employee_name?.toLowerCase().includes(search.toLowerCase()) || d.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Central de Documentos</h1>
          <Button onClick={() => setShowSendDialog(true)}><Send className="h-4 w-4 mr-2" /> Enviar Documento</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="enviados">Enviados ao Colaborador</TabsTrigger>
            <TabsTrigger value="recebidos">Recebidos do Colaborador</TabsTrigger>
          </TabsList>

          <TabsContent value="enviados" className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" /></div>
              <Select value={statusFilter || "__all__"} onValueChange={v => setStatusFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="visualizado">Visualizado</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Visualizado</TableHead>
                    <TableHead>Assinado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell>{d.employee_name}</TableCell>
                      <TableCell><Badge variant={STATUS_MAP[d.status]?.variant as any || 'outline'}>{STATUS_MAP[d.status]?.label || d.status}</Badge></TableCell>
                      <TableCell className="text-xs">{d.sent_at ? format(new Date(d.sent_at), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                      <TableCell className="text-xs">{d.viewed_at ? format(new Date(d.viewed_at), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                      <TableCell className="text-xs">{d.signed_at ? format(new Date(d.signed_at), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredDeliveries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum documento encontrado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="recebidos" className="space-y-3">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recebido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(inboundDocs || []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                      <TableCell>{d.employee_name}</TableCell>
                      <TableCell>{d.title}</TableCell>
                      <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                      <TableCell className="text-xs">{format(new Date(d.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                  {(inboundDocs || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum documento recebido</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enviar Documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Colaborador *</Label>
              <Select value={sendForm.employee_id} onValueChange={v => setSendForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{(employees || []).filter((e: any) => e.status === 'ativo').map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Título *</Label><Input value={sendForm.title} onChange={e => setSendForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea value={sendForm.description} onChange={e => setSendForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="space-y-1"><Label>Tipo de Documento</Label>
              <Select value={sendForm.document_type_id} onValueChange={v => setSendForm(f => ({ ...f, document_type_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)..." /></SelectTrigger>
                <SelectContent>{(docTypes || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendForm.requires_confirmation} onChange={e => setSendForm(f => ({ ...f, requires_confirmation: e.target.checked }))} /> Confirmar recebimento</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendForm.requires_signature} onChange={e => setSendForm(f => ({ ...f, requires_signature: e.target.checked }))} /> Assinatura obrigatória</label>
            </div>
            <Button onClick={handleSend} className="w-full" disabled={sendDelivery.isPending}>
              {sendDelivery.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
