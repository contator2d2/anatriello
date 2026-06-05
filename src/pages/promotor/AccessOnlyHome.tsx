import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePromotorHome } from "@/hooks/use-promotor";
import { QrScanner } from "@/components/promotor/QrScanner";
import { 
  QrCode, LogOut, MapPin, Clock, Calendar, 
  CheckCircle2, Loader2, User, Building2, Store
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

export default function AccessOnlyHome() {
  const { data, isLoading, refetch } = usePromotorHome();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const employee = data?.employee;
  const todayVisits = data?.today_routes || []; // We use the same 'routes' data but display it as 'visits'
  const activeVisit = todayVisits.find((v: any) => v.status === 'in_progress');

  const handleLogout = () => {
    localStorage.removeItem('promotor_token');
    localStorage.removeItem('promotor_employee');
    navigate('/promotor/login');
  };

  const handleQrScan = async (scannedId: string) => {
    setQrLoading(true);
    try {
      logger.info('[handleQrScan] Processando scan de QR Code no Access App', { scannedId });
      
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, 
          timeout: 10000 
        })
      ).catch(() => null); // Location is optional but good to have
      
      const res = await api<any>('/api/access-control/qr-scan', {
        method: 'POST',
        body: {
          unit_id: scannedId,
          latitude: pos?.coords.latitude,
          longitude: pos?.coords.longitude
        }
      });
      
      toast({ 
        title: 'Acesso solicitado!', 
        description: 'Sua entrada está sendo analisada pelo supermercado.' 
      });
      setShowQrScanner(false);
      refetch();
    } catch (err: any) {
      toast({ 
        title: 'Erro no acesso', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setQrLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {employee?.name?.[0]}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ayratech Access</p>
              <h1 className="text-sm font-bold truncate max-w-[150px]">{employee?.name}</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Status Card */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-primary to-primary-dark p-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <p className="text-primary-foreground/80 text-sm font-medium">Status de Hoje</p>
                  <h2 className="text-2xl font-bold">
                    {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </h2>
                </div>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm px-3 py-1">
                  {todayVisits.length} visitas
                </Badge>
              </div>
              
              {activeVisit ? (
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/20 mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70">Visita em andamento</p>
                      <p className="font-semibold">{activeVisit.pdv_name}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/20 mt-4">
                  <p className="text-sm text-white/90">Aguardando seu primeiro check-in no PDV.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR Scan Button - Primary Action */}
        <div className="flex flex-col gap-4">
          <Button 
            size="lg" 
            className="h-24 text-lg font-bold gap-3 shadow-lg shadow-primary/20 rounded-2xl transition-transform active:scale-95"
            onClick={() => setShowQrScanner(true)}
          >
            <QrCode className="h-8 w-8" />
            ESCANEAR QR CODE
          </Button>
        </div>

        {/* Visits List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Minhas Visitas
            </h3>
          </div>

          {todayVisits.length > 0 ? (
            <div className="grid gap-3">
              {todayVisits.map((visit: any) => (
                <Card key={visit.id} className="border-none shadow-sm hover:ring-1 hover:ring-primary/20 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          visit.status === 'completed' ? 'bg-green-100 text-green-600' :
                          visit.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{visit.pdv_name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {visit.pdv_address || 'Endereço não informado'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={
                        visit.status === 'completed' ? 'outline' :
                        visit.status === 'in_progress' ? 'default' :
                        'secondary'
                      } className={cn(
                        "text-[10px] px-2 py-0",
                        visit.status === 'completed' && "bg-green-100 text-green-700 border-green-200"
                      )}>
                        {visit.status === 'completed' ? 'Concluída' :
                         visit.status === 'in_progress' ? 'Em curso' : 'Agendada'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center space-y-3 border-2 border-dashed border-slate-200">
              <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <Building2 className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">Nenhuma visita agendada para hoje.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="px-6 py-8 text-center text-xs text-slate-400">
        <p>© 2026 Ayratech Access • v2.0</p>
      </footer>

      {/* QR Scanner Dialog */}
      <Dialog open={showQrScanner} onOpenChange={setShowQrScanner}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-slate-900">
          <DialogHeader className="p-6 bg-slate-900 border-b border-white/10">
            <DialogTitle className="text-white flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Escanear QR Code da Loja
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-slate-900">
            {!qrLoading ? (
              <div className="space-y-6">
                <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/10">
                  <QrScanner 
                    onScanSuccess={handleQrScan} 
                    onScanFailure={(err) => console.log('QR Error:', err)}
                  />
                  {/* Decorative corners */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-white">Posicione o código no centro</p>
                  <p className="text-xs text-slate-400">O acesso será solicitado automaticamente após a leitura.</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full border-white/10 text-white hover:bg-white/5"
                  onClick={() => setShowQrScanner(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <QrCode className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
                </div>
                <p className="text-white font-medium">Processando solicitação...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
