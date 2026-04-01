-- ================================================
-- Schema Fase 2 - App do Promotor Ayratech
-- PDVs, Ponto com Geo, Documentos RH↔Colaborador
-- ================================================

-- ================================================
-- PDVs (Pontos de Venda)
-- ================================================
CREATE TABLE IF NOT EXISTS pdvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  address TEXT,
  zip_code VARCHAR(10),
  city VARCHAR(100),
  state VARCHAR(2),
  neighborhood VARCHAR(100),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  radius_meters INTEGER DEFAULT 200,
  supervisor_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdvs_org ON pdvs(organization_id);

-- ================================================
-- Vínculo Colaborador ↔ PDV
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_pdvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  assignment_type VARCHAR(20) DEFAULT 'fixo', -- fixo, rota, agenda, temporario
  weekdays JSONB DEFAULT '[]', -- ["seg","ter","qua"]
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collab_pdvs_emp ON collaborator_pdvs(employee_id);
CREATE INDEX IF NOT EXISTS idx_collab_pdvs_pdv ON collaborator_pdvs(pdv_id);

-- ================================================
-- Agenda Diária do Colaborador
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_daily_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pdv_id UUID REFERENCES pdvs(id) ON DELETE SET NULL,
  assignment_date DATE NOT NULL,
  shift_start TIME,
  shift_end TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_assign_emp ON collaborator_daily_assignments(employee_id, assignment_date);

-- ================================================
-- Time Punches (Marcações de Ponto individuais)
-- ================================================
CREATE TABLE IF NOT EXISTS time_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  punch_type VARCHAR(30) NOT NULL, -- entrada, saida_intervalo, retorno_intervalo, saida, extraordinaria, ajuste
  punched_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  accuracy_meters NUMERIC(8,2),
  pdv_id UUID REFERENCES pdvs(id) ON DELETE SET NULL,
  distance_from_pdv NUMERIC(10,2),
  geo_status VARCHAR(30) DEFAULT 'dentro_area', -- dentro_area, fora_area, excecao, sem_gps
  device_info TEXT,
  ip_address VARCHAR(45),
  is_offline BOOLEAN DEFAULT false,
  offline_local_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'synced', -- synced, pending, conflict
  justification TEXT,
  approved BOOLEAN,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_punches_emp ON time_punches(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_punches_date ON time_punches(punched_at);
CREATE INDEX IF NOT EXISTS idx_time_punches_org ON time_punches(organization_id);

-- ================================================
-- Regras de Ponto / Tolerância
-- ================================================
CREATE TABLE IF NOT EXISTS time_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE, -- null = regra geral
  name VARCHAR(255),
  late_tolerance_minutes INTEGER DEFAULT 10,
  early_leave_tolerance INTEGER DEFAULT 10,
  break_tolerance INTEGER DEFAULT 5,
  max_late_minutes INTEGER DEFAULT 30,
  require_justification BOOLEAN DEFAULT true,
  absence_on_no_punch BOOLEAN DEFAULT true,
  punch_window_minutes INTEGER DEFAULT 60,
  allow_manual_adjustment BOOLEAN DEFAULT true,
  require_geo BOOLEAN DEFAULT true,
  allow_offline_punch BOOLEAN DEFAULT true,
  allow_exception_punch BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_rules_org ON time_rules(organization_id);

-- ================================================
-- Solicitações de Hora Extra
-- ================================================
CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  requested_start TIME,
  requested_end TIME,
  status VARCHAR(20) DEFAULT 'pendente',
  approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  supervisor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_emp ON overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_date ON overtime_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_status ON overtime_requests(status);

-- ================================================
-- Alertas de Ponto
-- ================================================
CREATE TABLE IF NOT EXISTS time_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- atraso, ausencia, fora_pdv, inconsistencia, jornada_excedida, saida_antecipada
  alert_date DATE NOT NULL,
  description TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_alerts_org ON time_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_time_alerts_emp ON time_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_alerts_date ON time_alerts(alert_date);

-- ================================================
-- Acesso ao App do Colaborador
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_app_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
  login_type VARCHAR(10) DEFAULT 'cpf', -- cpf, email, ambos
  password_hash VARCHAR(255),
  temp_password BOOLEAN DEFAULT false,
  force_password_change BOOLEAN DEFAULT true,
  access_status VARCHAR(30) DEFAULT 'sem_acesso', -- sem_acesso, liberado, aguardando_login, ativo, bloqueado, suspenso
  enabled_at TIMESTAMPTZ,
  enabled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_login TIMESTAMPTZ,
  last_device TEXT,
  last_ip VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_access_emp ON collaborator_app_access(employee_id);

-- ================================================
-- Sessões do App
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_info TEXT,
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_emp ON collaborator_sessions(employee_id);

-- ================================================
-- Histórico de Redefinição de Senha
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reset_by VARCHAR(20) NOT NULL, -- rh, proprio, sistema
  reset_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Tipos de Documento (para envio RH→Colaborador)
-- ================================================
CREATE TABLE IF NOT EXISTS rh_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100),
  requires_signature BOOLEAN DEFAULT false,
  requires_confirmation BOOLEAN DEFAULT true,
  category VARCHAR(50) DEFAULT 'geral', -- geral, advertencia, comunicado, contrato, termo, politica, recibo, comprovante
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_types_org ON rh_document_types(organization_id);

-- ================================================
-- Documentos enviados RH → Colaborador
-- ================================================
CREATE TABLE IF NOT EXISTS rh_document_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES rh_document_types(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  file_hash VARCHAR(128),
  requires_view_only BOOLEAN DEFAULT false,
  requires_confirmation BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  signature_deadline TIMESTAMPTZ,
  block_until_signed BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'pendente', -- criado, pendente, enviado, entregue, visualizado, confirmado, assinado, recusado, expirado, cancelado
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_id UUID, -- link para doc_signatures se existir
  refused_at TIMESTAMPTZ,
  refuse_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  batch_id UUID, -- para envios em lote
  ip_at_view VARCHAR(45),
  ip_at_sign VARCHAR(45),
  device_at_view TEXT,
  device_at_sign TEXT,
  geo_lat_at_sign NUMERIC(10,7),
  geo_lng_at_sign NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_org ON rh_document_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_emp ON rh_document_deliveries(employee_id);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_status ON rh_document_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_batch ON rh_document_deliveries(batch_id);

-- ================================================
-- Eventos de Documento (trilha completa)
-- ================================================
CREATE TABLE IF NOT EXISTS rh_document_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES rh_document_deliveries(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- criado, enviado, entregue, visualizado, confirmado, assinado, recusado, cancelado, reenviado
  event_at TIMESTAMPTZ DEFAULT NOW(),
  actor_type VARCHAR(20), -- rh, colaborador, sistema
  actor_id UUID,
  ip_address VARCHAR(45),
  device_info TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_doc_events_delivery ON rh_document_delivery_events(delivery_id);

-- ================================================
-- Documentos enviados Colaborador → RH (upload reverso)
-- ================================================
CREATE TABLE IF NOT EXISTS rh_inbound_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- atestado, justificativa, doc_pessoal, comprovante_bancario, recibo, foto_doc, termo, outro
  title VARCHAR(255),
  file_url TEXT,
  observation TEXT,
  status VARCHAR(20) DEFAULT 'recebido', -- recebido, lido, em_analise, aprovado, recusado, concluido
  read_by UUID REFERENCES users(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  process_notes TEXT,
  ip_address VARCHAR(45),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inbound_docs_org ON rh_inbound_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbound_docs_emp ON rh_inbound_documents(employee_id);

-- ================================================
-- Holerite Deliveries (envio para app)
-- ================================================
CREATE TABLE IF NOT EXISTS payslip_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  delivery_status VARCHAR(30) DEFAULT 'pendente', -- pendente, enviado, visualizado, confirmado, assinado
  requires_signature BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payslip_del_emp ON payslip_deliveries(employee_id);

-- ================================================
-- Espelho de Ponto / Timesheet exports
-- ================================================
CREATE TABLE IF NOT EXISTS timesheet_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reference_month VARCHAR(7) NOT NULL,
  status VARCHAR(30) DEFAULT 'rascunho', -- rascunho, em_conferencia, fechado, concluido, enviado
  pdf_url TEXT,
  total_hours NUMERIC(6,2),
  overtime_hours NUMERIC(6,2),
  absences INTEGER DEFAULT 0,
  lates INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  requires_signature BOOLEAN DEFAULT false,
  signature_id UUID,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timesheet_exp_emp ON timesheet_exports(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_exp_month ON timesheet_exports(reference_month);

-- ================================================
-- Fila de Sincronização Offline
-- ================================================
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- time_punch, confirm_receipt, view_document, upload
  payload JSONB NOT NULL,
  local_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending', -- pending, syncing, synced, failed, conflict
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  local_id VARCHAR(100), -- ID temporário local
  server_id UUID, -- ID definitivo após sincronismo
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offline_sync_emp ON offline_sync_queue(employee_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_queue(sync_status);

-- ================================================
-- Notificações do Colaborador
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(30) DEFAULT 'info', -- info, document, payslip, timesheet, alert, punch
  reference_type VARCHAR(50), -- delivery, payslip, timesheet, punch
  reference_id UUID,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collab_notif_emp ON collaborator_notifications(employee_id);

-- ================================================
-- Configuração de Notificações de Alerta
-- ================================================
CREATE TABLE IF NOT EXISTS rh_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- atraso, ausencia, ponto_fora_pdv, doc_pendente, assinatura_pendente, arquivo_recebido, ajuste_ponto
  notify_rh BOOLEAN DEFAULT true,
  notify_supervisor BOOLEAN DEFAULT false,
  notify_collaborator BOOLEAN DEFAULT false,
  channel_system BOOLEAN DEFAULT true,
  channel_push BOOLEAN DEFAULT false,
  channel_email BOOLEAN DEFAULT false,
  channel_whatsapp BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_rules_org ON rh_notification_rules(organization_id);

-- ================================================
-- Log de Notificações WhatsApp
-- ================================================
CREATE TABLE IF NOT EXISTS rh_whatsapp_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  event_type VARCHAR(50),
  phone VARCHAR(20),
  message_template VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read, failed
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error TEXT
);

-- ================================================
-- Preferências do App do Colaborador
-- ================================================
CREATE TABLE IF NOT EXISTS collaborator_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
  theme VARCHAR(10) DEFAULT 'auto', -- claro, escuro, auto
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas extras na employees para vincular supervisor
ALTER TABLE employees ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- ================================================
-- Rastreamento de Localização em Tempo Real
-- ================================================
CREATE TABLE IF NOT EXISTS employee_live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy_meters NUMERIC(8,2),
  battery_level INTEGER,
  is_moving BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id)
);
CREATE INDEX IF NOT EXISTS idx_live_locations_org ON employee_live_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_emp ON employee_live_locations(employee_id);

-- ================================================
-- Histórico de Localização (Rastreamento)
-- ================================================
CREATE TABLE IF NOT EXISTS employee_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy_meters NUMERIC(8,2),
  battery_level INTEGER,
  is_moving BOOLEAN DEFAULT false,
  speed NUMERIC(6,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_location_history_emp_date ON employee_location_history(employee_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_location_history_org ON employee_location_history(organization_id);
