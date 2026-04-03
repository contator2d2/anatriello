-- =====================================================
-- FASE 5 COMPLEMENTO: Autenticação Modular por Rede
-- =====================================================

-- Configurações de autenticação por rede
CREATE TABLE IF NOT EXISTS network_auth_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES supermarket_networks(id) ON DELETE CASCADE,
  -- Métodos de entrada
  cpf_entry_enabled BOOLEAN DEFAULT true,
  qr_entry_enabled BOOLEAN DEFAULT false,
  selfie_entry_required BOOLEAN DEFAULT false,
  selfie_exit_required BOOLEAN DEFAULT false,
  facial_recognition_enabled BOOLEAN DEFAULT false,
  -- Combinação
  combined_validation VARCHAR(50) DEFAULT 'cpf_only', -- cpf_only, cpf_selfie, qr_only, qr_selfie, qr_facial, cpf_selfie_facial
  -- Preset de segurança
  security_level VARCHAR(20) DEFAULT 'basic', -- basic, intermediate, high, maximum
  -- Tolerâncias
  facial_min_confidence NUMERIC(5,2) DEFAULT 70.00, -- % mínima para aceitar
  allow_low_confidence_entry BOOLEAN DEFAULT false,
  low_confidence_action VARCHAR(20) DEFAULT 'alert', -- alert, block
  -- QR settings
  qr_expiration_minutes INTEGER DEFAULT 60,
  qr_single_use BOOLEAN DEFAULT true,
  -- Consentimento LGPD
  require_lgpd_consent BOOLEAN DEFAULT true,
  consent_text TEXT DEFAULT 'Ao utilizar este sistema, você consente com a captura e armazenamento temporário de sua imagem para fins de controle de acesso, conforme a Lei Geral de Proteção de Dados (LGPD).',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(network_id)
);

-- Override de autenticação por PDV (opcional, herda da rede se não existir)
CREATE TABLE IF NOT EXISTS pdv_auth_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  cpf_entry_enabled BOOLEAN,
  qr_entry_enabled BOOLEAN,
  selfie_entry_required BOOLEAN,
  selfie_exit_required BOOLEAN,
  facial_recognition_enabled BOOLEAN,
  combined_validation VARCHAR(50),
  security_level VARCHAR(20),
  facial_min_confidence NUMERIC(5,2),
  allow_low_confidence_entry BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supermarket_unit_id)
);

-- QR Tokens dinâmicos
CREATE TABLE IF NOT EXISTS qr_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  valid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_from TIME,
  valid_until TIME,
  status VARCHAR(20) DEFAULT 'active', -- active, used, expired, revoked
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  created_by_type VARCHAR(20) DEFAULT 'system', -- system, admin, agency
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_qr_promoter CHECK (agency_promoter_id IS NOT NULL OR employee_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_status ON qr_access_tokens(status, expires_at);

-- Logs de uso de QR
CREATE TABLE IF NOT EXISTS qr_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_token_id UUID REFERENCES qr_access_tokens(id) ON DELETE SET NULL,
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- scanned, validated, rejected, expired
  reason VARCHAR(100),
  device_info TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capturas de selfie
CREATE TABLE IF NOT EXISTS selfie_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_log_id UUID REFERENCES pdv_entry_logs(id) ON DELETE SET NULL,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  capture_type VARCHAR(20) NOT NULL, -- entry, exit
  image_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_selfie_captures_entry ON selfie_captures(entry_log_id);

-- Logs de reconhecimento facial
CREATE TABLE IF NOT EXISTS facial_recognition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_log_id UUID REFERENCES pdv_entry_logs(id) ON DELETE SET NULL,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  comparison_type VARCHAR(30) NOT NULL, -- base_vs_selfie, entry_vs_exit
  confidence_score NUMERIC(5,2),
  result VARCHAR(20) NOT NULL, -- validated, not_recognized, low_confidence, divergent
  base_image_url TEXT,
  captured_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de tentativa de autenticação (master log)
CREATE TABLE IF NOT EXISTS authentication_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  cpf VARCHAR(14),
  method VARCHAR(30) NOT NULL, -- cpf, qr, selfie, facial, combined
  auth_steps JSONB DEFAULT '[]', -- [{step:'cpf',result:'ok'},{step:'selfie',result:'ok'}]
  overall_result VARCHAR(20) NOT NULL, -- approved, denied, suspect
  confidence_level NUMERIC(5,2),
  block_reason VARCHAR(100),
  entry_log_id UUID REFERENCES pdv_entry_logs(id) ON DELETE SET NULL,
  device_info TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_org ON authentication_attempt_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_unit ON authentication_attempt_logs(supermarket_unit_id, created_at);

-- Logs de detecção de fraude
CREATE TABLE IF NOT EXISTS fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supermarket_unit_id UUID NOT NULL REFERENCES supermarket_units(id) ON DELETE CASCADE,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  cpf VARCHAR(14),
  fraud_type VARCHAR(50) NOT NULL, -- qr_reused, qr_expired, cpf_invalid, selfie_divergent, out_of_hours, unauthorized_pdv, identity_mismatch
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  details JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_logs_org ON fraud_detection_logs(organization_id, created_at);

-- Perfil de identidade do promotor (foto base para reconhecimento facial)
CREATE TABLE IF NOT EXISTS promoter_identity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  base_photo_url TEXT NOT NULL,
  face_encoding JSONB, -- face descriptor data for comparison
  lgpd_consent_given BOOLEAN DEFAULT false,
  lgpd_consent_at TIMESTAMPTZ,
  lgpd_consent_ip VARCHAR(45),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_identity_promoter CHECK (agency_promoter_id IS NOT NULL OR employee_id IS NOT NULL)
);
