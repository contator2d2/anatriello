import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, QrCode, Camera, ScanFace, Lock, Loader2, AlertTriangle, Info } from "lucide-react";
import { usePdvAuthOverride, useUpdatePdvAuthOverride, useNetworkAuthSettings } from "@/hooks/use-access-control";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unitId: string;
  unitName: string;
  networkId?: string;
  networkName?: string;
}

const COMBINED_OPTIONS = [
  { value: "cpf_only", label: "Apenas CPF" },
  { value: "cpf_selfie", label: "CPF + Selfie" },
  { value: "qr_only", label: "Apenas QR Code" },
  { value: "qr_selfie", label: "QR + Selfie" },
  { value: "qr_facial", label: "QR + Reconhecimento Facial" },
  { value: "cpf_selfie_facial", label: "CPF + Selfie + Facial" },
];

const PRESETS = {
  basic: { label: "Básico", cpf: true, qr: false, selfieIn: false, selfieOut: false, facial: false, combined: "cpf_only" },
  intermediate: { label: "Intermediário", cpf: true, qr: true, selfieIn: true, selfieOut: false, facial: false, combined: "qr_selfie" },
  high: { label: "Alto", cpf: true, qr: true, selfieIn: true, selfieOut: true, facial: false, combined: "qr_selfie" },
  maximum: { label: "Máximo", cpf: true, qr: true, selfieIn: true, selfieOut: true, facial: true, combined: "qr_facial" },
};

export const PdvAuthOverrideDialog = ({ open, onOpenChange, unitId, unitName, networkId, networkName }: Props) => {
  const { data: override, isLoading: loadingOverride } = usePdvAuthOverride(open ? unitId : undefined);
  const { data: networkSettings } = useNetworkAuthSettings(open ? networkId : undefined);
  const updateMutation = useUpdatePdvAuthOverride();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
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
  });

  useEffect(() => {
    if (override) {
      setEnabled(true);
      setForm({
        cpf_entry_enabled: override.cpf_entry_enabled ?? true,
        qr_entry_enabled: override.qr_entry_enabled ?? false,
        selfie_entry_required: override.selfie_entry_required ?? false,
        selfie_exit_required: override.selfie_exit_required ?? false,
        facial_recognition_enabled: override.facial_recognition_enabled ?? false,
        combined_validation: override.combined_validation || "cpf_only",
        security_level: override.security_level || "basic",
        facial_min_confidence: override.facial_min_confidence ?? 70,
        allow_low_confidence_entry: override.allow_low_confidence_entry ?? false,
      });
    } else {
      setEnabled(false);
      // Pre-fill from network settings
      if (networkSettings) {
        setForm({
          cpf_entry_enabled: networkSettings.cpf_entry_enabled ?? true,
          qr_entry_enabled: networkSettings.qr_entry_enabled ?? false,
          selfie_entry_required: networkSettings.selfie_entry_required ?? false,
          selfie_exit_required: networkSettings.selfie_exit_required ?? false,
          facial_recognition_enabled: networkSettings.facial_recognition_enabled ?? false,
          combined_validation: networkSettings.combined_validation || "cpf_only",
          security_level: networkSettings.security_level || "basic",
          facial_min_confidence: networkSettings.facial_min_confidence ?? 70,
          allow_low_confidence_entry: networkSettings.allow_low_confidence_entry ?? false,
        });
      }
    }
  }, [override, networkSettings]);

  const applyPreset = (level: string) => {
    const preset = PRESETS[level as keyof typeof PRESETS];
    if (!preset) return;
    setForm(f => ({
      ...f, security_level: level,
      cpf_entry_enabled: preset.cpf, qr_entry_enabled: preset.qr,
      selfie_entry_required: preset.selfieIn, selfie_exit_required: preset.selfieOut,
      facial_recognition_enabled: preset.facial, combined_validation: preset.combined,
    }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ unitId, ...form });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const isLoading = loadingOverride;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Override de Autenticação — {unitName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            {/* Network info */}
            {networkName && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground">
                      <p>Esta unidade pertence à rede <strong className="text-foreground">{networkName}</strong>.</p>
                      <p>Por padrão, herda as regras da rede (nível: <Badge variant="outline" className="text-xs">{networkSettings?.security_level || "básico"}</Badge>).</p>
                      <p>Ative o override para definir regras específicas para este PDV.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!networkId && (
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Esta unidade não está vinculada a nenhuma rede. As configurações abaixo serão aplicadas diretamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enable override toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Override ativo</p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Este PDV usa regras próprias, ignorando a rede." : "Usando regras herdadas da rede."}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <>
                {/* Presets */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Nível de Segurança</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PRESETS).map(([key, preset]) => (
                      <button key={key} onClick={() => applyPreset(key)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          form.security_level === key ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                        }`}>
                        <div className="font-medium text-sm">{preset.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Methods */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold block">Métodos de Entrada</Label>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">Entrada por CPF</p>
                    </div>
                    <Switch checked={form.cpf_entry_enabled} onCheckedChange={v => setForm(f => ({ ...f, cpf_entry_enabled: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">Entrada por QR Code</p>
                    </div>
                    <Switch checked={form.qr_entry_enabled} onCheckedChange={v => setForm(f => ({ ...f, qr_entry_enabled: v }))} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-semibold block">Validação Biométrica</Label>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">Selfie na entrada</p>
                    </div>
                    <Switch checked={form.selfie_entry_required} onCheckedChange={v => setForm(f => ({ ...f, selfie_entry_required: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">Selfie na saída</p>
                    </div>
                    <Switch checked={form.selfie_exit_required} onCheckedChange={v => setForm(f => ({ ...f, selfie_exit_required: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScanFace className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">Reconhecimento facial</p>
                    </div>
                    <Switch checked={form.facial_recognition_enabled} onCheckedChange={v => setForm(f => ({ ...f, facial_recognition_enabled: v }))} />
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-semibold mb-2 block">Validação Combinada</Label>
                  <Select value={form.combined_validation} onValueChange={v => setForm(f => ({ ...f, combined_validation: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMBINED_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {form.facial_recognition_enabled && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold block">Tolerância Facial</Label>
                      <div>
                        <Label className="text-xs">Confiança mínima (%)</Label>
                        <Input type="number" min={0} max={100} value={form.facial_min_confidence}
                          onChange={e => setForm(f => ({ ...f, facial_min_confidence: parseFloat(e.target.value) || 70 }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">Permitir com baixa confiança</p>
                        <Switch checked={form.allow_low_confidence_entry}
                          onCheckedChange={v => setForm(f => ({ ...f, allow_low_confidence_entry: v }))} />
                      </div>
                    </div>
                  </>
                )}

                {/* Summary */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">MÉTODOS ATIVOS NESTE PDV</p>
                    <div className="flex flex-wrap gap-1">
                      {form.cpf_entry_enabled && <Badge variant="outline">CPF</Badge>}
                      {form.qr_entry_enabled && <Badge variant="outline">QR Code</Badge>}
                      {form.selfie_entry_required && <Badge variant="outline">Selfie Entrada</Badge>}
                      {form.selfie_exit_required && <Badge variant="outline">Selfie Saída</Badge>}
                      {form.facial_recognition_enabled && <Badge variant="outline">Reconhecimento Facial</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
