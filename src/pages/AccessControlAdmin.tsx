import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Store, Users, ShieldCheck, ClipboardList, DollarSign, ShieldAlert, Fingerprint } from "lucide-react";
import AccessControlNetworks from "@/components/access-control/NetworksTab";
import AccessControlUnits from "@/components/access-control/UnitsTab";
import AccessControlAgencies from "@/components/access-control/AgenciesTab";
import AccessControlPromoters from "@/components/access-control/PromotersTab";
import AccessControlLogs from "@/components/access-control/LogsTab";
import { AgencyBillingPanel } from "@/components/access-control/AgencyBillingPanel";
import AuthAttemptsTab from "@/components/access-control/AuthAttemptsTab";
import FraudLogsTab from "@/components/access-control/FraudLogsTab";

const AccessControlAdmin = () => {
  const [tab, setTab] = useState("networks");

  return (
    <MainLayout>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="networks" className="gap-2">
            <Building2 className="h-4 w-4" /> Redes
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-2">
            <Store className="h-4 w-4" /> Unidades
          </TabsTrigger>
          <TabsTrigger value="agencies" className="gap-2">
            <Users className="h-4 w-4" /> Agências
          </TabsTrigger>
          <TabsTrigger value="promoters" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Promotores
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <DollarSign className="h-4 w-4" /> Cobrança
          </TabsTrigger>
          <TabsTrigger value="auth-audit" className="gap-2">
            <Fingerprint className="h-4 w-4" /> Autenticação
          </TabsTrigger>
          <TabsTrigger value="fraud" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Fraudes
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="networks"><AccessControlNetworks /></TabsContent>
        <TabsContent value="units"><AccessControlUnits /></TabsContent>
        <TabsContent value="agencies"><AccessControlAgencies /></TabsContent>
        <TabsContent value="promoters"><AccessControlPromoters /></TabsContent>
        <TabsContent value="billing"><AgencyBillingPanel /></TabsContent>
        <TabsContent value="auth-audit"><AuthAttemptsTab /></TabsContent>
        <TabsContent value="fraud"><FraudLogsTab /></TabsContent>
        <TabsContent value="logs"><AccessControlLogs /></TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default AccessControlAdmin;