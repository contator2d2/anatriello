import { useState } from "react";
import { Bot, X, Lightbulb, ListChecks, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface AssistantSection {
  title: string;
  items: string[];
}

export interface PageAssistantContent {
  title: string;
  intro: string;
  whatIsIt: string[];
  howToUse: AssistantSection[];
  tips?: string[];
}

interface Props {
  content: PageAssistantContent;
  className?: string;
}

/**
 * Botão flutuante de "Assistente Virtual" que explica a tela atual.
 * Usar em cada página do SmartRoute passando o conteúdo específico.
 */
export function PageAssistant({ content, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all px-4 py-3 hover:scale-105",
          className
        )}
        aria-label="Assistente Virtual"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Assistente</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <SheetTitle className="text-lg">{content.title}</SheetTitle>
            </div>
            <SheetDescription className="text-sm leading-relaxed">
              {content.intro}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <section>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">O que é esta tela</h3>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground pl-6 list-disc">
                {content.whatIsIt.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>

            {content.howToUse.map((sec, i) => (
              <section key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">{sec.title}</h3>
                </div>
                <ol className="space-y-1.5 text-sm text-muted-foreground pl-6 list-decimal">
                  {sec.items.map((t, j) => <li key={j}>{t}</li>)}
                </ol>
              </section>
            ))}

            {content.tips && content.tips.length > 0 && (
              <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold">Dicas</h3>
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground pl-6 list-disc">
                  {content.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Conteúdo pré-definido para as telas de Rotas do SmartRoute
export const ASSISTANT_CONTENT: Record<string, PageAssistantContent> = {
  rotasLegado: {
    title: "Rotas (Legado)",
    intro:
      "Tela de cadastro manual de rotas — modelo antigo em que você monta cada rota, escolhe motorista, veículo e paradas na mão. Use quando precisar de controle total sem depender do fluxo automático.",
    whatIsIt: [
      "Listagem de todas as rotas cadastradas manualmente.",
      "Permite criar, editar, excluir e reotimizar rotas existentes.",
      "Suporta anexar pedidos pendentes e gerar romaneio em PDF.",
    ],
    howToUse: [
      {
        title: "Criando uma rota manual",
        items: [
          "Clique em Nova Rota e informe nome, data, CD de saída, motorista e veículo.",
          "Selecione os pedidos pendentes que farão parte desta rota.",
          "Salve — a rota entra como 'planejada'.",
          "Opcional: clique em Otimizar (IA) para reordenar paradas pela IA.",
        ],
      },
      {
        title: "Acompanhando",
        items: [
          "Use os filtros de status (planejada, em andamento, concluída).",
          "Ícone de olho: abre detalhes e sequência de paradas.",
          "Ícone PDF: gera romaneio para o motorista.",
        ],
      },
    ],
    tips: [
      "Este fluxo é útil para rotas eventuais ou avulsas. Para operação diária, prefira Pedidos + Rota do Dia (fluxo dinâmico com IA noturna).",
      "Se aparecer 'depósito sem coordenada', abra o CD em Centros de Distribuição e preencha o CEP para geocodificar.",
    ],
  },

  rotasMontadas: {
    title: "Rotas Montadas",
    intro:
      "Templates/modelos de rotas fixas — usado quando você tem uma sequência recorrente de PDVs (ex.: 'Rota Zona Sul segunda-feira') que se repete. Serve como base para gerar rotas do dia rapidamente.",
    whatIsIt: [
      "Biblioteca de rotas-modelo (templates) reutilizáveis.",
      "Cada modelo já vem com motorista padrão, veículo e CD de saída.",
      "Você replica um modelo em qualquer data para materializar como rota real.",
    ],
    howToUse: [
      {
        title: "Criando um modelo",
        items: [
          "Clique em Novo Modelo, dê um nome (ex.: 'Rota Zona Sul').",
          "Defina motorista padrão, veículo e CD.",
          "Adicione a sequência típica de PDVs.",
          "Salve — o modelo fica disponível na biblioteca.",
        ],
      },
      {
        title: "Usando um modelo",
        items: [
          "Clique em Gerar Rota do Dia a partir do modelo.",
          "Escolha a data e ajuste pedidos se necessário.",
          "A rota é criada em 'Rota do Dia' pronta para execução.",
        ],
      },
    ],
    tips: [
      "Ideal para operações com clientes fixos e cadência semanal previsível.",
      "Para operação totalmente dinâmica (pedidos que variam a cada dia), use o fluxo de Pedidos → cron noturno.",
    ],
  },

  rotaDoDia: {
    title: "Rota do Dia",
    intro:
      "Visão operacional da rota vigente — mostra as paradas na sequência que o motorista deve executar hoje, incluindo status em tempo real (a fazer, em progresso, concluída).",
    whatIsIt: [
      "Exibe a rota ativa de um motorista para a data selecionada.",
      "Mostra ETA (tempo estimado) e status de cada parada.",
      "Permite reotimização manual caso ocorra imprevisto durante o dia.",
    ],
    howToUse: [
      {
        title: "Consultando",
        items: [
          "Selecione o motorista/rota no topo.",
          "Veja a sequência ordenada de PDVs com horário previsto.",
          "Acompanhe os status: aguardando, chegou, checklist, finalizado.",
        ],
      },
      {
        title: "Reotimizando durante o dia",
        items: [
          "Clique em Otimizar com IA para recalcular ordem das paradas restantes.",
          "A IA respeita janelas de entrega e paradas já concluídas.",
          "Confirme para publicar a nova sequência ao motorista.",
        ],
      },
    ],
    tips: [
      "A rota é gerada automaticamente todo dia às 20h pelo cron noturno com base nos pedidos do dia seguinte.",
      "Se algo não gerou, verifique se há pedidos abertos e se o CD tem coordenadas.",
    ],
  },

  simulador: {
    title: "Simulador de Rota",
    intro:
      "Preview visual e animado de como uma rota será executada — calcula distâncias reais por ruas (OSRM), tempos de checklist/upsell em cada PDV e mostra a evolução no mapa.",
    whatIsIt: [
      "Mostra a rota no mapa com cada parada numerada.",
      "Estima tempo total (deslocamento + atendimento + checklist).",
      "Anima o progresso etapa por etapa para você visualizar o fluxo.",
    ],
    howToUse: [
      {
        title: "Simulando",
        items: [
          "Escolha a rota que quer simular.",
          "Clique em Play para iniciar a animação passo a passo.",
          "Observe ETA acumulado e tempo estimado de cada parada.",
        ],
      },
    ],
    tips: [
      "Use antes de publicar uma rota para verificar se ela cabe no expediente.",
      "Se o tempo total ultrapassar a jornada, divida a rota em duas ou ajuste paradas.",
    ],
  },

  planejador: {
    title: "Planejador IA",
    intro:
      "Ferramenta de auto-planejamento assistido por IA — você escolhe CD, veículos e pedidos, a IA monta uma proposta de rotas otimizada em segundos e você confirma o que vai virar realidade.",
    whatIsIt: [
      "Gera preview de várias rotas simultaneamente a partir de um pool de pedidos.",
      "Otimiza por proximidade, janelas de entrega e capacidade do veículo.",
      "Só grava quando você clica em Commit — permite testar cenários.",
    ],
    howToUse: [
      {
        title: "Planejando",
        items: [
          "Selecione o CD de saída (deve ter coordenadas cadastradas).",
          "Escolha os veículos e motoristas disponíveis.",
          "Marque os pedidos que entram no planejamento.",
          "Clique em Auto-plan — a IA gera a proposta de rotas.",
        ],
      },
      {
        title: "Confirmando",
        items: [
          "Revise a proposta no mapa e na lista de paradas.",
          "Ajuste manualmente se necessário (arrastar pedidos entre rotas).",
          "Clique em Commit para publicar as rotas como oficiais do dia.",
        ],
      },
    ],
    tips: [
      "Se aparecer 'depósito sem coordenada', abra o CD e preencha o CEP — a coordenada é buscada automaticamente.",
      "Use para dias atípicos (feriado, promoção) em que o fluxo automático noturno não é suficiente.",
    ],
  },
};
