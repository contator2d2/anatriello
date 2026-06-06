import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useRedeValidationConfig,
  useSaveRedeValidationConfig,
  DOCUMENT_LABELS,
} from '@/hooks/use-promoter-validations';
import { ApprovalAndNotificationFields, ApprovalMode } from '@/components/access-control/ApprovalAndNotificationFields';

interface Props {
  redeId: string;
  redeName?: string;
}

const ALL_DOCS = Object.keys(DOCUMENT_LABELS);

const DEFAULTS: Record<string, string[]> = {
  fixo: ['cnh', 'selfie', 'comprovante_endereco', 'contrato_trabalho', 'aso', 'ctps'],
  freelance: ['cnh', 'selfie'],
  substituto: ['cnh', 'selfie', 'declaracao_vinculo'],
};

type PromoterType = 'fixo' | 'freelance' | 'substituto';

export function RedeDocValidationConfig({ redeId, redeName }: Props) {
  const { data, isLoading } = useRedeValidationConfig(redeId);
  const saveMut = useSaveRedeValidationConfig();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [docsByType, setDocsByType] = useState<Record<PromoterType, string[]>>({
    fixo: [], freelance: [], substituto: [],
  });
  const [facialRequired, setFacialRequired] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [minScore, setMinScore] = useState(95);
  const [activeTab, setActiveTab] = useState<PromoterType>('fixo');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('ai');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState<string[]>([]);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [notifyEvents, setNotifyEvents] = useState<string[]>(['approved', 'rejected', 'divergent']);

  useEffect(() => {
    if (data) {
      const d: any = data;
      setEnabled(!!d.doc_validation_enabled);
      setDocsByType({
        fixo: Array.isArray(d.required_documents) && d.required_documents.length ? d.required_documents : DEFAULTS.fixo,
        freelance: Array.isArray(d.required_documents_freelance) ? d.required_documents_freelance : DEFAULTS.freelance,
        substituto: Array.isArray(d.required_documents_substituto) ? d.required_documents_substituto : DEFAULTS.substituto,
      });
      setFacialRequired(!!d.facial_required);
      setAutoApprove(d.auto_approve_on_match !== false);
      setMinScore(Number(d.auto_approve_min_score ?? 95));
      setApprovalMode((d.approval_mode as ApprovalMode) || 'ai');
      setNotifyEnabled(!!d.notify_enabled);
      setNotifyWhatsapp(Array.isArray(d.notify_whatsapp) ? d.notify_whatsapp : []);
      setNotifyEmails(Array.isArray(d.notify_emails) ? d.notify_emails : []);
      if (Array.isArray(d.notify_events)) setNotifyEvents(d.notify_events);
    }
  }, [data]);

  const toggleDoc = (type: PromoterType, doc: string) => {
    setDocsByType(prev => ({
      ...prev,
      [type]: prev[type].includes(doc) ? prev[type].filter(d => d !== doc) : [...prev[type], doc],
    }));
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({
        redeId,
        doc_validation_enabled: enabled,
        required_documents: docsByType.fixo as any,
        required_documents_freelance: docsByType.freelance,
        required_documents_substituto: docsByType.substituto,
        facial_required: facialRequired,
        auto_approve_on_match: autoApprove,
        auto_approve_min_score: minScore,
        approval_mode: approvalMode,
        notify_enabled: notifyEnabled,
        notify_events: notifyEvents,
        notify_whatsapp: notifyWhatsapp,
        notify_emails: notifyEmails,
      } as any);
      toast({ title: 'Configuração salva' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const renderDocs = (type: PromoterType) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {ALL_DOCS.map(doc => (
        <label key={doc} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
          <Checkbox
            checked={docsByType[type].includes(doc)}
            onCheckedChange={() => toggleDoc(type, doc)}
          />
          <span className="text-sm">{DOCUMENT_LABELS[doc]}</span>
        </label>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" /> Validação Automática de Documentos
        </CardTitle>
        {redeName && <p className="text-xs text-muted-foreground">{redeName}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-base">Ativar para esta rede</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativo, a IA analisa documentos antes da liberação do promotor
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label>Documentos exigidos por tipo de promotor</Label>
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
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Biometria facial obrigatória</Label>
                <p className="text-xs text-muted-foreground">
                  Compara selfie com foto da CNH antes da aprovação
                </p>
              </div>
              <Switch checked={facialRequired} onCheckedChange={setFacialRequired} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Auto-aprovar se 100% OK</Label>
                <p className="text-xs text-muted-foreground">
                  Libera promotor automaticamente quando score for atingido e sem divergências
                </p>
              </div>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>

            {autoApprove && (
              <div className="space-y-2">
                <Label>Score mínimo para auto-aprovação (0–100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                />
              </div>
            )}
          </>
        )}

        <ApprovalAndNotificationFields
          approvalMode={approvalMode}
          setApprovalMode={setApprovalMode}
          notifyEnabled={notifyEnabled}
          setNotifyEnabled={setNotifyEnabled}
          notifyWhatsapp={notifyWhatsapp}
          setNotifyWhatsapp={setNotifyWhatsapp}
          notifyEmails={notifyEmails}
          setNotifyEmails={setNotifyEmails}
          notifyEvents={notifyEvents}
          setNotifyEvents={setNotifyEvents}
        />


        <Button onClick={handleSave} disabled={saveMut.isPending} className="w-full">
          {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
