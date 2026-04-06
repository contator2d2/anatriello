import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, ShieldCheck, Camera, MapPin, Clock, Users, BarChart3, Bell,
  CheckCircle2, Smartphone, QrCode, Fingerprint, Eye, FileCheck,
  ArrowRight, Star, Zap, Lock, TrendingUp, Award, Building2,
  Monitor, UserCheck, AlertTriangle, CalendarCheck, BadgeCheck,
  ChevronDown, ChevronUp, MessageCircle, Brain, RefreshCw, Store,
  Building, DollarSign, Rocket, Ban, Target, Cpu, ScanFace
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/* ─────── Reveal on scroll ─────── */
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

/* ─────── Animated counter ─────── */
function CountUp({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && !started) { setStarted(true); obs.unobserve(el); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);
  return <span ref={ref}>{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}

export default function SupermarketLandingPage() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", store: "", message: "" });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Solicitação enviada! Entraremos em contato em breve.");
    setFormData({ name: "", email: "", phone: "", store: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-violet-100/60" : "bg-white/80 backdrop-blur-md border-b border-violet-100/60"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-violet-600" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-violet-600">Ayra</span>
              <span className="text-gray-800">Access</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#problema" className="hover:text-violet-600 transition-colors">O Problema</a>
            <a href="#solucao" className="hover:text-violet-600 transition-colors">Solução</a>
            <a href="#recursos" className="hover:text-violet-600 transition-colors">Recursos</a>
            <a href="#modelo" className="hover:text-violet-600 transition-colors">Modelo</a>
            <a href="#faq" className="hover:text-violet-600 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-violet-600 hover:bg-violet-50" onClick={() => navigate("/supermercado/login")}>
              Já sou parceiro
            </Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-5" onClick={() => document.getElementById("cadastro")?.scrollIntoView({ behavior: "smooth" })}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* ===== 1. HERO ===== */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-purple-50/40" />
        <div className="absolute top-10 right-[-200px] w-[600px] h-[600px] rounded-full bg-violet-100/50 blur-[120px] animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-purple-100/40 blur-[100px] animate-pulse" style={{ animationDuration: "8s" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 bg-violet-100/80 text-violet-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                  <Shield className="h-4 w-4" />
                  100% Gratuito para Supermercados
                </div>
              </Reveal>
              <Reveal delay={1}>
                <h1 className="text-4xl md:text-[3.2rem] lg:text-[3.6rem] font-extrabold leading-[1.1] tracking-tight text-gray-900">
                  Pare de controlar promotores com{" "}
                  <span className="relative">
                    <span className="text-violet-600">papel e improviso</span>
                    <svg className="absolute -bottom-1 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none">
                      <path d="M1 5.5C40 2 80 2 100 4C120 6 160 6 199 3" stroke="rgb(139 92 246)" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={2}>
                <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-lg">
                  O AyraAccess substitui autorizações manuais, organiza o acesso de promotores e dá visibilidade completa de quem está na loja, quais marcas estão sendo atendidas e como está o comportamento de cada profissional.
                </p>
              </Reveal>
              <Reveal delay={3}>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="bg-violet-600 hover:bg-violet-700 text-white text-base px-8 h-14 rounded-xl shadow-lg shadow-violet-200/60 transition-transform hover:scale-105"
                    onClick={() => document.getElementById("cadastro")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Quero organizar o acesso na minha loja
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={4}>
                <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-gray-400">
                  {["Setup em 5 minutos", "Sem mensalidade", "Sem contratos"].map((t, i) => (
                    <span key={i} className="flex items-center gap-1.5 hover:text-violet-600 transition-colors cursor-default">
                      <CheckCircle2 className="h-4 w-4 text-violet-400" /> {t}
                    </span>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Hero visual — Totem mockup */}
            <Reveal delay={2} className="relative hidden lg:flex justify-center">
              <div className="relative w-[340px]">
                <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-[2rem] p-6 shadow-2xl border border-gray-700/50">
                  <div className="bg-gradient-to-b from-violet-600/15 to-transparent rounded-2xl p-5 border border-violet-500/20">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                        <Shield className="h-7 w-7 text-violet-400" />
                      </div>
                    </div>
                    <p className="text-center text-violet-300 text-xs font-medium mb-5">Totem de Acesso — Seu PDV</p>
                    <div className="bg-gray-700/40 rounded-xl p-3 mb-3">
                      <p className="text-gray-500 text-[10px] mb-1.5 uppercase tracking-wider">CPF do Promotor</p>
                      <div className="bg-gray-600/40 rounded-lg px-3 py-2.5 text-white font-mono text-base tracking-widest">
                        123.456.789-00
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {[1,2,3,4,5,6,7,8,9,"←",0,"✓"].map((k, i) => (
                        <div key={i} className={`rounded-lg py-2 text-center font-semibold text-xs ${
                          k === "✓" ? "bg-violet-500 text-white" : "bg-gray-600/50 text-gray-300 hover:bg-gray-500/50"
                        }`}>{k}</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 justify-center">
                      <Lock className="h-3 w-3" /> Validação biométrica ativa
                    </div>
                  </div>
                </div>
                {/* Floating cards */}
                <div className="absolute -top-3 -right-6 bg-white rounded-xl shadow-xl p-3 flex items-center gap-2 border border-violet-100 animate-bounce" style={{ animationDuration: "3s" }}>
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">12 promotores</p>
                    <p className="text-[10px] text-gray-400">ativos agora</p>
                  </div>
                </div>
                <div className="absolute -bottom-3 -left-6 bg-white rounded-xl shadow-xl p-3 flex items-center gap-2 border border-violet-100 animate-bounce" style={{ animationDuration: "4s" }}>
                  <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center">
                    <ScanFace className="h-4 w-4 text-fuchsia-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Facial ativo</p>
                    <p className="text-[10px] text-gray-400">validação por IA</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR with animated numbers ===== */}
      <section className="py-14 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 100, suffix: "%", label: "Gratuito para PDVs", icon: DollarSign },
              { value: 5, prefix: "< ", suffix: "s", label: "Validação por promotor", icon: Clock },
              { value: 850, suffix: "+", label: "Acessos monitorados/mês", icon: UserCheck },
              { value: 99, suffix: "%", label: "Precisão facial por IA", icon: ScanFace },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.label} delay={i} className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="text-4xl md:text-5xl font-extrabold text-white mb-1">
                    <CountUp end={s.value} suffix={s.suffix} prefix={s.prefix || ""} />
                  </div>
                  <div className="text-violet-200 text-sm font-medium">{s.label}</div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== 5. PROBLEMA ATUAL ===== */}
      <section id="problema" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center mb-14">
              <p className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3">O problema</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                Hoje, o controle de promotores ainda é manual, falho e sem rastreabilidade
              </h2>
              <p className="mt-5 text-lg text-gray-500">Na prática, o cenário é esse:</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              "Autorização em papel",
              "Promotor entra sem validação real",
              "Ninguém sabe exatamente quem está na loja",
              "Dificuldade de saber quais marcas estão sendo atendidas",
              "Falta de histórico de comportamento",
              "Problemas recorrentes sem controle",
            ].map((t, i) => (
              <Reveal key={t} delay={i}>
                <div className="flex items-start gap-3 bg-red-50/60 rounded-xl p-4 border border-red-100/60 hover:shadow-md hover:border-red-200 transition-all hover:-translate-y-1">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{t}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={6}>
            <div className="mt-12 text-center">
              <p className="text-xl md:text-2xl font-bold text-gray-800 italic">
                "Você não controla a operação. <span className="text-red-500">Você reage aos problemas.</span>"
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== 6. SOLUÇÃO ===== */}
      <section id="solucao" className="py-20 bg-gradient-to-b from-violet-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center mb-14">
              <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider mb-3">A solução</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                O AyraAccess transforma o controle de acesso em um processo digital, automático e inteligente
              </h2>
              <p className="mt-5 text-gray-500 text-lg">
                Tudo passa a ser validado antes da entrada:
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {[
              { icon: UserCheck, label: "Promotor autorizado" },
              { icon: CalendarCheck, label: "Data e horário definidos" },
              { icon: MapPin, label: "PDV correto" },
              { icon: Award, label: "Marca vinculada" },
              { icon: Building2, label: "Agência responsável" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i}>
                <div className="flex flex-col items-center text-center bg-white rounded-2xl p-5 border border-violet-100/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <s.icon className="h-6 w-6 text-violet-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={5}>
            <p className="text-center mt-10 text-lg font-semibold text-violet-700">
              Sem papel. Sem dúvida. Sem improviso.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== 7. CONTROLE DE ACESSO ===== */}
      <section id="recursos" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider mb-3">Controle de Acesso</p>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
                  Controle de entrada e saída com múltiplos níveis de validação
                </h2>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {[
                    "CPF no totem",
                    "QR Code dinâmico",
                    "Selfie na entrada e saída",
                    "Validação por foto com IA",
                    "Controle de horário",
                    "Registro automático de permanência",
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 hover:translate-x-1 transition-transform">
                      <CheckCircle2 className="h-4 w-4 text-violet-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>
                <p className="text-lg font-semibold text-gray-800 italic">
                  "Entrou, ficou registrado. Saiu, também."
                </p>
              </div>
            </Reveal>
            <Reveal delay={2}>
              <div className="bg-gradient-to-br from-violet-100/80 to-purple-50 rounded-3xl p-10 flex items-center justify-center min-h-[320px]">
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { icon: Fingerprint, label: "CPF" },
                    { icon: QrCode, label: "QR Code" },
                    { icon: ScanFace, label: "Facial" },
                    { icon: Camera, label: "Selfie" },
                    { icon: Clock, label: "Horário" },
                    { icon: MapPin, label: "Localização" },
                  ].map((m, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 group">
                      <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center group-hover:shadow-lg group-hover:scale-110 transition-all">
                        <m.icon className="h-6 w-6 text-violet-600" />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== MINI STATS — Impact numbers ===== */}
      <section className="py-12 bg-violet-50/60 border-y border-violet-100/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 70, suffix: "%", label: "Menos tempo em autorizações" },
              { value: 24, suffix: "/7", label: "Monitoramento contínuo" },
              { value: 3, suffix: "x", label: "Mais visibilidade operacional" },
              { value: 0, suffix: "", label: "Custo para o supermercado", prefix: "R$ " },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i}>
                <div className="text-3xl md:text-4xl font-extrabold text-violet-600 mb-1">
                  <CountUp end={s.value} suffix={s.suffix} prefix={s.prefix || ""} />
                </div>
                <div className="text-xs text-gray-500 font-medium">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 8. VISIBILIDADE EM TEMPO REAL ===== */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal className="order-2 lg:order-1">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-violet-100/60">
                <div className="space-y-3">
                  {[
                    { label: "Promotores ativos", value: "12", color: "bg-violet-500" },
                    { label: "Marcas atendidas", value: "5", color: "bg-fuchsia-500" },
                    { label: "Agências presentes", value: "3", color: "bg-purple-500" },
                    { label: "Tempo médio", value: "4h 23m", color: "bg-indigo-500" },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-violet-50/40 transition-colors rounded-lg px-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
                        <span className="text-sm text-gray-600">{r.label}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={2} className="order-1 lg:order-2">
              <div>
                <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider mb-3">Tempo Real</p>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
                  Saiba exatamente quem está dentro da sua loja, em tempo real
                </h2>
                <p className="text-gray-500 mb-4">Sem precisar perguntar. Você vê:</p>
                <ul className="space-y-2 mb-8">
                  {[
                    "Promotores ativos no momento",
                    "Marcas sendo atendidas",
                    "Horário de entrada",
                    "Tempo de permanência",
                    "Agências presentes",
                  ].map((t, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600 hover:translate-x-1 transition-transform">
                      <Eye className="h-4 w-4 text-violet-500" /> {t}
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-semibold text-gray-800 italic">
                  "Você não pergunta mais. <span className="text-violet-600">Você já sabe.</span>"
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== 9. OCORRÊNCIA VIA WHATSAPP COM IA ===== */}
      <section className="py-20 bg-violet-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider mb-3">Inteligência Artificial</p>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
                  Registre ocorrências direto pelo WhatsApp, com inteligência automática
                </h2>
                <p className="text-gray-500 mb-4">O supervisor pode enviar:</p>
                <div className="flex gap-3 mb-6">
                  {["Mensagem", "Áudio", "Foto"].map((t, i) => (
                    <span key={i} className="bg-violet-100 text-violet-700 text-sm font-medium px-4 py-1.5 rounded-full hover:bg-violet-200 transition-colors">{t}</span>
                  ))}
                </div>
                <p className="text-gray-500 mb-2">A IA entende e organiza automaticamente.</p>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mt-6">
                  <p className="text-sm text-gray-500 mb-3 font-medium">Exemplo de envio:</p>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-gray-700 italic">"promotor chegou atrasado e não finalizou a execução"</p>
                  </div>
                  <p className="text-sm text-gray-500 mb-2 font-medium">Resultado automático:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: "Tipo", v: "Atraso + Não execução" },
                      { k: "Gravidade", v: "Média" },
                      { k: "Impacto", v: "Operacional" },
                      { k: "Resumo", v: "Padronizado" },
                    ].map((r, i) => (
                      <div key={i} className="bg-white rounded-lg p-2.5 border border-gray-100 hover:shadow-sm transition-shadow">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{r.k}</p>
                        <p className="text-sm font-semibold text-gray-800">{r.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-6 text-lg font-semibold text-gray-800 italic">
                  "Você fala. O sistema entende. <span className="text-violet-600">E registra.</span>"
                </p>
              </div>
            </Reveal>
            <Reveal delay={2} className="flex justify-center">
              <div className="relative w-[280px]">
                <div className="bg-gradient-to-b from-violet-600 to-purple-700 rounded-[2rem] p-1">
                  <div className="bg-gray-900 rounded-[1.8rem] p-5 min-h-[400px] flex flex-col items-center justify-center gap-4">
                    <MessageCircle className="h-16 w-16 text-green-400" />
                    <p className="text-white text-center text-sm font-medium">WhatsApp + IA</p>
                    <p className="text-gray-400 text-center text-xs">Envie texto, áudio ou foto.<br/>A IA classifica automaticamente.</p>
                    <div className="mt-4 flex gap-2">
                      <div className="w-10 h-10 rounded-full bg-violet-500/30 flex items-center justify-center">
                        <Brain className="h-5 w-5 text-violet-300" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-green-300" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-fuchsia-500/30 flex items-center justify-center">
                        <Camera className="h-5 w-5 text-fuchsia-300" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== 10. SCORE DO PROMOTOR ===== */}
      <section className="py-20 bg-gradient-to-b from-white to-violet-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center mb-14">
              <div className="inline-flex items-center gap-2 bg-violet-100/80 text-violet-700 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
                <Star className="h-4 w-4" /> Diferencial exclusivo
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                Cada promotor passa a ter um score baseado no comportamento real dentro das lojas
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Reveal delay={0}>
              <Card className="border-violet-100/60 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
                    <FileCheck className="h-6 w-6 text-violet-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-3">Histórico Automático</h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                    {["Ocorrências registradas", "Frequência de problemas", "Padrão de permanência", "Inconsistências de acesso", "Execução incompleta"].map((t, i) => (
                      <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" />{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={1}>
              <Card className="border-violet-200 rounded-2xl shadow-md bg-violet-600 text-white hover:shadow-xl hover:-translate-y-1 transition-all">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-3">Score Inteligente</h3>
                  <ul className="space-y-2 text-sm text-violet-100">
                    {["Comportamento fora do normal", "Baixa permanência recorrente", "Múltiplas ocorrências", "Risco operacional"].map((t, i) => (
                      <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/60" />{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={2}>
              <Card className="border-red-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                    <Ban className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-3">Bloqueio Automático</h3>
                  <ul className="space-y-2 text-sm text-gray-500">
                    {["Acesso automaticamente bloqueado", "Entrada negada no supermercado", "Agência notificada imediatamente"].map((t, i) => (
                      <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          </div>

          <Reveal delay={3}>
            <div className="max-w-2xl mx-auto bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <p className="text-sm text-gray-500 mb-3 font-medium">Consequência operacional:</p>
              <div className="space-y-2">
                {[
                  "A agência precisa substituir o promotor",
                  "O histórico acompanha o profissional em qualquer unidade",
                  "O problema deixa de ser local e passa a ser controlado",
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <ArrowRight className="h-4 w-4 text-violet-500 flex-shrink-0" /> {t}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={4}>
            <p className="text-center mt-10 text-xl font-bold text-gray-800">
              Não é só registrar problema. <span className="text-violet-600">É impedir que ele aconteça de novo.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== 11. CONTROLE ENTRE UNIDADES ===== */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="h-8 w-8 text-violet-600" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Histórico unificado em toda a rede
            </h2>
            <p className="text-gray-500 text-lg mb-4 max-w-xl mx-auto">
              Se o promotor tiver problema em uma loja, isso acompanha ele em outros PDVs.
            </p>
            <p className="text-lg font-semibold text-gray-800 italic">
              "O comportamento não se perde. <span className="text-violet-600">Ele é rastreado.</span>"
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== 12 & 13. DASHBOARDS ===== */}
      <section className="py-20 bg-violet-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider mb-3">Dashboards</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Visão completa para todos os lados
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8">
            <Reveal delay={0}>
              <Card className="rounded-2xl border-violet-100/60 shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                <div className="bg-violet-600 p-5">
                  <div className="flex items-center gap-3">
                    <Store className="h-6 w-6 text-white" />
                    <h3 className="text-lg font-bold text-white">Dashboard do Supermercado</h3>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 mb-4">Tenha visão completa da operação dentro da sua loja</p>
                  <div className="space-y-2.5">
                    {["Quem está na loja agora", "Quem esteve hoje", "Quais marcas foram atendidas", "Ocorrências registradas", "Ranking de agências", "Score dos promotores"].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-violet-500 flex-shrink-0" /> {t}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={1}>
              <Card className="rounded-2xl border-purple-100/60 shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                <div className="bg-purple-600 p-5">
                  <div className="flex items-center gap-3">
                    <Building className="h-6 w-6 text-white" />
                    <h3 className="text-lg font-bold text-white">Dashboard da Agência</h3>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 mb-4">A agência acompanha tudo e é responsabilizada pela operação</p>
                  <div className="space-y-2.5">
                    {["Promotores ativos", "Acessos realizados", "Ocorrências recebidas", "Score individual", "Alertas de risco", "Necessidade de substituição"].map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-purple-500 flex-shrink-0" /> {t}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== 14. MODELO COMERCIAL ===== */}
      <section id="modelo" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider mb-3">Modelo Comercial</p>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
                  O supermercado não paga nada para usar
                </h2>
                <div className="space-y-3 mb-8">
                  {["Uso gratuito para a rede", "Implantação sem custo", "Controle completo da operação"].map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{t}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xl font-bold text-gray-800 italic">
                  "Quem precisa acessar a loja é <span className="text-violet-600">quem paga pelo controle.</span>"
                </p>
              </div>
            </Reveal>
            <Reveal delay={2}>
              <div className="bg-gradient-to-br from-gray-50 to-violet-50/50 rounded-3xl p-8 border border-violet-100/40">
                <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-violet-600" /> Quem paga?
                </h3>
                <div className="space-y-4">
                  {[
                    { title: "Agências terceiras", desc: "Que necessitam acessar os PDVs" },
                    { title: "Por promotor ativo", desc: "Cobrança proporcional ao uso" },
                    { title: "Mensalidade pelo sistema", desc: "Acesso completo à plataforma" },
                  ].map((t, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== 15. POSICIONAMENTO FINAL ===== */}
      <section className="py-20 bg-gradient-to-b from-violet-600 to-purple-700 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Reveal>
            <Rocket className="h-12 w-12 mx-auto mb-6 text-violet-200" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Mais controle, menos risco e uma operação organizada de verdade
            </h2>
            <p className="text-lg text-violet-100 mb-8 max-w-2xl mx-auto">
              O AyraAccess não é só um controle de entrada. É um sistema completo de:
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {["Validação", "Monitoramento", "Histórico", "Inteligência Operacional"].map((t, i) => (
                <span key={i} className="bg-white/15 backdrop-blur-sm rounded-full px-5 py-2 text-sm font-medium text-white border border-white/20 hover:bg-white/25 transition-colors">
                  {t}
                </span>
              ))}
            </div>
            <p className="text-2xl font-bold">
              Se entra na sua loja, precisa estar sob controle.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
              Perguntas frequentes
            </h2>
          </Reveal>
          <div className="space-y-3">
            {[
              { q: "É realmente gratuito para o supermercado?", a: "Sim, 100%. O modelo é simples: as agências e empresas que precisam acessar sua loja pagam pelo serviço. Seu supermercado tem acesso completo e ilimitado a todos os recursos sem nenhum custo." },
              { q: "Preciso comprar algum equipamento?", a: "Não. O Totem funciona em qualquer tablet ou computador com navegador web e câmera. Basta acessar o sistema pelo link e posicionar na entrada da loja." },
              { q: "Como funciona a validação facial?", a: "Utilizamos inteligência artificial para comparar a selfie tirada no Totem com a foto cadastrada do promotor. A precisão é altíssima e o processo leva menos de 5 segundos." },
              { q: "Posso personalizar o visual do Totem?", a: "Sim! No painel de configurações você define as cores, faz upload do logotipo da sua loja, adiciona um slogan e personaliza o nome exibido no Totem." },
              { q: "E se o promotor não tiver foto cadastrada?", a: "A agência é responsável por cadastrar a foto e biometria do promotor antes de solicitar acesso. Sem foto, o promotor não consegue realizar a validação facial." },
              { q: "Preciso aprovar cada visita manualmente?", a: "Você pode aprovar visitas individualmente ou em massa. Também pode configurar aprovações automáticas para agências de confiança." },
              { q: "O sistema funciona offline?", a: "O Totem precisa de conexão com internet para validação facial e registro de acessos. Recomendamos uma conexão Wi-Fi estável na área de entrada." },
            ].map((item, i) => (
              <Reveal key={i} delay={i}>
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <button
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-100/60 transition-colors"
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  >
                    <span className="font-semibold text-gray-900 text-sm">{item.q}</span>
                    {expandedFaq === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-300"
                    style={{ maxHeight: expandedFaq === i ? "200px" : "0", opacity: expandedFaq === i ? 1 : 0 }}
                  >
                    <div className="px-5 pb-5 text-sm text-gray-500 leading-relaxed">{item.a}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 16. CTA FINAL + CADASTRO ===== */}
      <section id="cadastro" className="py-20 bg-gradient-to-b from-white to-violet-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  Quero implementar o AyraAccess{" "}
                  <span className="text-violet-600">na minha rede</span>
                </h2>
                <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                  Preencha o formulário ao lado e nossa equipe entrará em contato para ativar seu acesso.
                  Em poucos minutos você terá o painel completo funcionando.
                </p>
                <div className="space-y-3">
                  {[
                    "Sem custo, sem contrato, sem surpresas",
                    "Suporte dedicado para implementação",
                    "Treinamento gratuito para sua equipe",
                    "Personalização completa do Totem",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-violet-600" />
                      </div>
                      <span className="text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={2}>
              <Card className="rounded-2xl border-0 shadow-xl bg-white">
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Quero participar</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Seu nome</label>
                      <Input required placeholder="Nome completo" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">E-mail</label>
                        <Input required type="email" placeholder="email@loja.com" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="rounded-xl" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Telefone</label>
                        <Input required placeholder="(11) 99999-9999" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="rounded-xl" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do supermercado</label>
                      <Input required placeholder="Supermercado X" value={formData.store} onChange={e => setFormData(p => ({ ...p, store: e.target.value }))} className="rounded-xl" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Mensagem (opcional)</label>
                      <Textarea placeholder="Conte-nos mais sobre sua loja..." value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} className="rounded-xl" rows={3} />
                    </div>
                    <Button type="submit" className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white text-lg rounded-xl shadow-lg shadow-violet-200/60 transition-transform hover:scale-[1.02]">
                      Enviar solicitação
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <p className="text-xs text-gray-400 text-center">
                      Ao enviar, você concorda com nossos termos de uso e política de privacidade.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-400" />
              <span className="text-lg font-bold text-white">
                Ayra<span className="text-violet-400">Access</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="/politica-privacidade" className="hover:text-white transition-colors">Privacidade</a>
              <a href="/termos-servico" className="hover:text-white transition-colors">Termos</a>
              <a href="/exclusao-dados" className="hover:text-white transition-colors">Exclusão de dados</a>
            </div>
            <p className="text-sm">© {new Date().getFullYear()} Ayratech. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
