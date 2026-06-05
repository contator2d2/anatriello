import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useRedeValidationConfig,
  useSaveRedeValidationConfig,
  DOCUMENT_LABELS,
} from '@/hooks/use-promoter-validations';

interface Props {
  redeId: string;
  redeName?: string;
}

const ALL_DOCS = Object.keys(DOCUMENT_LABELS);

export function RedeDocValidationConfig({ redeId, redeName }: Props) {
  const { data, isLoading } = useRedeValidationConfig(redeId);
  const saveMut = useSaveRedeValidationConfig();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [facialRequired, setFacialRequired] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [minScore, setMinScore] = useState(95);

  useEffect(() => {
    if (data) {
      setEnabled(!!data.doc_validation_enabled);
      setRequiredDocs(Array.isArray(data.required_documents) ? data.required_documents : []);
      setFacialRequired(!!data.facial_required);
      setAutoApprove(data.auto_approve_on_match !== false);
      setMinScore(Number(data.auto_approve_min_score ?? 95));
    }
  }, [data]);

  const toggleDoc = (doc: string) => {
    setRequiredDocs(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]);
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({
        redeId,
        doc_validation_enabled: enabled,
        required_documents: requiredDocs as any,
        facial_required: facialRequired,
        auto_approve_on_match: autoApprove,
        auto_approve_min_score: minScore,
      });
      toast({ title: 'Configuração salva' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

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
              <Label>Documentos exigidos</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ALL_DOCS.map(doc => (
                  <label key={doc} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={requiredDocs.includes(doc)}
                      onCheckedChange={() => toggleDoc(doc)}
                    />
                    <span className="text-sm">{DOCUMENT_LABELS[doc]}</span>
                  </label>
                ))}
              </div>
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

        <Button onClick={handleSave} disabled={saveMut.isPending} className="w-full">
          {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
