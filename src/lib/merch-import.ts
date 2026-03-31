import * as XLSX from "xlsx";

export type ImportParsedRow = Record<string, string>;

const normalizeKey = (value: string) =>
  String(value || "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const stringifyRow = (row: Record<string, unknown>): ImportParsedRow =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key || "").trim(), value == null ? "" : String(value).trim()])
  );

const hasRowData = (row: ImportParsedRow) => Object.values(row).some((value) => String(value || "").trim());

const decodeCsv = async (file: File) => {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
};

export async function parseImportFile(file: File): Promise<ImportParsedRow[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  const workbook = isCsv
    ? XLSX.read(await decodeCsv(file), { type: "string", raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return [];

  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
    .map(stringifyRow)
    .filter(hasRowData);
}

export function getImportValue(row: ImportParsedRow, candidates: string[]) {
  const normalizedEntries = new Map(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), String(value || "").trim()])
  );

  for (const candidate of candidates) {
    const value = normalizedEntries.get(normalizeKey(candidate));
    if (value) return value;
  }

  return "";
}

const normalizeStatus = (value: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "active";
  if (["1", "true", "ativo", "active", "sim", "yes"].includes(normalized)) return "active";
  if (["0", "false", "inativo", "inactive", "nao", "não", "no"].includes(normalized)) return "inactive";
  return value;
};

export function mapBrandImportRow(row: ImportParsedRow) {
  return {
    name: getImportValue(row, ["name", "nome", "descricao", "descrição"]),
    razao_social: getImportValue(row, ["razao_social", "razão social"]),
    cnpj: getImportValue(row, ["cnpj"]),
    phone: getImportValue(row, ["phone", "telefone"]),
    status: normalizeStatus(getImportValue(row, ["status", "ativo"])),
  };
}

export function mapCategoryImportRow(row: ImportParsedRow) {
  return {
    name: getImportValue(row, ["nome", "name", "categoria", "descricao", "descrição"]),
    parent: getImportValue(row, ["categoria pai", "parent", "categoria_pai"]) || undefined,
    description: getImportValue(row, ["descrição", "descricao", "description"]) || undefined,
  };
}

export function mapProductImportRow(row: ImportParsedRow) {
  const categoryName = getImportValue(row, ["category_name", "categoria", "category", "departamento"]);
  const subcategoryName =
    getImportValue(row, ["subcategory_name", "subcategoria", "subcategory", "linha", "segmento"]) || categoryName;

  return {
    brand_name: getImportValue(row, ["brand_name", "marca", "brand", "familia", "família", "family", "cliente"]),
    name: getImportValue(row, ["name", "nome", "produto", "descricao", "descrição", "product", "product_name"]),
    sku: getImportValue(row, ["sku", "codigo", "código", "internal_code", "codigo_interno"]),
    barcode: getImportValue(row, ["barcode", "codigo_barras", "código de barras", "ean"]),
    category_name: categoryName,
    subcategory_name: subcategoryName,
    image_url: getImportValue(row, ["image_url", "imagem", "foto", "image"]),
    status: normalizeStatus(getImportValue(row, ["status", "ativo"])),
  };
}