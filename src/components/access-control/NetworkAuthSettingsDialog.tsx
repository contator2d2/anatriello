import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, QrCode, Camera, ScanFace, Lock, Loader2, AlertTriangle } from "lucide-react";
import { useNetworkAuthSettings, useUpdateNetworkAuthSettings } from "@/hooks/use-access-control";
import HelpPanel from "./HelpPanel";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  networkId: string;
  networkName: string;
}

const SECURITY_PRESETS = {
  basic: { label: "Básico", desc: "Apenas CPF", cpf: true, qr: false, selfieIn: false, selfieOut: false, facial: false, combined: "cpf_only" },
  intermediate: { label: "Intermediário", desc: "QR + Selfie na entrada", cpf: true, qr: true, selfieIn: true, selfieOut: false, facial: false, combined: "qr_selfie" },
  high: { label: "Alto", desc: "QR + Selfie entrada e saída", cpf: true, qr: true, selfieIn: true, selfieOut: true, facial: false, combined: "qr_selfie" },
  maximum: { label: "Máximo", desc: "QR + Reconhecimento facial completo", cpf: true, qr: true, selfieIn: true, selfieOut: true, facial: true, combined: "qr_facial" },
};

const COMBINED_OPTIONS = [
  { value: "cpf_only", label: "Apenas CPF" },
  { value: "cpf_selfie", label: "CPF + Selfie" },
  { value: "qr_only", label: "Apenas QR Code" },
  { value: "qr_selfie", label: "QR + Selfie" },
  { value: "qr_facial", label: "QR + Reconhecimento Facial" },
  { value: "cpf_selfie_facial", label: "CPF + Selfie + Facial" },
];

export const NetworkAuthSettingsDialog = ({ open, onOpenChange, networkId, networkName }: Props) => {
  const { data: settings, isLoading } = useNetworkAuthSettings(networkId);
  const updateMutation = useUpdateNetworkAuthSettings();
  const { toast } = useToast();

  const [form, setForm] = useState({
    cpf_entry_enabled: true,
    qr_entry_enabled: false,
    selfie_entry_required: false,
    selfie_exit_required: false,
    facial_recognition_enabled: false,
    combined_validation: "cpf_only",
    security_level: "basic",
    facial_min_confidence: 70,
    allow_low_confidence_entry: false,
    low_confidence_action: "alert",
    qr_expiration_minutes: 60,
    qr_single_use: true,
    require_lgpd_consent: true,
    consent_text: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        cpf_entry_enabled: settings.cpf_entry_enabled ?? true,
        qr_entry_enabled: settings.qr_entry_enabled ?? false,
        selfie_entry_required: settings.selfie_entry_required ?? false,
        selfie_exit_required: settings.selfie_exit_required ?? false,
        facial_recognition_enabled: settings.facial_recognition_enabled ?? false,
        combined_validation: settings.combined_validation || "cpf_only",
        security_level: settings.security_level || "basic",
        facial_min_confidence: settings.facial_min_confidence ?? 70,
        allow_low_confidence_entry: settings.allow_low_confidence_entry ?? false,
        low_confidence_action: settings.low_confidence_action || "alert",
        qr_expiration_minutes: settings.qr_expiration_minutes ?? 60,
        qr_single_use: settings.qr_single_use ?? true,
        require_lgpd_consent: settings.require_lgpd_consent ?? true,
        consent_text: settings.consent_text || "",
      });
    }
  }, [settings]);

  const applyPreset = (level: string) => {
    const preset = SECURITY_PRESETS[level as keyof typeof SECURITY_PRESETS];
    if (!preset) return;
    setForm(f => ({
      ...f,
      security_level: level,
      cpf_entry_enabled: preset.cpf,
      qr_entry_enabled: preset.qr,
      selfie_entry_required: preset.selfieIn,
      selfie_exit_required: preset.selfieOut,
      facial_recognition_enabled: preset.facial,
      combined_validation: preset.combined,
    }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ networkId, ...form });
      toast({ title: "Configurações de autenticação salvas" });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Regras de Autenticação — {networkName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            <HelpPanel
              title="Como funciona a autenticação modular?"
              sections={[
                {
                  title: "O que é?",
                  icon: "info",
                  content: [
                    "A Rede define quais métodos de segurança os promotores devem usar para entrar e sair dos PDVs.",
                    "Todas as Unidades (PDVs) vinculadas a esta Rede herdam automaticamente estas configurações.",
                    "O Totem se adapta ao fluxo: exibe apenas as etapas que estão ativas aqui.",
                  ],
                },
                {
                  title: "Níveis de Segurança (Presets)",
                  icon: "check",
                  content: [
                    "Básico — Apenas digitação de CPF no teclado virtual do Totem.",
                    "Intermediário — QR Code dinâmico + selfie obrigatória na entrada.",
                    "Alto — QR Code + selfie na entrada E na saída (compara as duas fotos).",
                    "Máximo — QR Code + reconhecimento facial comparando selfie com foto cadastrada.",
                  ],
                },
                {
                  title: "Requisitos de Foto para Reconhecimento Facial",
                  icon: "alert",
                  content: [
                    "A foto do promotor deve ser frontal, bem iluminada, sem óculos escuros, bonés ou máscaras.",
                    "Resolução mínima recomendada: 480×480px, formato JPEG ou PNG.",
                    "Agências e RH são notificados se a foto não atende aos requisitos (status 'não conforme').",
                    "Promotores internos usam a foto do cadastro no RH; externos usam a foto do portal da agência.",
                  ],
                },
                {
                  title: "QR Code Dinâmico",
                  icon: "info",
                  content: [
                    "QR gerado pelo sistema com validade configurável (ex: 60 min) e uso único.",
                    "Vinculado ao promotor, PDV, data e horário — não pode ser reutilizado.",
                    "Pode ser enviado via link, WhatsApp ou portal da agência (sem necessidade de app).",
                  ],
                },
                {
                  title: "Impacto nas Agências e Promotores",
                  icon: "alert",
                  content: [
                    "Ao ativar selfie ou facial, o sistema verifica se cada promotor tem foto em conformidade.",
                    "Promotores sem foto adequada ficam com status 'não conforme' e não conseguem fazer check-in.",
                    "A agência recebe notificação automática para atualizar a foto do promotor.",
                    "Promotores internos (CLT) seguem as mesmas regras — a foto é a do cadastro no RH.",
                  ],
                },
              ]}
            />

            {/* Security Level Presets */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Nível de Segurança (Preset)</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SECURITY_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.security_level === key
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.label}</div>
                    <div className="text-xs text-muted-foreground">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Entry Methods */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Métodos de Entrada</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Entrada por CPF</p>
                      <p className="text-xs text-muted-foreground">Digitação no teclado numérico</p>
                    </div>
                  </div>
                  <Switch checked={form.cpf_entry_enabled} onCheckedChange={v => setForm(f => ({ ...f, cpf_entry_enabled: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Entrada por QR Code</p>
                      <p className="text-xs text-muted-foreground">QR dinâmico gerado pelo sistema</p>
                    </div>
                  </div>
                  <Switch checked={form.qr_entry_enabled} onCheckedChange={v => setForm(f => ({ ...f, qr_entry_enabled: v }))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Selfie & Facial */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Validação Biométrica</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Selfie na entrada</p>
                      <p className="text-xs text-muted-foreground">Captura obrigatória para check-in</p>
                    </div>
                  </div>
                  <Switch checked={form.selfie_entry_required} onCheckedChange={v => setForm(f => ({ ...f, selfie_entry_required: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Selfie na saída</p>
                      <p className="text-xs text-muted-foreground">Captura para check-out com comparação</p>
                    </div>
                  </div>
                  <Switch checked={form.selfie_exit_required} onCheckedChange={v => setForm(f => ({ ...f, selfie_exit_required: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScanFace className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Reconhecimento facial</p>
                      <p className="text-xs text-muted-foreground">Compara selfie com foto cadastrada</p>
                    </div>
                  </div>
                  <Switch checked={form.facial_recognition_enabled} onCheckedChange={v => setForm(f => ({ ...f, facial_recognition_enabled: v }))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Combined Validation */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Validação Combinada</Label>
              <Select value={form.combined_validation} onValueChange={v => setForm(f => ({ ...f, combined_validation: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMBINED_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* QR Settings */}
            {form.qr_entry_enabled && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Configurações do QR Code</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Validade (minutos)</Label>
                      <Input type="number" value={form.qr_expiration_minutes}
                        onChange={e => setForm(f => ({ ...f, qr_expiration_minutes: parseInt(e.target.value) || 60 }))} />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={form.qr_single_use} onCheckedChange={v => setForm(f => ({ ...f, qr_single_use: v }))} />
                      <Label className="text-sm">Uso único</Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Facial Tolerance */}
            {form.facial_recognition_enabled && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Tolerância Facial</Label>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Confiança mínima (%)</Label>
                      <Input type="number" min={0} max={100} value={form.facial_min_confidence}
                        onChange={e => setForm(f => ({ ...f, facial_min_confidence: parseFloat(e.target.value) || 70 }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Permitir entrada com baixa confiança</p>
                        <p className="text-xs text-muted-foreground">Gera alerta mas não bloqueia</p>
                      </div>
                      <Switch checked={form.allow_low_confidence_entry}
                        onCheckedChange={v => setForm(f => ({ ...f, allow_low_confidence_entry: v }))} />
                    </div>
                    {form.allow_low_confidence_entry && (
                      <div>
                        <Label className="text-xs">Ação com baixa confiança</Label>
                        <Select value={form.low_confidence_action} onValueChange={v => setForm(f => ({ ...f, low_confidence_action: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alert">Gerar alerta</SelectItem>
                            <SelectItem value="block">Bloquear entrada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* LGPD */}
            <div>
              <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> LGPD e Consentimento
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Exigir consentimento LGPD</p>
                  <Switch checked={form.require_lgpd_consent}
                    onCheckedChange={v => setForm(f => ({ ...f, require_lgpd_consent: v }))} />
                </div>
                {form.require_lgpd_consent && (
                  <div>
                    <Label className="text-xs">Texto de consentimento</Label>
                    <Textarea value={form.consent_text} rows={3}
                      onChange={e => setForm(f => ({ ...f, consent_text: e.target.value }))}
                      placeholder="Texto de consentimento para exibir no totem..." />
                  </div>
                )}
              </div>
            </div>

            {/* Active methods summary */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">MÉTODOS ATIVOS</p>
                <div className="flex flex-wrap gap-1">
                  {form.cpf_entry_enabled && <Badge variant="outline">CPF</Badge>}
                  {form.qr_entry_enabled && <Badge variant="outline">QR Code</Badge>}
                  {form.selfie_entry_required && <Badge variant="outline">Selfie Entrada</Badge>}
                  {form.selfie_exit_required && <Badge variant="outline">Selfie Saída</Badge>}
                  {form.facial_recognition_enabled && <Badge variant="outline">Reconhecimento Facial</Badge>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
