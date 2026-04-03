import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanFace, Save, Loader2, Info, ShieldCheck, Camera, Fingerprint, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import HelpPanel from "@/components/access-control/HelpPanel";

interface FacialConfig {
  enabled: boolean;
  use_for_attendance: boolean;
  use_for_checkin: boolean;
  min_confidence: number;
  require_photo_registration: boolean;
  auto_verify_on_clock_in: boolean;
  allow_manual_fallback: boolean;
  photo_quality_check: boolean;
}

const DEFAULT_CONFIG: FacialConfig = {
  enabled: false,
  use_for_attendance: false,
  use_for_checkin: false,
  min_confidence: 70,
  require_photo_registration: true,
  auto_verify_on_clock_in: false,
  allow_manual_fallback: true,
  photo_quality_check: true,
};

export const FacialRecognitionConfigPanel = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["rh-facial-config"],
    queryFn: async () => {
      try {
        return await api<FacialConfig>("/api/rh/facial-recognition/config");
      } catch {
        return DEFAULT_CONFIG;
      }
    },
  });

  const [form, setForm] = useState<FacialConfig | null>(null);
  const currentConfig = form || config || DEFAULT_CONFIG;

  const saveMutation = useMutation({
    mutationFn: (data: FacialConfig) => api("/api/rh/facial-recognition/config", { method: "PUT", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh-facial-config"] });
      toast({ title: "Configuração salva com sucesso" });
      setForm(null);
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const update = (key: keyof FacialConfig, value: any) => {
    setForm(prev => ({ ...(prev || currentConfig), [key]: value }));
  };

  const handleSave = () => saveMutation.mutate(form || currentConfig);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HelpPanel
        title="Como funciona o Reconhecimento Facial?"
        sections={[
          {
            title: "Tecnologia utilizada",
            icon: "info",
            content: [
              "O sistema utiliza detecção de landmarks faciais (68 pontos do rosto) para gerar um vetor geométrico único por pessoa.",
              "Todo o processamento é feito localmente no navegador — nenhuma imagem é enviada para serviços externos de IA.",
              "A comparação é feita por distância euclidiana entre vetores, gerando um score de similaridade de 0-100%.",
            ],
          },
          {
            title: "Como cadastrar",
            icon: "check",
            content: [
              "Na ficha do colaborador, acesse a seção 'Biometria Facial' e capture a foto base.",
              "A foto deve ser frontal, bem iluminada, sem óculos escuros ou acessórios que cubram o rosto.",
              "O sistema extrairá automaticamente os 68 pontos de referência e o vetor de 128 dimensões.",
            ],
          },
          {
            title: "Uso no ponto e check-in",
            icon: "check",
            content: [
              "Quando ativado, o registro de ponto exigirá verificação facial antes de confirmar a marcação.",
              "O colaborador posiciona o rosto na câmera e o sistema compara com o vetor cadastrado.",
              "Se o fallback manual estiver ativo, o colaborador pode usar CPF/senha caso a câmera não esteja disponível.",
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5" /> Reconhecimento Facial — RH
          </CardTitle>
          <CardDescription>
            Configure o uso de verificação facial por landmarks para colaboradores internos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Módulo de Reconhecimento Facial</Label>
              <p className="text-sm text-muted-foreground">Ativa o sistema de biometria facial para colaboradores internos</p>
            </div>
            <Switch
              checked={currentConfig.enabled}
              onCheckedChange={v => update("enabled", v)}
            />
          </div>

          {currentConfig.enabled && (
            <>
              <Separator />

              {/* Use cases */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" /> Onde utilizar
                </h4>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>Registro de Ponto</Label>
                        <p className="text-xs text-muted-foreground">Exigir verificação facial ao bater ponto</p>
                      </div>
                    </div>
                    <Switch
                      checked={currentConfig.use_for_attendance}
                      onCheckedChange={v => update("use_for_attendance", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label>Check-in em PDV</Label>
                        <p className="text-xs text-muted-foreground">Verificação facial no check-in de rota (promotor interno)</p>
                      </div>
                    </div>
                    <Switch
                      checked={currentConfig.use_for_checkin}
                      onCheckedChange={v => update("use_for_checkin", v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Confidence threshold */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4" /> Nível de confiança
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Confiança mínima para aprovação</span>
                    <Badge variant="outline">{currentConfig.min_confidence}%</Badge>
                  </div>
                  <Slider
                    value={[currentConfig.min_confidence]}
                    onValueChange={([v]) => update("min_confidence", v)}
                    min={50}
                    max={95}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Mais tolerante (50%)</span>
                    <span>Mais rigoroso (95%)</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Opções
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Exigir cadastro de foto</Label>
                      <p className="text-xs text-muted-foreground">Colaboradores sem foto cadastrada não poderão usar o recurso</p>
                    </div>
                    <Switch
                      checked={currentConfig.require_photo_registration}
                      onCheckedChange={v => update("require_photo_registration", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Verificação automática</Label>
                      <p className="text-xs text-muted-foreground">Iniciar verificação automaticamente ao abrir o ponto</p>
                    </div>
                    <Switch
                      checked={currentConfig.auto_verify_on_clock_in}
                      onCheckedChange={v => update("auto_verify_on_clock_in", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Permitir fallback manual</Label>
                      <p className="text-xs text-muted-foreground">Se a câmera não estiver disponível, permitir login por CPF/senha</p>
                    </div>
                    <Switch
                      checked={currentConfig.allow_manual_fallback}
                      onCheckedChange={v => update("allow_manual_fallback", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Verificação de qualidade da foto</Label>
                      <p className="text-xs text-muted-foreground">Validar iluminação, enquadramento e nitidez ao cadastrar</p>
                    </div>
                    <Switch
                      checked={currentConfig.photo_quality_check}
                      onCheckedChange={v => update("photo_quality_check", v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <Button onClick={handleSave} disabled={saveMutation.isPending || !form} className="gap-2 w-full">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configuração
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
