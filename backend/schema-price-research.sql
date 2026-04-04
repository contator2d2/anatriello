-- ================================================
-- Schema - Módulo de Pesquisa de Preços
-- ================================================

-- ================================================
-- Price Research Rules (regras por marca)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  frequency VARCHAR(20) DEFAULT 'weekly',
  preferred_weekday INTEGER DEFAULT 1,
  preferred_time TIME,
  require_photo BOOLEAN DEFAULT false,
  require_justification BOOLEAN DEFAULT true,
  block_route_completion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, brand_id)
);

-- ================================================
-- Competitor Brands (marcas concorrentes)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_brand_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_competitors_brand ON price_research_brand_competitors(brand_id);

-- ================================================
-- Product Mappings (produtos da marca → concorrentes)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, product_id)
);

-- ================================================
-- Competitor Products (produtos concorrentes comparáveis)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_competitor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id UUID NOT NULL REFERENCES price_research_product_mappings(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES price_research_brand_competitors(id) ON DELETE CASCADE,
  competitor_product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  unit_measure VARCHAR(50),
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Schedules (agendamento semanal)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  route_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  preferred_date DATE,
  status VARCHAR(30) DEFAULT 'pending',
  is_last_route_of_week BOOLEAN DEFAULT false,
  is_mandatory BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_schedules_brand ON price_research_schedules(brand_id, week_start);
CREATE INDEX IF NOT EXISTS idx_pr_schedules_pdv ON price_research_schedules(pdv_id, week_start);

-- ================================================
-- Executions (execução da pesquisa numa rota)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES price_research_schedules(id) ON DELETE SET NULL,
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES merch_brands(id) ON DELETE CASCADE,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'pending',
  progress_pct NUMERIC(5,2) DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_exec_route ON price_research_executions(route_id);
CREATE INDEX IF NOT EXISTS idx_pr_exec_brand ON price_research_executions(brand_id);

-- ================================================
-- Items (preço do produto principal)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES price_research_executions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(10,2),
  observation TEXT,
  collected_at TIMESTAMPTZ,
  collected_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_items_exec ON price_research_items(execution_id);

-- ================================================
-- Item Competitors (preços concorrentes por item)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_item_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES price_research_items(id) ON DELETE CASCADE,
  competitor_product_id UUID REFERENCES price_research_competitor_products(id) ON DELETE SET NULL,
  competitor_id UUID REFERENCES price_research_brand_competitors(id) ON DELETE SET NULL,
  competitor_product_name VARCHAR(255),
  competitor_brand_name VARCHAR(255),
  price NUMERIC(10,2),
  observation TEXT,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Photos (fotos da pesquisa)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES price_research_executions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES price_research_items(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(30) DEFAULT 'evidence',
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  watermark_applied BOOLEAN DEFAULT false,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Postponements (prorrogações)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_postponements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES price_research_schedules(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  observation TEXT,
  next_route_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  postponed_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Justifications (justificativas de não execução)
-- ================================================
CREATE TABLE IF NOT EXISTS price_research_justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES price_research_schedules(id) ON DELETE CASCADE,
  route_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  reason VARCHAR(255) NOT NULL,
  observation TEXT,
  next_route_date DATE,
  justified_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
