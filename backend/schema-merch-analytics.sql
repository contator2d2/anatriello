-- ================================================
-- Schema - Módulo de Relatórios Inteligentes do Merchan
-- ================================================

-- KPI snapshots (daily aggregation)
CREATE TABLE IF NOT EXISTS merchan_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_routes INTEGER DEFAULT 0,
  completed_routes INTEGER DEFAULT 0,
  partial_routes INTEGER DEFAULT 0,
  pending_routes INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  executed_products INTEGER DEFAULT 0,
  brands_served INTEGER DEFAULT 0,
  pdvs_served INTEGER DEFAULT 0,
  active_promoters INTEGER DEFAULT 0,
  photos_captured INTEGER DEFAULT 0,
  damages_registered INTEGER DEFAULT 0,
  stockouts_registered INTEGER DEFAULT 0,
  price_research_completed INTEGER DEFAULT 0,
  price_research_pending INTEGER DEFAULT 0,
  stock_counts INTEGER DEFAULT 0,
  expiry_counts INTEGER DEFAULT 0,
  avg_visit_duration_min NUMERIC(6,1),
  avg_photos_per_route NUMERIC(5,1),
  operational_score NUMERIC(5,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, snapshot_date)
);

-- AI summaries and insights
CREATE TABLE IF NOT EXISTS merchan_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'report_pdv', 'report_brand', etc.
  reference_id UUID, -- optional: PDV id, brand id, promoter id
  reference_type VARCHAR(50), -- 'pdv', 'brand', 'promoter', 'route', 'product'
  period_start DATE,
  period_end DATE,
  summary TEXT NOT NULL,
  highlights JSONB, -- { problems: [], positives: [], trends: [], recommendations: [] }
  filters_applied JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI alerts (proactive)
CREATE TABLE IF NOT EXISTS merchan_ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'stockout_increase', 'damage_spike', 'execution_drop', etc.
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  data JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operational scores (per entity)
CREATE TABLE IF NOT EXISTS merchan_operational_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'operation', 'pdv', 'brand', 'promoter', 'region'
  entity_id UUID,
  score_date DATE NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  breakdown JSONB, -- { routes: 90, products: 85, damages: 95, stockouts: 80, ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, entity_type, entity_id, score_date)
);

-- Saved reports / favorites
CREATE TABLE IF NOT EXISTS merchan_saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  filters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Export history
CREATE TABLE IF NOT EXISTS merchan_report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  format VARCHAR(10) NOT NULL, -- 'excel', 'csv', 'pdf'
  filters JSONB,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI questions/answers
CREATE TABLE IF NOT EXISTS merchan_report_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  context_type VARCHAR(50), -- 'dashboard', 'pdv', 'brand', etc.
  context_id UUID,
  filters JSONB,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_org_date ON merchan_kpi_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_org ON merchan_ai_alerts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_entity ON merchan_operational_scores(organization_id, entity_type, score_date DESC);
