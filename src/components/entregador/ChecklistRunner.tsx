// SmartRoute — Runner de checklist do entregador (Onda 2)
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Camera, Loader2, Sparkles, MapPin } from "lucide-react";
import {
  useStopChecklist, useSaveChecklistItem, useStopOcr,
  getPos, pickPhoto,
} from "@/hooks/use-smartroute-journey";

const TYPE_LABEL: Record<string, string> = {
  photo: "Foto", video: "Vídeo", text: "Texto", number: "Número",
  temperature: "Temperatura °C", stock_count: "Contagem", ocr: "Foto + IA",
  qr: "QR Code", barcode: "Código de barras", signature: "Assinatura",
  geo: "GPS", face: "Selfie", yes_no: "Sim / Não", multi_choice: "Escolha",
};

export function ChecklistRunner({ stopId }: { stopId: string }) {
  const { data, isLoading } = useStopChecklist(stopId);
  const save = useSaveChecklistItem(stopId);
  const ocr = useStopOcr(stopId);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <div className="text-center text-sm text-muted-foreground py-6">Carregando checklist…</div>;
  if (!data?.items?.length) {
    return (
      <Card><CardContent className="p-4 text-sm text-muted-foreground text-center">
        Nenhum checklist aplicável a este PDV.
      </CardContent></Card>
    );
  }

  const total = data.items.length;
  const done = data.items.filter((i: any) => i.response).length;

  const answer = async (item: any, value: any, extra: any = {}) => {
    setBusy(item.id);
    try {
      const pos = await getPos();
      await save.mutateAsync({ itemId: item.id, value, ...pos, ...extra });
      toast.success("Registrado");
    } catch (e: any) { toast.error(e?.message || "Falha ao salvar"); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="secondary">{done}/{total} respondidos</Badge>
        {data.templates?.map((t: any) => (
          <Badge key={t.id} variant="outline" className="text-xs">{t.name}</Badge>
        ))}
      </div>

      {data.items.map((item: any) => (
        <Card key={item.id} className={item.response ? "border-emerald-200 bg-emerald-50/40" : ""}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-2">
              {item.response
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1" />
                : <span className="w-4 h-4 rounded-full border mt-1" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {item.label}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                <div className="text-xs text-muted-foreground">{TYPE_LABEL[item.field_type] || item.field_type}</div>
              </div>
            </div>

            <FieldEditor
              item={item}
              busy={busy === item.id || save.isPending}
              ocrRunning={ocr.isPending}
              onAnswer={answer}
              onOcr={async (image) => {
                const r = await ocr.mutateAsync({ image });
                await answer(item, r.parsed, { ocr_json: r.parsed });
                return r.parsed;
              }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FieldEditor({ item, busy, ocrRunning, onAnswer, onOcr }: any) {
  const cfg = item.config || {};
  const existing = item.response?.value;
  const [text, setText] = useState<string>(existing?.text || existing || "");
  const [num, setNum] = useState<string>(existing != null ? String(existing?.value ?? existing) : "");
  const [choice, setChoice] = useState<string>(existing?.choice || "");
  const [ocrData, setOcrData] = useState<any>(item.response?.ocr_json || null);

  const t = item.field_type;

  if (t === "yes_no") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant={existing === true ? "default" : "outline"} disabled={busy}
          onClick={() => onAnswer(item, true)}>Sim</Button>
        <Button size="sm" variant={existing === false ? "destructive" : "outline"} disabled={busy}
          onClick={() => onAnswer(item, false)}>Não</Button>
      </div>
    );
  }

  if (t === "multi_choice") {
    const opts: string[] = cfg.options || [];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <Button key={o} size="sm" variant={choice === o ? "default" : "outline"} disabled={busy}
            onClick={() => { setChoice(o); onAnswer(item, { choice: o }); }}>{o}</Button>
        ))}
      </div>
    );
  }

  if (t === "text") {
    return (
      <div className="space-y-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite…" />
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => onAnswer(item, { text })}>Salvar</Button>
      </div>
    );
  }

  if (t === "number" || t === "temperature" || t === "stock_count") {
    return (
      <div className="flex gap-2">
        <Input type="number" value={num} onChange={(e) => setNum(e.target.value)}
          placeholder={t === "temperature" ? "°C" : "Valor"} />
        <Button size="sm" disabled={busy || num === ""} onClick={() => onAnswer(item, { value: Number(num) })}>Salvar</Button>
      </div>
    );
  }

  if (t === "geo") {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        const pos = await getPos();
        if (pos.lat == null) return toast.error("Não foi possível obter a localização");
        onAnswer(item, pos);
      }}>
        <MapPin className="w-3 h-3 mr-1" /> Registrar coordenada
      </Button>
    );
  }

  if (t === "qr" || t === "barcode") {
    return (
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t === "qr" ? "Cole o QR" : "Cole ou digite o código"} />
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => onAnswer(item, { code: text })}>Salvar</Button>
      </div>
    );
  }

  if (t === "ocr") {
    return (
      <div className="space-y-2">
        <Button size="sm" disabled={busy || ocrRunning} onClick={async () => {
          const img = await pickPhoto();
          if (!img) return;
          try {
            const parsed = await onOcr(img);
            setOcrData(parsed);
          } catch (e: any) { toast.error(e?.message || "Falha no OCR"); }
        }}>
          {ocrRunning
            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analisando…</>
            : <><Sparkles className="w-3 h-3 mr-1" /> Tirar foto e extrair</>}
        </Button>
        {ocrData && (
          <div className="text-xs bg-white border rounded p-2 space-y-0.5">
            {ocrData.product && <div><b>Produto:</b> {ocrData.product}</div>}
            {ocrData.brand && <div><b>Marca:</b> {ocrData.brand}</div>}
            {ocrData.ean && <div><b>EAN:</b> {ocrData.ean}</div>}
            {ocrData.batch && <div><b>Lote:</b> {ocrData.batch}</div>}
            {ocrData.expires_at && <div><b>Validade:</b> {ocrData.expires_at}</div>}
            {ocrData.confidence != null && <div className="text-muted-foreground">Confiança IA: {(ocrData.confidence * 100).toFixed(0)}%</div>}
          </div>
        )}
      </div>
    );
  }

  // photo, video, face, signature — captura simples
  return (
    <Button size="sm" variant={item.response ? "secondary" : "default"} disabled={busy}
      onClick={async () => {
        const url = await pickPhoto();
        if (!url) return;
        onAnswer(item, { url });
      }}>
      <Camera className="w-3 h-3 mr-1" /> {item.response ? "Substituir" : "Capturar"}
    </Button>
  );
}
