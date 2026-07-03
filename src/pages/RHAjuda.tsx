import { HelpCircle, Building2, LayoutDashboard, UserPlus, Clock, DollarSign, FileText, CalendarDays, MapPin, Shield, ScanFace, Navigation, Code, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface GuideItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
}

const guides: GuideItem[] = [
  {
    id: "holding",
    icon: <Building2 className="h-5 w-5" />,
    title: "Holding",
    summary: "Agrupa várias empresas sob uma mesma estrutura corporativa.",
    steps: [
      "Acesse RH → Holding.",
      "Clique em 'Nova Holding' e informe razão social, CNPJ e responsável.",
      "Vincule as empresas que fazem parte da holding.",
      "Salve para consolidar relatórios e visualizações no dashboard.",
    ],
    tips: ["Use holding para consolidar folha, ponto e mapa entre unidades diferentes."],
  },
  {
    id: "empresas",
    icon: <Building2 className="h-5 w-5" />,
    title: "Empresas",
    summary: "Cadastro de cada empresa (CNPJ) que emprega colaboradores.",
    steps: [
      "Acesse RH → Empresas.",
      "Clique em 'Nova Empresa' e preencha CNPJ, endereço e responsável.",
      "Configure carga horária padrão e regras de jornada.",
      "Vincule a empresa a uma holding (se aplicável).",
    ],
  },
  {
    id: "dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Dashboard",
    summary: "Visão geral de indicadores: presença, ausências, atrasos e horas trabalhadas.",
    steps: [
      "Acesse RH → Dashboard.",
      "Selecione o período (dia, semana, mês) no filtro superior.",
      "Filtre por empresa, cargo ou colaborador se necessário.",
      "Clique nos cards para abrir a lista detalhada.",
    ],
    tips: ["Os KPIs consideram o fuso America/Sao_Paulo."],
  },
  {
    id: "colaboradores",
    icon: <UserPlus className="h-5 w-5" />,
    title: "Colaboradores",
    summary: "Cadastro completo de funcionários (dados pessoais, contrato, cargo e jornada).",
    steps: [
      "Acesse RH → Colaboradores e clique em 'Novo colaborador'.",
      "Preencha dados pessoais (CPF, nome, contato) e endereço.",
      "Defina cargo, empresa, PDV, jornada e salário.",
      "Anexe documentos (RG, CTPS, contrato).",
      "Ao salvar, o colaborador fica apto a receber acesso ao app.",
    ],
    tips: [
      "Use a importação em lote via Excel (upsert por CPF ou e-mail).",
      "Idade e admissão são calculadas automaticamente.",
    ],
  },
  {
    id: "ponto",
    icon: <Clock className="h-5 w-5" />,
    title: "Ponto",
    summary: "Registro e auditoria de batidas de ponto (entrada, intervalo, saída).",
    steps: [
      "Acesse RH → Ponto.",
      "Selecione o colaborador ou filtre por empresa/PDV.",
      "Visualize a folha diária com horas trabalhadas e extras.",
      "Ajuste batidas manualmente clicando na célula (fica registrado no log).",
      "Exporte o AFD (arquivo fiscal) quando necessário.",
    ],
    tips: ["Configuração padrão: 22 dias úteis, 1h de almoço."],
  },
  {
    id: "holerite",
    icon: <DollarSign className="h-5 w-5" />,
    title: "Holerite",
    summary: "Geração e envio de contracheques mensais.",
    steps: [
      "Acesse RH → Holerite.",
      "Selecione a competência (mês/ano).",
      "Confira os cálculos de salário, horas extras, descontos e benefícios.",
      "Gere o PDF individual ou em lote.",
      "Envie diretamente pelo app do colaborador ou baixe para envio externo.",
    ],
  },
  {
    id: "documentos",
    icon: <FileText className="h-5 w-5" />,
    title: "Documentos",
    summary: "Repositório de documentos do colaborador com assinatura digital.",
    steps: [
      "Acesse RH → Documentos.",
      "Clique em 'Novo documento' e escolha o modelo (contrato, aditivo, aviso).",
      "Selecione o colaborador destinatário.",
      "Envie para assinatura (OTP + SHA-256, horário GMT-3).",
      "Acompanhe status: pendente, assinado, expirado.",
    ],
  },
  {
    id: "feriados",
    icon: <CalendarDays className="h-5 w-5" />,
    title: "Feriados",
    summary: "Calendário de feriados nacionais, estaduais e municipais por região.",
    steps: [
      "Acesse RH → Feriados.",
      "Selecione a região (UF ou município).",
      "Clique em 'Adicionar feriado' informando data, nome e tipo.",
      "Feriados influenciam automaticamente o cálculo de ponto e escalas.",
    ],
  },
  {
    id: "mapa",
    icon: <MapPin className="h-5 w-5" />,
    title: "Mapa",
    summary: "Visualização em tempo real da localização dos colaboradores em campo.",
    steps: [
      "Acesse RH → Mapa.",
      "Selecione a data e o time (ou colaborador individual).",
      "Veja pontos de batida, PDVs visitados e trajeto.",
      "Clique em um marcador para ver detalhes da visita.",
    ],
    tips: ["Geocoding via Nominatim/OSM. Requer permissão de GPS no app do colaborador."],
  },
  {
    id: "acessos",
    icon: <Shield className="h-5 w-5" />,
    title: "Acessos App",
    summary: "Libera o app do colaborador e define qual perfil (template) ele terá.",
    steps: [
      "Acesse RH → Acessos App.",
      "Na aba 'Perfis do App', crie templates (ex.: Operacional, Gestor) marcando as capacidades permitidas.",
      "Na aba 'Colaboradores', clique em 'Liberar' na linha do colaborador.",
      "Escolha o perfil no dropdown e confirme — uma senha temporária (padrão anatriXXXaa) é gerada.",
      "Compartilhe login (CPF) e senha; o colaborador troca no primeiro acesso.",
      "Para trocar perfil depois, use o dropdown 'Perfil do App' direto na tabela.",
    ],
    tips: [
      "Cada template controla o que aparece no app: ponto, holerite, documentos, etc.",
      "Revogar acesso: use o botão 'Revogar' na linha correspondente.",
    ],
  },
  {
    id: "biometria",
    icon: <ScanFace className="h-5 w-5" />,
    title: "Biometria Facial",
    summary: "Cadastro facial dos colaboradores para validação no ponto.",
    steps: [
      "Acesse RH → Biometria Facial.",
      "Selecione o colaborador e clique em 'Capturar'.",
      "Peça para o colaborador posicionar o rosto na câmera (boa iluminação).",
      "O sistema captura o embedding via WebGL (com fallback CPU).",
      "Ao bater ponto, a face é comparada (distância euclidiana ≤ 0.6).",
    ],
    tips: ["Recomenda-se recapturar a face a cada 6 meses ou após mudança visual significativa."],
  },
  {
    id: "rastreamento",
    icon: <Navigation className="h-5 w-5" />,
    title: "Rastreamento",
    summary: "Histórico de localização e trajetos dos colaboradores.",
    steps: [
      "Acesse RH → Rastreamento.",
      "Selecione data e colaborador.",
      "Veja o trajeto completo com timestamps e velocidade.",
      "Exporte o relatório em CSV se precisar.",
    ],
  },
  {
    id: "monitor",
    icon: <Clock className="h-5 w-5" />,
    title: "Monitor de Ponto",
    summary: "Tela em tempo real de quem está batendo o ponto agora.",
    steps: [
      "Acesse RH → Monitor de Ponto (menu superior ou atalho).",
      "Veja em tempo real as batidas com foto e localização.",
      "Use para acompanhar o turno de trabalho ativamente.",
    ],
  },
  {
    id: "logs",
    icon: <Code className="h-5 w-5" />,
    title: "Logs & Erros",
    summary: "Registros técnicos e falhas para debug e auditoria.",
    steps: [
      "Acesse RH → Logs & Erros.",
      "Filtre por tipo (erro, info, aviso) ou por colaborador.",
      "Clique no log para ver stacktrace/detalhes.",
      "Use para auditar alterações críticas (ajuste de ponto, revogação de acesso).",
    ],
  },
  {
    id: "app-colaborador",
    icon: <Smartphone className="h-5 w-5" />,
    title: "App do Colaborador",
    summary: "Aplicativo mobile usado pelos funcionários.",
    steps: [
      "URL: /colaborador/login. Login com CPF + senha temporária.",
      "No primeiro acesso, o colaborador é obrigado a trocar a senha.",
      "Funcionalidades visíveis dependem do perfil (template) atribuído.",
      "Funciona offline: bate ponto sem internet e sincroniza depois.",
      "Sessão fica ativa até o logout manual.",
    ],
  },
];

export default function RHAjuda() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Central de Ajuda — RH</h1>
            <p className="text-sm text-muted-foreground">
              Passo a passo de cada funcionalidade do módulo de Recursos Humanos.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="mt-2">
          {guides.length} guias disponíveis
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guias por funcionalidade</CardTitle>
          <CardDescription>
            Clique em cada item para expandir o passo a passo. Ideal para treinar novos usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {guides.map((g) => (
              <AccordionItem key={g.id} value={g.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      {g.icon}
                    </div>
                    <div>
                      <div className="font-medium">{g.title}</div>
                      <div className="text-sm text-muted-foreground font-normal">
                        {g.summary}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-12 space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Passo a passo</h4>
                      <ol className="space-y-2">
                        {g.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-muted-foreground leading-relaxed pt-0.5">
                              {step}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    {g.tips && g.tips.length > 0 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <h4 className="font-semibold text-sm mb-1 text-amber-700 dark:text-amber-400">
                          Dicas
                        </h4>
                        <ul className="space-y-1">
                          {g.tips.map((tip, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              • {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
