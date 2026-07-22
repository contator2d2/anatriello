import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSRSavePdv } from "@/hooks/use-smartroute";

const FIELDS: { key: string; label: string; required?: boolean; hint?: string }[] = [
  { key: "name", label: "Nome / Razão Social", required: true },
  { key: "cnpj", label: "CNPJ" },
  { key: "zip", label: "CEP" },
  { key: "address", label: "Endereço" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF", hint: "2 letras" },
  { key: "lat", label: "Latitude" },
  { key: "lng", label: "Longitude" },
  { key: "contact_name", label: "Contato (nome)" },
  { key: "contact_phone", label: "Contato (telefone)" },
  { key: "delivery_window", label: "Janela preferencial", hint: "manha/tarde/noite/qualquer" },
  { key: "delivery_window_start", label: "Janela início", hint: "HH:MM" },
  { key: "delivery_window_end", label: "Janela fim", hint: "HH:MM" },
  { key: "service_time_min", label: "Tempo descarga (min)" },
  { key: "notes", label: "Observações" },
];

const IGNORE = "__ignore__";

// Simple auto-mapping by header similarity
function guessField(header: string): string {
  const h = header.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    nome: "name", razaosocial: "name", cliente: "name", pdv: "name",
    cnpj: "cnpj", documento: "cnpj",
    cep: "zip", zip: "zip",
    endereco: "address", logradouro: "address", rua: "address",
    cidade: "city", municipio: "city",
    uf: "state", estado: "state",
    lat: "lat", latitude: "lat",
    lng: "lng", lon: "lng", longitude: "lng",
    contato: "contact_name", nomecontato: "contact_name",
    telefone: "contact_phone", fone: "contact_phone", celular: "contact_phone",
    janela: "delivery_window", periodo: "delivery_window",
    inicio: "delivery_window_start", horainicio: "delivery_window_start",
    fim: "delivery_window_end", horafim: "delivery_window_end",
    tempodescarga: "service_time_min", descarga: "service_time_min", tempo: "service_time_min",
    observacao: "notes", observacoes: "notes", obs: "notes",
  };
  return map[h] || IGNORE;
}

function normWindow(v: any): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).toLowerCase().trim();
  if (s.startsWith("m")) return "manha";
  if (s.startsWith("t")) return "tarde";
  if (s.startsWith("n")) return "noite";
  return "qualquer";
}

export function PDVImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; onImported?: () => void }) {
  const save = useSRSavePdv();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // header -> field
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0 });
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({}); setImporting(false); setProgress({ done: 0, ok: 0, fail: 0 }); setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
      if (!json.length) { toast.error("Planilha vazia"); return; }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      const initial: Record<string, string> = {};
      const used = new Set<string>();
      hdrs.forEach(h => {
        const g = guessField(h);
        if (g !== IGNORE && !used.has(g)) { initial[h] = g; used.add(g); } else { initial[h] = IGNORE; }
      });
      setMapping(initial);
    } catch (e: any) {
      toast.error("Falha ao ler planilha", { description: e.message });
    }
  };

  const mappedFieldSet = useMemo(() => new Set(Object.values(mapping).filter(v => v !== IGNORE)), [mapping]);
  const missingRequired = FIELDS.filter(f => f.required && !mappedFieldSet.has(f.key));

  const buildRow = (r: Record<string, any>) => {
    const out: any = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field === IGNORE) continue;
      let v: any = r[header];
      if (v === "" || v === undefined || v === null) continue;
      if (field === "lat" || field === "lng") v = parseFloat(String(v).replace(",", "."));
      if (field === "service_time_min") v = parseInt(String(v), 10);
      if (field === "state") v = String(v).toUpperCase().slice(0, 2);
      if (field === "zip") v = String(v).replace(/\D/g, "");
      if (field === "delivery_window") v = normWindow(v);
      out[field] = v;
    }
    if (!out.delivery_window) out.delivery_window = "qualquer";
    if (!out.service_time_min) out.service_time_min = 15;
    if (!out.allowed_weekdays) out.allowed_weekdays = [1, 2, 3, 4, 5];
    return out;
  };

  const handleImport = async () => {
    if (missingRequired.length) { toast.error(`Mapeie os campos obrigatórios: ${missingRequired.map(f => f.label).join(", ")}`); return; }
    setImporting(true);
    setProgress({ done: 0, ok: 0, fail: 0 });
    for (let i = 0; i < rows.length; i++) {
      const body = buildRow(rows[i]);
      if (!body.name) { setProgress(p => ({ ...p, done: p.done + 1, fail: p.fail + 1 })); continue; }
      try { await save.mutateAsync(body); setProgress(p => ({ ...p, done: p.done + 1, ok: p.ok + 1 })); }
      catch { setProgress(p => ({ ...p, done: p.done + 1, fail: p.fail + 1 })); }
    }
    setImporting(false);
    toast.success("Importação concluída");
    onImported?.();
  };

  const downloadTemplate = () => {
    const sample = [{
      Nome: "Mercado Exemplo Ltda", CNPJ: "12.345.678/0001-90", CEP: "01310-100",
      Endereco: "Av. Paulista, 1000", Cidade: "São Paulo", UF: "SP",
      Latitude: -23.561, Longitude: -46.656,
      Contato: "João", Telefone: "(11) 99999-9999",
      Janela: "manha", "Hora Inicio": "08:00", "Hora Fim": "12:00",
      "Tempo Descarga": 15, Observacoes: "Recebimento pelo portão lateral",
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PDVs");
    XLSX.writeFile(wb, "modelo-importacao-pdvs.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Importar PDVs por planilha</DialogTitle>
        </DialogHeader>

        {!rows.length && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/20">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Selecione um arquivo <b>.xlsx</b>, <b>.xls</b> ou <b>.csv</b></p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div className="flex gap-2 justify-center">
                <Button onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Escolher arquivo</Button>
                <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1" /> Baixar modelo</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Campos disponíveis para mapeamento:</p>
              <div className="flex flex-wrap gap-1">
                {FIELDS.map(f => (
                  <Badge key={f.key} variant={f.required ? "default" : "outline"} className="text-[10px]">
                    {f.label}{f.required && " *"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {!!rows.length && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div><FileSpreadsheet className="w-4 h-4 inline mr-1" /> <b>{fileName}</b> — {rows.length} linhas detectadas</div>
              <Button variant="ghost" size="sm" onClick={reset}>Trocar arquivo</Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Mapeamento de colunas</h3>
              <p className="text-xs text-muted-foreground mb-3">Escolha para qual campo do PDV cada coluna da sua planilha deve ser enviada. Colunas marcadas como "Ignorar" não serão importadas.</p>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coluna da planilha</TableHead>
                      <TableHead>Exemplo</TableHead>
                      <TableHead>Campo do PDV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headers.map(h => (
                      <TableRow key={h}>
                        <TableCell className="font-medium">{h}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{String(rows[0]?.[h] ?? "")}</TableCell>
                        <TableCell>
                          <Select value={mapping[h] || IGNORE} onValueChange={(v) => setMapping({ ...mapping, [h]: v })}>
                            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={IGNORE}>— Ignorar —</SelectItem>
                              {FIELDS.map(f => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label}{f.required && " *"}{f.hint && ` (${f.hint})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!!missingRequired.length && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="w-4 h-4" /> Faltam campos obrigatórios: {missingRequired.map(f => f.label).join(", ")}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Prévia (5 primeiras linhas)</h3>
              <div className="border rounded-md overflow-auto max-h-64">
                <Table>
                  <TableHeader><TableRow>{headers.map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>{headers.map(h => <TableCell key={h} className="text-xs">{String(r[h] ?? "")}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {importing && (
              <div className="rounded-md border p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm mb-2"><Loader2 className="w-4 h-4 animate-spin" /> Importando {progress.done}/{rows.length}...</div>
                <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(progress.done / rows.length) * 100}%` }} /></div>
              </div>
            )}
            {!importing && progress.done > 0 && (
              <div className="rounded-md border p-3 bg-green-50 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Concluído: <b>{progress.ok}</b> importados{progress.fail > 0 && <>, <b className="text-red-600">{progress.fail}</b> falharam</>}.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!!rows.length && (
            <Button onClick={handleImport} disabled={importing || !!missingRequired.length}>
              {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Importar {rows.length} PDVs
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
