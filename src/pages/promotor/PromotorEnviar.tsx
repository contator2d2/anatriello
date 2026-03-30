import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadInput } from "@/components/ui/file-upload-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePromotorSendDocument, usePromotorInboundDocuments } from "@/hooks/use-promotor";
import { PromotorLayout } from "./PromotorLayout";
import { Upload, FileText, Loader2, Check, Clock } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: 'atestado', label: 'Atestado Médico' },
  { value: 'justificativa', label: 'Justificativa' },
  { value: 'doc_pessoal', label: 'Documento Pessoal' },
  { value: 'comprovante_bancario', label: 'Comprovante Bancário' },
  { value: 'recibo', label: 'Recibo' },
  { value: 'foto_doc', label: 'Foto de Documento' },
  { value: 'termo', label: 'Termo Assinado' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_LABELS: Record<string, string> = {
  recebido: 'Recebido', lido: 'Lido pelo RH', em_analise: 'Em Análise', aprovado: 'Aprovado', recusado: 'Recusado', concluido: 'Concluído',
};

export default function PromotorEnviar() {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [observation, setObservation] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [sending, setSending] = useState(false);
  const sendDoc = usePromotorSendDocument();
  const { data: history, isLoading } = usePromotorInboundDocuments();
  const { toast } = useToast();

  const handleSend = async () => {
    if (!category) { toast({ title: 'Selecione a categoria', variant: 'destructive' }); return; }
    setSending(true);
    try {
      await sendDoc.mutateAsync({ category, title: title || CATEGORIES.find(c => c.value === category)?.label, observation, file_url: fileUrl });
      toast({ title: 'Documento enviado ao RH!' });
      setCategory(''); setTitle(''); setObservation(''); setFileUrl('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <PromotorLayout>
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <h1 className="text-lg font-bold flex items-center gap-2"><Upload className="h-5 w-5" /> Enviar ao RH</h1>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Atestado Dr. Silva" />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={observation} onChange={e => setObservation(e.target.value)} placeholder="Informações adicionais..." rows={3} />
            </div>
            <Button onClick={handleSend} disabled={sending || !category} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Enviar Documento
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <h2 className="text-sm font-semibold">Histórico de Envios</h2>
        {(history || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhum envio ainda</p>}
        {(history || []).map((doc: any) => (
          <Card key={doc.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title || doc.category}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
              </div>
              <Badge variant="outline">{STATUS_LABELS[doc.status] || doc.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </PromotorLayout>
  );
}
