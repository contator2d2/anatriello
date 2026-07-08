# Documentação do Módulo de RH

Guia passo a passo de todas as configurações, processos e cálculos do módulo de Recursos Humanos.
Fuso horário padrão: **America/Sao_Paulo**.

---

## 1. Visão Geral do Módulo

O módulo de RH cobre o ciclo completo do colaborador: admissão, jornada, ponto, folha, benefícios, avaliações, desligamento e eSocial. Todas as datas usam o fuso America/Sao_Paulo.

### Fluxo macro
1. Configurar Holding → Empresas → PDVs → Feriados regionais.
2. Criar Perfis de Acesso (templates) e liberar app para colaboradores.
3. Admitir colaboradores (dados, contrato, documentos, biometria).
4. Definir escalas e regras de ponto por PDV/cargo.
5. Operar: ponto diário, banco de horas, férias, advertências.
6. Fechar folha mensal → gerar holerite → exportar eSocial.
7. Acompanhar via Dashboard, Rastreamento, Analytics e Auditoria.

> 💡 Comece sempre pela estrutura (Holding/Empresas) antes de cadastrar pessoas — muitas telas dependem desse vínculo.

---

## 2. Acesso e Permissões

Permissões são dinâmicas por template (JSONB) em vez de papéis fixos. Um mesmo colaborador pode ter perfis diferentes no app e no painel.

### Como criar um perfil
1. Vá em RH → Acessos App → aba "Perfis do App".
2. Clique em "Novo perfil" e nomeie (ex.: Operacional, Gestor de PDV).
3. Marque as capacidades permitidas (ponto, holerite, documentos, etc.).
4. Salve. O template fica disponível no dropdown de cada colaborador.

### Liberar acesso ao app
1. Aba "Colaboradores" → linha do colaborador → botão "Liberar".
2. Escolha o perfil e confirme. Uma senha temporária (padrão anatriXXXaa) é gerada.
3. Compartilhe login (CPF) e senha. Troca obrigatória no primeiro acesso.

> ⚠️ Nunca compartilhe a senha por canal não seguro. Revogue imediatamente ao desligar o colaborador.

---

## 3. Configurações Iniciais

### Holding
1. RH → Holding → "Nova holding".
2. Informe razão social, CNPJ e responsável.
3. Vincule as empresas do grupo para consolidar relatórios.

### Empresas
1. RH → Empresas → "Nova empresa".
2. Preencha CNPJ, endereço, responsável e carga horária padrão.
3. Associe a uma holding (opcional).

### PDVs / Unidades
1. RH → PDVs → cadastre cada unidade com endereço geolocalizado.
2. Defina raio de tolerância para bater ponto por GPS.

### Feriados
1. RH → Feriados → selecione UF/município → "Adicionar feriado".
2. Feriados influenciam ponto, escala, DSR e folha automaticamente.

> 💡 Cadastre feriados no início do ano fiscal para evitar recálculos posteriores.

---

## 4. Admissão / Contratação

A admissão gera automaticamente o evento S-2200 do eSocial e habilita o colaborador nas demais telas.

1. **Etapa 1 — Dados pessoais**: CPF, nome, nascimento, contato, endereço.
2. **Etapa 2 — Dados contratuais**: empresa, cargo, PDV, salário, admissão, jornada, tipo de contrato (CLT/PJ/estágio).
3. **Etapa 3 — Dependentes**: para IR e salário-família (opcional).
4. **Etapa 4 — Documentos**: RG, CTPS, PIS, comprovante de residência, foto 3x4, exame admissional.
5. **Etapa 5 — Geração**: revisar → clicar "Admitir". Sistema cria contrato, gera acesso ao app (se marcado) e agenda S-2200.

### Importação em lote
- Baixe o modelo Excel na tela de Colaboradores.
- Upsert por CPF (ou e-mail) — atualiza existentes, cria novos.
- Idade e tempo de casa são calculados automaticamente.

> ⚠️ Sem CPF válido o eSocial rejeita o evento. Valide antes de importar.

---

## 5. Documentos e Contratos

1. RH → Documentos → "Novo documento".
2. Escolha modelo (contrato, aditivo, aviso, termo de EPI).
3. Selecione colaborador destinatário — variáveis são preenchidas automaticamente.
4. Envie para assinatura. Colaborador recebe link + OTP por e-mail/WhatsApp.
5. Assinatura registra IP, dispositivo, timestamp GMT-3 e hash SHA-256.
6. Verifique autenticidade em Verificar Documento pelo hash.

> 💡 Modelos personalizados ficam em ModeloContrato — use variáveis `{{nome}}`, `{{cargo}}`, `{{salario}}` etc.

---

## 6. Escalas de Trabalho

1. RH → Escalas → "Nova escala".
2. Escolha o tipo (5x2, 6x1, 12x36, livre) e a semana modelo.
3. Defina intervalo (padrão 1h de almoço) e tolerância de atraso.
4. Atribua colaboradores ou vincule a um PDV inteiro.

- **5x2**: 44h semanais, DSR ao domingo.
- **6x1**: 44h em 6 dias com folga rotativa.
- **12x36**: turno de 12h com 36h de descanso.
- **Livre**: horário flexível com meta mensal de horas.

---

## 7. Relógio de Ponto

### Totem / Tablet (RHRelogioPonto)
1. Abra `/rh/relogio-ponto` no tablet fixo do PDV.
2. Faça login com o KioskLogin da empresa.
3. Colaborador digita CPF → posiciona rosto na câmera → confirma.
4. Sistema registra entrada/intervalo/saída conforme a batida atual.

### App do colaborador
1. Login em `/colaborador/login` com CPF + senha.
2. Tela inicial mostra botão "Bater ponto" com GPS obrigatório.
3. Selfie é comparada com o embedding cadastrado.
4. Funciona offline: bate ponto e sincroniza quando reconectar.

### Portal web (admin)
- RH → Ponto: visualiza folha diária, horas trabalhadas, extras.
- Ajuste manual: clique na célula → alterar → motivo → salva no log.
- Exportação AFD para fiscalização.

> 💡 Use Monitor de Ponto (`/rh/ponto-monitor`) para acompanhar em tempo real quem está batendo agora.

---

## 8. Biometria e Selfie

### Cadastro do rosto
1. RH → Biometria Facial → selecione o colaborador → "Capturar".
2. Ambiente iluminado, sem óculos escuros/máscara.
3. Sistema extrai embedding (128d) via face-api.js — WebGL, com fallback CPU.
4. Recomenda-se recapturar a cada 6 meses ou após mudança visual.

### Validação na batida
- Distância euclidiana entre selfie ao vivo e o embedding cadastrado.
- Threshold: ≤ 0.6 aprova, > 0.6 rejeita.
- Se rejeitar: colaborador tenta 3x, depois pede aprovação do gestor.

### Antifraude / testes
- Detecção básica de foto impressa (uniformidade de textura).
- Log com foto, GPS, IP e horário de cada tentativa.
- Teste sugerido: bata ponto com colaborador ausente — deve reprovar.
- Teste sugerido: bata ponto fora do raio do PDV — deve alertar.

> ⚠️ Sempre ative WebGL — CPU fallback é 5-10x mais lento e degrada a experiência.

---

## 9. Banco de Horas e Espelho

1. RH → Banco de Horas: veja saldo positivo/negativo por colaborador.
2. Configure regras: acordo individual/coletivo, vencimento (6/12 meses).
3. Compensações registradas geram folgas ou abatem horas na folha.

### Espelho de Ponto
1. RH → Espelho Digital → selecione competência.
2. Colaborador visualiza no app e assina digitalmente (OTP).
3. Espelho assinado é anexado ao processo de folha.

---

## 10. Férias e Férias Coletivas

1. Colaborador solicita pelo app: RH → Solicitações → Férias.
2. Gestor aprova em RH → Solicitações Admin.
3. Sistema calcula: 30 dias após 12 meses, com 1/3 constitucional.
4. Opções de abono pecuniário (até 10 dias) e adiantamento do 13º.
5. Envio de aviso 30 dias antes é obrigatório.
6. Evento S-2230 é gerado automaticamente para o eSocial.

### Férias Coletivas
- RH → Férias Coletivas → selecione empresa e período.
- Todos os colaboradores selecionados recebem programação.
- Comunicação ao sindicato e MTE é obrigatória com 15 dias de antecedência.

---

## 11. Advertências e Medidas

1. RH → Advertências → "Nova ocorrência".
2. Selecione colaborador, tipo (verbal/escrita/suspensão), motivo.
3. Anexe evidências (documentos, prints).
4. Envie para assinatura do colaborador com OTP.
5. Registro fica na ficha funcional e histórico disciplinar.

- **Verbal**: apenas registro, não notifica app.
- **Escrita**: colaborador assina no app.
- **Suspensão**: define dias, desconta na folha automaticamente.
- **Justa causa**: dispara fluxo de desligamento com S-2299 motivo específico.

---

## 12. Folha e Holerite

### Passo a passo do fechamento
1. RH → Checklist Folha: valida pendências (ponto sem batida, férias sem aprovação, etc.).
2. Resolva cada item marcado em vermelho.
3. RH → Holerite → selecione competência (mês/ano).
4. Confira cálculos: salário base, HE, DSR, adicional noturno, descontos, benefícios.
5. Gere PDF em lote ou individual.
6. Envie pelo app (notifica colaborador) ou baixe para envio externo.
7. Exporte S-1200 no eSocial após liberação.

> 💡 Rode o Checklist Folha até dia 25 do mês para evitar corridas no fechamento.

---

## 13. Cálculos Trabalhistas

### Base salarial
```
Salário-hora = Salário mensal ÷ (Jornada semanal × 5)
Ex.: R$ 2.200 ÷ (44 × 5) = R$ 10,00 / h
```

### Hora extra
```
HE 50%  = Salário-hora × 1,5
HE 100% = Salário-hora × 2   (domingos/feriados)
```

### DSR sobre HE
```
DSR = (Total HE no mês ÷ dias úteis) × domingos+feriados
```

### Descontos
- **INSS**: tabela progressiva 7,5% / 9% / 12% / 14%.
- **IRRF**: tabela mensal após INSS e dependentes.
- **VT**: até 6% do salário base.
- **Faltas injustificadas**: desconto do dia + reflexo no DSR.

### Provisões
```
Férias = Salário ÷ 12 + 1/3 constitucional
13º    = Salário ÷ 12 acumulado por mês trabalhado
FGTS   = 8% sobre salário + HE + adicionais
```

> ⚠️ Padrão fixo: 22 dias úteis e 1h de almoço. Ajuste em Empresas se sua CLT/CCT for diferente.

---

## 14. Desligamento / Demissão

1. RH → Colaboradores → abra ficha → "Desligar".
2. Escolha motivo (sem justa causa, com justa causa, pedido, acordo, término contrato).
3. Sistema calcula: saldo salário, aviso, férias vencidas/proporcionais + 1/3, 13º proporcional, FGTS + multa 40% quando aplicável.
4. Gere TRCT em PDF para assinatura.
5. Revogue acesso ao app automaticamente na data do desligamento.
6. Eventos eSocial gerados: S-2299 (desligamento) e S-1200 (última folha).

> ⚠️ Sempre confira o motivo antes de finalizar — ele define multa de FGTS e possibilidade de sacar seguro-desemprego.

---

## 15. Exportação eSocial

1. RH → eSocial → aba "Eventos pendentes".
2. Selecione competência e eventos a enviar.
3. Valide XML gerado (schema oficial do governo).
4. Envie lote → aguarde protocolo → confirme recebimento.
5. Guarde recibos por 5 anos no repositório de documentos.

- **S-2200**: Admissão.
- **S-2230**: Afastamentos temporários (férias, licença).
- **S-2299**: Desligamento.
- **S-1200**: Remuneração mensal.
- **S-3000**: Exclusão de evento enviado com erro.

---

## 16. Avaliações de Desempenho

1. RH → Avaliações → aba "Ciclos" → "Novo ciclo".
2. Escolha tipo (90° autoavaliação, 180° gestor, 360° com pares).
3. Configure competências e pesos.
4. Abra o ciclo: avaliações são geradas para todos os participantes.
5. Acompanhe preenchimento pelo dashboard de progresso.
6. Ao encerrar, sistema consolida pontuação ponderada e posiciona na Matriz 9-Box.

- Metas SMART com progresso auto-calculado.
- Feedback contínuo público ou privado.
- PDI: plano de desenvolvimento com ações e prazos.

---

## 17. Rastreamento e Mapa

- RH → Mapa: onde cada colaborador está agora.
- RH → Rastreamento: trajeto histórico por dia com velocidade e paradas.
- RH → Mapa Operacional: heatmap de PDVs visitados.
- Geocoding via Nominatim/OSM. Requer GPS ativo no app.

> ⚠️ Rastreamento respeita LGPD: só é ativo dentro do horário de trabalho configurado.

---

## 18. Analytics e Auditoria

- RH → Dashboard: presença, absenteísmo, atrasos, horas trabalhadas, turnover.
- RH → Logs & Erros: quem alterou o quê e quando (ajustes de ponto, revogação de acesso, folha).
- Filtros por empresa, cargo, PDV, período.
- Todos os KPIs no fuso America/Sao_Paulo.

---

## 19. Solicitações e Autoatendimento

- Tipos: férias, folga, ajuste de ponto, atestado, adiantamento, reembolso.
- Colaborador anexa foto/documento pelo app.
- Gestor aprova/reprova em RH → Solicitações Admin.
- Aprovação executa a ação (agenda férias, registra ponto, gera desconto).

---

## 20. Checklist Operacional / Testes

### Diário
- Monitor de Ponto ativo no início do turno.
- Verificar solicitações pendentes.
- Conferir alertas de biometria reprovada.

### Semanal
- Revisar banco de horas.
- Fechar advertências abertas.
- Backup manual de documentos assinados (opcional).

### Mensal
- Checklist Folha → resolver todas as pendências.
- Gerar holerite e enviar.
- Exportar eventos eSocial S-1200.
- Rodar analytics de turnover.

### Testes recomendados
- Cadastrar colaborador fictício, admitir, bater ponto, gerar holerite e desligar — ciclo completo.
- Bater ponto com selfie de foto impressa: deve reprovar.
- Bater ponto fora do raio do PDV: deve alertar/reprovar por GPS.
- Assinar documento e verificar hash SHA-256 em Verificar Documento.

> 💡 Rode esse checklist ao onboardar um novo administrador de RH — em 1 dia ele entende o módulo inteiro.
