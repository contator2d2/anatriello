import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePromotorSettings, usePromotorUpdateSettings, usePromotorChangePassword } from "@/hooks/use-promotor";
import { PromotorLayout } from "./PromotorLayout";
import { Settings, Lock, Palette, Wifi, WifiOff, Navigation, Smartphone, Loader2 } from "lucide-react";

export default function PromotorConfig() {
  const { data: settings } = usePromotorSettings();
  const updateSettings = usePromotorUpdateSettings();
  const changePassword = usePromotorChangePassword();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(settings?.theme || 'auto');
  const [notifications, setNotifications] = useState(settings?.notifications_enabled !== false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [gpsStatus, setGpsStatus] = useState('checking');

  const employee = JSON.parse(localStorage.getItem('promotor_employee') || '{}');

  useEffect(() => {
    if (settings) {
      setTheme(settings.theme || 'auto');
      setNotifications(settings.notifications_enabled !== false);
    }
  }, [settings]);

  useEffect(() => {
    const onOn = () => setIsOnline(true);
    const onOff = () => setIsOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setGpsStatus('active'),
        (err) => setGpsStatus(err.code === 1 ? 'denied' : 'off')
      );
    } else {
      setGpsStatus('unavailable');
    }

    return () => { window.removeEventListener('online', onOn); window.removeEventListener('offline', onOff); };
  }, []);

  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({ theme, notifications_enabled: notifications });
      toast({ title: 'Configurações salvas!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleChangePassword = async () => {
    if (!newPwd || newPwd.length < 6) {
      toast({ title: 'A nova senha deve ter ao menos 6 caracteres', variant: 'destructive' });
      return;
    }
    try {
      await changePassword.mutateAsync({ current_password: currentPwd, new_password: newPwd });
      toast({ title: 'Senha alterada com sucesso!' });
      setCurrentPwd(''); setNewPwd('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <PromotorLayout>
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <h1 className="text-lg font-bold flex items-center gap-2"><Settings className="h-5 w-5" /> Configurações</h1>

        {/* Profile Info */}
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Perfil</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-1 text-sm">
            <p><strong>Nome:</strong> {employee.name}</p>
            <p><strong>CPF:</strong> {employee.cpf}</p>
            <p><strong>E-mail:</strong> {employee.email}</p>
            <p><strong>Perfil:</strong> {employee.profile}</p>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> Tema</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="claro">☀️ Claro</SelectItem>
                <SelectItem value="escuro">🌙 Escuro</SelectItem>
                <SelectItem value="auto">🔄 Automático (sistema)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
              <Label>Notificações</Label>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Button onClick={handleSaveSettings} size="sm" className="w-full" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Preferências
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Alterar Senha</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Senha atual</Label>
              <Input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nova senha</Label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} size="sm" className="w-full" disabled={changePassword.isPending}>
              {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Alterar Senha
            </Button>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> Status do Dispositivo</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">{isOnline ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />} Conexão</span>
              <span className={isOnline ? 'text-green-600' : 'text-red-600'}>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Navigation className="h-4 w-4" /> GPS</span>
              <span className={gpsStatus === 'active' ? 'text-green-600' : 'text-red-600'}>
                {gpsStatus === 'active' ? 'Ativo' : gpsStatus === 'denied' ? 'Permissão negada' : 'Desligado'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Versão do App: 2.0.0</p>
          </CardContent>
        </Card>
      </div>
    </PromotorLayout>
  );
}
