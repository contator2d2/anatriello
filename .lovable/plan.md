
# Ponto Eletrônico Completo — Anatriello Gestão

Vamos elevar o módulo de ponto ao nível do Secullum, mantendo tudo integrado ao app do colaborador, à biometria facial e ao GPS que já temos.

## Visão geral

O ponto passa a ter três camadas:

1. **Coleta** — App do colaborador (biometria facial + GPS + selfie assinada) e importação de REP via arquivo AFD (Portaria 1.510/671).
2. **Processamento** — Motor de cálculo diário (previsto x realizado, atrasos, extras, DSR, banco de horas 1:1) rodando quando uma batida entra ou uma escala muda.
3. **Gestão** — Painel do RH com Cartão Ponto editável, extrato do banco de horas, fechamento de período, relatórios PDF e fluxo de ajustes (RH direto **e** solicitação do colaborador com aprovação).

## Fases de entrega

### Fase 1 — Cartão Ponto e Cálculos (base)
- Grade estilo Secullum: colunas Data · Entrada 1 · Saída 1 · Entrada 2 · Saída 2 · … · Normais · BCred · BDeb · BSaldo.
- Edição inline de batidas com auditoria (asterisco vermelho quando editado manualmente, guardando autor, valor anterior, motivo).
- Cálculo diário conforme a jornada do colaborador (já temos "horário diferente por dia").
- Marcadores automáticos: Feriado, Folga, DSR, Falta, Atraso, Extra.
- Filtros por período, folha (matrícula), nome, empresa (multi-tenant já existente).

### Fase 2 — Banco de Horas 1:1 + regras
- Saldo diário = Realizado − Previsto (respeitando tolerância configurável por empresa, ex.: 10 min).
- Acúmulo em `time_bank_entries` com histórico (crédito, débito, compensação, ajuste manual, pagamento).
- Extrato do banco por colaborador (igual print "Extrato do Período").
- Fechamento de período (bloqueia edição pós-assinatura eletrônica).

### Fase 3 — Escalas, Horários e Feriados
- Cadastro de **Horários** (turnos): jornada semanal com múltiplos intervalos, escala 6x1, 12x36, escala mensal.
- Cadastro de **Feriados** nacionais/estaduais/municipais por empresa (com importação automática dos nacionais).
- **Quadro de Horários**: vincular colaborador → horário/escala com vigência (início/fim).
- Departamentos e Funções (já existem parcialmente — só expor no ponto).

### Fase 4 — Ajustes de ponto (dois fluxos)
- **RH direto**: edita batida no Cartão Ponto → grava em `punch_adjustments` com autor, motivo, valores antes/depois.
- **Colaborador via app**: nova aba "Ajuste de ponto" em Solicitações → escolhe dia, informa horário correto, anexa justificativa/foto → gestor aprova/reprova → se aprovado, gera batida com flag `origin='employee_request'`.
- Notificações in-app + e-mail para o supervisor quando há solicitação pendente.

### Fase 5 — App + Biometria (reforço)
- Batida no app já tem GPS + facial; passa a validar:
  - **Cerca geográfica** (raio configurado por empresa/endereço da unidade).
  - **Horário de jornada** (avisa se está fora da janela, mas não bloqueia — vira "batida fora de horário" no cartão).
  - **Selfie assinada** salva junto com a batida (hash SHA-256 + timestamp GMT-3, requisito da Portaria 671).
- Comprovante de batida em PDF (NSR) disponível para download no app.

### Fase 6 — AFD e Relatórios
- **Importação AFD**: upload do arquivo do REP físico → parser cria batidas com `source='afd'` e evita duplicidade por hash.
- **Exportação AFD** (layout Portaria 671) para fiscalização.
- Relatórios PDF: Cartão Ponto individual, Espelho do período (assinável), Extrato do Banco de Horas, Relação de faltas/atrasos, Relatório de horas extras.
- Assinatura eletrônica do espelho (reaproveita módulo de assinatura já existente com SHA-256 + OTP).

## Detalhes técnicos

### Novas tabelas (backend, via `ensureTables`)
- `work_schedules` — jornada (nome, tipo, dias com entrada/almoço/saída, tolerância).
- `employee_schedules` — vínculo colaborador ↔ jornada com vigência.
- `holidays` — feriados por empresa/escopo (nacional, estadual, municipal).
- `punch_records` — evolução da atual: adiciona `source` (`app`, `afd`, `manual`, `request`), `nsr`, `signature_hash`, `edited_by`, `edited_at`, `original_time`.
- `punch_adjustments` — trilha de auditoria de edições (já existe, expandir).
- `punch_adjustment_requests` — solicitações do colaborador (status, aprovador, motivo).
- `time_bank_entries` — lançamentos do banco (data, tipo, minutos, saldo acumulado).
- `time_bank_closings` — fechamentos de período (empresa, período, assinado_por).

### Motor de cálculo
Serviço `PointCalculator` (Node) em `backend/src/services/point-calculator.js` recalcula um dia inteiro quando uma batida entra/edita/escala muda. Idempotente. Roda inline no request e também via cron noturno para fechar o dia.

### Frontend
- Nova rota `/rh/ponto` com abas: **Cartão Ponto** · **Banco de Horas** · **Escalas** · **Feriados** · **Solicitações** · **AFD** · **Relatórios**.
- Grade editável usando `@tanstack/react-table` + edição inline com atalhos (tab entre células, como Secullum).
- App do colaborador ganha aba "Ajuste de ponto" dentro de Solicitações.

## Ordem sugerida de execução
Faço **Fase 1 + Fase 2 + Fase 4** nesta primeira leva (é o coração do sistema e o que você já pode usar com os colaboradores existentes). Fases 3, 5 reforço e 6 (AFD) entram em uma segunda leva, para não estourar essa entrega.

Se preferir, posso inverter e começar pela Fase 6 (AFD) para migrar dados históricos do Secullum antes.
