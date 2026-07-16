import { useSearchParams } from "react-router-dom";
import { ColaboradorLayout } from "./ColaboradorLayout";
import { useColabMeFull } from "@/hooks/use-promotor";

type Section = "pessoais" | "contato" | "dependentes" | "bancario" | "endereco" | "privacidade" | "notificacoes";

const TITLES: Record<Section, string> = {
  pessoais: "Dados pessoais",
  contato: "Contato",
  dependentes: "Dependentes",
  bancario: "Dados bancários",
  endereco: "Endereço",
  privacidade: "Privacidade e segurança",
  notificacoes: "Notificações",
};

function Row({ label, value }: { label: string; value?: any }) {
  return (
    <div className="flex justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-right break-words">{value || "—"}</span>
    </div>
  );
}

export default function ColaboradorDados() {
  const [sp] = useSearchParams();
  const section = (sp.get("section") as Section) || "pessoais";
  const { data, isLoading } = useColabMeFull();
  const emp = data?.employee || {};

  const renderSection = () => {
    if (isLoading) return <p className="text-sm text-slate-500 text-center py-8">Carregando...</p>;
    switch (section) {
      case "pessoais":
        return (
          <>
            <Row label="Nome completo" value={emp.full_name} />
            <Row label="CPF" value={emp.cpf} />
            <Row label="RG" value={emp.rg} />
            <Row label="Data de nascimento" value={emp.birth_date} />
            <Row label="Gênero" value={emp.gender} />
            <Row label="Estado civil" value={emp.marital_status} />
            <Row label="Cargo" value={emp.position} />
            <Row label="Empresa" value={emp.company_name} />
          </>
        );
      case "contato":
        return (
          <>
            <Row label="E-mail" value={emp.email} />
            <Row label="Celular" value={emp.phone} />
            <Row label="WhatsApp" value={emp.whatsapp} />
            <Row label="Contato de emergência" value={emp.emergency_contact} />
            <Row label="Telefone emergência" value={emp.emergency_phone} />
          </>
        );
      case "dependentes":
        return Array.isArray(emp.dependents) && emp.dependents.length > 0 ? (
          emp.dependents.map((d: any, i: number) => (
            <div key={i} className="py-3 border-b border-slate-100 last:border-0">
              <p className="text-sm font-semibold">{d.name}</p>
              <p className="text-xs text-slate-500">{d.relationship} • {d.birth_date || "—"}</p>
            </div>
          ))
        ) : <p className="text-sm text-slate-500 text-center py-6">Nenhum dependente cadastrado.</p>;
      case "bancario":
        return (
          <>
            <Row label="Banco" value={emp.bank_name} />
            <Row label="Agência" value={emp.bank_agency} />
            <Row label="Conta" value={emp.bank_account} />
            <Row label="Tipo" value={emp.bank_account_type} />
            <Row label="PIX" value={emp.pix_key} />
          </>
        );
      case "endereco":
        return (
          <>
            <Row label="CEP" value={emp.zip_code || emp.cep} />
            <Row label="Logradouro" value={emp.address} />
            <Row label="Número" value={emp.address_number} />
            <Row label="Complemento" value={emp.address_complement} />
            <Row label="Bairro" value={emp.neighborhood} />
            <Row label="Cidade" value={emp.city} />
            <Row label="Estado" value={emp.state} />
          </>
        );
      case "notificacoes":
        return <p className="text-sm text-slate-500 text-center py-6">Configuração de notificações em breve.</p>;
      case "privacidade":
        return (
          <div className="space-y-3 py-2 text-sm text-slate-600">
            <p>Seus dados são tratados conforme a LGPD (Lei nº 13.709/2018).</p>
            <p>Para solicitar acesso, correção ou exclusão dos seus dados, abra uma solicitação na aba "Solicitações".</p>
          </div>
        );
    }
  };

  return (
    <ColaboradorLayout bg="light" title={TITLES[section]} showBack>
      <div className="px-4 pt-6 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          {renderSection()}
        </div>
        {section !== "privacidade" && section !== "notificacoes" && (
          <p className="text-xs text-slate-400 text-center mt-4">
            Para alterar estes dados, abra uma solicitação para o RH.
          </p>
        )}
      </div>
    </ColaboradorLayout>
  );
}
