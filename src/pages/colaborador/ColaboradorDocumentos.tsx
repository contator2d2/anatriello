import { useRef, useState } from "react";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { usePromotorInboundDocuments, usePromotorSendDocument } from "@/hooks/use-promotor";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Loader2,
  Upload,
  Camera,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  Stethoscope,
  Receipt,
  DollarSign,
  ClipboardList,
  FileSignature,
  Paperclip,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES = [
  { value: "atestado", label: "Atestado médico", icon: Stethoscope, color: "bg-rose-100 text-rose-600" },
  { value: "comprovante_comparecimento", label: "Comprov. de comparecimento", icon: ClipboardList, color: "bg-blue-100 text-blue-600" },
  { value: "comprovante_pagamento", label: "Comprov. de pagamento", icon: DollarSign, color: "bg-emerald-100 text-emerald-600" },
  { value: "recibo", label: "Recibo / Nota fiscal", icon: Receipt, color: "bg-amber-100 text-amber-600" },
  { value: "solicitacao", label: "Solicitação ao RH", icon: FileSignature, color: "bg-violet-100 text-violet-600" },
  { value: "outro", label: "Outro documento", icon: Paperclip, color: "bg-slate-100 text-slate-600" },
];

export default function ColaboradorDocumentos() {
  const { data: sent, isLoading } = usePromotorInboundDocuments();
  const sendDoc = usePromotorSendDocument();
  const { uploadFile, isUploading, progress } = useUpload(() => localStorage.getItem("n"));
  const { toast } = useToast();

  const [category, setCategory] = useState<string>("");
  const [observation, setObservation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const currentCat = CATEGORIES.find((c) => c.value === category);

  const pickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const reset = () => {
    setCategory("");
    setObservation("");
    setFile(null);
    setPreviewUrl(null);
  };

  const handleSend = async () => {
    if (!category || !file) {
      toast({ title: "Selecione o tipo e anexe o arquivo", variant: "destructive" });
      return;
    }
    try {
      const url = await uploadFile(file);
      if (!url) throw new Error("Falha no upload");
      await sendDoc.mutateAsync({
        category,
        title: `${currentCat?.label || category} — ${format(new Date(), "dd/MM/yyyy")}`,
        file_url: url,
        observation,
      });
      toast({ title: "Enviado ao RH", description: "Você receberá uma confirmação assim que for analisado." });
      reset();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <ColaboradorLayout bg="light" title="Enviar ao RH" showBack>
      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Explicação */}
        <div className="bg-white rounded-2xl p-3 shadow-sm">
          <p className="text-[13px] text-slate-700 leading-snug">
            Envie <b>atestados médicos</b>, <b>comprovantes de comparecimento</b>,
            <b> comprovantes de pagamento</b> e demais documentos diretamente ao RH.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Após o envio, o RH será notificado e você poderá acompanhar o status abaixo.
          </p>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Tipo do documento</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                      active ? "border-[#0a1128] bg-[#0a1128]/5" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-700 leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Observação (opcional)</p>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={2}
              placeholder="Ex.: atestado de 2 dias, consulta médica..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a1128]"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Arquivo</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => camRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700"
              >
                <Camera className="h-4 w-4" /> Câmera
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700"
              >
                <ImageIcon className="h-4 w-4" /> Galeria/Arquivo
              </button>
            </div>
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />

            {file && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 flex items-center gap-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-white flex items-center justify-center">
                    <FileText className="h-6 w-6 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="h-7 w-7 rounded-full bg-white flex items-center justify-center"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            )}

            {isUploading && (
              <div className="mt-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0a1128] transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 text-center mt-1">Enviando... {progress}%</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!category || !file || isUploading || sendDoc.isPending}
            className="w-full bg-[#0a1128] hover:bg-[#0d1a3d] disabled:opacity-50 text-white rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            {isUploading || sendDoc.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar ao RH
          </button>
        </div>

        {/* Histórico */}
        <div>
          <p className="text-xs font-semibold text-slate-500 px-1 mb-2">Meus envios</p>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />}
          {!isLoading && (sent || []).length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <Upload className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">Você ainda não enviou nenhum documento.</p>
            </div>
          )}
          <div className="space-y-2">
            {(sent || []).map((d: any) => {
              const cat = CATEGORIES.find((c) => c.value === d.category);
              const Icon = cat?.icon || FileText;
              return (
                <div key={d.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${cat?.color || "bg-slate-100 text-slate-600"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{d.title || cat?.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {cat?.label || d.category}
                      {d.created_at && ` • ${format(new Date(d.created_at), "dd/MM HH:mm", { locale: ptBR })}`}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Enviado
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ColaboradorLayout>
  );
}
