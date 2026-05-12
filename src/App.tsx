import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/use-branding";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PWAUpdateBanner } from "@/components/layout/PWAUpdateBanner";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Conexao from "./pages/Conexao";
import Contatos from "./pages/Contatos";
import Mensagens from "./pages/Mensagens";
import Campanhas from "./pages/Campanhas";
import Chat from "./pages/Chat";
import Cobranca from "./pages/Cobranca";
import Organizacoes from "./pages/Organizacoes";
import Admin from "./pages/Admin";
import Configuracoes from "./pages/Configuracoes";
import Agendamentos from "./pages/Agendamentos";
import Tags from "./pages/Tags";
import ContatosChat from "./pages/ContatosChat";
import Chatbots from "./pages/Chatbots";
import Fluxos from "./pages/Fluxos";
import Departamentos from "./pages/Departamentos";
import AgentesIA from "./pages/AgentesIA";
import CRMNegociacoes from "./pages/CRMNegociacoes";
import CRMProspects from "./pages/CRMProspects";
import CRMEmpresas from "./pages/CRMEmpresas";
import CRMTarefas from "./pages/CRMTarefas";
import CRMAgenda from "./pages/CRMAgenda";
import CRMConfiguracoes from "./pages/CRMConfiguracoes";
import CRMRelatorios from "./pages/CRMRelatorios";
import Mapa from "./pages/Mapa";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosServico from "./pages/TermosServico";
import ExclusaoDados from "./pages/ExclusaoDados";
import FluxosExternos from "./pages/FluxosExternos";
import PublicFormPage from "./pages/PublicFormPage";
import LeadWebhooks from "./pages/LeadWebhooks";
import SequenciasNurturing from "./pages/SequenciasNurturing";
import CTWAAnalytics from "./pages/CTWAAnalytics";
import RevenueIntelligence from "./pages/RevenueIntelligence";
import SecretariaGrupos from "./pages/SecretariaGrupos";
import ModuloFantasma from "./pages/ModuloFantasma";
import Projetos from "./pages/Projetos";
import TarefasKanban from "./pages/TarefasKanban";
import LeadGleego from "./pages/LeadGleego";
import AgentesIACliente from "./pages/AgentesIACliente";
import RespostasRapidas from "./pages/RespostasRapidas";
import ApiDocumentation from "./pages/ApiDocumentation";
import MetaTemplates from "./pages/MetaTemplates";
import Assinaturas from "./pages/Assinaturas";
import ModeloContrato from "./pages/ModeloContrato";
import AssinarDocumento from "./pages/AssinarDocumento";
import VerificarDocumento from "./pages/VerificarDocumento";
import RHColaboradores from "./pages/RHColaboradores";
import RHPonto from "./pages/RHPonto";
import RHHolerite from "./pages/RHHolerite";
import RHDashboard from "./pages/RHDashboard";
import RHDocumentos from "./pages/RHDocumentos";
import RHPontoMonitor from "./pages/RHPontoMonitor";
import RHPDVs from "./pages/RHPDVs";
import RHFeriados from "./pages/RHFeriados";
import RHAcessos from "./pages/RHAcessos";
import RHRastreamento from "./pages/RHRastreamento";
import RHBiometria from "./pages/RHBiometria";
import RHMapaOperacional from "./pages/RHMapaOperacional";
import LiveMaps from "./pages/LiveMaps";
  import MerchDashboard from "./pages/MerchDashboard";
import MerchMarcas from "./pages/MerchMarcas";
import MerchCategorias from "./pages/MerchCategorias";
import MerchProdutos from "./pages/MerchProdutos";
import MerchMixPDV from "./pages/MerchMixPDV";
import MerchRedes from "./pages/MerchRedes";
import MerchRelatorios from "./pages/MerchRelatorios";
import MerchRotas from "./pages/MerchRotas";
import MerchExecucao from "./pages/MerchExecucao";
import MerchChecklists from "./pages/MerchChecklists";
import MerchBookFotos from "./pages/MerchBookFotos";
import PublicPhotoBook from "./pages/PublicPhotoBook";
import MerchContratos from "./pages/MerchContratos";
import MerchAuditoria from "./pages/MerchAuditoria";
import MerchEquipe from "./pages/MerchEquipe";
import MerchPesquisaPrecos from "./pages/MerchPesquisaPrecos";
import MerchPesquisaDashboard from "./pages/MerchPesquisaDashboard";
import PromotorLogin from "./pages/promotor/PromotorLogin";
import PromotorHome from "./pages/promotor/PromotorHome";
import PromotorAgenda from "./pages/promotor/PromotorAgenda";
import PromotorRota from "./pages/promotor/PromotorRota";
import PromotorAvarias from "./pages/promotor/PromotorAvarias";
import PromotorDocumentos from "./pages/promotor/PromotorDocumentos";
import PromotorPonto from "./pages/promotor/PromotorPonto";
import PromotorEnviar from "./pages/promotor/PromotorEnviar";
import PromotorConfig from "./pages/promotor/PromotorConfig";
import PromotorTrocarSenha from "./pages/promotor/PromotorTrocarSenha";
import PromotorEquipe from "./pages/promotor/PromotorEquipe";
import NotFound from "./pages/NotFound";
import SupermarketLandingPage from "./pages/SupermarketLandingPage";
import TotemAccess from "./pages/TotemAccess";
import AccessControlAdmin from "./pages/AccessControlAdmin";
import { AgencyAuthProvider } from "./contexts/AgencyAuthContext";
import AgencyLogin from "./pages/agency/AgencyLogin";
import AgencyLayout from "./pages/agency/AgencyLayout";
import AgencyDashboard from "./pages/agency/AgencyDashboard";
import AgencyPromoters from "./pages/agency/AgencyPromoters";
import AgencyBrands from "./pages/agency/AgencyBrands";
import AgencyAccessRules from "./pages/agency/AgencyAccessRules";
import AgencyVisitRequests from "./pages/agency/AgencyVisitRequests";
import { SupermarketAuthProvider } from "./contexts/SupermarketAuthContext";
import SupermarketLogin from "./pages/supermarket/SupermarketLogin";
import SupermarketLayout from "./pages/supermarket/SupermarketLayout";
import SupermarketDashboard from "./pages/supermarket/SupermarketDashboard";
import SupermarketHistory from "./pages/supermarket/SupermarketHistory";
import SupermarketVisitRequests from "./pages/supermarket/SupermarketVisitRequests";
import SupermarketIncidents from "./pages/supermarket/SupermarketIncidents";
import SupermarketContacts from "./pages/supermarket/SupermarketContacts";
import SupermarketAssistant from "./pages/supermarket/SupermarketAssistant";
import SupermarketSettings from "./pages/supermarket/SupermarketSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401) return false;
        return failureCount < 1;
      },
    },
  },
});

// Component to handle favicon update
function FaviconUpdater() {
  const { branding } = useBranding();

  useEffect(() => {
    if (branding.favicon) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = branding.favicon;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = branding.favicon;
        document.head.appendChild(newLink);
      }
    }
  }, [branding.favicon]);

  return null;
}

// Smart redirect based on hostname and auth state
function SmartRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
  const isPromotorDomain = window.location.hostname.startsWith('promotor.');
  
  // If accessing from promotor subdomain, always go to promotor login
  if (isPromotorDomain) return <Navigate to="/promotor/login" replace />;
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (isPWA) return <Navigate to="/login" replace />;
  return <LandingPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FaviconUpdater />
      <PWAUpdateBanner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/" element={<SmartRedirect />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/merch/dashboard" element={<ProtectedRoute><MerchDashboard /></ProtectedRoute>} />
            <Route path="/conexao" element={<ProtectedRoute><Conexao /></ProtectedRoute>} />
            <Route path="/contatos" element={<ProtectedRoute><Contatos /></ProtectedRoute>} />
            <Route path="/mensagens" element={<ProtectedRoute><Mensagens /></ProtectedRoute>} />
            <Route path="/campanhas" element={<ProtectedRoute><Campanhas /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/agendamentos" element={<ProtectedRoute><Agendamentos /></ProtectedRoute>} />
            <Route path="/tags" element={<ProtectedRoute><Tags /></ProtectedRoute>} />
            <Route path="/contatos-chat" element={<ProtectedRoute><ContatosChat /></ProtectedRoute>} />
            <Route path="/cobranca" element={<ProtectedRoute><Cobranca /></ProtectedRoute>} />
            <Route path="/organizacoes" element={<ProtectedRoute><Organizacoes /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/chatbots" element={<ProtectedRoute><Chatbots /></ProtectedRoute>} />
            <Route path="/fluxos" element={<ProtectedRoute><Fluxos /></ProtectedRoute>} />
            <Route path="/departamentos" element={<ProtectedRoute><Departamentos /></ProtectedRoute>} />
            <Route path="/agentes-ia" element={<ProtectedRoute><AgentesIA /></ProtectedRoute>} />
            <Route path="/crm/negociacoes" element={<ProtectedRoute><CRMNegociacoes /></ProtectedRoute>} />
            <Route path="/crm/prospects" element={<ProtectedRoute><CRMProspects /></ProtectedRoute>} />
            <Route path="/crm/empresas" element={<ProtectedRoute><CRMEmpresas /></ProtectedRoute>} />
            <Route path="/crm/tarefas" element={<ProtectedRoute><CRMTarefas /></ProtectedRoute>} />
            <Route path="/crm/agenda" element={<ProtectedRoute><CRMAgenda /></ProtectedRoute>} />
            <Route path="/crm/configuracoes" element={<ProtectedRoute><CRMConfiguracoes /></ProtectedRoute>} />
            <Route path="/crm/relatorios" element={<ProtectedRoute><CRMRelatorios /></ProtectedRoute>} />
            <Route path="/mapa" element={<ProtectedRoute><Mapa /></ProtectedRoute>} />
            <Route path="/fluxos-externos" element={<ProtectedRoute><FluxosExternos /></ProtectedRoute>} />
            <Route path="/lead-webhooks" element={<ProtectedRoute><LeadWebhooks /></ProtectedRoute>} />
            <Route path="/sequencias" element={<ProtectedRoute><SequenciasNurturing /></ProtectedRoute>} />
            <Route path="/ctwa-analytics" element={<ProtectedRoute><CTWAAnalytics /></ProtectedRoute>} />
            <Route path="/revenue-intelligence" element={<ProtectedRoute><RevenueIntelligence /></ProtectedRoute>} />
            <Route path="/secretaria-grupos" element={<ProtectedRoute><SecretariaGrupos /></ProtectedRoute>} />
            <Route path="/modulo-fantasma" element={<ProtectedRoute><ModuloFantasma /></ProtectedRoute>} />
            <Route path="/projetos" element={<ProtectedRoute><Projetos /></ProtectedRoute>} />
            <Route path="/tarefas" element={<ProtectedRoute><TarefasKanban /></ProtectedRoute>} />
            <Route path="/lead-gleego" element={<ProtectedRoute><LeadGleego /></ProtectedRoute>} />
            <Route path="/agentes-ia-cliente" element={<ProtectedRoute><AgentesIACliente /></ProtectedRoute>} />
            <Route path="/respostas-rapidas" element={<ProtectedRoute><RespostasRapidas /></ProtectedRoute>} />
            <Route path="/meta-templates" element={<ProtectedRoute><MetaTemplates /></ProtectedRoute>} />
            <Route path="/assinaturas" element={<ProtectedRoute><Assinaturas /></ProtectedRoute>} />
            <Route path="/modelo-contrato" element={<ProtectedRoute><ModeloContrato /></ProtectedRoute>} />
            <Route path="/rh/colaboradores" element={<ProtectedRoute><RHColaboradores /></ProtectedRoute>} />
            <Route path="/rh/dashboard" element={<ProtectedRoute><RHDashboard /></ProtectedRoute>} />
            <Route path="/rh/ponto" element={<ProtectedRoute><RHPonto /></ProtectedRoute>} />
            <Route path="/rh/holerite" element={<ProtectedRoute><RHHolerite /></ProtectedRoute>} />
            <Route path="/rh/documentos" element={<ProtectedRoute><RHDocumentos /></ProtectedRoute>} />
            <Route path="/rh/ponto-monitor" element={<ProtectedRoute><RHPontoMonitor /></ProtectedRoute>} />
            <Route path="/rh/pdvs" element={<ProtectedRoute><RHPDVs /></ProtectedRoute>} />
            <Route path="/rh/feriados" element={<ProtectedRoute><RHFeriados /></ProtectedRoute>} />
            <Route path="/rh/acessos" element={<ProtectedRoute><RHAcessos /></ProtectedRoute>} />
            <Route path="/rh/biometria" element={<ProtectedRoute><RHBiometria /></ProtectedRoute>} />
            <Route path="/rh/rastreamento" element={<ProtectedRoute><RHRastreamento /></ProtectedRoute>} />
            <Route path="/rh/mapa" element={<ProtectedRoute><RHMapaOperacional /></ProtectedRoute>} />
            <Route path="/live-maps" element={<ProtectedRoute><LiveMaps /></ProtectedRoute>} />
            <Route path="/merch/marcas" element={<ProtectedRoute><MerchMarcas /></ProtectedRoute>} />
            <Route path="/merch/categorias" element={<ProtectedRoute><MerchCategorias /></ProtectedRoute>} />
            <Route path="/merch/produtos" element={<ProtectedRoute><MerchProdutos /></ProtectedRoute>} />
            <Route path="/merch/mix" element={<ProtectedRoute><MerchMixPDV /></ProtectedRoute>} />
            <Route path="/merch/redes" element={<ProtectedRoute><MerchRedes /></ProtectedRoute>} />
            <Route path="/merch/relatorios" element={<ProtectedRoute><MerchRelatorios /></ProtectedRoute>} />
            <Route path="/merch/contratos" element={<ProtectedRoute><MerchContratos /></ProtectedRoute>} />
            <Route path="/merch/equipe" element={<ProtectedRoute><MerchEquipe /></ProtectedRoute>} />
            <Route path="/merch/rotas" element={<ProtectedRoute><MerchRotas /></ProtectedRoute>} />
            <Route path="/merch/execucao" element={<ProtectedRoute><MerchExecucao /></ProtectedRoute>} />
            <Route path="/merch/checklists" element={<ProtectedRoute><MerchChecklists /></ProtectedRoute>} />
            <Route path="/merch/book-fotos" element={<ProtectedRoute><MerchBookFotos /></ProtectedRoute>} />
            <Route path="/merch/auditoria" element={<ProtectedRoute><MerchAuditoria /></ProtectedRoute>} />
            <Route path="/merch/pesquisa-precos" element={<ProtectedRoute><MerchPesquisaPrecos /></ProtectedRoute>} />
            <Route path="/merch/pesquisa-dashboard" element={<ProtectedRoute><MerchPesquisaDashboard /></ProtectedRoute>} />
            <Route path="/controle-acesso" element={<ProtectedRoute><AccessControlAdmin /></ProtectedRoute>} />
            <Route path="/totem" element={<TotemAccess />} />
            <Route path="/acesso-supermercado" element={<SupermarketLandingPage />} />
            {/* Agency Portal */}
            <Route path="/agencia/login" element={<AgencyAuthProvider><AgencyLogin /></AgencyAuthProvider>} />
            <Route path="/agencia" element={<AgencyAuthProvider><AgencyLayout /></AgencyAuthProvider>}>
              <Route path="dashboard" element={<AgencyDashboard />} />
              <Route path="promotores" element={<AgencyPromoters />} />
              <Route path="marcas" element={<AgencyBrands />} />
              <Route path="visitas" element={<AgencyVisitRequests />} />
              <Route path="regras" element={<AgencyAccessRules />} />
            </Route>
            {/* Supermarket Portal */}
            <Route path="/supermercado/login" element={<SupermarketAuthProvider><SupermarketLogin /></SupermarketAuthProvider>} />
            <Route path="/supermercado" element={<SupermarketAuthProvider><SupermarketLayout /></SupermarketAuthProvider>}>
              <Route path="dashboard" element={<SupermarketDashboard />} />
              <Route path="ocorrencias" element={<SupermarketIncidents />} />
              <Route path="visitas" element={<SupermarketVisitRequests />} />
              <Route path="contatos" element={<SupermarketContacts />} />
              <Route path="assistente" element={<SupermarketAssistant />} />
              <Route path="historico" element={<SupermarketHistory />} />
              <Route path="configuracoes" element={<SupermarketSettings />} />
            </Route>
            {/* Promotor App */}
            <Route path="/promotor/login" element={<PromotorLogin />} />
            <Route path="/promotor/home" element={<PromotorHome />} />
            <Route path="/promotor/agenda" element={<PromotorAgenda />} />
            <Route path="/promotor/rota/:id" element={<PromotorRota />} />
            <Route path="/promotor/avarias" element={<PromotorAvarias />} />
            <Route path="/promotor/documentos" element={<PromotorDocumentos />} />
            <Route path="/promotor/ponto" element={<PromotorPonto />} />
            <Route path="/promotor/enviar" element={<PromotorEnviar />} />
            <Route path="/promotor/configuracoes" element={<PromotorConfig />} />
            <Route path="/promotor/trocar-senha" element={<PromotorTrocarSenha />} />
            <Route path="/promotor/equipe" element={<PromotorEquipe />} />
            <Route path="/api-docs" element={<ApiDocumentation />} />
            <Route path="/f/:slug" element={<PublicFormPage />} />
            <Route path="/assinar/:token" element={<AssinarDocumento />} />
            <Route path="/book/:token" element={<PublicPhotoBook />} />
            <Route path="/verificar/:documentId" element={<VerificarDocumento />} />
            <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/termos-servico" element={<TermosServico />} />
            <Route path="/exclusao-dados" element={<ExclusaoDados />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
