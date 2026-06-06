import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { DOCUMENT_LABELS } from '@/hooks/use-promoter-validations';
import { ApprovalAndNotificationFields, ApprovalMode } from './ApprovalAndNotificationFields';

const ALL_DOCS = Object.keys(DOCUMENT_LABELS);
type PromoterType = 'fixo' | 'freelance' | 'substituto';

export function UnitDocValidationConfig({ unitId }: { unitId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['unit-validation-config', unitId],
    queryFn: () => api(`/api/promoter-validations/unit/${unitId}/config`),
    enabled: !!unitId,
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [docsByType, setDocsByType] = useState<Record<PromoterType, string[] | null>>({
    fixo: null, freelance: null, substituto: null,
  });
  const [facial, setFacial] = useState<boolean | null>(null);
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PromoterType>('fixo');

  useEffect(() => {
    if (!data) return;
    setEnabled(data.doc_validation_enabled);
    setDocsByType({
      fixo: Array.isArray(data.required_documents) ? data.required_documents : null,
      freelance: Array.isArray(data.required_documents_freelance) ? data.required_documents_freelance : null,
      substituto: Array.isArray(data.required_documents_substituto) ? data.required_documents_substituto : null,
    });
    setFacial(data.facial_required);
    setAutoApprove(data.auto_approve_on_match);
    setMinScore(data.auto_approve_min_score != null ? Number(data.auto_approve_min_score) : null);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (body: any) => api(`/api/promoter-validations/unit/${unitId}/config`, { method: 'PUT', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unit-validation-config', unitId] });
      toast({ title: 'Configuração salva' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const toggleDoc = (type: PromoterType, k: string) => {
    const cur = docsByType[type] || [];
    setDocsByType(prev => ({
      ...prev,
      [type]: cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k],
    }));
  };

  const renderDocs = (type: PromoterType) => (
    <div className="grid grid-cols-2 gap-2">
      {ALL_DOCS.map(k => (
        <label key={k} className="flex items-center gap-2 text-sm rounded-md border p-2 cursor-pointer hover:bg-muted/50">
          <Checkbox checked={(docsByType[type] || []).includes(k)} onCheckedChange={() => toggleDoc(type, k)} />
          {DOCUMENT_LABELS[k]}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Configuração específica deste PDV. Campos vazios herdam da Rede.</p>

      <div className="flex items-center justify-between">
        <Label>Validação habilitada (override)</Label>
        <Switch checked={!!enabled} onCheckedChange={v => setEnabled(v)} />
      </div>

      <div>
        <Label>Documentos exigidos por tipo de promotor</Label>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as PromoterType)} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="fixo" className="flex-1">Fixo</TabsTrigger>
            <TabsTrigger value="freelance" className="flex-1">Freelance</TabsTrigger>
            <TabsTrigger value="substituto" className="flex-1">Substituto</TabsTrigger>
          </TabsList>
          <TabsContent value="fixo" className="mt-3">{renderDocs('fixo')}</TabsContent>
          <TabsContent value="freelance" className="mt-3">{renderDocs('freelance')}</TabsContent>
          <TabsContent value="substituto" className="mt-3">{renderDocs('substituto')}</TabsContent>
        </Tabs>
      </div>

      <div className="flex items-center justify-between">
        <Label>Selfie / reconhecimento facial obrigatório</Label>
        <Switch checked={!!facial} onCheckedChange={v => setFacial(v)} />
      </div>

      <div className="flex items-center justify-between">
        <Label>Aprovar automaticamente quando IA aprovar</Label>
        <Switch checked={!!autoApprove} onCheckedChange={v => setAutoApprove(v)} />
      </div>

      <div>
        <Label>Score mínimo para auto-aprovação</Label>
        <Input type="number" min={0} max={100} value={minScore ?? ''} onChange={e => setMinScore(e.target.value ? Number(e.target.value) : null)} />
      </div>

      <Button
        className="w-full"
        disabled={saveMut.isPending}
        onClick={() => saveMut.mutate({
          doc_validation_enabled: enabled,
          required_documents: docsByType.fixo,
          required_documents_freelance: docsByType.freelance,
          required_documents_substituto: docsByType.substituto,
          facial_required: facial,
          auto_approve_on_match: autoApprove,
          auto_approve_min_score: minScore,
        })}
      >
        {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
      </Button>
    </div>
  );
}
