-- =====================================================
-- Schema: AI Analysis for Incidents, Behavior Detection,
-- Daily Summaries, WhatsApp Assistant & Authorized Contacts
-- Run after schema-incidents-scores.sql
-- =====================================================

-- AI analysis fields on incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS ai_classification JSONB;
-- ai_classification stores: { type, severity, impact, risk, summary, keywords[], analyzed_at }

-- Behavior analysis snapshots
CREATE TABLE IF NOT EXISTS promoter_behavior_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agency_promoter_id UUID NOT NULL REFERENCES agency_promoters(id) ON DELETE CASCADE,
  -- Risk assessment
  risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high
  risk_justification TEXT,
  trend VARCHAR(20) DEFAULT 'stable', -- stable, improving, worsening
  -- Alerts
  alerts JSONB DEFAULT '[]',
  -- Data points used
  data_snapshot JSONB,
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_org ON promoter_behavior_analysis(organization_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_promoter ON promoter_behavior_analysis(agency_promoter_id, analyzed_at DESC);

-- Daily operational summaries
CREATE TABLE IF NOT EXISTS daily_operational_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  -- Summary data
  summary_date DATE NOT NULL,
  summary_type VARCHAR(30) DEFAULT 'unit', -- unit, agency, network, admin
  ai_summary TEXT,
  metrics JSONB,
  highlights JSONB,
  risks JSONB,
  recommendations JSONB,
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_org ON daily_operational_summaries(organization_id, summary_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_unique ON daily_operational_summaries(organization_id, COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'), COALESCE(agency_id, '00000000-0000-0000-0000-000000000000'), summary_date, summary_type);

-- Authorized contacts for WhatsApp assistant
CREATE TABLE IF NOT EXISTS pdv_authorized_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  -- Contact info
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  role VARCHAR(50) DEFAULT 'other', -- gerente, supervisor, encarregado, administrativo, outro
  -- Permissions
  permissions JSONB DEFAULT '["consultar_operacao"]',
  -- consultar_operacao, registrar_ocorrencia, consultar_score, consultar_agenda, acesso_total
  active BOOLEAN DEFAULT true,
  notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_contacts_org ON pdv_authorized_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_auth_contacts_unit ON pdv_authorized_contacts(unit_id);
CREATE INDEX IF NOT EXISTS idx_auth_contacts_phone ON pdv_authorized_contacts(phone);

-- WhatsApp assistant audit log
CREATE TABLE IF NOT EXISTS assistant_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES pdv_authorized_contacts(id) ON DELETE SET NULL,
  -- Interaction
  phone VARCHAR(20),
  interaction_type VARCHAR(30) DEFAULT 'query', -- query, incident_creation, score_check, schedule_check
  user_message TEXT,
  ai_response TEXT,
  -- If incident was created
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  -- AI classification
  ai_classification JSONB,
  -- Status
  authorized BOOLEAN DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON assistant_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_unit ON assistant_audit_log(unit_id, created_at DESC);

-- Operational diagnostics
CREATE TABLE IF NOT EXISTS operational_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Analysis
  diagnostic_type VARCHAR(30) DEFAULT 'daily', -- daily, weekly, on_demand
  period_start DATE,
  period_end DATE,
  -- AI results
  problems JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  top_incident_agencies JSONB DEFAULT '[]',
  unstable_pdvs JSONB DEFAULT '[]',
  critical_promoters JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_org ON operational_diagnostics(organization_id, generated_at DESC);
