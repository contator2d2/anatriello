import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, Save, RotateCcw, Sparkles, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSRPrompts, useSRSavePrompt, type SRAIPrompt } from "@/hooks/use-smartroute-ai";

const EXAMPLES: Record<string, string> = {
  advisor:
    "Ex.: Priorize sempre reduzir custo de combustível. Considere que motoristas novatos (< 3 meses) precisam de rotas menores. Alertar quando um PDV rejeitar 2x na mesma semana.",
  post_route:
    "Ex.: Considere atraso aceitável até 20 min. Penalize forte checklist não preenchido. Destaque motoristas com desempenho acima da média.",
  ocr_batch_expiry:
    "Ex.: Rótulos da marca X usam formato DD/MM/AAAA. Ignore números com prefixo 'EAN'. Se houver duas datas, considere a mais próxima como validade.",
  shelf_analysis:
    "Ex.: Marcas prioritárias: Coca-Cola, Guaraná Antarctica. Ruptura crítica se fill < 30%. Sempre comentar posicionamento de PDV especial.",
};

function PromptCard({ prompt }: { prompt: SRAIPrompt }) {
  const [text, setText] = useState(prompt.instructions || "");
  const save = useSRSavePrompt();

  useEffect(() => { setText(prompt.instructions || ""); }, [prompt.instructions]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({ key: prompt.key, instructions: text });
      toast.success("Instruções salvas", { description: `A IA usará estas orientações em: ${prompt.label}` });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReset = async () => {
    setText("");
    try {
      await save.mutateAsync({ key: prompt.key, instructions: "" });
      toast.success("Instruções restauradas ao padrão");
    } catch (e: any) { toast.error(e.message); }
  };

  const dirty = text !== (prompt.instructions || "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-primary" />
          {prompt.label}
          {prompt.instructions && <Badge variant="outline" className="text-[10px]">Customizado</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{prompt.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Comportamento base da IA (não editável)</Label>
          <div className="mt-1 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground leading-relaxed">
            {prompt.system_default}
          </div>
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1">
            Suas instruções extras <Info className="w-3 h-3 text-muted-foreground" />
          </Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLES[prompt.key]}
            rows={6}
            className="mt-1 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Escreva em português, de forma direta. A IA seguirá estas regras como prioridade máxima.
            {prompt.updated_at && ` · Atualizado em ${new Date(prompt.updated_at).toLocaleString("pt-BR")}`}
          </p>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={save.isPending || !prompt.instructions}>
            <RotateCcw className="w-3 h-3 mr-1" /> Restaurar padrão
          </Button>
          <Button size="sm" onClick={handleSave} disabled={save.isPending || !dirty}>
            {save.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SmartRoutePrompts() {
  const { data: prompts = [], isLoading } = useSRPrompts();

  return (
    <MainLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> Inteligência do SmartRoute
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ajuste diretamente como a IA raciocina em cada análise. Escreva regras, prioridades e contexto do seu negócio — a IA aplicará em toda a operação da sua empresa.
          </p>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-3 items-start">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Como funciona</p>
              <p className="text-muted-foreground text-xs mt-1">
                Cada bloco abaixo controla uma parte da IA. O texto que você escrever é injetado no prompt da IA como
                <b> "instruções do gestor"</b> — a IA obedece sempre que gerar aquele tipo de análise. Deixe em branco para usar o comportamento padrão.
              </p>
            </div>
          </CardContent>
        </Card>

        {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>}

        <div className="space-y-4">
          {prompts.map((p) => <PromptCard key={p.key} prompt={p} />)}
        </div>
      </div>
    </MainLayout>
  );
}
