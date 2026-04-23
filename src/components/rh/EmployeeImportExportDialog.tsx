import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Upload, Download, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const UF_MAP: Record<string, string> = {
  'ACRE':'AC','ALAGOAS':'AL','AMAPA':'AP','AMAZONAS':'AM','BAHIA':'BA',
  'CEARA':'CE','DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES','GOIAS':'GO',
  'MARANHAO':'MA','MATO GROSSO':'MT','MATO GROSSO DO SUL':'MS',
  'MINAS GERAIS':'MG','PARA':'PA','PARAIBA':'PB','PARANA':'PR',
  'PERNAMBUCO':'PE','PIAUI':'PI','RIO DE JANEIRO':'RJ',
  'RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS','RONDONIA':'RO',
  'RORAIMA':'RR','SANTA CATARINA':'SC','SAO PAULO':'SP','SERGIPE':'SE',
  'TOCANTINS':'TO',
};

function normalizeUF(val: string): string {
  if (!val) return "";
  const s = val.trim().toUpperCase();
  if (s.length <= 2) return s;
  const normalized = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return UF_MAP[normalized] || s.substring(0, 2);
}

const EMPLOYEE_FIELDS = [
  { key: "full_name", label: "Nome Completo", required: true, aliases: ["nome", "nome completo", "colaborador"] },
  { key: "social_name", label: "Nome Social", aliases: ["nome social"] },
  { key: "cpf", label: "CPF", aliases: ["cpf"] },
  { key: "rg", label: "RG", aliases: ["rg", "identidade"] },
  { key: "pis_pasep", label: "PIS/PASEP", aliases: ["pis", "pasep", "pis pasep", "pis/pasep", "nis"] },
  { key: "birth_date", label: "Data Nascimento", aliases: ["data nascimento", "data_nascimento", "dt nascimento", "nascimento"] },
  { key: "gender", label: "Gênero", aliases: ["genero", "gênero", "sexo"] },
  { key: "marital_status", label: "Estado Civil", aliases: ["estado civil", "estado_civil"] },
  { key: "skin_color", label: "Cor / Raça", aliases: ["cor", "raca", "raça", "cor raca", "etnia"] },
  { key: "voter_id", label: "Título Eleitoral", aliases: ["titulo eleitoral", "titulo_eleitoral", "título eleitoral", "titulo de eleitor", "titulo"] },
  { key: "voter_zone", label: "Zona Eleitoral", aliases: ["zona", "zona eleitoral"] },
  { key: "voter_section", label: "Seção Eleitoral", aliases: ["secao", "seção", "secao eleitoral", "seção eleitoral"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "e_mail"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "celular", "fone", "whatsapp", "tel"] },
  { key: "phone2", label: "Telefone 2", aliases: ["telefone 2", "telefone2", "celular 2"] },
  { key: "address", label: "Endereço (Rua)", aliases: ["endereco", "endereço", "rua", "logradouro"] },
  { key: "address_number", label: "Número", aliases: ["numero", "número", "nº", "no"] },
  { key: "complement", label: "Complemento", aliases: ["complemento", "compl"] },
  { key: "neighborhood", label: "Bairro", aliases: ["bairro"] },
  { key: "city", label: "Cidade", aliases: ["cidade", "municipio", "município"] },
  { key: "state", label: "UF", aliases: ["uf", "estado"] },
  { key: "zip_code", label: "CEP", aliases: ["cep"] },
  { key: "registration_number", label: "Matrícula", aliases: ["matricula", "matrícula"] },
  { key: "worker_profile", label: "Perfil (administrativo/supervisor/promotor/operacional)", aliases: ["perfil"] },
  { key: "employment_type", label: "Vínculo (clt/pj/freelancer/temporario/estagiario/aprendiz)", aliases: ["vinculo", "vínculo", "tipo contrato"] },
  { key: "position", label: "Cargo", aliases: ["cargo", "funcao", "função"] },
  { key: "salary", label: "Salário", aliases: ["salario", "salário", "salario mensal", "salario_mensal", "salário mensal"] },
  { key: "admission_date", label: "Data Admissão", aliases: ["data admissao", "data_admissao", "data admissão", "admissao", "admissão", "dt admissao"] },
  { key: "bank_name", label: "Banco", aliases: ["banco"] },
  { key: "bank_agency", label: "Agência", aliases: ["agencia", "agência"] },
  { key: "bank_account", label: "Conta", aliases: ["conta"] },
  { key: "bank_account_type", label: "Tipo Conta", aliases: ["tipo conta", "tipo_conta"] },
  { key: "ctps_number", label: "CTPS", aliases: ["ctps", "carteira trabalho"] },
  { key: "cnpj", label: "CNPJ (PJ)", aliases: ["cnpj"] },
  { key: "company_name", label: "Razão Social (PJ)", aliases: ["razao social", "razão social"] },
  { key: "status", label: "Status (ativo/afastado/ferias/desligado/suspenso)", aliases: ["status", "situacao", "situação"] },
];

function normalizeColName(s: string) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

interface ImportRow {
  id: number;
  data: Record<string, string>;
  mapped: Record<string, string>;
  selected: boolean;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: any[];
  departments: any[];
  branches: any[];
  onImport: (rows: Record<string, any>[]) => Promise<void>;
}

export function EmployeeImportExportDialog({ open, onOpenChange, employees, departments, branches, onImport }: Props) {
  const [mode, setMode] = useState<"choose" | "import-upload" | "import-mapping" | "import-preview" | "importing">("choose");
  const [columns, setColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMode("choose");
    setColumns([]);
    setRawRows([]);
    setMapping({});
    setImportRows([]);
    setImportProgress(0);
    setImportError(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // ========== EXPORT ==========
  const handleExport = () => {
    const headers = EMPLOYEE_FIELDS.map(f => f.label);
    const keys = EMPLOYEE_FIELDS.map(f => f.key);
    const data = employees.map(emp => {
      const row: Record<string, any> = {};
      keys.forEach((k, i) => {
        let val = emp[k] ?? "";
        if (k === "birth_date" || k === "admission_date") val = val ? String(val).slice(0, 10) : "";
        if (k === "salary") val = val ? Number(val) : "";
        row[headers[i]] = val;
      });
      // Add department and branch names
      const dept = departments.find((d: any) => d.id === emp.department_id);
      const branch = branches.find((b: any) => b.id === emp.branch_id);
      row["Departamento"] = dept?.name || "";
      row["Filial"] = branch?.name || "";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");

    // Auto column width
    const colWidths = [...headers, "Departamento", "Filial"].map(h => ({ wch: Math.max(h.length + 2, 15) }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `colaboradores_${new Date().toISOString().slice(0, 10)}.xlsx`);
    handleClose(false);
  };

  // ========== IMPORT ==========
  const handleFile = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (!json.length) {
          setImportError("A planilha está vazia.");
          return;
        }

        const cols = Object.keys(json[0]);
        setColumns(cols);
        setRawRows(json.map(r => {
          const clean: Record<string, string> = {};
          cols.forEach(c => { clean[c] = String(r[c] ?? "").trim(); });
          return clean;
        }));

        const autoMap: Record<string, string> = {};
        const colsNorm = cols.map(c => ({ raw: c, norm: normalizeColName(c) }));
        EMPLOYEE_FIELDS.forEach(f => {
          // Try alias exact match first
          const aliases = [f.label, f.key, ...((f as any).aliases || [])].map(normalizeColName);
          let match = colsNorm.find(c => aliases.includes(c.norm));
          // Then partial includes
          if (!match) {
            match = colsNorm.find(c => aliases.some(a => a && (c.norm === a || c.norm.includes(a) || a.includes(c.norm))));
          }
          if (match) autoMap[f.key] = match.raw;
        });
        setMapping(autoMap);
        setMode("import-mapping");
      } catch {
        setImportError("Não foi possível ler a planilha.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const applyMapping = () => {
    const rows: ImportRow[] = rawRows.map((raw, i) => {
      const mapped: Record<string, string> = {};
      EMPLOYEE_FIELDS.forEach(f => {
        if (mapping[f.key]) {
          mapped[f.key] = raw[mapping[f.key]] || "";
        }
      });
      const errors: string[] = [];
      if (!mapped.full_name) errors.push("Nome obrigatório");
      return { id: i, data: raw, mapped, selected: errors.length === 0, errors };
    });
    setImportRows(rows);
    setMode("import-preview");
  };

  const doImport = async () => {
    const selected = importRows.filter(r => r.selected && r.errors.length === 0);
    if (!selected.length) return;
    setImportError(null);
    setMode("importing");
    try {
      const batch: Record<string, any>[] = [];
      for (const row of selected) {
        const emp: Record<string, any> = { ...row.mapped };
        ["birth_date", "admission_date"].forEach(dk => {
          if (emp[dk]) {
            const parsed = parseFlexDate(emp[dk]);
            emp[dk] = parsed || "";
          }
        });
        if (emp.salary) emp.salary = String(emp.salary).replace(/[^\d.,]/g, "").replace(",", ".");
        if (emp.state) emp.state = normalizeUF(emp.state);
        if (emp.gender) emp.gender = emp.gender.substring(0, 20);
        if (emp.zip_code) emp.zip_code = String(emp.zip_code).replace(/[^\d-]/g, "").substring(0, 10);
        if (!emp.status) emp.status = "ativo";
        if (!emp.worker_profile) emp.worker_profile = "operacional";
        if (!emp.employment_type) emp.employment_type = "clt";
        batch.push(emp);
      }

      const chunkSize = 10;
      let imported = 0;
      for (let i = 0; i < batch.length; i++) {
        try {
          await onImport([batch[i]]);
        } catch {
          // skip individual failures, continue importing
        }
        imported++;
        setImportProgress(Math.round((imported / batch.length) * 100));
      }
      setImportProgress(100);
      setTimeout(() => handleClose(false), 1500);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível concluir a importação.");
      setMode("import-preview");
    }
  };

  const selectedCount = importRows.filter(r => r.selected && r.errors.length === 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {mode === "choose" ? "Importar / Exportar Colaboradores" :
             mode === "importing" ? "Importando..." :
             mode === "import-upload" ? "Upload da Planilha" :
             mode === "import-mapping" ? "Mapeamento de Colunas" : "Pré-visualização"}
          </DialogTitle>
        </DialogHeader>

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {importError && mode !== "import-preview" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {importError}
          </div>
        )}

        {mode === "choose" && (
          <div className="grid grid-cols-2 gap-4 py-6">
            <button onClick={() => setMode("import-upload")} className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all">
              <Upload className="h-10 w-10 text-primary" />
              <span className="font-semibold text-lg">Importar</span>
              <span className="text-sm text-muted-foreground text-center">Envie uma planilha XLSX/CSV com os dados dos colaboradores</span>
            </button>
            <button onClick={handleExport} className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all">
              <Download className="h-10 w-10 text-primary" />
              <span className="font-semibold text-lg">Exportar</span>
              <span className="text-sm text-muted-foreground text-center">Baixe todos os colaboradores em formato XLSX</span>
            </button>
          </div>
        )}

        {mode === "import-upload" && (
          <div
            className="flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-all cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            <p className="text-lg font-medium">Arraste a planilha aqui ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground">Formatos aceitos: .xlsx, .xls, .csv</p>
          </div>
        )}

        {mode === "import-mapping" && (
          <div className="flex min-h-0 flex-1 flex-col space-y-4">
            <p className="text-sm text-muted-foreground">Mapeie as colunas da planilha para os campos do sistema. Encontramos <strong>{rawRows.length}</strong> linhas.</p>
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-2">
                {EMPLOYEE_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    <Label className="w-48 text-sm flex-shrink-0">
                      {f.label}
                      {f.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select value={mapping[f.key] || "__none__"} onValueChange={v => setMapping(p => ({ ...p, [f.key]: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Não mapear" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não mapear —</SelectItem>
                        {columns.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between border-t pt-3">
              <Button variant="outline" onClick={() => setMode("import-upload")}>Voltar</Button>
              <Button onClick={applyMapping} disabled={!mapping.full_name}>Pré-visualizar</Button>
            </div>
          </div>
        )}

        {mode === "import-preview" && (
          <div className="flex min-h-0 flex-1 flex-col space-y-4">
            {importError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {importError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{selectedCount}</strong> de {importRows.length} prontos para importar
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportRows(r => r.map(row => ({ ...row, selected: row.errors.length === 0 })))}>Selecionar válidos</Button>
                <Button variant="outline" size="sm" onClick={() => setImportRows(r => r.map(row => ({ ...row, selected: false })))}>Desmarcar todos</Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map(row => (
                    <TableRow key={row.id} className={cn(row.errors.length > 0 && "bg-destructive/5")}>
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          disabled={row.errors.length > 0}
                          onCheckedChange={v => setImportRows(r => r.map(rr => rr.id === row.id ? { ...rr, selected: !!v } : rr))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.mapped.full_name || "—"}</TableCell>
                      <TableCell>{row.mapped.cpf || "—"}</TableCell>
                      <TableCell>{row.mapped.position || "—"}</TableCell>
                      <TableCell>{row.mapped.employment_type || "—"}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{row.errors[0]}</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-green-600 border-green-200"><Check className="h-3 w-3" />OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between border-t pt-3">
              <Button variant="outline" onClick={() => setMode("import-mapping")}>Voltar</Button>
              <Button onClick={doImport} disabled={selectedCount === 0} className="gap-2">
                <Upload className="h-4 w-4" /> Importar {selectedCount} colaboradores
              </Button>
            </div>
          </div>
        )}

        {mode === "importing" && (
          <div className="space-y-4 py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <Progress value={importProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">{importProgress}% concluído</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function parseFlexDate(val: string): string {
  if (!val) return "";
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  // DD/MM/YYYY
  const brMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  // Excel serial number
  const num = Number(val);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const d = new Date((num - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return val;
}
