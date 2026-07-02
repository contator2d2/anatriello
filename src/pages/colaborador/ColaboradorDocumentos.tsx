import { useMemo, useState } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { usePromotorDocuments } from "@/hooks/use-promotor";
import { Folder, ChevronRight, ChevronLeft, FileText, Loader2, ExternalLink } from "lucide-react";

const FOLDERS = [
  { key: "admissao", label: "Admissão" },
  { key: "contratuais", label: "Contratuais" },
  { key: "pessoais", label: "Pessoais" },
  { key: "holerites", label: "Holerites" },
  { key: "ferias", label: "Férias" },
  { key: "avaliacoes", label: "Avaliações" },
  { key: "treinamentos", label: "Treinamentos" },
];

export default function ColaboradorDocumentos() {
  const { data, isLoading } = usePromotorDocuments();
  const [folder, setFolder] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    (data || []).forEach((d: any) => {
      const key = String(d.category || d.doc_type || "outros").toLowerCase();
      const match = FOLDERS.find(f => key.includes(f.key))?.key || "pessoais";
      (g[match] = g[match] || []).push(d);
    });
    return g;
  }, [data]);

  if (folder) {
    const items = grouped[folder] || [];
    const label = FOLDERS.find(f => f.key === folder)?.label || folder;
    return (
      <ColaboradorLayout bg="light" title={label} showBack>
        <button onClick={() => setFolder(null)} className="flex items-center gap-1 px-4 pt-4 text-sm text-slate-500">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="px-4 pt-4 space-y-2">
          {items.length === 0 && <p className="text-xs text-slate-400 text-center py-8">Nenhum documento</p>}
          {items.map(d => (
            <div key={d.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-50 text-[#f97316] flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{d.title || d.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{d.status || "disponível"}</p>
              </div>
              {d.file_url && (
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-[#f97316]">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </ColaboradorLayout>
    );
  }

  return (
    <ColaboradorLayout bg="light" title="Documentos" showBack>
      <div className="px-4 pt-4 space-y-2">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />}
        {FOLDERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFolder(f.key)}
            className="w-full bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left"
          >
            <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Folder className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{f.label}</p>
              <p className="text-[10px] text-slate-400">{(grouped[f.key] || []).length} arquivos</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </button>
        ))}
      </div>
    </ColaboradorLayout>
  );
}
