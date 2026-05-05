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
    .map((row, index) => ({ ...stringifyRow(row), __line: String(index + 2) }))
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

const cleanNull = (value: string) => {
  const v = String(value || "").trim();
  if (!v || v.toLowerCase() === "null") return "";
  return v;
};

const normalizeStatus = (value: string) => {
  const normalized = cleanNull(value).toLowerCase();
  if (!normalized) return "active";
  if (["1", "true", "ativo", "active", "sim", "yes"].includes(normalized)) return "active";
  if (["0", "false", "inativo", "inactive", "nao", "não", "no"].includes(normalized)) return "inactive";
  return value;
};

export function mapBrandImportRow(row: ImportParsedRow) {
  return {
    name: cleanNull(getImportValue(row, ["name", "nome", "descricao", "descrição"])),
    internal_code: cleanNull(getImportValue(row, ["codigo", "código", "code", "internal_code", "id"])),
    razao_social: cleanNull(getImportValue(row, ["razao_social", "razão social", "razao social"])),
    cnpj: cleanNull(getImportValue(row, ["cnpj"])),
    phone: cleanNull(getImportValue(row, ["phone", "telefone"])),
    street: cleanNull(getImportValue(row, ["street", "rua", "logradouro"])),
    number: cleanNull(getImportValue(row, ["number", "numero", "nº"])),
    neighborhood: cleanNull(getImportValue(row, ["neighborhood", "bairro"])),
    city: cleanNull(getImportValue(row, ["city", "cidade"])),
    zip: cleanNull(getImportValue(row, ["zip", "cep", "postal_code"])),
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
    __line: getImportValue(row, ["__line"]),
    brand_code: getImportValue(row, ["id_familia", "familia", "família", "family_id", "brand_code", "codigo_familia", "codigo", "código"]),
    brand_name: getImportValue(row, ["brand_name", "marca", "brand", "cliente"]),
    name: getImportValue(row, ["name", "nome", "produto", "descricao", "descrição", "product", "product_name"]),
    sku: getImportValue(row, ["sku", "internal_code", "codigo_interno"]),
    barcode: getImportValue(row, ["barcode", "codigo_barras", "código de barras", "ean"]),
    category_name: categoryName,
    subcategory_name: subcategoryName,
    image_url: getImportValue(row, ["image_url", "imagem", "foto", "image"]),
    status: normalizeStatus(getImportValue(row, ["status", "ativo"])),
  };
}

export function mapPDVImportRow(row: ImportParsedRow) {
  return {
    name: getImportValue(row, ["fantasia", "name", "nome", "pdv"]),
    cnpj: getImportValue(row, ["cnpj"]),
    rede: getImportValue(row, ["rede", "client_name", "cliente"]),
    endereco: getImportValue(row, ["endereco", "endereço", "address", "rua"]),
    bairro: getImportValue(row, ["bairro", "neighborhood"]),
    cidade: getImportValue(row, ["cidade", "city"]),
    estado: getImportValue(row, ["estado", "state", "uf"]),
    cep: getImportValue(row, ["cep", "zip", "zip_code"]),
    codigo: getImportValue(row, ["codigo", "código", "code", "external_code"]),
  };
}