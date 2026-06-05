import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { DOCUMENT_LABELS } from '@/hooks/use-promoter-validations';

const ALL_DOCS = Object.keys(DOCUMENT_LABELS);

export function UnitDocValidationConfig({ unitId }: { unitId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['unit-validation-config', unitId],
    queryFn: () => api(`/api/promoter-validations/unit/${unitId}/config`),
    enabled: !!unitId,
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [docs, setDocs] = useState<string[] | null>(null);
  const [facial, setFacial] = useState<boolean | null>(null);
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [minScore, setMinScore] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.doc_validation_enabled);
    setDocs(Array.isArray(data.required_documents) ? data.required_documents : null);
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

  const toggleDoc = (k: string) => {
    const cur = docs || [];
    setDocs(cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Configuração específica deste PDV. Campos vazios herdam da Rede.</p>

      <div className="flex items-center justify-between">
        <Label>Validação habilitada (override)</Label>
        <Switch checked={!!enabled} onCheckedChange={v => setEnabled(v)} />
      </div>

      <div>
        <Label>Documentos exigidos</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {ALL_DOCS.map(k => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox checked={(docs || []).includes(k)} onCheckedChange={() => toggleDoc(k)} />
              {DOCUMENT_LABELS[k]}
            </label>
          ))}
        </div>
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
          required_documents: docs,
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
