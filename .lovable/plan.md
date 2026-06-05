## Objetivo

Adicionar 3 capacidades ao módulo de Controle de Acesso:

1. **Tipos de promotor**: `fixo`, `freelance` e `substituto` (temporário).
2. **Fluxo de afastamento/substituição**: agência marca titular como afastado e escolhe substituto manualmente; visitas pendentes são reatribuídas.
3. **Dashboard de acompanhamento** com 4 painéis: Operacional em tempo real, Validações IA, Gestão de Promotores, Financeiro/Contratos.

---

## 1. Schema (backend, via ensureTables JIT)

**`agency_promoters` (novas colunas)**
- `promoter_type` text default `'fixo'` — `fixo` | `freelance` | `substituto`
- `is_available` boolean default true — para freelance/substituto aceitar cobertura
- `mei_cnpj` text — opcional, freelance pessoa jurídica
- `hourly_rate` numeric — custo do freelance (financeiro)

**`promoter_leaves` (nova tabela)**
- `id`, `promoter_id`, `agency_id`
- `reason` text — `doenca` | `ferias` | `falta` | `desligamento` | `outro`
- `start_date`, `end_date` (nullable se em aberto)
- `substitute_promoter_id` uuid nullable
- `notes` text, `created_at`, `created_by`

**`visit_requests` (novas colunas)**
- `original_promoter_id` uuid — preserva o titular quando há substituição
- `substitution_reason` text
- `leave_id` uuid referenciando `promoter_leaves`

**`merch_redes` (novas colunas)**
- `doc_validation_required_fixo` jsonb — docs exigidos do CLT/fixo
- `doc_validation_required_freelance` jsonb — docs exigidos do freelance (default: CNH + selfie)
- `doc_validation_required_substituto` jsonb — docs do substituto

**`supermarket_units` (override por tipo, já tem override por PDV)**
- `doc_validation_required_freelance` jsonb (override)
- `doc_validation_required_substituto` jsonb (override)

A função `loadValidationRequirements(redeId, unitId, promoterType)` passa a receber o tipo e retorna a lista de docs apropriada com fallback PDV → Rede → default por tipo.

---

## 2. Backend — novas rotas

`backend/src/routes/promoter-leaves.js` (registrado em `index.js`)
- `GET /api/promoter-leaves?agency_id=&active=true` — lista afastamentos
- `POST /api/promoter-leaves` — cria afastamento, opcionalmente já indicando substituto e reatribui automaticamente `visit_requests` pendentes do titular para o substituto (preserva `original_promoter_id`)
- `PUT /api/promoter-leaves/:id` — atualiza (encerrar afastamento, trocar substituto)
- `DELETE /api/promoter-leaves/:id` — cancela
- `GET /api/promoter-leaves/available-substitutes?agency_id=&date=` — lista promotores `freelance`/`substituto` disponíveis (sem visita marcada)

`backend/src/routes/access-control-dashboard.js`
- `GET /api/access-control/dashboard/operational` — visitas hoje, no PDV agora, afastamentos ativos, substituições pendentes
- `GET /api/access-control/dashboard/validations` — pendentes IA, score médio, rejeições, divergências críticas
- `GET /api/access-control/dashboard/promoters` — totais por tipo, conformidade, score de performance
- `GET /api/access-control/dashboard/financial` — contratos vencendo (30 dias), freelancers ativados no mês, custo estimado por PDV (hourly_rate × horas)

`backend/src/routes/promoter-validations.js` — `loadValidationRequirements` aceita `promoterType` e escolhe a coluna correta.

---

## 3. Frontend

**`src/pages/agency/AgencyPromoters.tsx`** — adicionar:
- Select `promoter_type` no formulário (Fixo / Freelance / Substituto)
- Campos condicionais: `mei_cnpj`, `hourly_rate` aparecem para freelance/substituto
- Documentos opcionais (contrato/CTPS) ficam ocultos para freelance
- Badge colorido na lista por tipo

**`src/pages/agency/AgencyLeaves.tsx`** (nova página, rota `/agency/leaves`)
- Lista afastamentos ativos
- Botão "Registrar afastamento": escolhe promotor titular, motivo, datas
- Após criar, abre modal "Designar substituto" com lista de freelancers disponíveis
- Mostra quantas visitas foram reatribuídas

**`src/components/merchandising/RedeDocValidationConfig.tsx`** — abas/tabs:
- Aba "Fixo (CLT)", "Freelance", "Substituto" — cada uma com os checkboxes de documentos exigidos

**`src/components/access-control/UnitDocValidationConfig.tsx`** — mesma estrutura de tabs por tipo (override opcional)

**`src/pages/admin/AccessControlDashboard.tsx`** (nova, rota `/admin/access-control/dashboard`)
- 4 cards de KPIs no topo (visitas hoje, no PDV agora, afastamentos, validações pendentes)
- Tabs: Operacional / Validações IA / Promotores / Financeiro
- Cada tab renderiza gráficos (recharts) e tabelas
- Link "Ver detalhes" navega para a página correspondente

**`src/hooks/use-promoter-leaves.ts`** — queries/mutations das rotas
**`src/hooks/use-access-dashboard.ts`** — query dos 4 endpoints

**`src/App.tsx`** — registrar as 2 novas rotas

---

## 4. Lógica de substituição automática

Quando `POST /api/promoter-leaves` é criado com `substitute_promoter_id`:
```sql
UPDATE visit_requests
SET original_promoter_id = promoter_id,
    promoter_id = $substitute,
    leave_id = $leave_id,
    substitution_reason = $reason,
    -- dispara nova validação IA do substituto
    validation_status = 'pending'
WHERE promoter_id = $original
  AND status IN ('pending','approved')
  AND visit_date >= $start_date
  AND ($end_date IS NULL OR visit_date <= $end_date);
```

Em seguida, o `triggerValidation` é chamado para cada visita reatribuída, usando o `promoter_type` do substituto (que normalmente exige menos documentos).

---

## Arquivos criados/editados (resumo)

Criar:
- `backend/src/routes/promoter-leaves.js`
- `backend/src/routes/access-control-dashboard.js`
- `src/pages/agency/AgencyLeaves.tsx`
- `src/pages/admin/AccessControlDashboard.tsx`
- `src/hooks/use-promoter-leaves.ts`
- `src/hooks/use-access-dashboard.ts`

Editar:
- `backend/src/index.js` (registrar rotas)
- `backend/src/routes/promoter-validations.js` (assinatura `loadValidationRequirements` + ensureTables)
- `backend/src/routes/access-control.js` (ensureTables novas colunas)
- `src/pages/agency/AgencyPromoters.tsx` (tipos + campos condicionais)
- `src/pages/agency/AgencyLayout.tsx` (item de menu "Afastamentos")
- `src/components/merchandising/RedeDocValidationConfig.tsx` (tabs por tipo)
- `src/components/access-control/UnitDocValidationConfig.tsx` (tabs por tipo)
- `src/App.tsx` (rotas)
- `src/pages/Admin.tsx` (card do dashboard)

Posso prosseguir com a implementação completa?
