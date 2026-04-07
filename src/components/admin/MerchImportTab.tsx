import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { mapProductImportRow, mapBrandImportRow, parseImportFile } from "@/lib/merch-import";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Download, AlertTriangle, Tags, Building2, Package } from "lucide-react";

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  ok?: boolean;
  created?: number;
  skipped?: number;
  total?: number;
  imported?: number;
  failed?: number;
  success?: number;
  brands_created?: number;
  categories_created?: number;
  errors?: {
    row?: string | number;
    line?: number;
    sku?: string;
    name?: string;
    brand_name?: string;
    category_name?: string;
    subcategory_name?: string;
    error: string;
  }[];
}

const BRAND_COLUMNS = ["codigo/id", "name/nome/descricao", "razao_social", "cnpj", "telefone", "status"];
const PRODUCT_COLUMNS = ["id_familia/codigo_familia", "brand_name/marca", "name/produto", "sku/codigo_interno", "barcode/ean", "categoria", "subcategoria", "status"];

function ImportSection({ type }: { type: "brands" | "products" }) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isBrands = type === "brands";
  const columns = isBrands ? BRAND_COLUMNS : PRODUCT_COLUMNS;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const rows = await parseImportFile(file);
      if (!rows.length) { toast.error("Arquivo vazio ou sem linhas válidas"); return; }
      setParsedData(rows);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível ler o arquivo");
    }
  };

  const handleImport = async () => {
    if (!parsedData.length) { toast.error("Nenhum dado para importar"); return; }
    setImporting(true);
    setResult(null);
    try {
      if (isBrands) {
        const items = parsedData.map(mapBrandImportRow).filter((item) => item.name);
        if (!items.length) { toast.error("Nenhuma linha válida reconhecida"); setImporting(false); return; }
        const res = await api<ImportResult>("/api/merchandising/brands/import", {
          method: "POST",
          body: { items },
        });
        setResult(res);
        const total = res.created ?? res.imported ?? res.success ?? 0;
        if (total > 0) toast.success(`${total} marcas importadas`);
        else toast.info("Nenhuma marca nova importada (possivelmente já existiam)");
      } else {
        const items = parsedData.map(mapProductImportRow).filter((item) => item.name);
        if (!items.length) { toast.error("Nenhuma linha válida reconhecida"); setImporting(false); return; }
        const res = await api<ImportResult>("/api/merchandising/products/import", {
          method: "POST",
          body: { auto_create: false, items },
        });
        setResult(res);
        const total = res.imported ?? res.success ?? 0;
        if (total > 0) toast.success(`${total} produtos importados`);
        else toast.error("Nenhum produto novo foi importado");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = columns.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isBrands ? "template_marcas.csv" : "template_produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setParsedData([]); setResult(null); setFileName(""); };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">1. Selecionar arquivo</Label>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Baixar template
          </Button>
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          {fileName ? (
            <p className="text-sm font-medium">{fileName} <span className="text-muted-foreground">({parsedData.length} linhas)</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">Clique para selecionar CSV ou Excel</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Colunas esperadas: <code>{columns.join(", ")}</code>
        </p>
        {isBrands ? (
          <Alert className="border-primary/30 bg-primary/5">
            <Building2 className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              Importe suas marcas/famílias primeiro. O <strong>codigo</strong> será usado como referência para vincular produtos depois.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-primary/30 bg-primary/5">
            <Tags className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              Os produtos serão vinculados às marcas pelo <strong>id_familia</strong> (código interno da marca). Importe as marcas antes dos produtos.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {parsedData.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">2. Pré-visualização ({parsedData.length} registros)</Label>
          <ScrollArea className="h-64 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(parsedData[0]).filter(h => h !== '__line').map((h) => (
                    <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    {Object.entries(row).filter(([k]) => k !== '__line').map(([, v], j) => (
                      <TableCell key={j} className="text-xs max-w-[200px] truncate">{String(v)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsedData.length > 50 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                Mostrando 50 de {parsedData.length} registros
              </p>
            )}
          </ScrollArea>
        </div>
      )}

      {parsedData.length > 0 && !result && (
        <Button onClick={handleImport} disabled={importing} className="w-full" size="lg">
          {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Importar {parsedData.length} {isBrands ? "Marcas" : "Produtos"}
        </Button>
      )}

      {result && (
        <div className="space-y-3">
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              {isBrands
                ? `${result.created ?? result.imported ?? 0} marcas importadas${result.skipped ? `, ${result.skipped} já existiam` : ""}`
                : `${result.imported ?? result.success ?? 0} produtos importados${result.brands_created ? `, ${result.brands_created} marcas criadas` : ""}${result.categories_created ? `, ${result.categories_created} categorias criadas` : ""}${result.failed ? `, ${result.failed} com erro` : ""}`
              }
            </AlertDescription>
          </Alert>

          {result.errors && result.errors.length > 0 && (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription>
                <p className="font-medium mb-2">{result.errors.length} erros:</p>
                <ScrollArea className="max-h-72 rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Linha</TableHead>
                        {!isBrands && <TableHead className="text-xs">SKU</TableHead>}
                        <TableHead className="text-xs">Nome</TableHead>
                        {!isBrands && <TableHead className="text-xs">Marca</TableHead>}
                        <TableHead className="text-xs">Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{e.line || e.row || '-'}</TableCell>
                          {!isBrands && <TableCell className="text-xs">{e.sku || '-'}</TableCell>}
                          <TableCell className="text-xs">{e.name || '-'}</TableCell>
                          {!isBrands && <TableCell className="text-xs">{e.brand_name || '-'}</TableCell>}
                          <TableCell className="text-xs text-muted-foreground">{e.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          <Button variant="outline" onClick={reset} className="w-full">Nova importação</Button>
        </div>
      )}
    </div>
  );
}

export function MerchImportTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importação em Massa
          </CardTitle>
          <CardDescription>
            Importe primeiro as marcas (famílias), depois os produtos vinculando pelo código.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="brands">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="brands" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                1. Marcas / Famílias
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                2. Produtos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="brands">
              <ImportSection type="brands" />
            </TabsContent>
            <TabsContent value="products">
              <ImportSection type="products" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
