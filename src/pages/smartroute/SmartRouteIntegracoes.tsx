import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSRWebhookToken, useSRRotateWebhookToken } from "@/hooks/use-smartroute";
import { Copy, RefreshCw, Webhook, Code } from "lucide-react";
import { toast } from "sonner";

export default function SmartRouteIntegracoes() {
  const { data } = useSRWebhookToken();
  const rotate = useSRRotateWebhookToken();
  const base = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, "");
  const url = data?.token ? `${base}/api/smartroute-public/webhook/orders/${data.token}` : "";
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  const example = `curl -X POST ${url || "<URL>"} \\
  -H "Content-Type: application/json" \\
  -d '{
    "order_number": "PED-1001",
    "pdv_cnpj": "12.345.678/0001-90",
    "pdv_name": "Supermercado Anatriello Centro",
    "address": "Rua das Flores, 100",
    "city": "São Paulo",
    "state": "SP",
    "lat": -23.5505,
    "lng": -46.6333,
    "customer_name": "João Silva",
    "customer_phone": "11999998888",
    "weight_kg": 12.5,
    "volume_m3": 0.08,
    "value_cents": 24990,
    "priority": 5,
    "delivery_date": "2026-07-08",
    "items": [{ "sku": "A1", "qty": 2 }]
  }'`;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Webhook className="w-6 h-6" /> Integrações</h1>
          <p className="text-sm text-muted-foreground">Importe pedidos do seu ERP diretamente para o SmartRoute.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Webhook de importação de pedidos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">URL do webhook</label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={url} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copy(url)}><Copy className="w-4 h-4" /></Button>
                <Button size="icon" variant="outline" onClick={() => rotate.mutate()} title="Rotacionar token"><RefreshCw className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Mantenha esse token secreto. Rotacionar invalida o anterior.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Code className="w-3 h-3" /> Exemplo cURL</label>
              <pre className="mt-1 p-3 bg-slate-900 text-slate-100 text-xs rounded overflow-x-auto">{example}</pre>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div><b>Campos aceitos:</b> order_number, pdv_id ou pdv_cnpj (+ pdv_name/address/city/state/lat/lng se novo), customer_name, customer_phone, weight_kg, volume_m3, value_cents, priority (1-10), delivery_date (YYYY-MM-DD), items (array), notes.</div>
              <div><b>Resposta:</b> <code>{`{ ok, id, tracking_token }`}</code>. Use <code>tracking_token</code> para gerar o link público: <code>{`${base}/track/{tracking_token}`}</code>.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Portal de rastreio (cliente final)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Cada pedido criado (via webhook ou manual) recebe um link público sem login:</p>
            <code className="block p-2 bg-slate-100 rounded">{base}/track/&lt;tracking_token&gt;</code>
            <p className="text-muted-foreground text-xs">Cliente acompanha o motorista em tempo real, vê ETA, timeline da entrega, comprovante e avalia (NPS 1-5) após o recebimento.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
