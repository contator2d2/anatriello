import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useRouteResearch, useExecuteResearch } from "@/hooks/use-price-research";
import {
  DollarSign, ChevronRight, CheckCircle2, Clock, AlertTriangle, Camera, Save,
} from "lucide-react";

interface PriceResearchCardProps {
  routeId: string;
  brandId: string;
  brandName: string;
  pdvId: string;
  promoterId: string;
  pdvName?: string;
  promotorName?: string;
}

export function PriceResearchCard({ routeId, brandId, brandName, pdvId, promoterId, pdvName, promotorName }: PriceResearchCardProps) {
  const { data: researches = [] } = useRouteResearch(routeId);
  const executeResearch = useExecuteResearch();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Find research for this brand
  const research = researches.find((r: any) => r.brand_id === brandId);

  useEffect(() => {
    if (research?.items?.length > 0) {
      setItems(research.items);
    }
  }, [research]);

  if (!research) return null;

  const status = research.status || 'not_started';
  const isMandatory = research.rule?.block_route_completion || research.is_mandatory;

  const completedCount = items.filter(i => i.price !== null && i.price !== undefined && i.price !== '').length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const updateItemPrice = (idx: number, price: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], price: price === '' ? null : parseFloat(price) };
    setItems(updated);
  };

  const updateCompetitorPrice = (itemIdx: number, compIdx: number, price: string) => {
    const updated = [...items];
    const comps = [...(updated[itemIdx].competitors || [])];
    comps[compIdx] = { ...comps[compIdx], price: price === '' ? null : parseFloat(price) };
    updated[itemIdx] = { ...updated[itemIdx], competitors: comps };
    setItems(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await executeResearch.mutateAsync({
        route_id: routeId,
        brand_id: brandId,
        pdv_id: pdvId,
        promoter_id: promoterId,
        items: items.map(i => ({
          product_id: i.product_id,
          price: i.price,
          observation: i.observation,
          competitors: i.competitors?.map((c: any) => ({
            competitor_product_id: c.competitor_product_id || c.id,
            competitor_id: c.competitor_id,
            competitor_product_name: c.competitor_product_name,
            competitor_brand_name: c.competitor_brand_name || c.competitor_name,
            price: c.price,
            observation: c.observation,
          })),
        })),
      });
      toast.success('Pesquisa salva!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    not_started: { label: 'Não iniciada', color: 'bg-muted text-muted-foreground', icon: Clock },
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    in_progress: { label: 'Em andamento', color: 'bg-blue-100 text-blue-800', icon: Clock },
    completed: { label: 'Concluída', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    postponed: { label: 'Prorrogada', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
    mandatory: { label: 'Obrigatória', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  };

  const displayStatus = isMandatory && status !== 'completed' ? 'mandatory' : status;
  const sc = statusConfig[displayStatus] || statusConfig.not_started;
  const StatusIcon = sc.icon;

  return (
    <>
      <Card className={`cursor-pointer hover:shadow-md transition-shadow ${isMandatory && status !== 'completed' ? 'border-destructive' : ''}`}
        onClick={() => setOpen(true)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Pesquisa de Preços</p>
                <p className="text-xs text-muted-foreground">{brandName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={sc.color}>
                <StatusIcon className="h-3 w-3 mr-1" />{sc.label}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          {totalCount > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{completedCount}/{totalCount} produtos</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          )}
          {isMandatory && status !== 'completed' && (
            <p className="text-xs text-destructive mt-2 font-medium">
              ⚠️ Pesquisa de preços obrigatória nesta visita
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Pesquisa de Preços — {brandName}
            </DialogTitle>
          </DialogHeader>

          {items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum produto configurado para pesquisa nesta marca
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => (
                <Card key={item.product_id || idx} className="p-3">
                  <p className="font-medium text-sm mb-2">{item.product_name || `Produto ${idx + 1}`}</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Preço encontrado (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={item.price ?? ''}
                        onChange={e => updateItemPrice(idx, e.target.value)}
                        className="h-9"
                      />
                    </div>

                    {item.competitors?.length > 0 && (
                      <div className="ml-3 border-l-2 border-muted pl-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Concorrentes</p>
                        {item.competitors.map((comp: any, cIdx: number) => (
                          <div key={comp.id || cIdx}>
                            <Label className="text-xs">{comp.competitor_brand_name || comp.competitor_name} — {comp.competitor_product_name}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0,00"
                              value={comp.price ?? ''}
                              onChange={e => updateCompetitorPrice(idx, cIdx, e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={handleSave} disabled={saving || items.length === 0}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Salvando...' : 'Salvar Pesquisa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
