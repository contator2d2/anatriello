import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, FileDown, FileText, Loader2, Building2 } from "lucide-react";
import { usePayrollFormats, usePayrollPreview, downloadPayrollFile } from "@/hooks/use-payroll-export";
import { useCompanies } from "@/hooks/use-companies";

const GENERIC_COLS = [
  "matricula", "cpf", "nome", "evento", "descricao", "referencia", "valor", "tipo",
  "competencia", "salario_base", "total_proventos", "total_descontos", "liquido",
  "admissao", "cargo", "departamento", "empresa",
];
const GENERIC_DEFAULT = ["matricula", "cpf", "nome", "evento", "descricao", "referencia", "valor", "tipo", "competencia"];

function currentMonth() { return new Date().toISOString().slice(0, 7); }

export default function RHFolhaExport() {
  const [month, setMonth] = useState(currentMonth());
  const [format, setFormat] = useState("dominio");
  const [companyId, setCompanyId] = useState<string>("all");
  const [cols, setCols] = useState<string[]>(GENERIC_DEFAULT);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const { data: formats = [] } = usePayrollFormats();
  const { companies = [] } = useCompanies();
  const columnsParam = format === "generic" ? cols.join(",") : undefined;

  const { data: preview, isFetching } = usePayrollPreview({
    month, format,
    company_id: companyId === "all" ? undefined : companyId,
    columns: columnsParam,
  });

  const selectedFormat = useMemo(() => formats.find((f: any) => f.key === format), [formats, format]);

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadPayrollFile({
        month, format,
        company_id: companyId === "all" ? undefined : companyId,
        columns: columnsParam,
      });
      toast({ title: "Arquivo gerado", description: `${preview?.filename || format}` });
    } catch (e: any) {
      toast({ title: "Erro ao gerar arquivo", description: e.message, variant: "destructive" });
    } finally { setDownloading(false); }
  }

  function toggleCol(c: string) {
    setCols(x => x.includes(c) ? x.filter(k => k !== c) : [...x, c]);
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileDown className="h-6 w-6 text-primary" /> Integração Folha
          </h1>
          <p className="text-xs text-muted-foreground">
            Exporte os holerites no layout do seu sistema de folha
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Parâmetros da exportação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Competência</Label>
                <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
              </div>
              <div>
                <Label>Sistema de folha</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {formats.map((f: any) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(companies as any[]).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedFormat && (
              <div className="text-xs bg-muted/50 rounded p-3 flex items-start gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{selectedFormat.label}</p>
                  <p className="text-muted-foreground">{selectedFormat.description}</p>
                </div>
              </div>
            )}

            {format === "generic" && (
              <div className="border rounded p-3">
                <Label className="mb-2 block">Colunas do CSV (arraste a ordem no seu sistema)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {GENERIC_COLS.map(c => (
                    <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={cols.includes(c)} onCheckedChange={() => toggleCol(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleDownload} disabled={downloading || !preview?.employees_count}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Baixar arquivo
              </Button>
              {preview && (
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary">{preview.employees_count} colaboradores</Badge>
                  <Badge variant="secondary">{preview.events_count} eventos</Badge>
                  <Badge variant="outline">{preview.total_lines} linhas</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Prévia do arquivo</CardTitle>
            {preview && <span className="text-[10px] text-muted-foreground">{preview.filename}</span>}
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !preview?.employees_count ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum holerite gerado para {month}. Gere os holerites em RH → Holerite primeiro.
              </div>
            ) : (
              <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 p-3 rounded overflow-x-auto max-h-[400px] whitespace-pre">
                {preview.sample}
                {preview.total_lines > 30 && `\n... (+${preview.total_lines - 30} linhas)`}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
