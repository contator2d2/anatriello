import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSupermarketAuth } from '@/contexts/SupermarketAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Settings, Palette, Lock, Key, Copy, RefreshCw, Loader2, Eye, EyeOff, Store, Monitor } from 'lucide-react';

const getHeaders = () => {
  const t = localStorage.getItem('supermarket_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

export default function SupermarketSettings() {
  const { user } = useSupermarketAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = getHeaders();

  // Password form
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // Token visibility
  const [showToken, setShowToken] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['sm-settings'],
    queryFn: () => api<any>('/api/access-control/supermarket-portal/settings', { headers }),
    enabled: !!user,
  });

  // Customization form
  const [customForm, setCustomForm] = useState<any>(null);

  // Initialize form when settings load
  if (settings && !customForm) {
    setCustomForm({
      logo_url: settings.logo_url || '',
      totem_primary_color: settings.totem_primary_color || '#3b82f6',
      totem_secondary_color: settings.totem_secondary_color || '#1e293b',
      totem_bg_color: settings.totem_bg_color || '#0f172a',
      totem_button_color: settings.totem_button_color || '#3b82f6',
      totem_button_text_color: settings.totem_button_text_color || '#ffffff',
      totem_header_text: settings.totem_header_text || 'Controle de Acesso',
    });
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) => api('/api/access-control/supermarket-portal/settings', { method: 'PUT', body: data, headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sm-settings'] });
      toast({ title: 'Configurações salvas!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const changePwMutation = useMutation({
    mutationFn: (data: any) => api('/api/access-control/supermarket-portal/change-password', { method: 'PUT', body: data, headers }),
    onSuccess: () => {
      toast({ title: 'Senha alterada com sucesso!' });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const regenTokenMutation = useMutation({
    mutationFn: () => api<{ totem_token: string }>('/api/access-control/supermarket-portal/regenerate-token', { method: 'POST', headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sm-settings'] });
      toast({ title: 'Token do Totem regenerado!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const handleSaveCustom = () => {
    if (!customForm) return;
    saveMutation.mutate(customForm);
  };

  const handleChangePw = () => {
    if (!pwForm.current_password || !pwForm.new_password) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast({ title: 'A nova senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    changePwMutation.mutate({ current_password: pwForm.current_password, new_password: pwForm.new_password });
  };

  const copyToken = () => {
    if (settings?.totem_token) {
      navigator.clipboard.writeText(settings.totem_token);
      toast({ title: 'Token copiado!' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" /> Configurações
        </h1>
        <p className="text-muted-foreground">{settings?.name} — {settings?.network_name || ''}</p>
      </div>

      {/* Token do Totem */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-primary" /> Token do Totem
          </CardTitle>
          <CardDescription>
            Este token é utilizado para validar e autenticar o totem de controle de acesso neste PDV
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={settings?.totem_enabled ? 'default' : 'secondary'}>
              {settings?.totem_enabled ? 'Totem Ativo' : 'Totem Inativo'}
            </Badge>
          </div>
          {settings?.totem_token && (
            <div className="space-y-2">
              <Label>Token de Liberação</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={showToken ? settings.totem_token : '••••••••••••••••••••••••••••••••'}
                  className="font-mono text-sm"
                />
                <Button size="icon" variant="outline" onClick={() => setShowToken(!showToken)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={copyToken}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <Button variant="outline" onClick={() => regenTokenMutation.mutate()} disabled={regenTokenMutation.isPending}
            className="gap-2">
            {regenTokenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerar Token
          </Button>
          <p className="text-xs text-muted-foreground">
            ⚠️ Ao regenerar o token, o totem atual precisará ser reconectado com o novo token.
          </p>
        </CardContent>
      </Card>

      {/* Personalização Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5 text-primary" /> Personalização do Totem
          </CardTitle>
          <CardDescription>Configure as cores, logo e textos do totem de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customForm && (
            <>
              <div className="space-y-2">
                <Label>URL do Logo</Label>
                <Input value={customForm.logo_url} onChange={e => setCustomForm({ ...customForm, logo_url: e.target.value })}
                  placeholder="https://exemplo.com/logo.png" />
              </div>
              <div className="space-y-2">
                <Label>Texto do Cabeçalho</Label>
                <Input value={customForm.totem_header_text} onChange={e => setCustomForm({ ...customForm, totem_header_text: e.target.value })}
                  placeholder="Controle de Acesso" />
              </div>

              <Separator />
              <p className="text-sm font-medium text-foreground">Cores</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'totem_primary_color', label: 'Cor Primária' },
                  { key: 'totem_secondary_color', label: 'Cor Secundária' },
                  { key: 'totem_bg_color', label: 'Fundo' },
                  { key: 'totem_button_color', label: 'Botão' },
                  { key: 'totem_button_text_color', label: 'Texto Botão' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={customForm[key] || '#3b82f6'}
                        onChange={e => setCustomForm({ ...customForm, [key]: e.target.value })}
                        className="w-10 h-10 rounded border border-border cursor-pointer" />
                      <Input value={customForm[key] || ''} onChange={e => setCustomForm({ ...customForm, [key]: e.target.value })}
                        className="text-xs font-mono" placeholder="#000000" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview mini */}
              <Separator />
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Monitor className="h-4 w-4" /> Pré-visualização
              </p>
              <div className="rounded-xl p-6 text-center space-y-3"
                style={{ backgroundColor: customForm.totem_bg_color, color: customForm.totem_button_text_color }}>
                {customForm.logo_url && (
                  <img src={customForm.logo_url} alt="Logo" className="h-12 mx-auto object-contain" />
                )}
                <p className="text-lg font-bold" style={{ color: customForm.totem_primary_color }}>
                  {customForm.totem_header_text || 'Controle de Acesso'}
                </p>
                <div className="flex justify-center gap-2">
                  <div className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: customForm.totem_button_color, color: customForm.totem_button_text_color }}>
                    CPF
                  </div>
                  <div className="px-4 py-2 rounded-lg text-sm font-medium border"
                    style={{ borderColor: customForm.totem_primary_color, color: customForm.totem_primary_color }}>
                    QR Code
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveCustom} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Personalização
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" /> Alterar Senha
          </CardTitle>
          <CardDescription>Altere a senha de acesso ao portal do supermercado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>Senha Atual</Label>
            <div className="relative">
              <Input type={showPw.current ? 'text' : 'password'} value={pwForm.current_password}
                onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="••••••••" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>
                {showPw.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <div className="relative">
              <Input type={showPw.new ? 'text' : 'password'} value={pwForm.new_password}
                onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="••••••••" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw({ ...showPw, new: !showPw.new })}>
                {showPw.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirmar Nova Senha</Label>
            <div className="relative">
              <Input type={showPw.confirm ? 'text' : 'password'} value={pwForm.confirm_password}
                onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="••••••••" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>
                {showPw.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleChangePw} disabled={changePwMutation.isPending} className="gap-2">
            {changePwMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}