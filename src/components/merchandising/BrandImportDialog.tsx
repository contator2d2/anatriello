import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseImportFile, mapBrandImportRow } from "@/lib/merch-import";
import { useImportBrands } from "@/hooks/use-merchandising";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle, Building2 } from "lucide-react";

interface MappedBrand {
  name: string;
  internal_code: string;
  razao_social: string;
  cnpj: string;
  phone: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  zip?: string;
  status: string;
  _selected: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandImportDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"upload" | "validate">("upload");
  const [brands, setBrands] = useState<MappedBrand[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importBrands = useImportBrands();

  const reset = () => {
    setStep("upload");
    setBrands([]);
    setFileName("");
    setResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const cleanNull = (v: string) => {
    const trimmed = String(v || "").trim();
    return trimmed.toLowerCase() === "null" ? "" : trimmed;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const rows = await parseImportFile(file);
      const mapped = rows.map(mapBrandImportRow)
        .filter(item => item.name)
        .map(item => ({
          ...item,
          name: cleanNull(item.name),
          internal_code: cleanNull(item.internal_code),
          razao_social: cleanNull(item.razao_social),
          cnpj: cleanNull(item.cnpj),
          phone: cleanNull(item.phone),
          street: cleanNull(item.street || ""),
          number: cleanNull(item.number || ""),
          neighborhood: cleanNull(item.neighborhood || ""),
          city: cleanNull(item.city || ""),
          zip: cleanNull(item.zip || ""),
          _selected: true,
        }))
        .filter(item => item.name);

      if (!mapped.length) {
        toast.error("Nenhuma marca válida encontrada");
        return;
      }
      setBrands(mapped);
      setStep("validate");
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler arquivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleAll = () => {
    const allSelected = brands.every(b => b._selected);
    setBrands(brands.map(b => ({ ...b, _selected: !allSelected })));
  };

  const toggleOne = (index: number) => {
    setBrands(brands.map((b, i) => i === index ? { ...b, _selected: !b._selected } : b));
  };

  const selectedCount = brands.filter(b => b._selected).length;

  const handleImport = async () => {
    const selected = brands.filter(b => b._selected);
    if (!selected.length) {
      toast.error("Selecione ao menos uma marca");
      return;
    }
    setImporting(true);
    try {
      const items = selected.map(({ _selected, ...rest }) => rest);
      const res = await importBrands.mutateAsync({ items });
      setResult({ created: res.created ?? 0, skipped: res.skipped ?? 0 });
      toast.success(`${res.created ?? 0} marca(s) importada(s)`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Importar Marcas / Famílias
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && !result && (
          <div className="space-y-4 py-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV ou Excel</p>
              <p className="text-xs text-muted-foreground mt-1">
                Colunas esperadas: <code>codigo, nome, razao_social, cnpj, telefone, rua, numero, bairro, cidade, cep</code>
              </p>
            </div>
            <Alert className="border-primary/30 bg-primary/5">
              <Building2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                O <strong>código</strong> de cada família será salvo como referência interna. 
                Na importação de produtos, use o <strong>id_familia</strong> para vincular ao mesmo código.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "validate" && !result && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {fileName} — <span className="text-primary">{selectedCount}</span> de {brands.length} selecionadas
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setStep("upload"); setBrands([]); }}>
                Trocar arquivo
              </Button>
            </div>

            <ScrollArea className="flex-1 border rounded-lg max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={brands.length > 0 && selectedCount === brands.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-xs w-20">Código</TableHead>
                    <TableHead className="text-xs">Nome / Família</TableHead>
                    <TableHead className="text-xs">Razão Social</TableHead>
                    <TableHead className="text-xs">CNPJ</TableHead>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Endereço</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((b, i) => (
                    <TableRow key={i} className={b._selected ? "bg-primary/5" : "opacity-50"}>
                      <TableCell>
                        <Checkbox checked={b._selected} onCheckedChange={() => toggleOne(i)} />
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-primary">{b.internal_code || "-"}</TableCell>
                      <TableCell className="text-sm font-medium">{b.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.razao_social || "-"}</TableCell>
                      <TableCell className="text-xs">{b.cnpj || "-"}</TableCell>
                      <TableCell className="text-xs">{b.phone || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {b.street ? `${b.street}, ${b.number || 'S/N'}` : '-'}
                        {b.city && <div className="text-[10px] text-muted-foreground">{b.city} - {b.zip}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === "active" ? "default" : "secondary"} className="text-[10px]">
                          {b.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {result && (
          <div className="space-y-4 py-4">
            <Alert className="border-green-500/30 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <strong>{result.created}</strong> marca(s) importada(s)
                {result.skipped > 0 && <>, <strong>{result.skipped}</strong> já existente(s)</>}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          ) : step === "validate" ? (
            <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar {selectedCount} Marca(s)
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
