# SmartRoute AI — Documentação de Uso

Guia completo para operar o módulo SmartRoute AI (painel administrativo) e o Aplicativo do Entregador.

Fuso padrão: **America/Sao_Paulo**. Todas as datas e horários são exibidos em GMT-3.

---

## 1. Visão Geral

O SmartRoute AI é um **controlador de jornada operacional ponta-a-ponta**. Cada entrega é uma máquina de estados com validações configuráveis, e a próxima entrega só é liberada quando a atual atende todos os requisitos obrigatórios.

**Máquina de estados por entrega (stop):**

```
PENDING → NAVIGATING → ARRIVED → CHECKED_IN
       → CHECKLIST_IN_PROGRESS → CHECKLIST_DONE
       → PROOF_CAPTURED → SIGNED → CHECKED_OUT → COMPLETED
                                              ↘ EXCEPTION (com ocorrência)
```

Regra de ouro: **um stop só avança quando os obrigatórios do passo anterior estão preenchidos**.

---

## 2. Estrutura do Módulo (Admin)

Acesso: menu **SmartRoute AI**.

| Tela | Rota | Uso |
|---|---|---|
| Dashboard | `/smartroute` | KPIs operacionais (entregas em andamento, tempo médio por stop, taxa de ocorrências, checklists com maior falha). |
| Mapa Live | `/smartroute/mapa` | Posição dos entregadores em tempo real. |
| Rotas | `/smartroute/rotas` | Criar/otimizar rotas do dia. |
| Pedidos | `/smartroute/pedidos` | Base de pedidos a serem entregues. |
| PDVs | `/smartroute/pdvs` | Cadastro de pontos com atributos (cliente, canal, região, categoria) usados para atribuir checklists. |
| Frota | `/smartroute/frota` | Veículos e capacidades. |
| CDs | `/smartroute/cds` | Centros de distribuição / origens. |
| Motoristas | `/smartroute/motoristas` | Cadastro de entregadores com credenciais do app. |
| Checklists | `/smartroute/checklists` | Editor de templates + vinculação por escopo. |
| Replay | `/smartroute/replay/:id` | Timeline da jornada (checkins, fotos, OCR, ocorrências, checkout). |
| Gestor IA | `/smartroute/gestor-ia` | Recomendações e insights automáticos. |
| Integrações | `/smartroute/integracoes` | Webhooks, ERPs. |
| Relatórios | `/smartroute/relatorios` | Exportações. |
| Configurações | `/smartroute/configuracoes` | Parâmetros operacionais da organização. |

---

## 3. Configuração Inicial

Ordem recomendada de cadastro:

1. **CDs** — cadastre os centros de distribuição (origem das rotas).
2. **Frota** — veículos, capacidade de carga e restrições.
3. **Motoristas** — cadastre entregadores; o sistema gera credenciais para login no app (`/entregador/login`).
4. **PDVs** — importe ou cadastre pontos com atributos completos (**cliente, tipo, canal, categoria, região, equipamento, operação, produto**). Esses atributos determinam qual checklist será aplicado.
5. **Checklists** — crie templates e defina regras de vinculação.
6. **Configurações → Operação** — ajuste distância de check-in, obrigatoriedades e app de navegação preferido.

---

## 4. Configurações de Operação

Em `SmartRoute → Configurações → aba Operação`:

- **Distância máxima de check-in** — raio (metros) em que o GPS do entregador deve estar em relação ao PDV. Padrão: **30 m**.
- **Exigir foto de fachada** no check-in (sim/não).
- **Exigir checklist do veículo** no início da jornada (sim/não).
- **App de navegação preferido** — Google Maps, Waze ou perguntar ao entregador.
- **Permitir check-out com ocorrência** (sim/não).
- **Exigir assinatura** do recebedor.
- **Exigir foto da nota fiscal** no fechamento.

Alterações valem para toda a organização e não retroagem em stops já iniciados (snapshot do template é mantido).

---

## 5. Checklists Inteligentes

Cada entrega roda o checklist aplicável ao PDV/pedido. **O mesmo app atende desde uma entrega simples até uma auditoria completa de PDV.**

### 5.1 Criar um Template

Em `SmartRoute → Checklists → Novo template`:

1. Dê um **nome** e defina o **escopo** (cliente, tipo de PDV, canal, categoria, produto, região, equipamento, operação).
2. Adicione **itens** na ordem em que aparecerão para o entregador.
3. Para cada item selecione o **tipo de campo**:

| Tipo | Uso |
|---|---|
| `photo` | Foto obrigatória com EXIF (GPS + timestamp). |
| `video` | Vídeo curto. |
| `text` | Texto livre. |
| `number` | Número (min/max opcional). |
| `temperature` | Temperatura com tolerância (min/max °C). |
| `stock_count` | Contagem de estoque. |
| `ocr` | Foto processada por IA (produto, marca, EAN, lote, validade). |
| `qr` | Leitura de QR Code. |
| `barcode` | Leitura de código de barras. |
| `signature` | Assinatura digital (canvas). |
| `geo` | Coordenada obrigatória. |
| `face` | Validação facial (face-api.js, threshold 0.6). |
| `yes_no` | Sim/Não. |
| `multi_choice` | Múltipla escolha (opções em `config.options`). |

4. Marque cada item como **obrigatório** ou opcional.
5. Salve. O template fica disponível para vinculação.

### 5.2 Regras de Vinculação

Na aba **Vinculação** do template, defina os atributos que o PDV precisa ter para receber esse checklist (interseção de escopos). Se mais de um template se aplicar, todos rodam em ordem.

### 5.3 Simulação

Aba **Simulação**: escolha um PDV/pedido e visualize exatamente qual checklist o entregador verá — útil para validar regras antes de publicar.

### 5.4 OCR de Embalagens

Itens do tipo `ocr` disparam análise por IA (Gemini/OpenAI via Lovable AI Gateway) após a foto. O retorno é um JSON estruturado:

```json
{
  "product": "...",
  "brand": "...",
  "code": "...",
  "ean": "...",
  "batch": "...",
  "manufactured_at": "YYYY-MM-DD",
  "expires_at": "YYYY-MM-DD",
  "confidence": 0.0
}
```

O entregador **confirma ou corrige** os dados antes de gravar.

---

## 6. Aplicativo do Entregador

URL: **`/entregador/login`** (abra pelo navegador do celular ou instale como PWA).

### 6.1 Login

- Usuário: **CPF** ou e-mail cadastrado em `SmartRoute → Motoristas`.
- Senha: fornecida pelo gestor no primeiro acesso.
- Token de sessão fica salvo no dispositivo (sem necessidade de novo login diário).

### 6.2 Tela Inicial (`/entregador`)

Mostra:

- Resumo do dia (nº de entregas, km previstos, tempo estimado, veículo).
- Botão **Iniciar operação** (se exigido, roda checklist do veículo antes).
- Lista de rotas do dia — toque para abrir.

### 6.3 Lista de Stops (`/entregador/rota/:id`)

Cada card mostra: sequência, cliente, endereço, janela horária e status atual. Toque para abrir a entrega. A rota **não permite pular stops** — o próximo só desbloqueia quando o atual é concluído.

### 6.4 Tela de Entrega (`/entregador/entrega/:id`)

Dividida em abas na ordem do fluxo:

**1. Navegar**
- Botão abre deep link nativo (Google Maps ou Waze) conforme configuração.
- Ao tocar, o stop muda para `NAVIGATING`.

**2. Check-in**
- Captura GPS e valida distância em relação ao PDV (Haversine).
- Se exigido: foto de fachada obrigatória (EXIF gravado).
- Fora do raio → o app **bloqueia o check-in** e sugere registrar ocorrência.

**3. Checklist**
- Renderiza todos os itens dos templates aplicáveis, na ordem.
- Cada item mostra badge **Obrigatório** ou **Opcional**.
- Só habilita o fechamento quando todos os obrigatórios estão respondidos.

**4. Ocorrências**
- Bottom-sheet para registrar: danificado, vencido, recusado, ausente, garantia, devolução, descarte, equipamento, freezer, outros.
- Aceita descrição, mídias e captura de geolocalização.

**5. Finalizar (Check-out)**
- Foto da nota fiscal (se exigido).
- Assinatura do recebedor (canvas) + nome de quem recebeu.
- Botão **Concluir entrega** — valida pendências. Se algo falta, exibe lista amigável.
- Ao concluir: stop passa a `COMPLETED`, duração é calculada, próximo stop é liberado com banner e contagem regressiva.

### 6.5 Modo Offline

- Fotos, respostas e assinaturas são gravados em **IndexedDB local**.
- Reenvio automático quando a rede volta (fila do `use-offline-sync`).
- O entregador pode operar em áreas sem sinal — os dados sobem depois.

### 6.6 Deep Links de Navegação

Preferência configurada em Configurações → Operação:

- Android: `google.navigation:q=lat,lng` ou `waze://?ll=lat,lng&navigate=yes`.
- iOS: `comgooglemaps://` ou `waze://`.
- Fallback web: `https://www.google.com/maps/dir/?api=1&destination=...`.

---

## 7. Ocorrências

Registradas na aba **Ocorrências** da entrega. Tipos padrão:

- Produto **danificado**
- Produto **vencido**
- Entrega **recusada**
- Cliente **ausente**
- **Garantia**
- **Devolução**
- **Descarte**
- Problema de **equipamento** (freezer, câmara fria)
- **Outros**

Cada ocorrência exige tipo, descrição, geo e (opcional) mídias. Se `Permitir check-out com ocorrência` estiver ligado, o stop pode ir para `EXCEPTION` justificada e liberar o próximo.

---

## 8. Replay da Jornada (Admin)

`/smartroute/replay/:id` mostra uma **timeline auditável** com todos os eventos:

- Início da jornada / checklist do veículo.
- Cada `NAVIGATING`, `ARRIVED`, `CHECKED_IN` com foto e GPS.
- Respostas do checklist, incluindo mídias e OCR.
- Ocorrências registradas.
- Assinatura e check-out.

Log é **append-only** — não pode ser alterado, só complementado.

---

## 9. Dashboard Operacional

Cards em `/smartroute`:

- Entregas em andamento **por estado** (pizza).
- **Tempo médio** por stop e por rota.
- **Taxa de ocorrências** por PDV/cliente.
- Checklists com **maior índice de falha** (item que mais bloqueia).
- Veículos ativos vs. planejados.

---

## 10. Fluxos Recomendados

### 10.1 Rodar um dia de operação (gestor)

1. Manhã: verifica rotas do dia em `SmartRoute → Rotas`.
2. Se algo estiver desbalanceado, roda **Otimizar rota**.
3. Acompanha o **Mapa Live** e o **Dashboard**.
4. Trata alertas (atraso, desvio, ocorrência crítica).
5. Ao final do dia, revisa **Replay** dos stops com exceção.

### 10.2 Fazer uma entrega (entregador)

1. Login → **Iniciar operação** (checklist do veículo se exigido).
2. Toca no primeiro stop → aba **Navegar** → segue pelo Maps/Waze.
3. Chegou → aba **Check-in** → captura GPS + foto de fachada.
4. Roda o **Checklist** (foto do produto, OCR, temperatura, etc.).
5. Registra **ocorrência** se necessário.
6. **Finaliza**: NF + assinatura → toca em **Concluir entrega**.
7. O app abre automaticamente o próximo stop.

### 10.3 Criar um novo checklist (gestor)

1. `SmartRoute → Checklists → Novo template`.
2. Escopo (ex.: cliente = "Rede X", canal = "Farmácia").
3. Adiciona itens na ordem: foto de fachada, foto do produto (OCR), temperatura do freezer, assinatura.
4. **Simulação** com um PDV real para conferir.
5. Ativa o template.

---

## 11. Boas Práticas

- Sempre cadastre **atributos completos do PDV** — sem eles, o checklist correto não é aplicado.
- Prefira **poucos templates bem focados** em vez de um checklist gigante.
- Configure a **distância de check-in** conforme a realidade (30 m em cidade, 60–100 m em zona rural).
- Reveja periodicamente os **checklists com maior falha** — sinal de item mal desenhado ou treinamento faltando.
- Use o **Replay** para treinar entregadores com casos reais.
- Nunca edite um template esperando efeito retroativo — snapshots preservam o histórico.

---

## 12. Solução de Problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Check-in bloqueado | Fora do raio configurado | Conferir GPS do dispositivo; registrar ocorrência de endereço errado. |
| Checklist não aparece | PDV sem atributos ou nenhum template ativo cobre o escopo | Completar atributos do PDV / revisar vinculação do template. |
| OCR retorna vazio | Foto tremida, contra-luz, embalagem amassada | Refazer foto; se persistir, preencher manualmente. |
| App não abre navegação | App preferido não instalado | Alterar preferência em Configurações → Operação. |
| Próximo stop não libera | Stop atual sem obrigatórios | Ver lista de pendências exibida no botão Concluir. |
| Fotos não sobem | Sem sinal | Ficam na fila offline; sincronizam sozinhas ao reconectar. |

---

## 13. Segurança e Auditoria

- Todas as mídias vão para bucket **privado** com policies por `organization_id` e `stop_id`.
- Cada ação gera evento em `sr_journey_events` (append-only).
- EXIF (lat, lng, timestamp, device) é **obrigatório** em fotos — o backend recusa upload sem esses dados.
- Assinaturas ficam com timestamp GMT-3 e hash do canvas.
- Sessão do entregador expira conforme política da organização.

---

_Documentação viva — atualizada a cada release do SmartRoute AI._
