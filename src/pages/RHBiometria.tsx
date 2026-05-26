import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { FacialRecognitionConfigPanel } from "@/components/settings/FacialRecognitionConfigPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScanFace, Search, Camera, CheckCircle2, AlertTriangle, Users, Loader2, Trash2, ShieldCheck, Play, ShieldX } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { FaceCaptureDialog } from "@/components/facial-recognition/FaceCaptureDialog";
import { FaceVerifyDialog } from "@/components/facial-recognition/FaceVerifyDialog";

interface EmployeeFace {
  id: string;
  full_name: string;
  photo_url?: string;
  cpf?: string;
  position?: string;
  status: string;
  face_enrolled: boolean;
  face_photo_url?: string;
  face_enrolled_at?: string;
  facial_verification_enabled: boolean;
}

interface FacialConfig {
  min_confidence: number;
}

const RHBiometria = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollingName, setEnrollingName] = useState("");
  const [testingEmp, setTestingEmp] = useState<EmployeeFace | null>(null);
  const [testDescriptor, setTestDescriptor] = useState<number[]>([]);

  const { data: facialConfig } = useQuery({
    queryKey: ["rh-facial-config-threshold"],
    queryFn: async () => {
      try {
        return await api<FacialConfig>("/api/rh/facial-recognition/config");
      } catch {
        return { min_confidence: 70 };
      }
    },
    staleTime: 300000,
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["rh-facial-employees", filter],
    queryFn: () => api<EmployeeFace[]>(`/api/rh/facial-recognition/employees?filter=${filter}`),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api(`/api/rh/facial-recognition/enroll/${id}`, { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh-facial-employees"] });
      toast({ title: "Biometria cadastrada com sucesso!" });
      setEnrollingId(null);
    },
    onError: () => toast({ title: "Erro ao cadastrar biometria", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/rh/facial-recognition/enroll/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh-facial-employees"] });
      toast({ title: "Biometria removida" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const toggleFacialMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api(`/api/rh/facial-recognition/toggle-verification/${id}`, { method: "PUT", body: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh-facial-employees"] });
      qc.invalidateQueries({ queryKey: ["rh-facial-alerts"] });
      toast({ title: "Configuração atualizada" });
    },
    onError: () => toast({ title: "Erro ao atualizar configuração", variant: "destructive" }),
  });

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.cpf?.includes(search)
  );

  const enrolled = employees.filter((e) => e.face_enrolled).length;
  const pending = employees.filter((e) => !e.face_enrolled).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Config panel */}
        <FacialRecognitionConfigPanel />

        <Separator />

        {/* Enrollment Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Cadastro Facial dos Colaboradores
            </CardTitle>
            <CardDescription>
              Gerencie o cadastro biométrico facial de todos os colaboradores ativos
            </CardDescription>

            {/* Stats */}
            <div className="flex gap-4 pt-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{enrolled} cadastrados</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">{pending} pendentes</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{employees.length} total</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filter} onValueChange={setFilter} className="w-auto">
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="pending">Pendentes</TabsTrigger>
                  <TabsTrigger value="enrolled">Cadastrados</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Employee List */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum colaborador encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={emp.face_photo_url || emp.photo_url} />
                          <AvatarFallback className="text-xs">
                            {emp.full_name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {!emp.facial_verification_enabled && (
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full border-2 border-background p-0.5" title="Verificação facial desativada">
                            <ShieldX className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.position || "Sem cargo"} {emp.cpf ? `• ${emp.cpf}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className={emp.facial_verification_enabled ? "text-muted-foreground" : "text-amber-600 bg-amber-50"}
                        title={emp.facial_verification_enabled ? "Desativar verificação facial" : "Ativar verificação facial"}
                        onClick={() => toggleFacialMutation.mutate({ id: emp.id, enabled: !emp.facial_verification_enabled })}
                        disabled={toggleFacialMutation.isPending}
                      >
                        {emp.facial_verification_enabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                      </Button>
                      
                      {emp.face_enrolled ? (
                        <>
                          <Badge variant="default" className="bg-green-600 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Cadastrado
                          </Badge>
                          {emp.face_enrolled_at && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {new Date(emp.face_enrolled_at).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-8 w-8 p-0"
                            onClick={() => removeMutation.mutate(emp.id)}
                            disabled={removeMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1"
                            onClick={async () => {
                              try {
                                const data = await api<any>(`/api/rh/facial-recognition/descriptor/${emp.id}`);
                                if (data?.descriptor) {
                                  setTestDescriptor(data.descriptor);
                                  setTestingEmp(emp);
                                } else {
                                  toast({ title: 'Sem dados faciais para testar', variant: 'destructive' });
                                }
                              } catch {
                                toast({ title: 'Erro ao carregar dados faciais', variant: 'destructive' });
                              }
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Testar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setEnrollingId(emp.id);
                              setEnrollingName(emp.full_name);
                            }}
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Recadastrar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Pendente
                          </Badge>
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setEnrollingId(emp.id);
                              setEnrollingName(emp.full_name);
                            }}
                          >
                            <ScanFace className="h-3.5 w-3.5" />
                            Cadastrar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Face Capture Dialog */}
      <FaceCaptureDialog
        open={!!enrollingId}
        onOpenChange={(open) => {
          if (!open) setEnrollingId(null);
        }}
        title={`Cadastro Facial — ${enrollingName}`}
        description="Posicione o rosto do colaborador de frente para a câmera. O sistema detectará automaticamente os pontos faciais e validará a qualidade da foto."
        onCapture={(data) => {
          if (enrollingId) {
            enrollMutation.mutate({ id: enrollingId, data });
          }
        }}
      />

      {/* Face Verify Test Dialog */}
      <FaceVerifyDialog
        open={!!testingEmp}
        onOpenChange={(open) => { if (!open) { setTestingEmp(null); setTestDescriptor([]); } }}
        storedDescriptor={testDescriptor}
        storedPhotoUrl={testingEmp?.face_photo_url || testingEmp?.photo_url}
        personName={testingEmp?.full_name}
        threshold={facialConfig?.min_confidence ?? 70}
        onResult={(result) => {
          toast({
            title: result.match ? '✅ Teste aprovado!' : '❌ Teste reprovado',
            description: `Similaridade: ${result.score.toFixed(1)}%`,
            variant: result.match ? 'default' : 'destructive',
          });
        }}
      />
    </MainLayout>
  );
};

export default RHBiometria;
