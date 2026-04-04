import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Store, Users, ShieldCheck, ClipboardList, DollarSign, ShieldAlert, Fingerprint, Bot } from "lucide-react";
import AccessControlNetworks from "@/components/access-control/NetworksTab";
import AccessControlUnits from "@/components/access-control/UnitsTab";
import AccessControlAgencies from "@/components/access-control/AgenciesTab";
import AccessControlPromoters from "@/components/access-control/PromotersTab";
import AccessControlLogs from "@/components/access-control/LogsTab";
import { AgencyBillingPanel } from "@/components/access-control/AgencyBillingPanel";
import AuthAttemptsTab from "@/components/access-control/AuthAttemptsTab";
import FraudLogsTab from "@/components/access-control/FraudLogsTab";
import WhatsAppAgentConfigTab from "@/components/access-control/WhatsAppAgentConfigTab";

const AccessControlAdmin = () => {
  const [tab, setTab] = useState("networks");

  return (
    <MainLayout>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 pb-1">
          <TabsList className="inline-flex gap-1 min-w-max">
            <TabsTrigger value="networks" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Redes</span><span className="sm:hidden">Redes</span>
            </TabsTrigger>
            <TabsTrigger value="units" className="gap-1.5 text-xs sm:text-sm">
              <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Unidades</span><span className="sm:hidden">PDVs</span>
            </TabsTrigger>
            <TabsTrigger value="agencies" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Agências</span><span className="sm:hidden">Agên.</span>
            </TabsTrigger>
            <TabsTrigger value="promoters" className="gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Promotores</span><span className="sm:hidden">Prom.</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Cobrança</span><span className="sm:hidden">Cobr.</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp-agent" className="gap-1.5 text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Agente IA</span><span className="sm:hidden">IA</span>
            </TabsTrigger>
            <TabsTrigger value="auth-audit" className="gap-1.5 text-xs sm:text-sm">
              <Fingerprint className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Autenticação</span><span className="sm:hidden">Auth</span>
            </TabsTrigger>
            <TabsTrigger value="fraud" className="gap-1.5 text-xs sm:text-sm">
              <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Fraudes</span><span className="sm:hidden">Fraud</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Logs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="networks"><AccessControlNetworks /></TabsContent>
        <TabsContent value="units"><AccessControlUnits /></TabsContent>
        <TabsContent value="agencies"><AccessControlAgencies /></TabsContent>
        <TabsContent value="promoters"><AccessControlPromoters /></TabsContent>
        <TabsContent value="billing"><AgencyBillingPanel /></TabsContent>
        <TabsContent value="whatsapp-agent"><WhatsAppAgentConfigTab /></TabsContent>
        <TabsContent value="auth-audit"><AuthAttemptsTab /></TabsContent>
        <TabsContent value="fraud"><FraudLogsTab /></TabsContent>
        <TabsContent value="logs"><AccessControlLogs /></TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default AccessControlAdmin;