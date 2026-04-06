import { useState } from "react";
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
} from "lucide-react";

/* ─────────────── HERO ─────────────── */
function Hero({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
      {/* Subtle decorative blobs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-violet-300/30 blur-3xl" />

      <div className="mx-auto max-w-6xl px-6 text-center relative z-10">
        <Badge className="mb-6 bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100 text-sm px-4 py-1.5">
          Sistema completo para agências de merchandising
        </Badge>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-900 max-w-4xl mx-auto">
          Pare de operar promotores no improviso —{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            tenha controle total da operação
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          O Ayratech organiza, automatiza e monitora toda a operação com promotores,
          supervisores e agências, usando IA, WhatsApp, CRM e controle completo de execução.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={onCta}
            className="bg-violet-600 hover:bg-violet-700 text-white text-lg px-8 h-14 rounded-xl shadow-lg shadow-violet-200"
          >
            Quero organizar minha operação <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            className="border-violet-300 text-violet-700 hover:bg-violet-50 text-lg px-8 h-14 rounded-xl"
          >
            Conheça os recursos
          </Button>
        </div>

        {/* Trust strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          {["IA integrada", "WhatsApp nativo", "CRM completo", "App do promotor", "Controle de acesso"].map(t => (
            <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-violet-500" />{t}</span>
          ))}
        </div>
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
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-red-50 text-red-600 border-red-200 hover:bg-red-50">O problema</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 max-w-3xl mx-auto">
            Se você depende de planilha, WhatsApp solto e "confiança", você{" "}
            <span className="text-red-500">não tem controle</span> da operação
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {problems.map(p => (
            <div key={p} className="flex items-start gap-3 bg-white rounded-xl p-5 border border-red-100 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-gray-700">{p}</span>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-xl font-semibold text-gray-800 italic">
          "Você não tem visibilidade. Você tem suposição."
        </p>
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
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-50">A solução</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 max-w-3xl mx-auto">
            O Ayratech centraliza, valida e acompanha toda a operação{" "}
            <span className="text-violet-600">em tempo real</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4 bg-violet-50/60 rounded-xl p-5 border border-violet-100">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-gray-800 font-medium">{text}</span>
            </div>
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
      "Check-in validado no PDV",
      "Escolha de ponto natural ou ponto extra",
      "Foto obrigatória da categoria antes de iniciar",
      "Checklist por produto",
      "Contagem, validade e execução",
      "Múltiplas marcas na mesma rota",
      "Fotos com validação de qualidade",
      "Marca d'água automática",
    ],
    quote: "Se não foi validado, não foi executado.",
    icon: Smartphone,
  },
  {
    id: "ia",
    badge: "IA na Operação",
    badgeColor: "bg-purple-50 text-purple-600 border-purple-200",
    title: "A operação não depende mais só do promotor —",
    titleHighlight: "a IA valida e analisa tudo",
    items: [
      "Análise de fotos",
      "Identificação de padrões",
      "Detecção de comportamento fora do normal",
      "Interpretação de ocorrências (texto e áudio)",
      "Geração de resumos automáticos",
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
      "Chat interno",
      "Múltiplos atendentes",
      "Departamentos",
      "Histórico completo",
      "Distribuição automática",
      "Integração com CRM",
    ],
    extraItems: {
      label: "IA integrada",
      items: ["Respostas automáticas", "Triagem inteligente", "Suporte à operação"],
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
      "Tarefas",
      "Acompanhamento",
      "Pipeline",
      "Organização por cliente e PDV",
      "Histórico completo",
    ],
    quote: "Você vê a operação acontecendo.",
    icon: BarChart3,
  },
  {
    id: "acesso",
    badge: "Controle de Acesso",
    badgeColor: "bg-red-50 text-red-600 border-red-200",
    title: "Controle de entrada em supermercados",
    titleHighlight: "integrado",
    items: [
      "Autorização automática",
      "Controle por PDV",
      "Horários definidos",
      "Bloqueio por comportamento",
      "Histórico de acesso",
    ],
    quote: "Se não estiver autorizado, não entra.",
    icon: Lock,
  },
  {
    id: "score",
    badge: "Score de Promotor",
    badgeColor: "bg-amber-50 text-amber-600 border-amber-200",
    title: "Cada promotor tem um score baseado no",
    titleHighlight: "comportamento real",
    items: [
      "Ocorrências",
      "Execução",
      "Permanência",
      "Padrão de comportamento",
    ],
    extraItems: {
      label: "Resultado",
      items: ["Identificação de risco", "Bloqueio automático", "Substituição obrigatória"],
    },
    quote: "Você evita o problema antes dele acontecer.",
    icon: Target,
  },
  {
    id: "rh",
    badge: "Assinatura Digital & RH",
    badgeColor: "bg-teal-50 text-teal-600 border-teal-200",
    title: "Contratos e controle de equipe",
    titleHighlight: "em um só lugar",
    items: [
      "Assinatura digital com validade jurídica",
      "Contratos",
      "Documentos",
      "Holerite",
      "Relógio de ponto",
    ],
    quote: "Menos papel. Mais controle.",
    icon: FileText,
  },
  {
    id: "automacao",
    badge: "Automação & IA",
    badgeColor: "bg-indigo-50 text-indigo-600 border-indigo-200",
    title: "Automatize tarefas com",
    titleHighlight: "inteligência artificial",
    items: [
      "Secretária virtual",
      "Automação de processos",
      "Lembretes inteligentes",
      "Organização automática",
    ],
    quote: "Menos trabalho manual. Mais eficiência.",
    icon: Zap,
  },
  {
    id: "relatorios",
    badge: "Relatórios",
    badgeColor: "bg-cyan-50 text-cyan-600 border-cyan-200",
    title: "Relatórios completos com",
    titleHighlight: "análise real da operação",
    items: [
      "Execução por promotor",
      "Desempenho por PDV",
      "Produtividade por marca",
      "Falhas e inconsistências",
      "Análise com IA",
    ],
    quote: "Você entende a operação.",
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
          <div className="lg:w-5/12 flex justify-center">
            <div className="relative">
              <div className="h-48 w-48 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-50 flex items-center justify-center shadow-lg shadow-violet-100/50">
                <Icon className="h-20 w-20 text-violet-600" />
              </div>
              <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {String(index + 1).padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* Content side */}
          <div className="lg:w-7/12">
            <Badge className={`mb-3 ${f.badgeColor} hover:opacity-90`}>{f.badge}</Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
              {f.title}{" "}
              {f.titleHighlight && <span className="text-violet-600">{f.titleHighlight}</span>}
            </h2>

            <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
              {f.items.map(item => (
                <div key={item} className="flex items-center gap-2.5">
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
                    <span key={ei} className="text-xs bg-white rounded-full px-3 py-1 text-violet-700 border border-violet-200">
                      {ei}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-lg font-semibold text-gray-800 italic border-l-4 border-violet-400 pl-4">
              "{f.quote}"
            </p>
          </div>
        </div>
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
          className="bg-white text-violet-700 hover:bg-violet-50 text-lg px-10 h-14 rounded-xl shadow-lg font-semibold"
        >
          Quero implementar o Ayratech na minha agência <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

/* ─────────────── FAQ ─────────────── */
function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: "O sistema funciona para qualquer tamanho de agência?", a: "Sim, o Ayratech atende desde agências com 5 promotores até operações com centenas de profissionais em campo." },
    { q: "Precisa instalar algo no supermercado?", a: "O totem de acesso pode rodar em um tablet comum. Não exige infraestrutura especial no PDV." },
    { q: "A IA substitui o supervisor?", a: "Não. A IA complementa a supervisão, identificando padrões e problemas que passariam despercebidos." },
    { q: "O promotor precisa de um celular especial?", a: "Não. O app funciona em qualquer smartphone Android ou iOS com câmera." },
    { q: "Como funciona a cobrança?", a: "A agência paga por promotor ativo. O supermercado usa o sistema gratuitamente." },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-gray-800">{faq.q}</span>
                {open === i ? <ChevronUp className="h-5 w-5 text-violet-500" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {open === i && (
                <div className="px-5 pb-5 pt-0 text-gray-600 text-sm leading-relaxed">{faq.a}</div>
              )}
            </div>
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
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">
          Quero implementar o Ayratech
        </h2>
        <p className="text-center text-gray-500 mb-10">Preencha e nossa equipe entra em contato</p>

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
          <Button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 rounded-xl text-base">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enviar <Send className="ml-2 h-4 w-4" /></>}
          </Button>
        </form>
      </div>
    </section>
  );
}

/* ─────────────── NAVBAR ─────────────── */
function Navbar({ onCta }: { onCta: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/60">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-extrabold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Ayratech
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          {[
            { label: "Recursos", href: "#features" },
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
      <ProblemSection />
      <SolutionSection />

      <div id="features">
        {features.map((f, i) => (
          <FeatureSection key={f.id} f={f} index={i} />
        ))}
      </div>

      <PositioningSection onCta={scrollToContact} />
      <div id="faq"><FAQSection /></div>
      <ContactSection />
      <Footer />
    </div>
  );
}
