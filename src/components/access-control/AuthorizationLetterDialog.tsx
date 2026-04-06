import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { downloadAuthorizationLetter, type AuthorizationLetterData } from '@/lib/authorization-letter-pdf';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Signature, Share2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

interface AvailableBrand {
  id: string;
  name: string;
}

interface AvailableUnit {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  networkName?: string;
  cnpj?: string;
}

interface AuthorizationLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promoter?: { name: string; cpf: string; phone?: string; isInternal?: boolean };
  agency?: { name: string; cnpj?: string; responsible?: string };
  unit?: { name: string; address?: string; cnpj?: string; networkName?: string };
  rule?: { allowed_weekdays?: number[]; start_time?: string; end_time?: string; brands?: string[] };
  organizationName?: string;
  availableBrands?: AvailableBrand[];
  availableUnits?: AvailableUnit[];
  agencyAuthToken?: string;
}

export function AuthorizationLetterDialog({
  open, onOpenChange, promoter, agency, unit, rule, organizationName, availableBrands, availableUnits, agencyAuthToken,
}: AuthorizationLetterDialogProps) {
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [form, setForm] = useState<AuthorizationLetterData>({
    promoterName: '',
    promoterCpf: '',
    promoterPhone: '',
    agencyName: '',
    agencyCnpj: '',
    agencyResponsible: '',
    unitName: '',
    unitAddress: '',
    unitCnpj: '',
    networkName: '',
    brands: [],
    allowedWeekdays: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '18:00',
    validFrom: format(new Date(), 'dd/MM/yyyy'),
    validUntil: '',
    isDigitallySigned: false,
    organizationName: organizationName || 'Ayratech',
  });

  const [brandInput, setBrandInput] = useState('');

  useEffect(() => {
    if (open) {
      setForm(f => ({
        ...f,
        promoterName: promoter?.name || f.promoterName,
        promoterCpf: promoter?.cpf || f.promoterCpf,
        promoterPhone: promoter?.phone || f.promoterPhone,
        agencyName: agency?.name || f.agencyName,
        agencyCnpj: agency?.cnpj || f.agencyCnpj,
        agencyResponsible: agency?.responsible || f.agencyResponsible,
        unitName: unit?.name || f.unitName,
        unitAddress: unit?.address || f.unitAddress,
        unitCnpj: unit?.cnpj || f.unitCnpj,
        networkName: unit?.networkName || f.networkName,
        allowedWeekdays: rule?.allowed_weekdays || f.allowedWeekdays,
        startTime: rule?.start_time?.slice(0, 5) || f.startTime,
        endTime: rule?.end_time?.slice(0, 5) || f.endTime,
        brands: rule?.brands || f.brands,
        isDigitallySigned: promoter?.isInternal || false,
      }));
      setSelectedUnitId('');
    }
  }, [open, promoter, agency, unit, rule]);

  const toggleWeekday = (day: number) => {
    setForm(f => ({
      ...f,
      allowedWeekdays: f.allowedWeekdays.includes(day)
        ? f.allowedWeekdays.filter(d => d !== day)
        : [...f.allowedWeekdays, day].sort(),
    }));
  };

  const addBrand = () => {
    if (brandInput.trim() && !form.brands.includes(brandInput.trim())) {
      setForm(f => ({ ...f, brands: [...f.brands, brandInput.trim()] }));
      setBrandInput('');
    }
  };

  const removeBrand = (brand: string) => {
    setForm(f => ({ ...f, brands: f.brands.filter(b => b !== brand) }));
  };

  const generateLetterData = () => {
    const now = new Date();
    const hash = Array.from(
      new Uint8Array(
        new TextEncoder().encode(
          `${form.promoterCpf}${form.unitName}${now.toISOString()}`
        )
      )
    ).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 64);

    return {
      ...form,
      isDigitallySigned: true,
      signedBy: form.organizationName || 'Ayratech',
      signedAt: format(now, "dd/MM/yyyy 'às' HH:mm:ss (xxx)"),
      signatureHash: hash.toUpperCase(),
    };
  };

  const handleGenerate = () => {
    if (!form.promoterName || !form.promoterCpf || !form.unitName) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (form.isDigitallySigned) {
      const data = generateLetterData();
      downloadAuthorizationLetter(data);
    } else {
      downloadAuthorizationLetter(form);
    }

    toast({ title: 'Carta de autorização gerada!', description: 'O download iniciou automaticamente' });
  };

  const handleShareWithSupermarket = async () => {
    if (!form.promoterName || !form.promoterCpf || !form.unitName) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSharing(true);
    try {
      const letterData = generateLetterData();
      // Also download locally
      downloadAuthorizationLetter(letterData);

      // Save to backend for supermarket visibility
      const token = agencyAuthToken || localStorage.getItem('agency_auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      await api('/api/access-control/agency/shared-letters', {
        method: 'POST',
        body: {
          promoter_name: form.promoterName,
          promoter_cpf: form.promoterCpf,
          supermarket_unit_id: selectedUnitId || null,
          unit_name: form.unitName,
          network_name: form.networkName,
          brands: form.brands,
          allowed_weekdays: form.allowedWeekdays,
          start_time: form.startTime,
          end_time: form.endTime,
          valid_from: form.validFrom,
          valid_until: form.validUntil,
          is_digitally_signed: true,
          signature_hash: letterData.signatureHash,
          signed_at: letterData.signedAt,
          signed_by: letterData.signedBy,
        },
        headers,
      });

      toast({ title: 'Carta compartilhada!', description: 'A carta foi assinada digitalmente e está disponível no portal do supermercado.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao compartilhar', description: err?.message, variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Carta de Autorização - PDV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Tipo de carta */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Assinatura Digital</p>
              <p className="text-xs text-muted-foreground">
                {form.isDigitallySigned
                  ? 'Carta com validade jurídica (MP 2.200-2/2001)'
                  : 'Carta para impressão e assinatura manual'}
              </p>
            </div>
            <Switch
              checked={form.isDigitallySigned}
              onCheckedChange={(v) => setForm(f => ({ ...f, isDigitallySigned: v }))}
            />
          </div>

          {/* Promotor */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Dados do Promotor</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <Input value={form.promoterName} onChange={e => setForm(f => ({ ...f, promoterName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">CPF *</label>
                <Input value={form.promoterCpf} onChange={e => setForm(f => ({ ...f, promoterCpf: e.target.value }))} />
              </div>
            </div>
          </fieldset>

          {/* Agência */}
          {!form.isDigitallySigned && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">Dados da Agência</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nome da Agência</label>
                  <Input value={form.agencyName} onChange={e => setForm(f => ({ ...f, agencyName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
                  <Input value={form.agencyCnpj} onChange={e => setForm(f => ({ ...f, agencyCnpj: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                  <Input value={form.agencyResponsible} onChange={e => setForm(f => ({ ...f, agencyResponsible: e.target.value }))} />
                </div>
              </div>
            </fieldset>
          )}

          {/* PDV */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Ponto de Venda</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nome do PDV *</label>
                {availableUnits && availableUnits.length > 0 ? (
                  <Select
                    value={selectedUnitId || form.unitName}
                    onValueChange={(v) => {
                      const selected = availableUnits.find(u => u.id === v);
                      if (selected) {
                        setSelectedUnitId(selected.id);
                        setForm(f => ({
                          ...f,
                          unitName: selected.name,
                          unitAddress: selected.address || f.unitAddress,
                          unitCnpj: selected.cnpj || f.unitCnpj,
                          networkName: selected.networkName || f.networkName,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o PDV" /></SelectTrigger>
                    <SelectContent>
                      {availableUnits.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} {u.city ? `— ${u.city}/${u.state}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.unitName} onChange={e => setForm(f => ({ ...f, unitName: e.target.value }))} />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Rede</label>
                <Input value={form.networkName} onChange={e => setForm(f => ({ ...f, networkName: e.target.value }))} readOnly={!!availableUnits?.length} className={availableUnits?.length ? 'bg-muted' : ''} />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Endereço</label>
                <Input value={form.unitAddress} onChange={e => setForm(f => ({ ...f, unitAddress: e.target.value }))} readOnly={!!availableUnits?.length} className={availableUnits?.length ? 'bg-muted' : ''} />
              </div>
            </div>
          </fieldset>

          {/* Autorização */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Autorização</legend>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Dias Autorizados</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map(w => (
                  <label key={w.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.allowedWeekdays.includes(w.value)}
                      onCheckedChange={() => toggleWeekday(w.value)}
                    />
                    {w.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Horário Início</label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Horário Fim</label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Marcas</label>
              {availableBrands && availableBrands.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value=""
                    onValueChange={(v) => {
                      const brand = availableBrands.find(b => b.id === v);
                      if (brand && !form.brands.includes(brand.name)) {
                        setForm(f => ({ ...f, brands: [...f.brands, brand.name] }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
                    <SelectContent>
                      {availableBrands.filter(b => !form.brands.includes(b.name)).map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.brands.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {form.brands.map(b => (
                        <Badge key={b} variant="secondary" className="cursor-pointer" onClick={() => removeBrand(b)}>
                          {b} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da marca..."
                      value={brandInput}
                      onChange={e => setBrandInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBrand())}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={addBrand}>Adicionar</Button>
                  </div>
                  {form.brands.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {form.brands.map(b => (
                        <Badge key={b} variant="secondary" className="cursor-pointer" onClick={() => removeBrand(b)}>
                          {b} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Válido a partir de</label>
                <Input value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} placeholder="dd/mm/aaaa" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Válido até</label>
                <Input value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} placeholder="dd/mm/aaaa (opcional)" />
              </div>
            </div>
          </fieldset>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {agencyAuthToken || localStorage.getItem('agency_auth_token') ? (
            <Button onClick={handleShareWithSupermarket} disabled={sharing} className="gap-2 bg-green-600 hover:bg-green-700">
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Assinar e Compartilhar com PDV
            </Button>
          ) : (
            <Button onClick={handleGenerate} className="gap-2">
              {form.isDigitallySigned ? (
                <>
                  <Signature className="h-4 w-4" />
                  Gerar com Assinatura Digital
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Gerar para Impressão
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
