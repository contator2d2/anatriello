
## Objetivo

Criar **Perfis (Templates) de Acesso do App do Colaborador**, onde o RH define quais funções cada tipo de colaborador pode usar dentro do app (bater ponto, ver holerite, pedir férias etc.). Cada colaborador é vinculado a um template e as telas/botões do app se adaptam.

## Capabilities (funções do app hoje)

Vou mapear tudo o que existe atualmente como uma "capability" (chave técnica). Um template é apenas um conjunto liga/desliga dessas chaves.

```text
punch.register           Bater ponto pelo celular
punch.facial_required    Exigir reconhecimento facial no ponto
punch.view_history       Ver histórico de batidas / espelho
journey.view             Aba Jornada (horas trabalhadas, banco de horas)
requests.view            Aba Solicitações (listar)
requests.create          Abrir novas solicitações
vacations.view           Consultar férias
vacations.request        Solicitar férias
payslip.view             Baixar holerite
payslip.download_pdf     Salvar/exportar holerite em PDF
documents.view           Ver documentos pessoais
documents.upload         Enviar documentos (RG, comprovante etc.)
benefits.view            Ver benefícios (VR, VT, plano)
announcements.view       Receber comunicados
profile.view             Ver perfil
profile.change_password  Trocar a própria senha
notifications.receive    Receber push do sistema
```

Novas funções futuras entram só adicionando uma linha na tabela de capabilities.

## Templates iniciais criados por padrão

- **Operacional (padrão)** — bate ponto (facial ON), vê jornada, holerite, comunicados, perfil, trocar senha. Sem solicitações/férias/documentos/benefícios.
- **Administrativo** — tudo do Operacional + solicitações, férias, benefícios, documentos.
- **Gestor** — tudo habilitado.
- **Visitante / Terceirizado** — só perfil + comunicados. Não bate ponto.

Templates são editáveis; o RH pode criar quantos quiser.

## Telas novas no painel do RH

1. **RH → Acessos → aba "Perfis do App"**
   - Lista de templates com contagem de colaboradores vinculados.
   - Botão "Novo perfil" → nome + descrição + grid de capabilities agrupadas (Ponto, Solicitações, Financeiro, Documentos, Perfil).
   - Editor com switches por capability.

2. **Na tela de cada Colaborador (RHColaboradores / RHAcessos)**
   - Novo campo "Perfil do App" (select com os templates).
   - Botão "Aplicar template padrão da função" (usa o cargo para sugerir).

## Comportamento no App do Colaborador

- Ao logar, o backend devolve `capabilities: string[]` junto de `employee`.
- Guardado em `localStorage.promotor_capabilities` (offline-ready).
- Um hook `useCanColab(cap)` decide render:
  - Card de "Registrar Ponto" só aparece com `punch.register`.
  - Ícones de acesso rápido (Holerite, Férias, Benefícios, Documentos, Solicitações, Jornada, Comunicados) filtrados por capability.
  - Rotas `/app/*` protegidas por um wrapper `<RequireCap cap="...">`; sem permissão → redireciona para `/app/home` com toast "Função não liberada".
  - Tabs inferiores (Início, Jornada, Solicitações, Perfil) escondem itens sem permissão.
- Se o colaborador **não tem** `punch.register`, a Home mostra card "Seu perfil não permite bater ponto pelo app — procure a portaria/gestor".

## Detalhes técnicos

**Banco (Postgres backend):**

```sql
CREATE TABLE app_access_templates (
  id UUID PK,
  organization_id UUID,
  name TEXT,
  description TEXT,
  is_default BOOLEAN,
  created_at, updated_at
);

CREATE TABLE app_access_template_caps (
  template_id UUID FK,
  capability TEXT,             -- ex: 'punch.register'
  PRIMARY KEY (template_id, capability)
);

ALTER TABLE employees
  ADD COLUMN app_access_template_id UUID REFERENCES app_access_templates(id);
```

Seed automático dos 4 templates iniciais em `init-db.js` (só se a org não tiver nenhum).

**Backend (`backend/src/routes/rh.js` + novo `access-templates.js`):**
- `GET/POST/PUT/DELETE /api/rh/app-templates`
- `PUT /api/rh/employees/:id/app-template` — vincula/desvincula.
- Endpoint `/api/promotor/me` passa a devolver `capabilities`.

**Frontend:**
- Novo hook `useAppAccessTemplates()` (React Query).
- Novo componente `AppAccessTemplatesTab` dentro de `RHAcessos.tsx` (aba lateral) — mesmo padrão visual das tabs existentes.
- Novo select "Perfil do App" no dialog de "Liberar acesso" em `RHAcessos.tsx` e na edição do colaborador em `RHColaboradores.tsx`.
- Novo `src/lib/colab-capabilities.ts` — helper `hasCap(cap)`.
- Novo `<RequireCap>` em `src/components/ColabRequireCap.tsx`.
- `ColaboradorHome.tsx` e `ColaboradorLayout.tsx` passam a filtrar cards/tabs por capability.

## Fora do escopo agora

- UI para atribuir template em massa (fica no próximo ciclo).
- Permissões por PDV/Filial (o template atual é global por colaborador).
