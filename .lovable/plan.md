
# Reestruturação do Sistema de Acesso a Supermercados

## Novo Fluxo

```text
Agência A  ──(envia documentos + lista de PDVs + marcas)──►  Rede Muffato
                                                                  │
                                                          aprova cadastro (1x)
                                                                  │
                              ┌───────────────────────────────────┼─────────────────────────┐
                              ▼                                   ▼                         ▼
                          PDV 01                              PDV 02                    PDV N
                    (acesso liberado por padrão — pode bloquear individualmente se houver problema)
                                                                  │
                                                    bloqueio → notifica Agência + Rede
```

**Regra central:** Documentação e aprovação cadastral acontecem **apenas na Rede**. PDVs **não validam documentos**, apenas exercem controle operacional de bloqueio individual do promotor naquele PDV específico.

## Mudanças

### 1. Backend (`backend/src/routes/promoter-validations.js`)
- **Remover** endpoints/config de validação de documento por PDV (`/unit/:id/config` de docs).
- Mantém `approval_mode`, documentos exigidos, score IA e notificações **apenas na Rede**.
- Novo endpoint `POST /portal/supermarket/units/:unitId/block-promoter` — PDV bloqueia/desbloqueia promotor individualmente.
- Novo endpoint `GET /portal/supermarket/units/:unitId/blocked-promoters` — lista bloqueios do PDV.
- Bloqueio dispara notificação automática para:
  - Agência do promotor (WhatsApp + e-mail configurados na agência)
  - Rede (canais de notificação configurados na Rede)
- Verificação de acesso (totem/check-in) passa a checar: aprovação da Rede **E** ausência de bloqueio no PDV.

### 2. Banco de dados (nova migration)
- Nova tabela `pdv_promoter_blocks`:
  - `supermarket_unit_id`, `agency_promoter_id`, `blocked_by` (supermarket_user), `reason`, `blocked_at`, `unblocked_at`, `active`.
- Auditoria via `access_audit_logs` existente (action: `pdv_block_promoter` / `pdv_unblock_promoter`).
- **Sem remoção de colunas** de `supermarket_units` para não quebrar dados — apenas deixam de ser usadas pelo frontend.

### 3. Frontend Admin (`src/pages/AccessControlAdmin.tsx` + componentes)
- `UnitDocValidationConfig.tsx`: **remover** a aba/tela de configuração de documentos no PDV. Substituir por aviso: "Documentação é configurada na Rede" + atalho para a Rede vinculada.
- `RedeDocValidationConfig.tsx`: continua sendo a fonte única de verdade (docs, IA, notificações).
- Compliance Tab: continua agregando por Rede.

### 4. Portal Supermercado (`src/pages/supermarket/`)
- `SupermarketAccessRequests.tsx`: remover configuração de docs/IA. Manter apenas:
  - Lista de promotores autorizados pela Rede com filtros.
  - Botão **"Bloquear neste PDV"** com motivo obrigatório.
  - Lista de bloqueios ativos com possibilidade de remover (gera notificação).
  - Histórico de eventos (auditado).
- Mostra status: "Aprovado pela Rede" / "Bloqueado neste PDV (motivo)".

### 5. Notificações
- Reaproveita `promoter_validation_notifications` (outbox) + `whatsappProvider`.
- Eventos novos: `pdv_blocked`, `pdv_unblocked`.
- Destinatários: agência (do promotor) + rede (do PDV).

## Detalhes Técnicos

- Hook `usePromoterValidations` ganha:
  - `usePdvBlockPromoter()` — mutação para bloquear/desbloquear.
  - `usePdvBlockedPromoters(unitId)` — listagem.
- `pdv_access_rules` continua existindo para horário/dia/marcas, mas o gate de aprovação documental olha somente a Rede.
- Migration adiciona índice em `(supermarket_unit_id, agency_promoter_id, active)`.

## Fora de escopo
- Não vou migrar dados antigos de configs por PDV — ficam órfãos e inertes.
- Não vou mexer no fluxo de check-in do totem além do gate de bloqueio (continua usando regras existentes).
