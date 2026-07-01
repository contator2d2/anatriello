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
  // Identificação
  { key: "full_name", label: "Nome Completo", required: true, aliases: ["nome", "nome completo", "colaborador"] },
  { key: "social_name", label: "Nome Social", aliases: ["nome social"] },
  { key: "cpf", label: "CPF", aliases: ["cpf"] },
  { key: "rg", label: "RG", aliases: ["rg", "identidade"] },
  { key: "rg_issuer", label: "Órgão Emissor RG", aliases: ["orgao emissor do rg", "órgão emissor do rg", "orgao emissor rg"] },
  { key: "rg_uf", label: "UF do RG", aliases: ["uf do rg", "uf rg"] },
  { key: "rg_issue_date", label: "Data Emissão RG", aliases: ["data de emissao do rg", "data de emissão do rg", "emissao rg"] },
  { key: "pis_pasep", label: "PIS/PASEP", aliases: ["pis", "pasep", "pis pasep", "pis/pasep", "nis"] },
  { key: "pis_issue_date", label: "Emissão do PIS", aliases: ["emissao do pis", "emissão do pis"] },
  { key: "birth_date", label: "Data Nascimento", aliases: ["data nascimento", "data_nascimento", "dt nascimento", "nascimento", "data de nascimento"] },
  { key: "gender", label: "Gênero", aliases: ["genero", "gênero", "sexo"] },
  { key: "marital_status", label: "Estado Civil", aliases: ["estado civil", "estado_civil"] },
  { key: "skin_color", label: "Cor / Raça", aliases: ["cor", "raca", "raça", "cor raca", "etnia"] },
  { key: "education_level", label: "Escolaridade", aliases: ["grau de instrucao", "grau de instrução", "escolaridade"] },
  { key: "birth_city", label: "Cidade de Nascimento", aliases: ["cidade de nascimento", "naturalidade"] },
  { key: "birth_country", label: "País de Nascimento", aliases: ["pais de nascimento", "país de nascimento"] },
  { key: "nationality_country", label: "País Nacionalidade", aliases: ["pais de nacionalidade", "país de nacionalidade", "nacionalidade"] },
  { key: "foreigner_registry", label: "Registro Estrangeiro", aliases: ["registro nacional de estrangeiro numero", "rne"] },
  { key: "residence_time", label: "Tempo de Residência", aliases: ["tempo de residencia", "tempo de residência"] },

  // Filiação
  { key: "mother_name", label: "Nome da Mãe", aliases: ["nome da mae", "nome da mãe", "mae"] },
  { key: "father_name", label: "Nome do Pai", aliases: ["nome do pai", "pai"] },
  { key: "spouse_name", label: "Nome do Cônjuge", aliases: ["nome do conjuge", "nome do cônjuge", "conjuge", "cônjuge"] },

  // Título eleitoral
  { key: "voter_id", label: "Título Eleitoral", aliases: ["titulo eleitoral", "titulo_eleitoral", "título eleitoral", "titulo de eleitor", "titulo", "título de eleitor"] },
  { key: "voter_zone", label: "Zona Eleitoral", aliases: ["zona", "zona eleitoral"] },
  { key: "voter_section", label: "Seção Eleitoral", aliases: ["secao", "seção", "secao eleitoral", "seção eleitoral"] },

  // Reservista
  { key: "reservist_cert", label: "Certificado Reservista", aliases: ["certificado de reservista", "reservista"] },

  // Registro Civil
  { key: "civil_registry", label: "Registro Civil", aliases: ["registro civil"] },
  { key: "civil_registry_term", label: "Termo/Matrícula", aliases: ["termo/matricula", "termo/matrícula", "termo matricula"] },
  { key: "civil_registry_office", label: "Cartório", aliases: ["cartorio", "cartório"] },
  { key: "civil_registry_book", label: "Livro (RC)", aliases: ["livro"] },
  { key: "civil_registry_folio", label: "Folha (RC)", aliases: ["folha"] },
  { key: "civil_registry_city", label: "Cidade Emissão RC", aliases: ["cidade de emissao", "cidade de emissão"] },
  { key: "civil_registry_date", label: "Data Emissão RC", aliases: ["registro civil data de emissao", "registro civil data de emissão"] },

  // CTPS
  { key: "ctps_number", label: "CTPS Número", aliases: ["numero da ctps", "número da ctps", "ctps", "carteira trabalho"] },
  { key: "ctps_series", label: "CTPS Série", aliases: ["serie", "série"] },
  { key: "ctps_digit", label: "CTPS Dígito", aliases: ["digito", "dígito"] },
  { key: "ctps_issue_date", label: "Emissão CTPS", aliases: ["emissao da ctps", "emissão da ctps"] },
  { key: "ctps_uf", label: "UF CTPS", aliases: ["uf da ctps"] },

  // CNH
  { key: "cnh", label: "CNH Número", aliases: ["numero cnh", "número cnh", "cnh"] },
  { key: "cnh_issue_date", label: "Emissão CNH", aliases: ["emissao da cnh", "emissão da cnh"] },
  { key: "cnh_category", label: "Categoria CNH", aliases: ["categoria cnh"] },
  { key: "cnh_expiry", label: "Validade CNH", aliases: ["validade cnh"] },
  { key: "cnh_uf", label: "UF CNH", aliases: ["uf da cnh"] },
  { key: "cnh_first_date", label: "1ª Habilitação CNH", aliases: ["primeira habilitacao cnh", "primeira habilitação cnh"] },

  // RIC
  { key: "ric_number", label: "RIC Número", aliases: ["numero do registro de identificacao civil", "número do registro de identificação civil"] },
  { key: "ric_issuer", label: "RIC Órgão Emissor", aliases: ["orgao emissor do registro de identificacao civil", "órgão emissor do registro de identificação civil"] },
  { key: "ric_issue_date", label: "RIC Data Emissão", aliases: ["data da emissao do registro de identificacao civil", "data da emissão do registro de identificação civil"] },

  // Órgão de Classe
  { key: "class_body_number", label: "Órgão Classe Nº", aliases: ["orgao de classe numero", "órgão de classe numero"] },
  { key: "class_body_org", label: "Órgão Classe", aliases: ["orgao de classe orgao", "órgão de classe orgão"] },
  { key: "class_body_issue_date", label: "Órgão Classe Emissão", aliases: ["orgao de classe emissao", "órgão de classe emissão"] },
  { key: "class_body_expiry", label: "Órgão Classe Validade", aliases: ["orgao de classe validade", "órgão de classe validade"] },

  // Contato / endereço
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "e_mail"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "fone", "tel"] },
  { key: "phone2", label: "Celular", aliases: ["celular", "whatsapp", "telefone 2", "telefone2", "celular 2"] },
  { key: "address", label: "Endereço (Rua)", aliases: ["endereco", "endereço", "rua", "logradouro"] },
  { key: "address_number", label: "Número", aliases: ["numero", "número", "nº", "no"] },
  { key: "complement", label: "Complemento", aliases: ["complemento", "compl"] },
  { key: "neighborhood", label: "Bairro", aliases: ["bairro"] },
  { key: "city", label: "Cidade", aliases: ["cidade", "municipio", "município"] },
  { key: "state", label: "UF", aliases: ["uf", "estado"] },
  { key: "zip_code", label: "CEP", aliases: ["cep"] },

  // Contrato / admissão
  { key: "registration_number", label: "Matrícula", aliases: ["matricula", "matrícula", "matricula esocial", "matrícula esocial"] },
  { key: "previous_registration", label: "Matrícula Anterior", aliases: ["numero de matricula anterior", "número de matrícula anterior"] },
  { key: "worker_profile", label: "Perfil (administrativo/supervisor/promotor/operacional)", aliases: ["perfil"] },
  { key: "employment_type", label: "Vínculo (clt/pj/freelancer/temporario/estagiario/aprendiz)", aliases: ["vinculo", "vínculo", "tipo contrato"] },
  { key: "collaborator_type", label: "Tipo Colaborador", aliases: ["tipo de colaborador"] },
  { key: "worker_class", label: "Classe Trabalhador", aliases: ["classe"] },
  { key: "admission_type", label: "Tipo Admissão", aliases: ["tipo de admissao", "tipo de admissão"] },
  { key: "contract_type", label: "Tipo Contrato", aliases: ["tipo de contrato"] },
  { key: "occupation_nature", label: "Natureza Ocupação", aliases: ["natureza da ocupacao", "natureza da ocupação"] },
  { key: "previous_employer_cnpj", label: "CNPJ Empresa Anterior", aliases: ["cpnj empresa anterior", "cnpj empresa anterior"] },
  { key: "transfer_with_onus", label: "Transferência c/ Ônus", aliases: ["transferencia com onus", "transferência com ônus"] },
  { key: "transfer_date", label: "Data Transferência", aliases: ["data de transferencia", "data de transferência"] },
  { key: "position", label: "Cargo Inicial", aliases: ["cargo", "funcao", "função", "cargo inicial"] },
  { key: "cbo_code", label: "CBO Cargo Inicial", aliases: ["cbo cargo inicial", "cbo"] },
  { key: "current_position", label: "Cargo Atual", aliases: ["cargo atual"] },
  { key: "current_cbo", label: "CBO Atual", aliases: ["cbo cargo atual"] },
  { key: "salary", label: "Salário Inicial", aliases: ["salario", "salário", "salario inicial", "salário inicial", "salario mensal"] },
  { key: "current_salary", label: "Salário Atual", aliases: ["salario atual", "salário atual"] },
  { key: "admission_date", label: "Data Admissão", aliases: ["data admissao", "data_admissao", "data admissão", "admissao", "admissão", "dt admissao", "data de admissao", "data de admissão"] },
  { key: "registration_date", label: "Data Cadastro", aliases: ["data de cadastro"] },
  { key: "service_time_start_date", label: "Início Adic. Tempo Serviço", aliases: ["data de inicio adicional de tempo de servico", "data de início adicional de tempo de serviço"] },
  { key: "probation_end_date", label: "Fim Prazo Experiência", aliases: ["prazo experiencia", "prazo experiência", "fim do prazo"] },
  { key: "probation_extension_end", label: "Fim Prorrogação", aliases: ["prorrogacao", "prorrogação", "fim da prorrogacao", "fim da prorrogação"] },
  { key: "contract_end_date", label: "Fim de Contrato", aliases: ["fim de contrato", "data fim contrato"] },
  { key: "retirement_date", label: "Data Aposentadoria", aliases: ["data da aposentadoria"] },
  { key: "termination_date", label: "Data Desligamento", aliases: ["data de desligamento"] },
  { key: "reinstatement_date", label: "Data Reintegração", aliases: ["data de reintegracoes", "data de reintegrações"] },

  // Jornada
  { key: "work_regime", label: "Regime Jornada", aliases: ["regime jornada de trabalho"] },
  { key: "shift_type", label: "Tipo Escala", aliases: ["tipo de escala"] },
  { key: "weekly_rest", label: "Descanso Semanal", aliases: ["descanso semanal"] },
  { key: "work_schedule_desc", label: "Quadro Horário Inicial", aliases: ["quadro de horario inicial", "quadro de horário inicial"] },
  { key: "current_schedule_desc", label: "Quadro Horário Atual", aliases: ["quadro de horario atual", "quadro de horário atual"] },
  { key: "journey_type", label: "Tipo Jornada", aliases: ["tipo de jornada"] },
  { key: "journey_description", label: "Descrição Tipo Jornada", aliases: ["descricao tipo de jornada", "descrição tipo de jornada"] },
  { key: "night_shift", label: "Horário Noturno", aliases: ["horario noturno", "horário noturno"] },
  { key: "monthly_hours", label: "Horas Mensais", aliases: ["horas mensais"] },
  { key: "weekly_hours", label: "Horas Semanais", aliases: ["horas semanais"] },
  { key: "daily_hours", label: "Horas Diárias", aliases: ["horas diarias", "horas diárias"] },
  { key: "punch_card_number", label: "Nº Cartão Ponto", aliases: ["numero cartao ponto", "número cartão ponto"] },
  { key: "record_sheet", label: "Ficha Registro", aliases: ["ficha registro"] },

  // Adicionais
  { key: "insalubrity_percent", label: "Adic. Insalubridade (%)", aliases: ["adicional insalubridade(%)", "adicional insalubridade"] },
  { key: "insalubrity_incidence", label: "Incid. Insalubridade", aliases: ["incidencia insalubridade", "incidência insalubridade"] },
  { key: "periculosity_percent", label: "Adic. Periculosidade (%)", aliases: ["adicional periculosidade(%)", "adicional periculosidade"] },
  { key: "periculosity_incidence", label: "Incid. Periculosidade", aliases: ["incidencia periculosidade", "incidência periculosidade"] },
  { key: "night_shift_percent", label: "Adic. Noturno (%)", aliases: ["adicional noturno(%)", "adicional noturno"] },
  { key: "night_shift_incidence", label: "Incid. Noturno", aliases: ["incidencia noturno", "incidência noturno"] },
  { key: "private_pension_value", label: "Prev. Privada", aliases: ["valor previdencia privada", "valor previdência privada"] },
  { key: "private_pension_13", label: "Prev. Privada 13º", aliases: ["valor previdencia privada 13", "valor previdência privada 13º"] },

  // Sindicato / FGTS / Previdência
  { key: "syndicate", label: "Sindicato", aliases: ["sindicato"] },
  { key: "syndicalized", label: "Sindicalizado", aliases: ["sindicalizado"] },
  { key: "syndicate_discount", label: "Desc. Contrib. Sindical", aliases: ["descontar contribuicao sindical", "descontar contribuição sindical"] },
  { key: "fgts_category", label: "Categoria FGTS", aliases: ["categoria fgts"] },
  { key: "fgts_occurrence", label: "Ocorrência FGTS", aliases: ["ocorrencia fgts", "ocorrência fgts"] },
  { key: "fgts_account", label: "Conta FGTS", aliases: ["conta fgts"] },
  { key: "social_security_regime", label: "Regime Previdenciário", aliases: ["regime previdenciario", "regime previdênciario", "regime previdenciário"] },

  // Bancário / pagamento
  { key: "payment_method", label: "Forma de Pagamento", aliases: ["forma de pagamento"] },
  { key: "payment_mode", label: "Modo de Pagamento", aliases: ["modo de pagamento"] },
  { key: "bank_name", label: "Banco/Agência", aliases: ["banco", "banco/agencia", "banco/agência"] },
  { key: "bank_agency", label: "Agência", aliases: ["agencia", "agência"] },
  { key: "bank_account", label: "Conta", aliases: ["conta"] },
  { key: "bank_digit", label: "Dígito Conta", aliases: ["digito", "dígito"] },
  { key: "bank_account_type", label: "Tipo Conta", aliases: ["tipo de conta", "tipo conta", "tipo_conta"] },
  { key: "pix_key", label: "Chave PIX", aliases: ["pix", "chave pix"] },
  { key: "pix_key_type", label: "Tipo Chave PIX", aliases: ["tipo chave pix", "tipo pix"] },
  { key: "salary_card", label: "Cartão Salário", aliases: ["cartao salario", "cartão salário"] },
  { key: "vr_card", label: "Cartão VR", aliases: ["cartao vr", "cartão vr"] },
  { key: "vt_card", label: "Cartão VT", aliases: ["cartao vt", "cartão vt"] },
  { key: "va_card", label: "Cartão VA", aliases: ["cartao va", "cartão va"] },
  { key: "receives_vr", label: "Recebe VR", aliases: ["recebe vale refeicao", "recebe vale refeição"] },
  { key: "receives_va", label: "Recebe VA", aliases: ["recebe vale alimentacao", "recebe vale alimentação"] },
  { key: "receives_vt", label: "Recebe VT", aliases: ["recebe vale transporte"] },
  { key: "receives_advance", label: "Recebe Adiantamento", aliases: ["recebe adiantamento"] },
  { key: "advance_percent", label: "% Adiantamento", aliases: ["percentual adiantamento"] },
  { key: "commission_percent", label: "% Comissão", aliases: ["percentual de comissao", "percentual de comissão"] },
  { key: "partial_time_regime", label: "Regime Tempo Parcial", aliases: ["regime tempo parcial"] },
  { key: "unemployment_benefit", label: "Seguro Desemprego", aliases: ["esta em beneficio de seguro desemprego", "está em beneficio de seguro desemprego"] },

  // PJ
  { key: "cnpj", label: "CNPJ (PJ)", aliases: ["cnpj"] },
  { key: "company_name", label: "Razão Social (PJ)", aliases: ["razao social", "razão social"] },

  // eSocial / observação / status
  { key: "esocial_receipt", label: "Recibo eSocial", aliases: ["numero recibo esocial", "número recibo esocial"] },
  { key: "esocial_integration_date", label: "Data Integração eSocial", aliases: ["data integracao esocial", "data integração esocial"] },
  { key: "observation", label: "Observação", aliases: ["observacao", "observação", "obs"] },
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
  companies?: { id: string; name: string }[];
  defaultCompanyId?: string;
  onImport: (rows: Record<string, any>[]) => Promise<void>;
}

export function EmployeeImportExportDialog({ open, onOpenChange, employees, departments, branches, companies = [], defaultCompanyId, onImport }: Props) {
  const [importCompanyId, setImportCompanyId] = useState<string>(defaultCompanyId || "");
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
      const company = companies.find((c: any) => c.id === emp.company_id);
      row["Departamento"] = dept?.name || "";
      row["Filial"] = branch?.name || "";
      row["Empresa"] = company?.name || "";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");

    const colWidths = [...headers, "Departamento", "Filial", "Empresa"].map(h => ({ wch: Math.max(h.length + 2, 15) }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `colaboradores_${new Date().toISOString().slice(0, 10)}.xlsx`);
    handleClose(false);
  };

  const handleDownloadTemplate = () => {
    const headers = EMPLOYEE_FIELDS.map(f => f.label);
    const example: Record<string, any> = {};
    headers.forEach(h => { example[h] = ""; });
    example["Nome Completo"] = "João da Silva";
    example["CPF"] = "000.000.000-00";
    example["E-mail"] = "joao@exemplo.com";
    example["Telefone"] = "(11) 90000-0000";
    example["Data Admissão"] = "01/01/2025";
    const ws = XLSX.utils.json_to_sheet([example]);
    ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo_colaboradores.xlsx");
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
        const DATE_KEYS = [
          "birth_date","admission_date","rg_issue_date","pis_issue_date",
          "ctps_issue_date","cnh_issue_date","cnh_expiry","cnh_first_date",
          "ric_issue_date","class_body_issue_date","class_body_expiry",
          "civil_registry_date","registration_date","service_time_start_date",
          "probation_end_date","probation_extension_end","contract_end_date",
          "retirement_date","termination_date","reinstatement_date",
          "transfer_date","esocial_integration_date",
        ];
        DATE_KEYS.forEach(dk => {
          if (emp[dk]) {
            const parsed = parseFlexDate(emp[dk]);
            emp[dk] = parsed || "";
          }
        });
        const NUM_KEYS = [
          "salary","current_salary","monthly_hours","weekly_hours","daily_hours",
          "insalubrity_percent","periculosity_percent","night_shift_percent",
          "private_pension_value","private_pension_13","commission_percent","advance_percent",
        ];
        NUM_KEYS.forEach(nk => {
          if (emp[nk]) emp[nk] = String(emp[nk]).replace(/[^\d.,-]/g, "").replace(",", ".");
        });
        const BOOL_KEYS = [
          "transfer_with_onus","syndicalized","syndicate_discount",
          "receives_vr","receives_va","receives_vt","receives_advance",
          "partial_time_regime","unemployment_benefit",
        ];
        BOOL_KEYS.forEach(bk => {
          if (emp[bk] !== undefined && emp[bk] !== "") {
            const s = String(emp[bk]).trim().toLowerCase();
            if (["sim","yes","1","true","s","y"].includes(s)) emp[bk] = true;
            else if (["nao","não","no","0","false","n"].includes(s)) emp[bk] = false;
            else delete emp[bk];
          } else {
            delete emp[bk];
          }
        });
        if (emp.state) emp.state = normalizeUF(emp.state);
        if (emp.rg_uf) emp.rg_uf = normalizeUF(emp.rg_uf);
        if (emp.ctps_uf) emp.ctps_uf = normalizeUF(emp.ctps_uf);
        if (emp.cnh_uf) emp.cnh_uf = normalizeUF(emp.cnh_uf);
        if (emp.gender) emp.gender = emp.gender.substring(0, 20);
        if (emp.zip_code) emp.zip_code = String(emp.zip_code).replace(/[^\d-]/g, "").substring(0, 10);
        if (!emp.status) emp.status = "ativo";
        if (!emp.worker_profile) emp.worker_profile = "operacional";
        if (!emp.employment_type) emp.employment_type = "clt";
        if (importCompanyId) emp.company_id = importCompanyId;
        batch.push(emp);
      }

      let imported = 0;
      const failures: string[] = [];
      for (let i = 0; i < batch.length; i++) {
        try {
          await onImport([batch[i]]);
        } catch (error: any) {
          const name = batch[i]?.full_name || `Linha ${i + 1}`;
          failures.push(`${name}: ${error?.message || "erro ao salvar"}`);
        }
        imported++;
        setImportProgress(Math.round((imported / batch.length) * 100));
      }
      if (failures.length) {
        setImportError(
          failures.length === batch.length
            ? `Nenhum colaborador foi importado. ${failures.slice(0, 3).join(" | ")}`
            : `${batch.length - failures.length} importados e ${failures.length} com erro. ${failures.slice(0, 3).join(" | ")}`
        );
        setMode("import-preview");
        return;
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
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-1" /> Baixar modelo de planilha
              </Button>
            </div>
          </div>
        )}

        {mode === "import-upload" && (
          <div className="space-y-4">
            {companies.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <Label className="text-sm font-medium">Empresa dos colaboradores importados *</Label>
                <Select value={importCompanyId} onValueChange={setImportCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Todos os colaboradores da planilha serão vinculados a esta empresa.</p>
              </div>
            )}
            <div
              className={cn(
                "flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed transition-all",
                companies.length > 0 && !importCompanyId
                  ? "border-muted-foreground/20 opacity-50 pointer-events-none"
                  : "border-muted-foreground/30 hover:border-primary cursor-pointer"
              )}
              onClick={() => { if (companies.length === 0 || importCompanyId) fileRef.current?.click(); }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { if (companies.length === 0 || importCompanyId) handleDrop(e); else e.preventDefault(); }}
            >
              <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
              <p className="text-lg font-medium">Arraste a planilha aqui ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground">Formatos aceitos: .xlsx, .xls, .csv</p>
            </div>
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
