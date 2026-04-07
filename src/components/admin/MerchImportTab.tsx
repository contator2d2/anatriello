import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { mapBrandImportRow, mapCategoryImportRow, mapProductImportRow, parseImportFile } from "@/lib/merch-import";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download, AlertTriangle, Tags, Package, FolderTree } from "lucide-react";

type ImportType = "brands" | "categories" | "products";

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  ok?: boolean;
  created?: number;
  skipped?: number;
  categories_created?: number;
  subcategories_created?: number;
  total?: number;
  imported?: number;
  failed?: number;
  success?: number;
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

export function MerchImportTab() {
  const [importType, setImportType] = useState<ImportType>("brands");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [autoCreate, setAutoCreate] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    try {
      const rows = await parseImportFile(file);
      if (!rows.length) {
        toast.error("Arquivo vazio ou sem linhas válidas");
        return;
      }
      setParsedData(rows);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível ler o arquivo");
    }
  };

  const getExpectedColumns = () => {
    switch (importType) {
      case "brands": return ["name", "codigo", "razao_social", "cnpj", "phone", "status"];
      case "categories": return ["Nome", "Categoria Pai", "Descrição"];
      case "products": return ["id_familia/brand_name", "name/descricao", "sku/codigo", "barcode/codigo_barras", "category_name", "status"];
    }
  };

  const handleImport = async () => {
    if (!parsedData.length) { toast.error("Nenhum dado para importar"); return; }
    setImporting(true);
    setResult(null);

    try {
      let res: ImportResult;
      switch (importType) {
        case "brands":
          {
            const items = parsedData.map(mapBrandImportRow).filter((item) => item.name);
            if (!items.length) {
              toast.error("Nenhuma linha válida de marca foi reconhecida no arquivo");
              return;
            }
          res = await api<ImportResult>("/api/merchandising/brands/import", {
            method: "POST",
            body: { items },
          });
          }
          break;
        case "categories":
          {
            const items = parsedData.map(mapCategoryImportRow).filter((item) => item.name);
            if (!items.length) {
              toast.error("Nenhuma linha válida de categoria foi reconhecida no arquivo");
              return;
            }
          res = await api<ImportResult>("/api/merchandising/categories/import", {
            method: "POST",
            body: { items },
          });
          }
          break;
        case "products":
          {
            const items = parsedData.map(mapProductImportRow).filter((item) => item.name);
            if (!items.length) {
              toast.error("Nenhuma linha válida de produto foi reconhecida no arquivo");
              return;
            }
          res = await api<ImportResult>("/api/merchandising/products/import", {
            method: "POST",
            body: {
              auto_create: autoCreate,
              items,
            },
          });
          }
          break;
      }
      setResult(res);
      const total = res.created ?? res.imported ?? res.success ?? ((res.categories_created || 0) + (res.subcategories_created || 0));
      if (total > 0) toast.success(`Importação concluída: ${total} registros criados`);
      else toast.error("Nenhum item novo foi importado");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const cols = getExpectedColumns();
    const csv = cols.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${importType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeConfig = {
    brands: { icon: Tags, label: "Marcas", color: "text-blue-500" },
    categories: { icon: FolderTree, label: "Categorias & Subcategorias", color: "text-green-500" },
    products: { icon: Package, label: "Produtos", color: "text-purple-500" },
  };

  const TypeIcon = typeConfig[importType].icon;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importação em Massa - Merchandising
          </CardTitle>
          <CardDescription>
            Importe marcas, categorias e produtos via CSV ou Excel (.xlsx)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">1. Tipo de importação</Label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(typeConfig) as [ImportType, typeof typeConfig.brands][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => { setImportType(key); setParsedData([]); setResult(null); setFileName(""); }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      importType === key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${cfg.color}`} />
                    <p className="font-medium text-sm">{cfg.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload file */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">2. Selecionar arquivo</Label>
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
              Colunas esperadas: <code>{getExpectedColumns().join(", ")}</code>
            </p>
          </div>

          {/* Options */}
          {importType === "products" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
              <Label className="text-sm">Auto-criar marcas, categorias e subcategorias ausentes</Label>
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">3. Pré-visualização ({parsedData.length} registros)</Label>
              <ScrollArea className="h-64 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(parsedData[0]).map((h) => (
                        <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
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

          {/* Import button */}
          {parsedData.length > 0 && !result && (
            <Button onClick={handleImport} disabled={importing} className="w-full" size="lg">
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar {parsedData.length} {typeConfig[importType].label}
            </Button>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  {importType === "brands" && `${result.created} marcas criadas, ${result.skipped} já existiam`}
                  {importType === "categories" && `${result.categories_created} categorias e ${result.subcategories_created} subcategorias criadas`}
                  {importType === "products" && `${result.imported ?? result.success ?? 0} produtos importados${result.failed ? `, ${result.failed} com erro` : ""}`}
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
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">Produto</TableHead>
                            <TableHead className="text-xs">Marca</TableHead>
                            <TableHead className="text-xs">Categoria</TableHead>
                            <TableHead className="text-xs">Erro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.errors.map((e, i) => (
                            <TableRow key={`${e.line || e.row || i}-${i}`}>
                              <TableCell className="text-xs">{e.line || e.row || '-'}</TableCell>
                              <TableCell className="text-xs">{e.sku || '-'}</TableCell>
                              <TableCell className="text-xs">{e.name || '-'}</TableCell>
                              <TableCell className="text-xs">{e.brand_name || '-'}</TableCell>
                              <TableCell className="text-xs">{e.category_name || e.subcategory_name || '-'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{e.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              <Button variant="outline" onClick={() => { setParsedData([]); setResult(null); setFileName(""); }} className="w-full">
                Nova importação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
