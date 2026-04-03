-- =====================================================
-- Schema: Incidents, Promoter Scores & Activity Snapshots
-- =====================================================

-- Incident types enum
CREATE TYPE incident_type AS ENUM ('delay', 'misconduct', 'non_execution', 'product_issue', 'other');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE incident_status AS ENUM ('open', 'under_review', 'responded', 'resolved', 'escalated');

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Who reported
  reported_by_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  reported_by_user_name VARCHAR(200),
  -- About whom
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  -- Details
  incident_type incident_type NOT NULL DEFAULT 'other',
  severity incident_severity NOT NULL DEFAULT 'low',
  status incident_status NOT NULL DEFAULT 'open',
  description TEXT,
  incident_date TIMESTAMPTZ DEFAULT NOW(),
  -- Attachments
  photo_urls TEXT[],
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_agency ON incidents(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_promoter ON incidents(agency_promoter_id);
CREATE INDEX IF NOT EXISTS idx_incidents_unit ON incidents(reported_by_unit_id);

-- Incident responses / timeline
CREATE TABLE IF NOT EXISTS incident_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  -- Who responded
  responder_type VARCHAR(30) NOT NULL, -- agency, admin, supermarket
  responder_name VARCHAR(200),
  -- Content
  message TEXT NOT NULL,
  attachment_urls TEXT[],
  -- Status change
  new_status incident_status,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_responses ON incident_responses(incident_id, created_at);

-- Promoter scores
CREATE TABLE IF NOT EXISTS promoter_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agency_promoter_id UUID NOT NULL REFERENCES agency_promoters(id) ON DELETE CASCADE,
  -- Current score
  score NUMERIC(5,2) DEFAULT 100.00,
  -- Breakdown
  presence_score NUMERIC(5,2) DEFAULT 100.00,
  punctuality_score NUMERIC(5,2) DEFAULT 100.00,
  permanence_score NUMERIC(5,2) DEFAULT 100.00,
  identity_score NUMERIC(5,2) DEFAULT 100.00,
  incidents_score NUMERIC(5,2) DEFAULT 100.00,
  -- Counters
  total_visits INTEGER DEFAULT 0,
  total_incidents INTEGER DEFAULT 0,
  total_blocks INTEGER DEFAULT 0,
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, agency_promoter_id)
);

CREATE INDEX IF NOT EXISTS idx_promoter_scores_org ON promoter_scores(organization_id, score DESC);

-- Score history for trend analysis
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_score_id UUID NOT NULL REFERENCES promoter_scores(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_history ON score_history(promoter_score_id, calculated_at DESC);

-- Activity snapshots for real-time dashboard
CREATE TABLE IF NOT EXISTS promoter_activity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  -- Activity details
  status VARCHAR(30) DEFAULT 'active', -- active, en_route, waiting, completed
  entry_at TIMESTAMPTZ,
  exit_at TIMESTAMPTZ,
  brands_attending TEXT[],
  validation_method VARCHAR(30), -- cpf, qr, selfie, facial
  -- Score at time of visit
  promoter_score NUMERIC(5,2),
  -- Date for easy querying
  visit_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_org_date ON promoter_activity_snapshots(organization_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_activity_unit_date ON promoter_activity_snapshots(unit_id, visit_date);
