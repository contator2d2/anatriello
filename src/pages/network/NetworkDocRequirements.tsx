import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShieldCheck, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DOCUMENT_LABELS } from '@/hooks/use-promoter-validations';

const ALL_DOCS = Object.keys(DOCUMENT_LABELS);
const DEFAULTS: Record<string, string[]> = {
  fixo: ['cnh', 'selfie', 'comprovante_endereco', 'contrato_trabalho', 'aso', 'ctps'],
  freelance: ['cnh', 'selfie'],
  substituto: ['cnh', 'selfie', 'declaracao_vinculo'],
};
type PromoterType = 'fixo' | 'freelance' | 'substituto';

const getHeaders = () => {
  const token = localStorage.getItem('network_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export default function NetworkDocRequirements() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['network-doc-config'],
    queryFn: () => api('/api/network-portal/doc-config', { headers: getHeaders() }),
  });

  const [docsByType, setDocsByType] = useState<Record<PromoterType, string[]>>({
    fixo: [], freelance: [], substituto: [],
  });
  const [blockSubmission, setBlockSubmission] = useState(true);
  const [activeTab, setActiveTab] = useState<PromoterType>('fixo');

  useEffect(() => {
    if (data) {
      setDocsByType({
        fixo: Array.isArray(data.required_documents) && data.required_documents.length ? data.required_documents : DEFAULTS.fixo,
        freelance: Array.isArray(data.required_documents_freelance) ? data.required_documents_freelance : DEFAULTS.freelance,
        substituto: Array.isArray(data.required_documents_substituto) ? data.required_documents_substituto : DEFAULTS.substituto,
      });
      setBlockSubmission(data.docs_block_submission !== false);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (body: any) => api('/api/network-portal/doc-config', { method: 'PUT', body, headers: getHeaders() }),
    onSuccess: () => {
      toast({ title: 'Configuração salva' });
      qc.invalidateQueries({ queryKey: ['network-doc-config'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message, variant: 'destructive' }),
  });

  const toggleDoc = (type: PromoterType, doc: string) => {
    setDocsByType(prev => ({
      ...prev,
      [type]: prev[type].includes(doc) ? prev[type].filter(d => d !== doc) : [...prev[type], doc],
    }));
  };

  const renderDocs = (type: PromoterType) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {ALL_DOCS.map(doc => (
        <label key={doc} className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
          <Checkbox
            checked={docsByType[type].includes(doc)}
            onCheckedChange={() => toggleDoc(type, doc)}
          />
          <span className="text-sm">{DOCUMENT_LABELS[doc]}</span>
        </label>
      ))}
    </div>
  );

  if (isLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Documentos Exigidos
        </h1>
        <p className="text-muted-foreground text-sm">
          Defina quais documentos as agências devem enviar para cada promotor antes de operar nos seus PDVs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" /> Checklist por tipo de promotor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-base">Bloquear envio sem todos os documentos</Label>
              <p className="text-xs text-muted-foreground">
                A agência só consegue salvar o promotor após anexar todos os itens marcados.
              </p>
            </div>
            <Switch checked={blockSubmission} onCheckedChange={setBlockSubmission} />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PromoterType)}>
            <TabsList className="w-full">
              <TabsTrigger value="fixo" className="flex-1">Fixo (CLT)</TabsTrigger>
              <TabsTrigger value="freelance" className="flex-1">Freelance</TabsTrigger>
              <TabsTrigger value="substituto" className="flex-1">Substituto</TabsTrigger>
            </TabsList>
            <TabsContent value="fixo" className="mt-3">{renderDocs('fixo')}</TabsContent>
            <TabsContent value="freelance" className="mt-3">{renderDocs('freelance')}</TabsContent>
            <TabsContent value="substituto" className="mt-3">{renderDocs('substituto')}</TabsContent>
          </Tabs>

          <Button
            onClick={() => saveMut.mutate({
              required_documents: docsByType.fixo,
              required_documents_freelance: docsByType.freelance,
              required_documents_substituto: docsByType.substituto,
              docs_block_submission: blockSubmission,
            })}
            disabled={saveMut.isPending}
            className="w-full"
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configuração
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
