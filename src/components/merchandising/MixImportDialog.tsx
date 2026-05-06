import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseImportFile, getImportValue } from "@/lib/merch-import";
import { useImportMix } from "@/hooks/use-merchandising";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle, Layers } from "lucide-react";

interface Row {
  __line: string;
  pdv_name: string;
  brand_name: string;
  product_name: string;
  sku?: string;
  mandatory?: string;
  priority?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MixImportDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"upload" | "validate" | "importing" | "done">("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportMix();

  const reset = () => {
    setStep("upload"); setRows([]); setFileName(""); setProgress(0); setResult(null);
  };
  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = await parseImportFile(file);
      const mapped: Row[] = parsed.map((r) => ({
        __line: getImportValue(r, ["__line"]) || "",
        pdv_name: getImportValue(r, ["pdv", "pdv_name", "loja", "fantasia", "store"]),
        brand_name: getImportValue(r, ["marca", "brand", "brand_name", "cliente", "fornecedor"]),
        product_name: getImportValue(r, ["produto", "product", "product_name", "name", "nome", "descricao", "descrição"]),
        sku: getImportValue(r, ["sku", "codigo_interno", "código interno", "ref"]),
        mandatory: getImportValue(r, ["obrigatorio", "obrigatório", "mandatory"]),
        priority: getImportValue(r, ["prioridade", "priority"]),
      })).filter(r => r.pdv_name && r.brand_name && r.product_name);

      if (!mapped.length) {
        toast.error("Nenhuma linha válida. Esperado colunas: PDV, Marca, Produto");
        return;
      }
      setRows(mapped);
      setStep("validate");
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler arquivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);
    const chunkSize = 200;
    const aggregated: any = {
      total: rows.length, inserted: 0, updated: 0, skipped: 0,
      missing_pdvs: [], missing_brands: [], missing_products: [], errors: [],
    };
    try {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const res = await importMutation.mutateAsync({ items: chunk });
        aggregated.inserted += res.inserted || 0;
        aggregated.updated += res.updated || 0;
        aggregated.skipped += res.skipped || 0;
        aggregated.missing_pdvs.push(...(res.missing_pdvs || []));
        aggregated.missing_brands.push(...(res.missing_brands || []));
        aggregated.missing_products.push(...(res.missing_products || []));
        aggregated.errors.push(...(res.errors || []));
        setProgress(Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100)));
      }
      setResult(aggregated);
      setStep("done");
      toast.success(`${aggregated.inserted} inseridos, ${aggregated.updated} atualizados`);
    } catch (err: any) {
      toast.error(err.message || "Erro na importação");
      setStep("validate");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Importar Mix por PDV
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para selecionar (CSV ou Excel)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Colunas: <code>PDV</code>, <code>Marca</code>, <code>Produto</code> (opcionais: <code>SKU</code>, <code>Obrigatório</code>, <code>Prioridade</code>)
              </p>
            </div>
            <Alert className="border-primary/30 bg-primary/5">
              <AlertDescription className="text-xs">
                PDVs, marcas e produtos precisam estar previamente cadastrados. Itens não encontrados serão listados sem interromper a importação.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "validate" && (
          <div className="space-y-3 py-2">
            <p className="text-sm">{fileName} — <strong>{rows.length}</strong> linha(s) válida(s)</p>
            <Alert>
              <AlertDescription className="text-xs">
                Vínculos existentes serão atualizados. Novos serão criados.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-3 py-6">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando... {progress}%
            </div>
            <Progress value={progress} />
          </div>
        )}

        {step === "done" && result && (
          <ScrollArea className="flex-1 max-h-[60vh] pr-3">
            <div className="space-y-3">
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-xs space-y-1">
                  <div><strong>Total processado:</strong> {result.total}</div>
                  <div><strong>{result.inserted}</strong> novo(s) vínculo(s)</div>
                  <div><strong>{result.updated}</strong> atualizado(s)</div>
                  {result.skipped > 0 && <div>{result.skipped} ignorado(s) (linhas incompletas)</div>}
                </AlertDescription>
              </Alert>

              {result.missing_pdvs?.length > 0 && (
                <Alert className="border-yellow-500/30 bg-yellow-500/5">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs">
                    <strong>{result.missing_pdvs.length} PDV(s) não encontrado(s):</strong>
                    <div className="mt-1 max-h-32 overflow-auto">
                      {result.missing_pdvs.slice(0, 30).map((m: any, i: number) => (
                        <div key={i}>L{m.line}: {m.pdv}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {result.missing_brands?.length > 0 && (
                <Alert className="border-yellow-500/30 bg-yellow-500/5">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs">
                    <strong>{result.missing_brands.length} marca(s) não encontrada(s):</strong>
                    <div className="mt-1 max-h-32 overflow-auto">
                      {result.missing_brands.slice(0, 30).map((m: any, i: number) => (
                        <div key={i}>L{m.line}: {m.brand}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {result.missing_products?.length > 0 && (
                <Alert className="border-yellow-500/30 bg-yellow-500/5">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-xs">
                    <strong>{result.missing_products.length} produto(s) não encontrado(s):</strong>
                    <div className="mt-1 max-h-40 overflow-auto">
                      {result.missing_products.slice(0, 50).map((m: any, i: number) => (
                        <div key={i}>L{m.line}: {m.brand} → {m.product}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {result.errors?.length > 0 && (
                <Alert className="border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-xs">
                    <strong>{result.errors.length} erro(s):</strong>
                    <div className="mt-1 max-h-40 overflow-auto">
                      {result.errors.slice(0, 50).map((e: any, i: number) => (
                        <div key={i}>L{e.line}: {e.product} — {e.error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {step === "validate" && (
            <Button onClick={handleImport} disabled={!rows.length}>
              <Upload className="h-4 w-4 mr-2" />
              Importar {rows.length} linha(s)
            </Button>
          )}
          {step === "done" && <Button onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
