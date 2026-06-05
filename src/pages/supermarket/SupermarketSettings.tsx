import { useEffect, useState } from 'react';
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
import { Settings, Palette, Lock, Key, Copy, RefreshCw, Loader2, Eye, EyeOff, Monitor, UserCog, ExternalLink } from 'lucide-react';
import { FileUploadInput } from '@/components/ui/file-upload-input';

const getHeaders = () => {
  const t = localStorage.getItem('supermarket_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : undefined;
};

const DEFAULTS = {
  logo_url: '',
  totem_primary_color: '#3b82f6',
  totem_secondary_color: '#1e293b',
  totem_bg_color: '#0f172a',
  totem_button_color: '#3b82f6',
  totem_button_text_color: '#ffffff',
  totem_header_text: 'Controle de Acesso',
  totem_slogan: '',
  totem_pdv_name: '',
  qr_access_enabled: false,
};

export default function SupermarketSettings() {
  const { user } = useSupermarketAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const headers = getHeaders();

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [showToken, setShowToken] = useState(false);
  const [customForm, setCustomForm] = useState(DEFAULTS);

  const { data: settings, isLoading, isError, error } = useQuery({
    queryKey: ['sm-settings'],
    queryFn: () => api<any>('/api/access-control/supermarket-portal/settings', { headers }),
    enabled: !!user,
  });

  useEffect(() => {
    if (!settings) return;
    setCustomForm({
      logo_url: settings.logo_url || DEFAULTS.logo_url,
      totem_primary_color: settings.totem_primary_color || DEFAULTS.totem_primary_color,
      totem_secondary_color: settings.totem_secondary_color || DEFAULTS.totem_secondary_color,
      totem_bg_color: settings.totem_bg_color || DEFAULTS.totem_bg_color,
      totem_button_color: settings.totem_button_color || DEFAULTS.totem_button_color,
      totem_button_text_color: settings.totem_button_text_color || DEFAULTS.totem_button_text_color,
      totem_header_text: settings.totem_header_text || DEFAULTS.totem_header_text,
      totem_slogan: settings.totem_slogan || DEFAULTS.totem_slogan,
      totem_pdv_name: settings.totem_pdv_name || settings.name || DEFAULTS.totem_pdv_name,
      qr_access_enabled: settings.qr_access_enabled ?? DEFAULTS.qr_access_enabled,
    });
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof DEFAULTS) => api('/api/access-control/supermarket-portal/settings', { method: 'PUT', body: data, headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sm-settings'] });
      toast({ title: 'Configurações salvas!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err?.message, variant: 'destructive' }),
  });

  const changePwMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) => api('/api/access-control/supermarket-portal/change-password', { method: 'PUT', body: data, headers }),
    onSuccess: () => {
      toast({ title: 'Senha do acesso ao totem alterada com sucesso!' });
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

  const copyText = async (value?: string, successTitle = 'Copiado!') => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast({ title: successTitle });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar configurações</CardTitle>
            <CardDescription>{(error as Error)?.message || 'Não foi possível carregar os dados da unidade.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['sm-settings'] })}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" /> Configurações
        </h1>
        <p className="text-muted-foreground">{settings?.name} — {settings?.network_name || ''}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5 text-primary" /> Credenciais do Totem
          </CardTitle>
          <CardDescription>
            O Totem usa o mesmo login desta unidade: e-mail abaixo + a senha definida nesta página.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail de acesso do Totem</Label>
            <div className="flex gap-2">
              <Input readOnly value={settings?.login_email || user?.email || ''} />
              <Button type="button" variant="outline" size="icon" onClick={() => copyText(settings?.login_email || user?.email, 'E-mail copiado!')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A senha do Totem não é exibida por segurança. Para trocar, use a seção <strong>Alterar Senha</strong> abaixo.
          </p>
          <Button type="button" variant="outline" asChild>
            <a href="/totem" target="_blank" rel="noreferrer" className="gap-2">
              <ExternalLink className="h-4 w-4" /> Abrir Totem
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-primary" /> Token do Totem
          </CardTitle>
          <CardDescription>Este token valida e autentica o terminal físico deste PDV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={settings?.totem_enabled ? 'default' : 'secondary'}>
              {settings?.totem_enabled ? 'Totem Ativo' : 'Totem Inativo'}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label>Token de Liberação</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={settings?.totem_token ? (showToken ? settings.totem_token : '••••••••••••••••••••••••••••••••') : 'Nenhum token gerado ainda'}
                className="font-mono text-sm"
              />
              <Button size="icon" variant="outline" onClick={() => setShowToken(!showToken)} disabled={!settings?.totem_token}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={() => copyText(settings?.totem_token, 'Token copiado!')} disabled={!settings?.totem_token}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button variant="outline" onClick={() => regenTokenMutation.mutate()} disabled={regenTokenMutation.isPending} className="gap-2">
            {regenTokenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {settings?.totem_token ? 'Regenerar Token' : 'Gerar Token'}
          </Button>
          <p className="text-xs text-muted-foreground">Ao gerar um novo token, o terminal atual precisará ser reconectado com a nova credencial.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5 text-primary" /> Personalização do Totem
          </CardTitle>
          <CardDescription>Configure logo, texto e cores aplicadas na tela do Totem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo do PDV</Label>
            <FileUploadInput
              value={customForm.logo_url}
              onChange={(url) => setCustomForm({ ...customForm, logo_url: url })}
              accept="image/*"
              placeholder="https://exemplo.com/logo.png ou faça upload"
              showPreview={true}
              previewType="image"
              customTokenGetter={() => localStorage.getItem('supermarket_auth_token')}
            />
            {customForm.logo_url && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                <img src={customForm.logo_url} alt="Preview do logo" className="h-14 w-14 object-contain rounded border border-border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <span className="text-xs text-muted-foreground">Preview do logo carregado</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nome do PDV (exibido no Totem)</Label>
            <Input value={customForm.totem_pdv_name} onChange={(e) => setCustomForm({ ...customForm, totem_pdv_name: e.target.value })} placeholder="Ex: Supermercado Central" />
          </div>

          <div className="space-y-2">
            <Label>Texto do Cabeçalho</Label>
            <Input value={customForm.totem_header_text} onChange={(e) => setCustomForm({ ...customForm, totem_header_text: e.target.value })} placeholder="Controle de Acesso" />
          </div>

          <div className="space-y-2">
            <Label>Frase / Slogan (abaixo do logo)</Label>
            <Input value={customForm.totem_slogan} onChange={(e) => setCustomForm({ ...customForm, totem_slogan: e.target.value })} placeholder="Ex: Bem-vindo ao nosso PDV" />
          </div>

          <Separator />
          <p className="text-sm font-medium text-foreground">Cores</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'totem_primary_color', label: 'Cor Primária' },
              { key: 'totem_secondary_color', label: 'Cor Secundária' },
              { key: 'totem_bg_color', label: 'Fundo' },
              { key: 'totem_button_color', label: 'Botão' },
              { key: 'totem_button_text_color', label: 'Texto do Botão' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={String(customForm[key as keyof typeof customForm] || '#000000')} onChange={(e) => setCustomForm({ ...customForm, [key]: e.target.value })} className="w-10 h-10 rounded border border-border cursor-pointer" />
                  <Input value={String(customForm[key as keyof typeof customForm] || '')} onChange={(e) => setCustomForm({ ...customForm, [key]: e.target.value })} className="text-xs font-mono" placeholder="#000000" />
                </div>
              </div>
            ))}
          </div>

          <Separator />
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Pré-visualização
          </p>
          <div className="rounded-xl p-6 text-center space-y-3 relative" style={{ backgroundColor: customForm.totem_bg_color, color: customForm.totem_button_text_color }}>
            {customForm.logo_url && <img src={customForm.logo_url} alt="Logo do totem" className="h-14 mx-auto object-contain" />}
            {customForm.totem_pdv_name && (
              <p className="text-base font-semibold" style={{ color: customForm.totem_secondary_color }}>
                {customForm.totem_pdv_name}
              </p>
            )}
            <p className="text-lg font-bold" style={{ color: customForm.totem_primary_color }}>
              {customForm.totem_header_text || 'Controle de Acesso'}
            </p>
            {customForm.totem_slogan && (
              <p className="text-sm opacity-80" style={{ color: customForm.totem_button_text_color }}>
                {customForm.totem_slogan}
              </p>
            )}
            <div className="flex justify-center gap-2">
              <div className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: customForm.totem_button_color, color: customForm.totem_button_text_color }}>
                CPF
              </div>
              <div className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: customForm.totem_primary_color, color: customForm.totem_primary_color }}>
                QR Code
              </div>
            </div>
            <p className="text-[10px] opacity-50 pt-2" style={{ color: customForm.totem_button_text_color }}>
              Powered by Ayratech
            </p>
          </div>

          <Button onClick={() => saveMutation.mutate(customForm)} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Personalização
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" /> Alterar Senha
          </CardTitle>
          <CardDescription>Essa é a senha usada para entrar no portal da unidade e também no Totem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>Senha Atual</Label>
            <div className="relative">
              <Input type={showPw.current ? 'text' : 'password'} value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="••••••••" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}>
                {showPw.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <div className="relative">
              <Input type={showPw.new ? 'text' : 'password'} value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="••••••••" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw({ ...showPw, new: !showPw.new })}>
                {showPw.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirmar Nova Senha</Label>
            <div className="relative">
              <Input type={showPw.confirm ? 'text' : 'password'} value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} placeholder="••••••••" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}>
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
