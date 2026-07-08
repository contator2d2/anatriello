import { useState, useMemo } from "react";
import {
  BookOpen, Search, Building2, Shield, Settings, UserPlus, FileSignature,
  CalendarRange, Clock, ScanFace, Timer, Plane, AlertTriangle, DollarSign,
  Calculator, UserMinus, FileCode2, Target, MapPin, LineChart, Inbox,
  ClipboardCheck, ChevronRight, CheckCircle2, Info, AlertCircle, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Block =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "tip"; text: string }
  | { type: "warn"; text: string }
  | { type: "code"; text: string }
  | { type: "h3"; text: string };

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  blocks: Block[];
}

const sections: Section[] = [
  {
    id: "visao-geral",
    title: "1. Visão Geral do Módulo",
    icon: <BookOpen className="h-4 w-4" />,
    summary: "Como o RH está estruturado e quais são os fluxos principais.",
    blocks: [
      { type: "p", text: "O módulo de RH cobre o ciclo completo do colaborador: admissão, jornada, ponto, folha, benefícios, avaliações, desligamento e eSocial. Todas as datas usam o fuso America/Sao_Paulo." },
      { type: "h3", text: "Fluxo macro" },
      { type: "steps", items: [
        "Configurar Holding → Empresas → PDVs → Feriados regionais.",
        "Criar Perfis de Acesso (templates) e liberar app para colaboradores.",
        "Admitir colaboradores (dados, contrato, documentos, biometria).",
        "Definir escalas e regras de ponto por PDV/cargo.",
        "Operar: ponto diário, banco de horas, férias, advertências.",
        "Fechar folha mensal → gerar holerite → exportar eSocial.",
        "Acompanhar via Dashboard, Rastreamento, Analytics e Auditoria.",
      ]},
      { type: "tip", text: "Comece sempre pela estrutura (Holding/Empresas) antes de cadastrar pessoas — muitas telas dependem desse vínculo." },
    ],
  },
  {
    id: "acesso-permissoes",
    title: "2. Acesso e Permissões",
    icon: <Shield className="h-4 w-4" />,
    summary: "Templates dinâmicos JSONB controlam o que cada usuário enxerga.",
    blocks: [
      { type: "p", text: "Permissões são dinâmicas por template (JSONB) em vez de papéis fixos. Um mesmo colaborador pode ter perfis diferentes no app e no painel." },
      { type: "h3", text: "Como criar um perfil" },
      { type: "steps", items: [
        "Vá em RH → Acessos App → aba 'Perfis do App'.",
        "Clique em 'Novo perfil' e nomeie (ex.: Operacional, Gestor de PDV).",
        "Marque as capacidades permitidas (ponto, holerite, documentos, etc.).",
        "Salve. O template fica disponível no dropdown de cada colaborador.",
      ]},
      { type: "h3", text: "Liberar acesso ao app" },
      { type: "steps", items: [
        "Aba 'Colaboradores' → linha do colaborador → botão 'Liberar'.",
        "Escolha o perfil e confirme. Uma senha temporária (padrão anatriXXXaa) é gerada.",
        "Compartilhe login (CPF) e senha. Troca obrigatória no primeiro acesso.",
      ]},
      { type: "warn", text: "Nunca compartilhe a senha por canal não seguro. Revogue imediatamente ao desligar o colaborador." },
    ],
  },
  {
    id: "config-inicial",
    title: "3. Configurações Iniciais",
    icon: <Settings className="h-4 w-4" />,
    summary: "Holding, Empresas, PDVs, Feriados, Uniformes/EPIs e Escalas.",
    blocks: [
      { type: "h3", text: "Holding" },
      { type: "steps", items: [
        "RH → Holding → 'Nova holding'.",
        "Informe razão social, CNPJ e responsável.",
        "Vincule as empresas do grupo para consolidar relatórios.",
      ]},
      { type: "h3", text: "Empresas" },
      { type: "steps", items: [
        "RH → Empresas → 'Nova empresa'.",
        "Preencha CNPJ, endereço, responsável e carga horária padrão.",
        "Associe a uma holding (opcional).",
      ]},
      { type: "h3", text: "PDVs / Unidades" },
      { type: "steps", items: [
        "RH → PDVs → cadastre cada unidade com endereço geolocalizado.",
        "Defina raio de tolerância para bater ponto por GPS.",
      ]},
      { type: "h3", text: "Feriados" },
      { type: "steps", items: [
        "RH → Feriados → selecione UF/município → 'Adicionar feriado'.",
        "Feriados influenciam ponto, escala, DSR e folha automaticamente.",
      ]},
      { type: "tip", text: "Cadastre feriados no início do ano fiscal para evitar recálculos posteriores." },
    ],
  },
  {
    id: "admissao",
    title: "4. Admissão / Contratação",
    icon: <UserPlus className="h-4 w-4" />,
    summary: "Cinco etapas para admitir um colaborador com dados completos.",
    blocks: [
      { type: "p", text: "A admissão gera automaticamente o evento S-2200 do eSocial e habilita o colaborador nas demais telas." },
      { type: "steps", items: [
        "Etapa 1 — Dados pessoais: CPF, nome, nascimento, contato, endereço.",
        "Etapa 2 — Dados contratuais: empresa, cargo, PDV, salário, admissão, jornada, tipo de contrato (CLT/PJ/estágio).",
        "Etapa 3 — Dependentes: para IR e salário-família (opcional).",
        "Etapa 4 — Documentos: RG, CTPS, PIS, comprovante de residência, foto 3x4, exame admissional.",
        "Etapa 5 — Geração: revisar → clicar 'Admitir'. Sistema cria contrato, gera acesso ao app (se marcado) e agenda S-2200.",
      ]},
      { type: "h3", text: "Importação em lote" },
      { type: "list", items: [
        "Baixe o modelo Excel na tela de Colaboradores.",
        "Upsert por CPF (ou e-mail) — atualiza existentes, cria novos.",
        "Idade e tempo de casa são calculados automaticamente.",
      ]},
      { type: "warn", text: "Sem CPF válido o eSocial rejeita o evento. Valide antes de importar." },
    ],
  },
  {
    id: "documentos",
    title: "5. Documentos e Contratos",
    icon: <FileSignature className="h-4 w-4" />,
    summary: "Modelos, assinatura digital com OTP + SHA-256, auditoria.",
    blocks: [
      { type: "steps", items: [
        "RH → Documentos → 'Novo documento'.",
        "Escolha modelo (contrato, aditivo, aviso, termo de EPI).",
        "Selecione colaborador destinatário — variáveis são preenchidas automaticamente.",
        "Envie para assinatura. Colaborador recebe link + OTP por e-mail/WhatsApp.",
        "Assinatura registra IP, dispositivo, timestamp GMT-3 e hash SHA-256.",
        "Verifique autenticidade em Verificar Documento pelo hash.",
      ]},
      { type: "tip", text: "Modelos personalizados ficam em ModeloContrato — use variáveis {{nome}}, {{cargo}}, {{salario}} etc." },
    ],
  },
  {
    id: "escalas",
    title: "6. Escalas de Trabalho",
    icon: <CalendarRange className="h-4 w-4" />,
    summary: "5x2, 6x1, 12x36, escala livre e escalas por PDV.",
    blocks: [
      { type: "steps", items: [
        "RH → Escalas → 'Nova escala'.",
        "Escolha o tipo (5x2, 6x1, 12x36, livre) e a semana modelo.",
        "Defina intervalo (padrão 1h de almoço) e tolerância de atraso.",
        "Atribua colaboradores ou vincule a um PDV inteiro.",
      ]},
      { type: "list", items: [
        "5x2: 44h semanais, DSR ao domingo.",
        "6x1: 44h em 6 dias com folga rotativa.",
        "12x36: turno de 12h com 36h de descanso.",
        "Livre: horário flexível com meta mensal de horas.",
      ]},
    ],
  },
  {
    id: "relogio-ponto",
    title: "7. Relógio de Ponto",
    icon: <Clock className="h-4 w-4" />,
    summary: "Totem (tablet), app do colaborador e portal web.",
    blocks: [
      { type: "h3", text: "Totem / Tablet (RHRelogioPonto)" },
      { type: "steps", items: [
        "Abra /rh/relogio-ponto no tablet fixo do PDV.",
        "Faça login com o KioskLogin da empresa.",
        "Colaborador digita CPF → posiciona rosto na câmera → confirma.",
        "Sistema registra entrada/intervalo/saída conforme a batida atual.",
      ]},
      { type: "h3", text: "App do colaborador" },
      { type: "steps", items: [
        "Login em /colaborador/login com CPF + senha.",
        "Tela inicial mostra botão 'Bater ponto' com GPS obrigatório.",
        "Selfie é comparada com o embedding cadastrado.",
        "Funciona offline: bate ponto e sincroniza quando reconectar.",
      ]},
      { type: "h3", text: "Portal web (admin)" },
      { type: "list", items: [
        "RH → Ponto: visualiza folha diária, horas trabalhadas, extras.",
        "Ajuste manual: clique na célula → alterar → motivo → salva no log.",
        "Exportação AFD para fiscalização.",
      ]},
      { type: "tip", text: "Use Monitor de Ponto (/rh/ponto-monitor) para acompanhar em tempo real quem está batendo agora." },
    ],
  },
  {
    id: "biometria",
    title: "8. Biometria e Selfie",
    icon: <ScanFace className="h-4 w-4" />,
    summary: "Cadastro facial, threshold 0.6 e antifraude.",
    blocks: [
      { type: "h3", text: "Cadastro do rosto" },
      { type: "steps", items: [
        "RH → Biometria Facial → selecione o colaborador → 'Capturar'.",
        "Ambiente iluminado, sem óculos escuros/máscara.",
        "Sistema extrai embedding (128d) via face-api.js — WebGL, com fallback CPU.",
        "Recomenda-se recapturar a cada 6 meses ou após mudança visual.",
      ]},
      { type: "h3", text: "Validação na batida" },
      { type: "list", items: [
        "Distância euclidiana entre selfie ao vivo e o embedding cadastrado.",
        "Threshold: ≤ 0.6 aprova, > 0.6 rejeita.",
        "Se rejeitar: colaborador tenta 3x, depois pede aprovação do gestor.",
      ]},
      { type: "h3", text: "Antifraude / testes" },
      { type: "list", items: [
        "Detecção básica de foto impressa (uniformidade de textura).",
        "Log com foto, GPS, IP e horário de cada tentativa.",
        "Teste sugerido: bata ponto com colaborador ausente — deve reprovar.",
        "Teste sugerido: bata ponto fora do raio do PDV — deve alertar.",
      ]},
      { type: "warn", text: "Sempre ative WebGL — CPU fallback é 5-10x mais lento e degrada a experiência." },
    ],
  },
  {
    id: "banco-horas",
    title: "9. Banco de Horas e Espelho",
    icon: <Timer className="h-4 w-4" />,
    summary: "Acúmulo, compensação e espelho digital assinado.",
    blocks: [
      { type: "steps", items: [
        "RH → Banco de Horas: veja saldo positivo/negativo por colaborador.",
        "Configure regras: acordo individual/coletivo, vencimento (6/12 meses).",
        "Compensações registradas geram folgas ou abatem horas na folha.",
      ]},
      { type: "h3", text: "Espelho de Ponto" },
      { type: "steps", items: [
        "RH → Espelho Digital → selecione competência.",
        "Colaborador visualiza no app e assina digitalmente (OTP).",
        "Espelho assinado é anexado ao processo de folha.",
      ]},
    ],
  },
  {
    id: "ferias",
    title: "10. Férias e Férias Coletivas",
    icon: <Plane className="h-4 w-4" />,
    summary: "Solicitação, aprovação, 1/3 constitucional e S-2230.",
    blocks: [
      { type: "steps", items: [
        "Colaborador solicita pelo app: RH → Solicitações → Férias.",
        "Gestor aprova em RH → Solicitações Admin.",
        "Sistema calcula: 30 dias após 12 meses, com 1/3 constitucional.",
        "Opções de abono pecuniário (até 10 dias) e adiantamento do 13º.",
        "Envio de aviso 30 dias antes é obrigatório.",
        "Evento S-2230 é gerado automaticamente para o eSocial.",
      ]},
      { type: "h3", text: "Férias Coletivas" },
      { type: "list", items: [
        "RH → Férias Coletivas → selecione empresa e período.",
        "Todos os colaboradores selecionados recebem programação.",
        "Comunicação ao sindicato e MTE é obrigatória com 15 dias de antecedência.",
      ]},
    ],
  },
  {
    id: "advertencias",
    title: "11. Advertências e Medidas",
    icon: <AlertTriangle className="h-4 w-4" />,
    summary: "Verbal, escrita, suspensão e justa causa com registro auditado.",
    blocks: [
      { type: "steps", items: [
        "RH → Advertências → 'Nova ocorrência'.",
        "Selecione colaborador, tipo (verbal/escrita/suspensão), motivo.",
        "Anexe evidências (documentos, prints).",
        "Envie para assinatura do colaborador com OTP.",
        "Registro fica na ficha funcional e histórico disciplinar.",
      ]},
      { type: "list", items: [
        "Verbal: apenas registro, não notifica app.",
        "Escrita: colaborador assina no app.",
        "Suspensão: define dias, desconta na folha automaticamente.",
        "Justa causa: dispara fluxo de desligamento com S-2299 motivo específico.",
      ]},
    ],
  },
  {
    id: "folha-holerite",
    title: "12. Folha e Holerite",
    icon: <DollarSign className="h-4 w-4" />,
    summary: "Fechamento mensal com checklist e envio ao colaborador.",
    blocks: [
      { type: "h3", text: "Passo a passo do fechamento" },
      { type: "steps", items: [
        "RH → Checklist Folha: valida pendências (ponto sem batida, férias sem aprovação, etc.).",
        "Resolva cada item marcado em vermelho.",
        "RH → Holerite → selecione competência (mês/ano).",
        "Confira cálculos: salário base, HE, DSR, adicional noturno, descontos, benefícios.",
        "Gere PDF em lote ou individual.",
        "Envie pelo app (notifica colaborador) ou baixe para envio externo.",
        "Exporte S-1200 no eSocial após liberação.",
      ]},
      { type: "tip", text: "Rode o Checklist Folha até dia 25 do mês para evitar corridas no fechamento." },
    ],
  },
  {
    id: "calculos",
    title: "13. Cálculos Trabalhistas",
    icon: <Calculator className="h-4 w-4" />,
    summary: "Fórmulas base: HE, DSR, provisões, descontos.",
    blocks: [
      { type: "h3", text: "Base salarial" },
      { type: "code", text: "Salário-hora = Salário mensal ÷ (Jornada semanal × 5)\nEx.: R$ 2.200 ÷ (44 × 5) = R$ 10,00 / h" },
      { type: "h3", text: "Hora extra" },
      { type: "code", text: "HE 50% = Salário-hora × 1,5\nHE 100% (dom/feriado) = Salário-hora × 2" },
      { type: "h3", text: "DSR sobre HE" },
      { type: "code", text: "DSR = (Total HE no mês ÷ dias úteis) × domingos+feriados" },
      { type: "h3", text: "Descontos" },
      { type: "list", items: [
        "INSS: tabela progressiva 7,5% / 9% / 12% / 14%.",
        "IRRF: tabela mensal após INSS e dependentes.",
        "VT: até 6% do salário base.",
        "Faltas injustificadas: desconto do dia + reflexo no DSR.",
      ]},
      { type: "h3", text: "Provisões" },
      { type: "code", text: "Férias = Salário ÷ 12 + 1/3 constitucional\n13º = Salário ÷ 12 acumulado por mês trabalhado\nFGTS = 8% sobre salário + HE + adicionais" },
      { type: "warn", text: "Padrão fixo: 22 dias úteis e 1h de almoço. Ajuste em Empresas se sua CLT/CCT for diferente." },
    ],
  },
  {
    id: "desligamento",
    title: "14. Desligamento / Demissão",
    icon: <UserMinus className="h-4 w-4" />,
    summary: "Rescisão, TRCT, aviso prévio e S-2299.",
    blocks: [
      { type: "steps", items: [
        "RH → Colaboradores → abra ficha → 'Desligar'.",
        "Escolha motivo (sem justa causa, com justa causa, pedido, acordo, término contrato).",
        "Sistema calcula: saldo salário, aviso, férias vencidas/proporcionais + 1/3, 13º proporcional, FGTS + multa 40% quando aplicável.",
        "Gere TRCT em PDF para assinatura.",
        "Revogue acesso ao app automaticamente na data do desligamento.",
        "Eventos eSocial gerados: S-2299 (desligamento) e S-1200 (última folha).",
      ]},
      { type: "warn", text: "Sempre confira o motivo antes de finalizar — ele define multa de FGTS e possibilidade de sacar seguro-desemprego." },
    ],
  },
  {
    id: "esocial",
    title: "15. Exportação eSocial",
    icon: <FileCode2 className="h-4 w-4" />,
    summary: "S-1200, S-2200, S-2230, S-2299, S-3000.",
    blocks: [
      { type: "steps", items: [
        "RH → eSocial → aba 'Eventos pendentes'.",
        "Selecione competência e eventos a enviar.",
        "Valide XML gerado (schema oficial do governo).",
        "Envie lote → aguarde protocolo → confirme recebimento.",
        "Guarde recibos por 5 anos no repositório de documentos.",
      ]},
      { type: "list", items: [
        "S-2200: Admissão.",
        "S-2230: Afastamentos temporários (férias, licença).",
        "S-2299: Desligamento.",
        "S-1200: Remuneração mensal.",
        "S-3000: Exclusão de evento enviado com erro.",
      ]},
    ],
  },
  {
    id: "avaliacoes",
    title: "16. Avaliações de Desempenho",
    icon: <Target className="h-4 w-4" />,
    summary: "Ciclos 90/180/360, PDI, matriz 9-Box.",
    blocks: [
      { type: "steps", items: [
        "RH → Avaliações → aba 'Ciclos' → 'Novo ciclo'.",
        "Escolha tipo (90° autoavaliação, 180° gestor, 360° com pares).",
        "Configure competências e pesos.",
        "Abra o ciclo: avaliações são geradas para todos os participantes.",
        "Acompanhe preenchimento pelo dashboard de progresso.",
        "Ao encerrar, sistema consolida pontuação ponderada e posiciona na Matriz 9-Box.",
      ]},
      { type: "list", items: [
        "Metas SMART com progresso auto-calculado.",
        "Feedback contínuo público ou privado.",
        "PDI: plano de desenvolvimento com ações e prazos.",
      ]},
    ],
  },
  {
    id: "rastreamento",
    title: "17. Rastreamento e Mapa",
    icon: <MapPin className="h-4 w-4" />,
    summary: "Localização em tempo real e trajetos históricos.",
    blocks: [
      { type: "list", items: [
        "RH → Mapa: onde cada colaborador está agora.",
        "RH → Rastreamento: trajeto histórico por dia com velocidade e paradas.",
        "RH → Mapa Operacional: heatmap de PDVs visitados.",
        "Geocoding via Nominatim/OSM. Requer GPS ativo no app.",
      ]},
      { type: "warn", text: "Rastreamento respeita LGPD: só é ativo dentro do horário de trabalho configurado." },
    ],
  },
  {
    id: "analytics",
    title: "18. Analytics e Auditoria",
    icon: <LineChart className="h-4 w-4" />,
    summary: "KPIs de RH, logs de alteração, aderência LGPD.",
    blocks: [
      { type: "list", items: [
        "RH → Dashboard: presença, absenteísmo, atrasos, horas trabalhadas, turnover.",
        "RH → Logs & Erros: quem alterou o quê e quando (ajustes de ponto, revogação de acesso, folha).",
        "Filtros por empresa, cargo, PDV, período.",
        "Todos os KPIs no fuso America/Sao_Paulo.",
      ]},
    ],
  },
  {
    id: "solicitacoes",
    title: "19. Solicitações e Autoatendimento",
    icon: <Inbox className="h-4 w-4" />,
    summary: "Colaborador solicita pelo app, gestor aprova.",
    blocks: [
      { type: "list", items: [
        "Tipos: férias, folga, ajuste de ponto, atestado, adiantamento, reembolso.",
        "Colaborador anexa foto/documento pelo app.",
        "Gestor aprova/reprova em RH → Solicitações Admin.",
        "Aprovação executa a ação (agenda férias, registra ponto, gera desconto).",
      ]},
    ],
  },
  {
    id: "checklist-testes",
    title: "20. Checklist Operacional / Testes",
    icon: <ClipboardCheck className="h-4 w-4" />,
    summary: "Rotinas diárias, semanais, mensais e testes de sanidade.",
    blocks: [
      { type: "h3", text: "Diário" },
      { type: "list", items: [
        "Monitor de Ponto ativo no início do turno.",
        "Verificar solicitações pendentes.",
        "Conferir alertas de biometria reprovada.",
      ]},
      { type: "h3", text: "Semanal" },
      { type: "list", items: [
        "Revisar banco de horas.",
        "Fechar advertências abertas.",
        "Backup manual de documentos assinados (opcional).",
      ]},
      { type: "h3", text: "Mensal" },
      { type: "list", items: [
        "Checklist Folha → resolver todas as pendências.",
        "Gerar holerite e enviar.",
        "Exportar eventos eSocial S-1200.",
        "Rodar analytics de turnover.",
      ]},
      { type: "h3", text: "Testes recomendados" },
      { type: "list", items: [
        "Cadastrar colaborador fictício, admitir, bater ponto, gerar holerite e desligar — ciclo completo.",
        "Bater ponto com selfie de foto impressa: deve reprovar.",
        "Bater ponto fora do raio do PDV: deve alertar/reprovar por GPS.",
        "Assinar documento e verificar hash SHA-256 em Verificar Documento.",
      ]},
      { type: "tip", text: "Rode esse checklist ao onboardar um novo administrador de RH — em 1 dia ele entende o módulo inteiro." },
    ],
  },
];

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return <p className="text-sm text-muted-foreground leading-relaxed">{block.text}</p>;
    case "h3":
      return <h3 className="text-sm font-semibold text-foreground mt-4 mb-1">{block.text}</h3>;
    case "steps":
      return (
        <ol className="space-y-2 mt-2">
          {block.items.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                {i + 1}
              </span>
              <span className="text-muted-foreground leading-relaxed pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="space-y-1.5 mt-2">
          {block.items.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-1 shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 flex gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{block.text}</p>
        </div>
      );
    case "warn":
      return (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">{block.text}</p>
        </div>
      );
    case "code":
      return (
        <pre className="mt-2 rounded-lg bg-muted/60 border border-border p-3 text-xs font-mono whitespace-pre-wrap text-foreground overflow-x-auto">
          {block.text}
        </pre>
      );
  }
}

export default function RHDocumentacao() {
  const [active, setActive] = useState(sections[0].id);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.blocks.some((b) => "text" in b
          ? b.text.toLowerCase().includes(q)
          : "items" in b && b.items.some((i) => i.toLowerCase().includes(q))
        )
    );
  }, [query]);

  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Documentação do Módulo de RH</h1>
            <p className="text-sm text-muted-foreground">
              Guia passo a passo de todas as configurações, processos e cálculos do RH.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="secondary">{sections.length} seções</Badge>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/docs/rh-documentacao.md" download="rh-documentacao.md">
              <Download className="h-4 w-4" />
              Baixar Markdown
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar de navegação */}
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar na documentação..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[70vh] lg:h-[calc(100vh-260px)]">
              <nav className="p-2">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={cn(
                      "w-full flex items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors group",
                      active === s.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className={cn(
                      "mt-0.5 shrink-0",
                      active === s.id ? "text-primary" : "text-muted-foreground"
                    )}>
                      {s.icon}
                    </span>
                    <span className="flex-1 leading-tight">{s.title}</span>
                    <ChevronRight className={cn(
                      "h-3.5 w-3.5 mt-0.5 shrink-0 transition-opacity",
                      active === s.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                    )} />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nenhum resultado para "{query}"
                  </p>
                )}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conteúdo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                {current.icon}
              </div>
              <div>
                <CardTitle className="text-xl">{current.title}</CardTitle>
                <CardDescription>{current.summary}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 space-y-2">
            {current.blocks.map((b, i) => (
              <BlockRenderer key={i} block={b} />
            ))}

            {/* Navegação entre seções */}
            <div className="pt-8 mt-8 border-t flex items-center justify-between gap-2">
              {(() => {
                const idx = sections.findIndex((s) => s.id === current.id);
                const prev = sections[idx - 1];
                const next = sections[idx + 1];
                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => setActive(prev.id)}
                        className="text-sm text-muted-foreground hover:text-foreground text-left"
                      >
                        ← {prev.title}
                      </button>
                    ) : <span />}
                    {next ? (
                      <button
                        onClick={() => setActive(next.id)}
                        className="text-sm text-primary hover:underline text-right ml-auto"
                      >
                        {next.title} →
                      </button>
                    ) : <span />}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
