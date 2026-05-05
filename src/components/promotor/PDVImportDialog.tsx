import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseImportFile, mapPDVImportRow } from "@/lib/merch-import";
import { useImportPDVs } from "@/hooks/use-promotor";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, MapPin } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDVImportDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<"upload" | "validate">("upload");
  const [items, setItems] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importPDVs = useImportPDVs();

  const reset = () => {
    setStep("upload");
    setItems([]);
    setFileName("");
    setResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const rows = await parseImportFile(file);
      const mapped = rows.map(mapPDVImportRow)
        .filter(item => item.name)
        .map(item => ({ ...item, _selected: true }));

      if (!mapped.length) {
        toast.error("Nenhum PDV válido encontrado");
        return;
      }
      setItems(mapped);
      setStep("validate");
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler arquivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleAll = () => {
    const allSelected = items.every(b => b._selected);
    setItems(items.map(b => ({ ...b, _selected: !allSelected })));
  };

  const toggleOne = (index: number) => {
    setItems(items.map((b, i) => i === index ? { ...b, _selected: !b._selected } : b));
  };

  const selectedCount = items.filter(b => b._selected).length;

  const handleImport = async () => {
    const selected = items.filter(b => b._selected);
    if (!selected.length) return;
    setImporting(true);
    try {
      const res = await importPDVs.mutateAsync({ items: selected.map(({ _selected, ...rest }) => rest) });
      setResult({ created: res.created || 0, updated: res.updated || 0, skipped: res.skipped || 0 });
      toast.success(`${res.created} PDVs criados, ${res.updated} atualizados`);
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
            <MapPin className="h-5 w-5 text-primary" />
            Importar PDVs
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
                Colunas: <code>Código, CNPJ, Fantasia, Endereço, Bairro, Cidade, Estado, Cep, Rede</code>
              </p>
            </div>
          </div>
        )}

        {step === "validate" && !result && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{fileName} — {selectedCount} selecionados</p>
              <Button variant="ghost" size="sm" onClick={() => { setStep("upload"); setItems([]); }}>Trocar arquivo</Button>
            </div>
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={items.length > 0 && selectedCount === items.length} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead className="text-xs">Fantasia</TableHead>
                    <TableHead className="text-xs">Rede</TableHead>
                    <TableHead className="text-xs">Endereço</TableHead>
                    <TableHead className="text-xs">Cidade/UF</TableHead>
                    <TableHead className="text-xs">CEP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((b, i) => (
                    <TableRow key={i} className={b._selected ? "" : "opacity-50"}>
                      <TableCell><Checkbox checked={b._selected} onCheckedChange={() => toggleOne(i)} /></TableCell>
                      <TableCell className="text-sm font-medium">{b.name}</TableCell>
                      <TableCell className="text-xs">{b.rede || "-"}</TableCell>
                      <TableCell className="text-xs">{b.endereco || "-"}</TableCell>
                      <TableCell className="text-xs">{b.cidade || "-"}/{b.estado || "-"}</TableCell>
                      <TableCell className="text-xs">{b.cep || "-"}</TableCell>
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
                <strong>{result.created}</strong> criados, <strong>{result.updated}</strong> atualizados, <strong>{result.skipped}</strong> pulados.
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
              Importar {selectedCount} PDV(s)
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}