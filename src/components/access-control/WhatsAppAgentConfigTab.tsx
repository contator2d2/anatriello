import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, Brain, MessageSquare, Settings, Zap, Shield, Sparkles,
  Save, Loader2, Plus, Trash2, Power, PowerOff, Mic, Image,
  FileText, AlertTriangle, Phone, Clock
} from 'lucide-react';

interface WhatsAppAgentConfig {
  id?: string;
  organization_id?: string;
  name: string;
  is_active: boolean;
  connection_id: string;
  ai_provider: 'openai' | 'gemini' | 'openrouter';
  ai_model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  greeting_message: string;
  fallback_message: string;
  capabilities: string[];
  personality_traits: string[];
  language: string;
  context_window: number;
  working_hours?: {
    enabled: boolean;
    start: string;
    end: string;
    days: Record<string, boolean>;
    outside_message: string;
  };
  notification_rules?: {
    low: string[];
    medium: string[];
    high: string[];
  };
}

interface Connection {
  id: string;
  name: string;
  status: string;
  phone_number?: string;
  provider?: string;
}

const AI_MODELS: Record<string, { label: string; models: { id: string; label: string }[] }> = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-pro', label: 'Gemini Pro' },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
      { id: 'mistralai/mixtral-8x7b-instruct', label: 'Mixtral 8x7B' },
    ],
  },
};

const ALL_CAPABILITIES = [
  { id: 'consult_operations', label: 'Consultar Operação', description: 'Quem está na loja, marcas, agenda', icon: MessageSquare },
  { id: 'register_incidents', label: 'Registrar Ocorrências', description: 'Registrar via texto ou áudio guiado', icon: AlertTriangle },
  { id: 'transcribe_audio', label: 'Interpretar Áudio', description: 'Transcrever e interpretar mensagens de voz', icon: Mic },
  { id: 'analyze_images', label: 'Analisar Imagens', description: 'Interpretar fotos de evidências enviadas', icon: Image },
  { id: 'consult_scores', label: 'Consultar Scores', description: 'Verificar score de promotores', icon: Sparkles },
  { id: 'consult_schedule', label: 'Consultar Agenda', description: 'Verificar agenda de visitas', icon: Clock },
  { id: 'read_reports', label: 'Ler Relatórios', description: 'Acessar resumos e relatórios operacionais', icon: FileText },
  { id: 'notify_stakeholders', label: 'Notificar Envolvidos', description: 'Disparar notificações automáticas', icon: Phone },
];

const DEFAULT_PROMPT = `Você é o assistente operacional inteligente do sistema de Controle de Acesso. Seu papel é ajudar gerentes, supervisores e contatos autorizados dos supermercados.

Suas capacidades:
- Consultar quem está na loja em tempo real
- Informar marcas sendo atendidas
- Verificar agenda de visitas (hoje e próximos dias)
- Registrar ocorrências (atraso, conduta, falha operacional, etc.)
- Consultar score e histórico de promotores
- Interpretar mensagens de texto e áudio

Regras:
- Responda APENAS sobre dados do PDV autorizado do contato
- Seja objetivo e operacional
- Para registrar ocorrência, colete: promotor, agência, marca, descrição, urgência
- Confirme antes de registrar qualquer ocorrência
- Classifique automaticamente: tipo, gravidade, impacto e risco
- Notifique conforme regras: baixa→agência, média→agência+supermercado, alta→todos+admin

Variáveis disponíveis:
{{current_date}}, {{current_time}}, {{current_day}}, {{pdv_name}}, {{contact_name}}`;

const DEFAULT_CONFIG: WhatsAppAgentConfig = {
  name: 'Assistente Operacional PDV',
  is_active: false,
  connection_id: '',
  ai_provider: 'openai',
  ai_model: 'gpt-4o-mini',
  system_prompt: DEFAULT_PROMPT,
  temperature: 0.4,
  max_tokens: 1000,
  greeting_message: 'Olá! Sou o assistente operacional do seu PDV. Como posso ajudar?',
  fallback_message: 'Desculpe, não consegui processar sua solicitação. Tente novamente ou entre em contato com o suporte.',
  capabilities: ['consult_operations', 'register_incidents', 'transcribe_audio', 'consult_scores'],
  personality_traits: ['profissional', 'objetivo', 'operacional'],
  language: 'pt-BR',
  context_window: 10,
  working_hours: {
    enabled: false,
    start: '06:00',
    end: '22:00',
    days: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: true, dom: false },
    outside_message: 'O assistente está disponível apenas em horário comercial. Tente novamente mais tarde.',
  },
  notification_rules: {
    low: ['agency'],
    medium: ['agency', 'supermarket'],
    high: ['agency', 'supermarket', 'admin'],
  },
};

export default function WhatsAppAgentConfigTab() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<WhatsAppAgentConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState('general');
  const [newTrait, setNewTrait] = useState('');

  // Load connections
  const { data: connections = [] } = useQuery({
    queryKey: ['connections-list'],
    queryFn: () => api<Connection[]>('/api/connections'),
  });

  // Load existing config
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['whatsapp-agent-config'],
    queryFn: () => api<WhatsAppAgentConfig>('/api/access-control/whatsapp-agent-config'),
  });

  useEffect(() => {
    if (savedConfig?.id) {
      setConfig({
        ...DEFAULT_CONFIG,
        ...savedConfig,
        capabilities: Array.isArray(savedConfig.capabilities) ? savedConfig.capabilities : DEFAULT_CONFIG.capabilities,
        personality_traits: Array.isArray(savedConfig.personality_traits) ? savedConfig.personality_traits : DEFAULT_CONFIG.personality_traits,
        working_hours: savedConfig.working_hours || DEFAULT_CONFIG.working_hours,
        notification_rules: savedConfig.notification_rules || DEFAULT_CONFIG.notification_rules,
      });
    }
  }, [savedConfig]);

  // Save config
  const saveMutation = useMutation({
    mutationFn: (data: WhatsAppAgentConfig) =>
      api('/api/access-control/whatsapp-agent-config', { method: 'POST', body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-agent-config'] });
      toast.success('Configuração do agente salva com sucesso');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  const toggleCapability = (capId: string) => {
    setConfig(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...prev.capabilities, capId],
    }));
  };

  const addTrait = () => {
    if (newTrait.trim() && !config.personality_traits.includes(newTrait.trim())) {
      setConfig(prev => ({ ...prev, personality_traits: [...prev.personality_traits, newTrait.trim()] }));
      setNewTrait('');
    }
  };

  const removeTrait = (trait: string) => {
    setConfig(prev => ({ ...prev, personality_traits: prev.personality_traits.filter(t => t !== trait) }));
  };

  const updateWorkingHours = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      working_hours: { ...prev.working_hours!, [field]: value },
    }));
  };

  const toggleWorkDay = (day: string) => {
    setConfig(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours!,
        days: { ...prev.working_hours!.days, [day]: !prev.working_hours!.days[day] },
      },
    }));
  };

  const toggleNotifyTarget = (severity: 'low' | 'medium' | 'high', target: string) => {
    setConfig(prev => {
      const rules = { ...prev.notification_rules! };
      const list = rules[severity] || [];
      rules[severity] = list.includes(target) ? list.filter(t => t !== target) : [...list, target];
      return { ...prev, notification_rules: rules };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableModels = AI_MODELS[config.ai_provider]?.models || [];
  const weekDays = [
    { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
    { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' },
    { key: 'dom', label: 'Dom' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Agente IA WhatsApp</h2>
            <p className="text-sm text-muted-foreground">Configure o assistente inteligente para contatos autorizados dos PDVs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {config.is_active ? (
              <Badge variant="default" className="gap-1"><Power className="h-3 w-3" /> Ativo</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><PowerOff className="h-3 w-3" /> Inativo</Badge>
            )}
            <Switch checked={config.is_active} onCheckedChange={v => setConfig(p => ({ ...p, is_active: v }))} />
          </div>
          <Button onClick={() => saveMutation.mutate(config)} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="general" className="gap-1 text-xs"><Settings className="h-3.5 w-3.5" /> Geral</TabsTrigger>
          <TabsTrigger value="brain" className="gap-1 text-xs"><Brain className="h-3.5 w-3.5" /> Cérebro</TabsTrigger>
          <TabsTrigger value="capabilities" className="gap-1 text-xs"><Zap className="h-3.5 w-3.5" /> Habilidades</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1 text-xs"><Clock className="h-3.5 w-3.5" /> Horários</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1 text-xs"><Shield className="h-3.5 w-3.5" /> Notificações</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Identificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Nome do Agente</Label>
                  <Input value={config.name} onChange={e => setConfig(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Assistente Operacional PDV" />
                </div>
                <div>
                  <Label>Idioma</Label>
                  <Select value={config.language} onValueChange={v => setConfig(p => ({ ...p, language: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mensagem de Boas-vindas</Label>
                  <Textarea value={config.greeting_message} onChange={e => setConfig(p => ({ ...p, greeting_message: e.target.value }))} rows={2} />
                </div>
                <div>
                  <Label>Mensagem de Fallback</Label>
                  <Textarea value={config.fallback_message} onChange={e => setConfig(p => ({ ...p, fallback_message: e.target.value }))} rows={2} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Conexão WhatsApp</CardTitle>
                <CardDescription>Selecione a conexão que o agente usará para enviar e receber mensagens</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Conexão</Label>
                  <Select value={config.connection_id} onValueChange={v => setConfig(p => ({ ...p, connection_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conexão" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map(conn => (
                        <SelectItem key={conn.id} value={conn.id}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${conn.status === 'connected' ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                            {conn.name} {conn.phone_number ? `(${conn.phone_number})` : ''}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {config.connection_id && (
                  <div className="rounded-md border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      O agente responderá mensagens recebidas nesta conexão de contatos autorizados dos PDVs cadastrados.
                    </p>
                  </div>
                )}

                <div>
                  <Label>Personalidade</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {config.personality_traits.map(trait => (
                      <Badge key={trait} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTrait(trait)}>
                        {trait} <Trash2 className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input value={newTrait} onChange={e => setNewTrait(e.target.value)} placeholder="Ex: empático, formal..."
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTrait())} className="text-sm" />
                    <Button variant="outline" size="sm" onClick={addTrait}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Brain Tab */}
        <TabsContent value="brain" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4" /> Prompt do Sistema (Cérebro)</CardTitle>
                <CardDescription>Define como o agente se comporta, o que sabe fazer e suas regras</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={config.system_prompt}
                  onChange={e => setConfig(p => ({ ...p, system_prompt: e.target.value }))}
                  rows={18}
                  className="font-mono text-xs"
                  placeholder="Escreva o prompt do sistema..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Variáveis: {'{{current_date}}'}, {'{{current_time}}'}, {'{{current_day}}'}, {'{{pdv_name}}'}, {'{{contact_name}}'}, {'{{contact_role}}'}
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Provedor de IA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Provedor</Label>
                    <Select value={config.ai_provider} onValueChange={v => {
                      const provider = v as 'openai' | 'gemini' | 'openrouter';
                      const firstModel = AI_MODELS[provider]?.models[0]?.id || '';
                      setConfig(p => ({ ...p, ai_provider: provider, ai_model: firstModel }));
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(AI_MODELS).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modelo</Label>
                    <Select value={config.ai_model} onValueChange={v => setConfig(p => ({ ...p, ai_model: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableModels.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Parâmetros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between">
                      <Label>Temperatura</Label>
                      <span className="text-xs text-muted-foreground">{config.temperature}</span>
                    </div>
                    <Slider
                      value={[config.temperature]}
                      onValueChange={([v]) => setConfig(p => ({ ...p, temperature: v }))}
                      min={0} max={1} step={0.1}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Menor = mais preciso, Maior = mais criativo</p>
                  </div>
                  <div>
                    <Label>Max Tokens</Label>
                    <Input type="number" value={config.max_tokens} onChange={e => setConfig(p => ({ ...p, max_tokens: parseInt(e.target.value) || 1000 }))} />
                  </div>
                  <div>
                    <Label>Janela de Contexto (msgs)</Label>
                    <Input type="number" value={config.context_window} onChange={e => setConfig(p => ({ ...p, context_window: parseInt(e.target.value) || 10 }))} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Capabilities Tab */}
        <TabsContent value="capabilities" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Habilidades do Agente</CardTitle>
              <CardDescription>Selecione o que o agente poderá fazer quando um contato autorizado enviar mensagem</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_CAPABILITIES.map(cap => {
                  const Icon = cap.icon;
                  const active = config.capabilities.includes(cap.id);
                  return (
                    <div
                      key={cap.id}
                      onClick={() => toggleCapability(cap.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{cap.label}</p>
                          {active && <Badge variant="default" className="text-[10px] h-4">Ativo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{cap.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Horário de Funcionamento</CardTitle>
              <CardDescription>Defina quando o agente estará disponível para responder</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.working_hours?.enabled || false}
                  onCheckedChange={v => updateWorkingHours('enabled', v)}
                />
                <Label>Restringir por horário</Label>
              </div>

              {config.working_hours?.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Início</Label>
                      <Input type="time" value={config.working_hours.start} onChange={e => updateWorkingHours('start', e.target.value)} />
                    </div>
                    <div>
                      <Label>Fim</Label>
                      <Input type="time" value={config.working_hours.end} onChange={e => updateWorkingHours('end', e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <Label>Dias ativos</Label>
                    <div className="flex gap-2 mt-1">
                      {weekDays.map(d => (
                        <button
                          key={d.key}
                          onClick={() => toggleWorkDay(d.key)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            config.working_hours?.days[d.key]
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Mensagem fora do horário</Label>
                    <Textarea
                      value={config.working_hours.outside_message}
                      onChange={e => updateWorkingHours('outside_message', e.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Regras de Notificação por Gravidade</CardTitle>
              <CardDescription>Defina quem é notificado conforme a gravidade da ocorrência registrada pelo agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(['low', 'medium', 'high'] as const).map(severity => {
                const labels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
                const colors = { low: 'text-green-600', medium: 'text-yellow-600', high: 'text-destructive' };
                const targets = [
                  { id: 'agency', label: 'Agência' },
                  { id: 'supermarket', label: 'Supermercado' },
                  { id: 'admin', label: 'Admin Ayratech' },
                  { id: 'supervisor', label: 'Supervisor Regional' },
                ];
                return (
                  <div key={severity} className="rounded-lg border p-3 space-y-2">
                    <p className={`text-sm font-semibold ${colors[severity]}`}>
                      Gravidade {labels[severity]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {targets.map(t => {
                        const active = config.notification_rules?.[severity]?.includes(t.id);
                        return (
                          <Badge
                            key={t.id}
                            variant={active ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => toggleNotifyTarget(severity, t.id)}
                          >
                            {t.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
