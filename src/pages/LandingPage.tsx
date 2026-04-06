import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  Menu, X, Loader2, ArrowRight, CheckCircle2,
  Smartphone, Brain, MessageSquare, BarChart3,
  Shield, Users, FileText, Zap, Target, Star,
  Camera, ClipboardList, Bot, Send, Building2,
  Lock, AlertTriangle, TrendingUp, Calendar,
  Layers, Clock, Eye, ChevronDown, ChevronUp,
  MapPin, Route, Fingerprint, Navigation, Wallet,
  Monitor, UserCheck, Globe, Radio, Gauge,
} from "lucide-react";

/* ─────────────── SCROLL REVEAL HOOK ─────────────── */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(40px)";
    el.style.transition = "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)";

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(40px)";
    el.style.transition = `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay * 0.12}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay * 0.12}s`;

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}

/* ─────────────── ANIMATED COUNTER ─────────────── */
function CountUp({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) {
          setStarted(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setCount(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ─────────────── STATS BAR ─────────────── */
function StatsBar() {
  const stats = [
    { value: 500, suffix: "+", label: "Promotores gerenciados", icon: Users },
    { value: 98, suffix: "%", label: "Precisão na execução", icon: Target },
    { value: 1200, suffix: "+", label: "PDVs monitorados", icon: Building2 },
    { value: 40, suffix: "%", label: "Redução de km rodados", icon: Route },
  ];

  return (
    <section className="py-16 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60" />
      <div className="mx-auto max-w-6xl px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} delay={i} className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="text-4xl md:text-5xl font-extrabold text-white mb-1">
                  <CountUp end={s.value} suffix={s.suffix} />
                </div>
                <div className="text-violet-200 text-sm font-medium">{s.label}</div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── HERO ─────────────── */
function Hero({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-200/40 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-violet-300/30 blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />

      <div className="mx-auto max-w-6xl px-6 text-center relative z-10">
        <Reveal>
          <Badge className="mb-6 bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100 text-sm px-4 py-1.5">
            Sistema completo para agências de merchandising
          </Badge>
        </Reveal>

        <Reveal delay={1}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-900 max-w-4xl mx-auto">
            Pare de operar promotores no improviso —{" "}
            <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              tenha controle total da operação
            </span>
          </h1>
        </Reveal>

        <Reveal delay={2}>
          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            O Ayratech organiza, automatiza e monitora toda a operação com promotores,
            supervisores e agências, usando IA, WhatsApp, CRM e controle completo de execução.
          </p>
        </Reveal>

        <Reveal delay={3}>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={onCta}
              className="bg-violet-600 hover:bg-violet-700 text-white text-lg px-8 h-14 rounded-xl shadow-lg shadow-violet-200 transition-transform hover:scale-105"
            >
              Quero organizar minha operação <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="border-violet-300 text-violet-700 hover:bg-violet-50 text-lg px-8 h-14 rounded-xl transition-transform hover:scale-105"
            >
              Conheça os recursos
            </Button>
          </div>
        </Reveal>

        <Reveal delay={4}>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            {["IA integrada", "WhatsApp nativo", "CRM completo", "App do promotor", "Controle de acesso", "Rotas por IA", "Rastreamento GPS", "Ponto facial"].map((t, i) => (
              <span key={t} className="flex items-center gap-1.5 transition-all hover:text-violet-600 hover:scale-110 cursor-default">
                <CheckCircle2 className="h-4 w-4 text-violet-500" />{t}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────── PROBLEM ─────────────── */
function ProblemSection() {
  const problems = [
    "Promotor não executa corretamente",
    "Ninguém sabe o que foi feito de verdade",
    "Fotos não são confiáveis",
    "Checklist mal preenchido",
    "Supervisão falha",
    "Comunicação desorganizada",
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-red-50 text-red-600 border-red-200 hover:bg-red-50">O problema</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 max-w-3xl mx-auto">
              Se você depende de planilha, WhatsApp solto e "confiança", você{" "}
              <span className="text-red-500">não tem controle</span> da operação
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {problems.map((p, i) => (
            <Reveal key={p} delay={i}>
              <div className="flex items-start gap-3 bg-white rounded-xl p-5 border border-red-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all hover:-translate-y-1">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <span className="text-gray-700">{p}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={6}>
          <p className="text-center mt-10 text-xl font-semibold text-gray-800 italic">
            "Você não tem visibilidade. Você tem suposição."
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────── SOLUTION ─────────────── */
function SolutionSection() {
  const items = [
    { icon: Shield, text: "Entrada no PDV validada" },
    { icon: ClipboardList, text: "Execução por categoria" },
    { icon: CheckCircle2, text: "Checklist validado" },
    { icon: Camera, text: "Fotos com controle" },
    { icon: Users, text: "Histórico do promotor" },
    { icon: MessageSquare, text: "Comunicação integrada" },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-50">A solução</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 max-w-3xl mx-auto">
              O Ayratech centraliza, valida e acompanha toda a operação{" "}
              <span className="text-violet-600">em tempo real</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, text }, i) => (
            <Reveal key={text} delay={i}>
              <div className="flex items-center gap-4 bg-violet-50/60 rounded-xl p-5 border border-violet-100 hover:shadow-lg hover:border-violet-300 transition-all hover:-translate-y-1 group">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-gray-800 font-medium">{text}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── FEATURE CARD SECTION ─────────────── */
interface FeatureBlock {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  titleHighlight?: string;
  items: string[];
  quote: string;
  icon: any;
  extraItems?: { label: string; items: string[] };
}

const features: FeatureBlock[] = [
  {
    id: "app-promotor",
    badge: "App do Promotor",
    badgeColor: "bg-blue-50 text-blue-600 border-blue-200",
    title: "O promotor executa tudo pelo app, com",
    titleHighlight: "validação real",
    items: [
      "Check-in validado no PDV com geolocalização",
      "Foto obrigatória da categoria antes de iniciar",
      "Checklist por produto com contagem e validade",
      "Múltiplas marcas na mesma rota",
      "Fotos com validação de qualidade por IA",
      "Marca d'água automática com data/hora/local",
      "Ponto natural e ponto extra separados",
      "PWA instalável — funciona como app nativo",
    ],
    quote: "Se não foi validado, não foi executado.",
    icon: Smartphone,
  },
  {
    id: "rotas-ia",
    badge: "Rotas Inteligentes por IA",
    badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
    title: "Criação e otimização de rotas com",
    titleHighlight: "inteligência artificial",
    items: [
      "Sequenciamento automático por geolocalização",
      "Considera endereço do promotor como origem",
      "Cálculo de distância e tempo entre PDVs",
      "Balanceamento de carga operacional diária",
      "Respeita marcas autorizadas por promotor",
      "Comparação plano manual vs. otimizado",
      "Calendário visual de rotas por semana/mês",
      "Duplicação e recorrência de rotas",
    ],
    extraItems: {
      label: "Resultado",
      items: ["Menos km rodados", "Mais PDVs atendidos", "Operação equilibrada"],
    },
    quote: "A IA planeja. Você aprova. O promotor executa.",
    icon: Route,
  },
  {
    id: "mapas",
    badge: "Mapas & Rastreamento GPS",
    badgeColor: "bg-sky-50 text-sky-600 border-sky-200",
    title: "Saiba onde está cada promotor e",
    titleHighlight: "o que ele está fazendo",
    items: [
      "Mapa em tempo real com todos os promotores",
      "Status ao vivo: em rota, no PDV, em deslocamento",
      "Histórico de trajetos com playback",
      "Marcadores de início e fim do expediente",
      "Nível de bateria e status de movimento",
      "Controle de velocidade de reprodução (0.5x a 10x)",
      "Filtro por promotor, marca e região",
    ],
    quote: "Você não pergunta mais. Você já sabe onde ele está.",
    icon: MapPin,
  },
  {
    id: "rh",
    badge: "RH Completo",
    badgeColor: "bg-teal-50 text-teal-600 border-teal-200",
    title: "Gestão de equipe completa",
    titleHighlight: "em um só lugar",
    items: [
      "Cadastro de colaboradores (CLT, PJ, Freelancer)",
      "Hierarquia: departamentos, cargos e filiais",
      "Controle de documentos e holerites",
      "Assinatura digital com validade jurídica",
      "Contratos e termos automatizados",
      "Vínculo obrigatório de supervisor",
      "Perfil funcional e controle de acesso ao app",
      "Auditoria e conformidade LGPD",
    ],
    quote: "Menos papel. Mais controle. Tudo em um lugar.",
    icon: FileText,
  },
  {
    id: "ponto-facial",
    badge: "Ponto por Reconhecimento Facial",
    badgeColor: "bg-rose-50 text-rose-600 border-rose-200",
    title: "Registro de ponto validado por",
    titleHighlight: "biometria facial e geolocalização",
    items: [
      "Reconhecimento facial com IA para bater ponto",
      "Geolocalização obrigatória no registro",
      "Fotos de entrada e saída armazenadas",
      "Dashboard de monitoramento em tempo real",
      "Controle de horas extras e banco de horas",
      "Relatório de frequência por período",
      "Fallback manual com justificativa",
      "Integração com módulo de RH",
    ],
    quote: "Ponto batido com rosto e localização. Sem fraude.",
    icon: Fingerprint,
  },
  {
    id: "ia",
    badge: "IA na Operação",
    badgeColor: "bg-purple-50 text-purple-600 border-purple-200",
    title: "A operação não depende mais só do promotor —",
    titleHighlight: "a IA valida e analisa tudo",
    items: [
      "Análise automática de fotos de execução",
      "Identificação de padrões e anomalias",
      "Detecção de comportamento fora do normal",
      "Interpretação de ocorrências (texto e áudio)",
      "Geração de resumos automáticos",
      "Secretária virtual com agendamento",
      "Múltiplos provedores: OpenAI, Gemini, OpenRouter",
    ],
    quote: "A IA garante que o controle aconteça.",
    icon: Brain,
  },
  {
    id: "whatsapp",
    badge: "WhatsApp Integrado",
    badgeColor: "bg-green-50 text-green-600 border-green-200",
    title: "Toda a comunicação centralizada no WhatsApp, com",
    titleHighlight: "CRM e IA",
    items: [
      "Chat com múltiplos atendentes simultâneos",
      "Departamentos e distribuição automática",
      "Histórico completo de conversas",
      "Agentes de IA com respostas automáticas",
      "Triagem inteligente por contexto",
      "Integração nativa com CRM e pipeline",
    ],
    extraItems: {
      label: "IA no WhatsApp",
      items: ["Transcrição de áudio", "Análise de imagens", "Base de conhecimento RAG"],
    },
    quote: "Não é mais conversa solta. É operação organizada.",
    icon: MessageSquare,
  },
  {
    id: "crm",
    badge: "CRM & Kanban",
    badgeColor: "bg-orange-50 text-orange-600 border-orange-200",
    title: "Controle total da operação com",
    titleHighlight: "CRM e gestão visual",
    items: [
      "Kanban e Pipeline visuais",
      "Campos personalizados por negociação",
      "Gestão de empresas com busca por CNPJ",
      "Análise preditiva de saúde do deal",
      "Tarefas e acompanhamento integrados",
      "Relatórios de performance e conversão",
    ],
    quote: "Você vê a operação acontecendo.",
    icon: BarChart3,
  },
  {
    id: "score",
    badge: "Score de Promotor",
    badgeColor: "bg-amber-50 text-amber-600 border-amber-200",
    title: "Cada promotor tem um score baseado no",
    titleHighlight: "comportamento real",
    items: [
      "Ocorrências registradas por supervisores",
      "Qualidade e completude da execução",
      "Tempo de permanência no PDV",
      "Padrão de comportamento ao longo do tempo",
      "Inconsistências de acesso detectadas",
    ],
    extraItems: {
      label: "Consequência automática",
      items: ["Identificação de risco", "Bloqueio automático", "Agência notificada", "Substituição obrigatória"],
    },
    quote: "Você evita o problema antes dele acontecer.",
    icon: Target,
  },
  {
    id: "automacao",
    badge: "Automação & Fluxos",
    badgeColor: "bg-indigo-50 text-indigo-600 border-indigo-200",
    title: "Automatize processos com",
    titleHighlight: "fluxos inteligentes",
    items: [
      "Chatbots e fluxos de atendimento",
      "Campanhas programadas via WhatsApp",
      "Lembretes e notificações automáticas",
      "Nurturing de leads com sequências",
      "Webhooks e integrações externas",
    ],
    quote: "Menos trabalho manual. Mais eficiência.",
    icon: Zap,
  },
  {
    id: "relatorios",
    badge: "Relatórios & Analytics",
    badgeColor: "bg-cyan-50 text-cyan-600 border-cyan-200",
    title: "Relatórios completos com",
    titleHighlight: "análise real da operação",
    items: [
      "Execução por promotor e por PDV",
      "Produtividade por marca e região",
      "Análise de falhas e inconsistências",
      "Dashboards visuais com gráficos",
      "Exportação em Excel e PDF",
      "Análise assistida por IA",
    ],
    quote: "Você entende a operação com dados reais.",
    icon: TrendingUp,
  },
];

function FeatureSection({ f, index }: { f: FeatureBlock; index: number }) {
  const Icon = f.icon;
  const isEven = index % 2 === 0;

  return (
    <section id={f.id} className={`py-16 ${isEven ? "bg-white" : "bg-gray-50/60"}`}>
      <div className="mx-auto max-w-6xl px-6">
        <div className={`flex flex-col lg:flex-row gap-10 items-center ${!isEven ? "lg:flex-row-reverse" : ""}`}>
          {/* Icon side */}
          <Reveal delay={0} className="lg:w-5/12 flex justify-center">
            <div className="relative group">
              <div className="h-48 w-48 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-50 flex items-center justify-center shadow-lg shadow-violet-100/50 group-hover:shadow-xl group-hover:shadow-violet-200/60 transition-all group-hover:scale-105">
                <Icon className="h-20 w-20 text-violet-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform">
                {String(index + 1).padStart(2, "0")}
              </div>
            </div>
          </Reveal>

          {/* Content side */}
          <Reveal delay={2} className="lg:w-7/12">
            <Badge className={`mb-3 ${f.badgeColor} hover:opacity-90`}>{f.badge}</Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              {f.title}{" "}
              {f.titleHighlight && <span className="text-violet-600">{f.titleHighlight}</span>}
            </h2>

            <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
              {f.items.map((item, i) => (
                <div key={item} className="flex items-center gap-2.5 hover:translate-x-1 transition-transform">
                  <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-gray-700 text-sm">{item}</span>
                </div>
              ))}
            </div>

            {f.extraItems && (
              <div className="mt-4 bg-violet-50/70 rounded-xl p-4 border border-violet-100">
                <p className="text-sm font-semibold text-violet-700 mb-2">{f.extraItems.label}:</p>
                <div className="flex flex-wrap gap-2">
                  {f.extraItems.items.map(ei => (
                    <span key={ei} className="text-xs bg-white rounded-full px-3 py-1 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">
                      {ei}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-lg font-semibold text-gray-800 italic border-l-4 border-violet-400 pl-4">
              "{f.quote}"
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── COMMERCIAL MODEL ─────────────── */
function CommercialModelSection() {
  const cards = [
    { icon: Wallet, title: "Setup personalizado", desc: "Implantação e treinamento adaptados à realidade e ao tamanho da sua operação." },
    { icon: Users, title: "Por equipe ativa", desc: "Valor baseado na quantidade de promotores e na complexidade da operação.", highlight: true },
    { icon: Gauge, title: "Tudo incluso", desc: "IA, WhatsApp, CRM, rotas, mapas, RH, ponto facial — tudo na mesma plataforma." },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-50">Modelo comercial</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Valores e implantação{" "}
              <span className="text-violet-600">sob consulta</span>
            </h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              Cada operação é única. O setup, treinamento e valor variam de acordo com o tamanho da equipe e as necessidades da sua agência.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} delay={i}>
                <div className={`bg-white rounded-2xl p-8 border shadow-sm text-center hover:shadow-lg hover:-translate-y-2 transition-all ${c.highlight ? "border-violet-200 ring-2 ring-violet-100" : "border-gray-200"}`}>
                  <div className="h-14 w-14 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-violet-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{c.title}</h3>
                  <p className="text-gray-600 text-sm">{c.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={3}>
          <p className="text-center mt-10 text-lg font-semibold text-gray-800 italic">
            "Fale com nosso time e receba uma proposta personalizada para a sua agência."
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────── POSITIONING ─────────────── */
function PositioningSection({ onCta }: { onCta: () => void }) {
  return (
    <section className="py-20 bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60" />
      <div className="mx-auto max-w-4xl px-6 text-center relative z-10">
        <Reveal>
          <Star className="h-10 w-10 mx-auto mb-6 text-violet-200" />
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Um sistema completo para quem quer crescer com operação organizada
          </h2>
          <p className="text-lg text-violet-100 mb-4 max-w-2xl mx-auto">
            O Ayratech não é só uma ferramenta.
            É a base para estruturar uma operação profissional de merchandising.
          </p>
          <p className="text-xl font-semibold text-white/90 italic mb-10">
            "Se sua operação depende de pessoas, ela precisa de controle."
          </p>
          <Button
            size="lg"
            onClick={onCta}
            className="bg-white text-violet-700 hover:bg-violet-50 text-lg px-10 h-14 rounded-xl shadow-lg font-semibold transition-transform hover:scale-105"
          >
            Quero implementar o Ayratech na minha agência <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────── FAQ ─────────────── */
function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: "O sistema funciona para qualquer tamanho de agência?", a: "Sim, o Ayratech atende desde agências com 5 promotores até operações com centenas de profissionais em campo, com escalabilidade total." },
    { q: "Como funciona a contratação?", a: "Os valores e a implantação são sob consulta, variando de acordo com o tamanho da equipe e as necessidades de treinamento. Entre em contato para uma proposta personalizada." },
    { q: "Precisa instalar algo no supermercado?", a: "O totem de acesso roda em qualquer tablet comum com navegador. Não exige hardware especial." },
    { q: "O promotor precisa de um celular especial?", a: "Não. O app funciona como PWA em qualquer smartphone Android ou iOS com câmera e GPS." },
    { q: "A IA substitui o supervisor?", a: "Não. A IA complementa a supervisão humana, identificando padrões, validando fotos e detectando anomalias que passariam despercebidas." },
    { q: "Como funciona o reconhecimento facial?", a: "O sistema utiliza IA para comparar a selfie do promotor com a foto cadastrada, validando identidade no registro de ponto e no acesso ao PDV." },
    { q: "As rotas por IA funcionam com qualquer quantidade de PDVs?", a: "Sim. A otimização considera distância, tempo de deslocamento, mix de produtos e carga operacional, independente do volume." },
    { q: "Posso integrar com o sistema do supermercado?", a: "Sim, a plataforma oferece integração nativa com PDVs e redes de supermercados para controle completo da operação." },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Perguntas frequentes</h2>
        </Reveal>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i}>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium text-gray-800">{faq.q}</span>
                  {open === i ? <ChevronUp className="h-5 w-5 text-violet-500" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: open === i ? "200px" : "0", opacity: open === i ? 1 : 0 }}
                >
                  <div className="px-5 pb-5 pt-0 text-gray-600 text-sm leading-relaxed">{faq.a}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── CONTACT FORM ─────────────── */
function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error("Preencha nome e telefone");
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/leads/landing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "landing-agencia" }),
      });
      toast.success("Recebemos seu contato! Entraremos em breve.");
      setForm({ name: "", email: "", phone: "", company: "" });
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contato" className="py-20">
      <div className="mx-auto max-w-xl px-6">
        <Reveal>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">
            Quero implementar o Ayratech
          </h2>
          <p className="text-center text-gray-500 mb-10">Preencha e nossa equipe entra em contato</p>
        </Reveal>

        <Reveal delay={1}>
          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <Label className="text-gray-700">Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700">E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700">Telefone / WhatsApp *</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700">Agência / Empresa</Label>
              <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Nome da sua agência" className="mt-1" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 rounded-xl text-base transition-transform hover:scale-[1.02]">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enviar <Send className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────── NAVBAR ─────────────── */
function Navbar({ onCta }: { onCta: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-200/60" : "bg-white/80 backdrop-blur-lg border-b border-gray-200/60"}`}>
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-extrabold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Ayratech
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          {[
            { label: "Recursos", href: "#features" },
            { label: "Modelo", href: "#modelo" },
            { label: "FAQ", href: "#faq" },
            { label: "Contato", href: "#contato" },
          ].map(l => (
            <a key={l.href} href={l.href} className="hover:text-violet-600 transition-colors">{l.label}</a>
          ))}
          <Link to="/login">
            <Button variant="outline" size="sm" className="border-violet-300 text-violet-600 hover:bg-violet-50">
              Entrar
            </Button>
          </Link>
          <Button size="sm" onClick={onCta} className="bg-violet-600 hover:bg-violet-700 text-white">
            Começar agora
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-6 py-4 space-y-3">
          <a href="#features" className="block text-gray-700" onClick={() => setMenuOpen(false)}>Recursos</a>
          <a href="#faq" className="block text-gray-700" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="#contato" className="block text-gray-700" onClick={() => setMenuOpen(false)}>Contato</a>
          <Link to="/login" className="block text-violet-600 font-medium">Entrar</Link>
          <Button onClick={() => { onCta(); setMenuOpen(false); }} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            Começar agora
          </Button>
        </div>
      )}
    </nav>
  );
}

/* ─────────────── FOOTER ─────────────── */
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="text-xl font-extrabold text-white">Ayratech</span>
            <p className="text-sm mt-1">Sistema completo para agências de merchandising</p>
          </div>
          <div className="flex gap-6 text-sm">
            <Link to="/politica-privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            <Link to="/termos-servico" className="hover:text-white transition-colors">Termos</Link>
            <a href="#contato" className="hover:text-white transition-colors">Contato</a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Ayratech. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── MAIN PAGE ─────────────── */
export default function LandingPage() {
  const scrollToContact = () => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-white">
      <Navbar onCta={scrollToContact} />
      <Hero onCta={scrollToContact} />
      <StatsBar />
      <ProblemSection />
      <SolutionSection />

      <div id="features">
        {features.map((f, i) => (
          <FeatureSection key={f.id} f={f} index={i} />
        ))}
      </div>

      <div id="modelo"><CommercialModelSection /></div>
      <PositioningSection onCta={scrollToContact} />
      <div id="faq"><FAQSection /></div>
      <ContactSection />
      <Footer />
    </div>
  );
}
