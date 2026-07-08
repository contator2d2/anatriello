import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Download, Truck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DOC_URL = "/docs/smartroute-documentacao.md";

const SmartRouteDocumentacao = () => {
  const [md, setMd] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(DOC_URL)
      .then((r) => r.text())
      .then((t) => setMd(t))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documentação — SmartRoute AI</h1>
            <p className="text-sm text-muted-foreground">
              Guia completo do painel administrativo e do aplicativo do entregador.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <a href={DOC_URL} download="smartroute-documentacao.md">
            <Download className="h-4 w-4 mr-2" />
            Baixar (.md)
          </a>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Painel Admin
            </CardTitle>
            <CardDescription>Rotas, PDVs, checklists, replay e dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Configure a operação, monte checklists inteligentes e acompanhe cada entrega em tempo real.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" /> App do Entregador
            </CardTitle>
            <CardDescription>Navegar → Check-in → Checklist → Finalizar.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Fluxo linear com validações obrigatórias, OCR, assinatura, ocorrências e modo offline.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
            </div>
          ) : (
            <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none
              prose-headings:scroll-mt-24 prose-headings:tracking-tight
              prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-a:text-primary prose-code:text-primary
              prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-muted prose-pre:text-foreground
              prose-table:text-sm prose-th:bg-muted/60">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
            </article>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SmartRouteDocumentacao;
