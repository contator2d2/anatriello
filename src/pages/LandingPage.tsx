import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/lib/api";
import { toast } from "sonner";
import ayratechLogo from "@/assets/ayratech-logo.jpg";
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

/* ─────── Reveal ─────── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(36px)";
    el.style.transition = `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay * 0.12}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay * 0.12}s`;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateY(0)"; obs.unobserve(el); } },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}

/* ─────── CountUp ─────── */
function CountUp({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { setStarted(true); obs.unobserve(el); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);
  return <span ref={ref}>{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ─────── Glow line separator ─────── */
function GlowDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />;
}

/* ─────── HERO ─────── */
function Hero({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 lg:pt-44 lg:pb-32">
      {/* Animated gradient blobs */}
      <div className="pointer-events-none absolute -top-60 -right-60 h-[700px] w-[700px] rounded-full bg-violet-600/15 blur-[150px] animate-pulse" style={{ animationDuration: "6s" }} />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-purple-500/8 blur-[100px]" />

      <div className="mx-auto max-w-6xl px-6 text-center relative z-10">
        <Reveal>
          <div className="flex justify-center mb-8">
            <img src={ayratechLogo} alt="Ayratech" className="h-28 md:h-36 rounded-2xl shadow-2xl shadow-violet-500/20" />
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-full px-5 py-2 text-sm font-medium mb-6 backdrop-blur-sm">
            <Zap className="h-4 w-4 text-orange-400" />
            Sistema completo para agências de merchandising
          </div>
        </Reveal>

        <Reveal delay={2}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight max-w-4xl mx-auto">
            <span className="text-white">Pare de operar promotores no improviso — </span>
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
              tenha controle total da operação
            </span>
          </h1>
        </Reveal>

        <Reveal delay={3}>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            O Ayratech organiza, automatiza e monitora toda a operação com promotores,
            supervisores e agências, usando IA, WhatsApp, CRM e controle completo de execução.
          </p>
        </Reveal>

        <Reveal delay={4}>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={onCta}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-lg px-8 h-14 rounded-xl shadow-lg shadow-violet-500/25 transition-all hover:scale-105 hover:shadow-violet-500/40 border border-violet-500/30"
            >
              Quero organizar minha operação <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white text-lg px-8 h-14 rounded-xl transition-all hover:scale-105 bg-transparent"
            >
              Conheça os recursos
            </Button>
          </div>
        </Reveal>

        <Reveal delay={5}>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            {["IA integrada", "WhatsApp nativo", "CRM completo", "App do promotor", "Controle de acesso", "Rotas por IA", "Rastreamento GPS", "Ponto facial"].map(t => (
              <span key={t} className="flex items-center gap-1.5 hover:text-violet-400 transition-colors cursor-default">
                <CheckCircle2 className="h-4 w-4 text-violet-500" />{t}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────── STATS BAR ─────── */
function StatsBar() {
  const stats = [
    { value: 500, suffix: "+", label: "Promotores gerenciados", icon: Users },
    { value: 98, suffix: "%", label: "Precisão na execução", icon: Target },
    { value: 1200, suffix: "+", label: "PDVs monitorados", icon: Building2 },
    { value: 40, suffix: "%", label: "Redução de km rodados", icon: Route },
  ];

  return (
    <section className="py-16 relative overflow-hidden border-y border-gray-800">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 via-purple-600/10 to-orange-500/5" />
      <div className="mx-auto max-w-6xl px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} delay={i} className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-violet-400" />
                  </div>
                </div>
                <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent mb-1">
                  <CountUp end={s.value} suffix={s.suffix} />
                </div>
                <div className="text-gray-500 text-sm font-medium">{s.label}</div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────── PROBLEM ─────── */
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
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">O problema</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white max-w-3xl mx-auto mt-3">
              Se você depende de planilha, WhatsApp solto e "confiança", você{" "}
              <span className="text-red-400">não tem controle</span> da operação
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {problems.map((p, i) => (
            <Reveal key={p} delay={i}>
              <div className="flex items-start gap-3 bg-red-500/5 rounded-xl p-5 border border-red-500/15 hover:border-red-500/30 hover:bg-red-500/10 transition-all hover:-translate-y-1">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <span className="text-gray-300">{p}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={6}>
          <p className="text-center mt-10 text-xl font-semibold text-gray-300 italic">
            "Você não tem visibilidade. <span className="text-red-400">Você tem suposição.</span>"
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────── SOLUTION ─────── */
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
            <span className="text-sm font-semibold text-violet-400 uppercase tracking-wider">A solução</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white max-w-3xl mx-auto mt-3">
              O Ayratech centraliza, valida e acompanha toda a operação{" "}
              <span className="bg-gradient-to-r from-violet-400 to-orange-400 bg-clip-text text-transparent">em tempo real</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, text }, i) => (
            <Reveal key={text} delay={i}>
              <div className="flex items-center gap-4 bg-gray-900/60 rounded-xl p-5 border border-gray-800 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 transition-all hover:-translate-y-1 group">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 text-white group-hover:scale-110 transition-transform shadow-lg shadow-violet-500/20">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-gray-200 font-medium">{text}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────── FEATURES ─────── */
interface FeatureBlock {
  id: string; badge: string; badgeColor: string; title: string; titleHighlight?: string;
  items: string[]; quote: string; icon: any; extraItems?: { label: string; items: string[] };
}

const features: FeatureBlock[] = [
  { id: "app-promotor", badge: "App do Promotor", badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20", title: "O promotor executa tudo pelo app, com", titleHighlight: "validação real", items: ["Check-in validado no PDV com geolocalização", "Foto obrigatória da categoria antes de iniciar", "Checklist por produto com contagem e validade", "Múltiplas marcas na mesma rota", "Fotos com validação de qualidade por IA", "Marca d'água automática com data/hora/local", "Ponto natural e ponto extra separados", "PWA instalável — funciona como app nativo"], quote: "Se não foi validado, não foi executado.", icon: Smartphone },
  { id: "rotas-ia", badge: "Rotas Inteligentes por IA", badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", title: "Criação e otimização de rotas com", titleHighlight: "inteligência artificial", items: ["Sequenciamento automático por geolocalização", "Considera endereço do promotor como origem", "Cálculo de distância e tempo entre PDVs", "Balanceamento de carga operacional diária", "Respeita marcas autorizadas por promotor", "Comparação plano manual vs. otimizado", "Calendário visual de rotas por semana/mês", "Duplicação e recorrência de rotas"], extraItems: { label: "Resultado", items: ["Menos km rodados", "Mais PDVs atendidos", "Operação equilibrada"] }, quote: "A IA planeja. Você aprova. O promotor executa.", icon: Route },
  { id: "mapas", badge: "Mapas & Rastreamento GPS", badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/20", title: "Saiba onde está cada promotor e", titleHighlight: "o que ele está fazendo", items: ["Mapa em tempo real com todos os promotores", "Status ao vivo: em rota, no PDV, em deslocamento", "Histórico de trajetos com playback", "Marcadores de início e fim do expediente", "Nível de bateria e status de movimento", "Controle de velocidade de reprodução (0.5x a 10x)", "Filtro por promotor, marca e região"], quote: "Você não pergunta mais. Você já sabe onde ele está.", icon: MapPin },
  { id: "rh", badge: "RH Completo", badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20", title: "Gestão de equipe completa", titleHighlight: "em um só lugar", items: ["Cadastro de colaboradores (CLT, PJ, Freelancer)", "Hierarquia: departamentos, cargos e filiais", "Controle de documentos e holerites", "Assinatura digital com validade jurídica", "Contratos e termos automatizados", "Vínculo obrigatório de supervisor", "Perfil funcional e controle de acesso ao app", "Auditoria e conformidade LGPD"], quote: "Menos papel. Mais controle. Tudo em um lugar.", icon: FileText },
  { id: "ponto-facial", badge: "Ponto por Reconhecimento Facial", badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20", title: "Registro de ponto validado por", titleHighlight: "biometria facial e geolocalização", items: ["Reconhecimento facial com IA para bater ponto", "Geolocalização obrigatória no registro", "Fotos de entrada e saída armazenadas", "Dashboard de monitoramento em tempo real", "Controle de horas extras e banco de horas", "Relatório de frequência por período", "Fallback manual com justificativa", "Integração com módulo de RH"], quote: "Ponto batido com rosto e localização. Sem fraude.", icon: Fingerprint },
  { id: "ia", badge: "IA na Operação", badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20", title: "A operação não depende mais só do promotor —", titleHighlight: "a IA valida e analisa tudo", items: ["Análise automática de fotos de execução", "Identificação de padrões e anomalias", "Detecção de comportamento fora do normal", "Interpretação de ocorrências (texto e áudio)", "Geração de resumos automáticos", "Secretária virtual com agendamento", "Múltiplos provedores: OpenAI, Gemini, OpenRouter"], quote: "A IA garante que o controle aconteça.", icon: Brain },
  { id: "whatsapp", badge: "WhatsApp Integrado", badgeColor: "bg-green-500/10 text-green-400 border-green-500/20", title: "Toda a comunicação centralizada no WhatsApp, com", titleHighlight: "CRM e IA", items: ["Chat com múltiplos atendentes simultâneos", "Departamentos e distribuição automática", "Histórico completo de conversas", "Agentes de IA com respostas automáticas", "Triagem inteligente por contexto", "Integração nativa com CRM e pipeline"], extraItems: { label: "IA no WhatsApp", items: ["Transcrição de áudio", "Análise de imagens", "Base de conhecimento RAG"] }, quote: "Não é mais conversa solta. É operação organizada.", icon: MessageSquare },
  { id: "crm", badge: "CRM & Kanban", badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20", title: "Controle total da operação com", titleHighlight: "CRM e gestão visual", items: ["Kanban e Pipeline visuais", "Campos personalizados por negociação", "Gestão de empresas com busca por CNPJ", "Análise preditiva de saúde do deal", "Tarefas e acompanhamento integrados", "Relatórios de performance e conversão"], quote: "Você vê a operação acontecendo.", icon: BarChart3 },
  { id: "score", badge: "Score de Promotor", badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20", title: "Cada promotor tem um score baseado no", titleHighlight: "comportamento real", items: ["Ocorrências registradas por supervisores", "Qualidade e completude da execução", "Tempo de permanência no PDV", "Padrão de comportamento ao longo do tempo", "Inconsistências de acesso detectadas"], extraItems: { label: "Consequência automática", items: ["Identificação de risco", "Bloqueio automático", "Agência notificada", "Substituição obrigatória"] }, quote: "Você evita o problema antes dele acontecer.", icon: Target },
  { id: "automacao", badge: "Automação & Fluxos", badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", title: "Automatize processos com", titleHighlight: "fluxos inteligentes", items: ["Chatbots e fluxos de atendimento", "Campanhas programadas via WhatsApp", "Lembretes e notificações automáticas", "Nurturing de leads com sequências", "Webhooks e integrações externas"], quote: "Menos trabalho manual. Mais eficiência.", icon: Zap },
  { id: "relatorios", badge: "Relatórios & Analytics", badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", title: "Relatórios completos com", titleHighlight: "análise real da operação", items: ["Execução por promotor e por PDV", "Produtividade por marca e região", "Análise de falhas e inconsistências", "Dashboards visuais com gráficos", "Exportação em Excel e PDF", "Análise assistida por IA"], quote: "Você entende a operação com dados reais.", icon: TrendingUp },
];

function FeatureSection({ f, index }: { f: FeatureBlock; index: number }) {
  const Icon = f.icon;
  const isEven = index % 2 === 0;

  return (
    <section id={f.id} className={`py-16 ${isEven ? "" : "bg-gray-900/40"}`}>
      <div className="mx-auto max-w-6xl px-6">
        <div className={`flex flex-col lg:flex-row gap-10 items-center ${!isEven ? "lg:flex-row-reverse" : ""}`}>
          <Reveal delay={0} className="lg:w-5/12 flex justify-center">
            <div className="relative group">
              <div className="h-48 w-48 rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center shadow-2xl shadow-violet-500/10 group-hover:shadow-violet-500/20 group-hover:border-violet-500/30 transition-all group-hover:scale-105">
                <Icon className="h-20 w-20 text-violet-400 group-hover:text-violet-300 transition-colors" />
              </div>
              <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                {String(index + 1).padStart(2, "0")}
              </div>
              {/* Glow behind */}
              <div className="absolute inset-0 rounded-3xl bg-violet-500/5 blur-xl -z-10 group-hover:bg-violet-500/10 transition-all" />
            </div>
          </Reveal>

          <Reveal delay={2} className="lg:w-7/12">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${f.badgeColor}`}>{f.badge}</span>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 mt-3">
              {f.title}{" "}
              {f.titleHighlight && <span className="bg-gradient-to-r from-violet-400 to-orange-400 bg-clip-text text-transparent">{f.titleHighlight}</span>}
            </h2>

            <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
              {f.items.map(item => (
                <div key={item} className="flex items-center gap-2.5 hover:translate-x-1 transition-transform">
                  <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-gray-400 text-sm">{item}</span>
                </div>
              ))}
            </div>

            {f.extraItems && (
              <div className="mt-4 bg-violet-500/5 rounded-xl p-4 border border-violet-500/15">
                <p className="text-sm font-semibold text-violet-400 mb-2">{f.extraItems.label}:</p>
                <div className="flex flex-wrap gap-2">
                  {f.extraItems.items.map(ei => (
                    <span key={ei} className="text-xs bg-gray-800 rounded-full px-3 py-1 text-violet-300 border border-violet-500/20 hover:bg-violet-500/10 transition-colors">
                      {ei}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-lg font-semibold text-gray-300 italic border-l-4 border-violet-500 pl-4">
              "{f.quote}"
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────── COMMERCIAL MODEL ─────── */
function CommercialModelSection() {
  const cards = [
    { icon: Wallet, title: "Setup personalizado", desc: "Implantação e treinamento adaptados à realidade e ao tamanho da sua operação." },
    { icon: Users, title: "Por equipe ativa", desc: "Valor baseado na quantidade de promotores e na complexidade da operação.", highlight: true },
    { icon: Gauge, title: "Tudo incluso", desc: "IA, WhatsApp, CRM, rotas, mapas, RH, ponto facial — tudo na mesma plataforma." },
  ];

  return (
    <section className="py-20 bg-gray-900/40">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-violet-400 uppercase tracking-wider">Modelo comercial</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
              Valores e implantação{" "}
              <span className="bg-gradient-to-r from-violet-400 to-orange-400 bg-clip-text text-transparent">sob consulta</span>
            </h2>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">
              Cada operação é única. O setup, treinamento e valor variam de acordo com o tamanho da equipe e as necessidades da sua agência.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} delay={i}>
                <div className={`bg-gray-900/80 rounded-2xl p-8 border text-center hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-2 transition-all ${c.highlight ? "border-violet-500/30 shadow-lg shadow-violet-500/10" : "border-gray-800"}`}>
                  <div className="h-14 w-14 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">{c.title}</h3>
                  <p className="text-gray-400 text-sm">{c.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={3}>
          <p className="text-center mt-10 text-lg font-semibold text-gray-300 italic">
            "Fale com nosso time e receba uma proposta personalizada para a sua agência."
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────── POSITIONING ─────── */
function PositioningSection({ onCta }: { onCta: () => void }) {
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-purple-600/15 to-orange-500/10" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')]" />
      <div className="mx-auto max-w-4xl px-6 text-center relative z-10">
        <Reveal>
          <Star className="h-10 w-10 mx-auto mb-6 text-orange-400" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Um sistema completo para quem quer crescer com operação organizada
          </h2>
          <p className="text-lg text-gray-400 mb-4 max-w-2xl mx-auto">
            O Ayratech não é só uma ferramenta.
            É a base para estruturar uma operação profissional de merchandising.
          </p>
          <p className="text-xl font-semibold text-gray-300 italic mb-10">
            "Se sua operação depende de pessoas, ela precisa de controle."
          </p>
          <Button
            size="lg"
            onClick={onCta}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-lg px-10 h-14 rounded-xl shadow-lg shadow-violet-500/25 font-semibold transition-all hover:scale-105 border border-violet-500/30"
          >
            Quero implementar o Ayratech na minha agência <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────── FAQ ─────── */
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
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <h2 className="text-3xl font-bold text-center text-white mb-12">Perguntas frequentes</h2>
        </Reveal>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i}>
              <div className="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors">
                <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-medium text-gray-200">{faq.q}</span>
                  {open === i ? <ChevronUp className="h-5 w-5 text-violet-400" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
                </button>
                <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open === i ? "200px" : "0", opacity: open === i ? 1 : 0 }}>
                  <div className="px-5 pb-5 pt-0 text-gray-400 text-sm leading-relaxed">{faq.a}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────── CONTACT ─────── */
function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error("Preencha nome e telefone"); return; }
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/leads/landing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, source: "landing-agencia" }) });
      toast.success("Recebemos seu contato! Entraremos em breve.");
      setForm({ name: "", email: "", phone: "", company: "" });
    } catch { toast.error("Erro ao enviar. Tente novamente."); }
    finally { setLoading(false); }
  };

  return (
    <section id="contato" className="py-20">
      <div className="mx-auto max-w-xl px-6">
        <Reveal>
          <h2 className="text-3xl font-bold text-center text-white mb-3">Quero implementar o Ayratech</h2>
          <p className="text-center text-gray-500 mb-10">Preencha e nossa equipe entra em contato</p>
        </Reveal>

        <Reveal delay={1}>
          <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900/60 p-8 rounded-2xl border border-gray-800 shadow-2xl shadow-violet-500/5">
            <div>
              <Label className="text-gray-300">Nome *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" className="mt-1 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500" />
            </div>
            <div>
              <Label className="text-gray-300">E-mail</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" className="mt-1 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500" />
            </div>
            <div>
              <Label className="text-gray-300">Telefone / WhatsApp *</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="mt-1 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500" />
            </div>
            <div>
              <Label className="text-gray-300">Agência / Empresa</Label>
              <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Nome da sua agência" className="mt-1 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white h-12 rounded-xl text-base transition-all hover:scale-[1.02] shadow-lg shadow-violet-500/20 border border-violet-500/30">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enviar <Send className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────── NAVBAR ─────── */
function Navbar({ onCta }: { onCta: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-gray-950/95 backdrop-blur-lg shadow-lg shadow-black/20 border-b border-gray-800" : "bg-transparent"}`}>
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-extrabold bg-gradient-to-r from-violet-400 to-orange-400 bg-clip-text text-transparent">
          Ayratech
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          {[
            { label: "Recursos", href: "#features" },
            { label: "Modelo", href: "#modelo" },
            { label: "FAQ", href: "#faq" },
            { label: "Contato", href: "#contato" },
          ].map(l => (
            <a key={l.href} href={l.href} className="hover:text-violet-400 transition-colors">{l.label}</a>
          ))}
          <Link to="/login">
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white bg-transparent">
              Entrar
            </Button>
          </Link>
          <Button size="sm" onClick={onCta} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border border-violet-500/30">
            Começar agora
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="h-6 w-6 text-gray-300" /> : <Menu className="h-6 w-6 text-gray-300" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 px-6 py-4 space-y-3">
          <a href="#features" className="block text-gray-300" onClick={() => setMenuOpen(false)}>Recursos</a>
          <a href="#faq" className="block text-gray-300" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="#contato" className="block text-gray-300" onClick={() => setMenuOpen(false)}>Contato</a>
          <Link to="/login" className="block text-violet-400 font-medium">Entrar</Link>
          <Button onClick={() => { onCta(); setMenuOpen(false); }} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white">
            Começar agora
          </Button>
        </div>
      )}
    </nav>
  );
}

/* ─────── FOOTER ─────── */
function Footer() {
  return (
    <footer className="border-t border-gray-800 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-violet-400 to-orange-400 bg-clip-text text-transparent">Ayratech</span>
            <p className="text-sm mt-1 text-gray-500">Sistema completo para agências de merchandising</p>
          </div>
          <div className="flex gap-6 text-sm">
            <Link to="/politica-privacidade" className="text-gray-500 hover:text-gray-300 transition-colors">Privacidade</Link>
            <Link to="/termos-servico" className="text-gray-500 hover:text-gray-300 transition-colors">Termos</Link>
            <a href="#contato" className="text-gray-500 hover:text-gray-300 transition-colors">Contato</a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Ayratech. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

/* ─────── MAIN ─────── */
export default function LandingPage() {
  const scrollToContact = () => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Navbar onCta={scrollToContact} />
      <Hero onCta={scrollToContact} />
      <StatsBar />
      <GlowDivider />
      <ProblemSection />
      <GlowDivider />
      <SolutionSection />
      <GlowDivider />

      <div id="features">
        {features.map((f, i) => (
          <FeatureSection key={f.id} f={f} index={i} />
        ))}
      </div>

      <GlowDivider />
      <div id="modelo"><CommercialModelSection /></div>
      <GlowDivider />
      <PositioningSection onCta={scrollToContact} />
      <GlowDivider />
      <div id="faq"><FAQSection /></div>
      <GlowDivider />
      <ContactSection />
      <Footer />
    </div>
  );
}
