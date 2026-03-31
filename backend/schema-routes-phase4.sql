-- ================================================
-- Schema Fase 4 - Rotas, Execução em Campo, Avarias, Devoluções
-- ================================================

-- ================================================
-- Photo Quality Settings (configuração global/por marca)
-- ================================================
CREATE TABLE IF NOT EXISTS photo_quality_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  blur_tolerance NUMERIC(5,2) DEFAULT 50,
  min_brightness NUMERIC(5,2) DEFAULT 30,
  max_brightness NUMERIC(5,2) DEFAULT 90,
  compression_quality INTEGER DEFAULT 80,
  max_file_size_mb NUMERIC(5,2) DEFAULT 5,
  require_checkin_photo BOOLEAN DEFAULT true,
  require_category_photo BOOLEAN DEFAULT true,
  require_checkout_photo BOOLEAN DEFAULT false,
  watermark_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Brand Checklists (checklist padrão por marca)
-- ================================================
CREATE TABLE IF NOT EXISTS brand_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  require_checkin_photo BOOLEAN DEFAULT true,
  require_checkout_photo BOOLEAN DEFAULT false,
  require_stock_count BOOLEAN DEFAULT false,
  require_validity_check BOOLEAN DEFAULT false,
  require_extra_point BOOLEAN DEFAULT false,
  stock_count_frequency VARCHAR(20) DEFAULT 'every_visit',
  validity_check_frequency VARCHAR(20) DEFAULT 'every_visit',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Brand Checklist Rules (regras por categoria/produto)
-- ================================================
CREATE TABLE IF NOT EXISTS brand_checklist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES brand_checklists(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES product_subcategories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  require_photo BOOLEAN DEFAULT false,
  require_count BOOLEAN DEFAULT false,
  require_validity BOOLEAN DEFAULT false,
  require_stock BOOLEAN DEFAULT false,
  require_extra_point BOOLEAN DEFAULT false,
  require_observation BOOLEAN DEFAULT false,
  count_frequency VARCHAR(20) DEFAULT 'every_visit',
  max_postponements INTEGER DEFAULT 1,
  is_mandatory BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Brand Promoter Assignments (promotores por marca)
-- ================================================
CREATE TABLE IF NOT EXISTS brand_promoter_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_type VARCHAR(20) DEFAULT 'preferred',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, employee_id)
);

-- ================================================
-- Exposure Point Types (tipos de ponto configuráveis)
-- ================================================
CREATE TABLE IF NOT EXISTS exposure_point_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert defaults
-- INSERT INTO exposure_point_types (organization_id, name, code) VALUES
-- (org_id, 'Ponto Natural', 'natural'),
-- (org_id, 'Ponto Extra', 'extra'),
-- (org_id, 'Ponta de Gôndola', 'gondola'),
-- (org_id, 'Ilha', 'ilha'),
-- (org_id, 'Checkout', 'checkout'),
-- (org_id, 'Expositor', 'expositor');

-- ================================================
-- Routes (rotas de visita)
-- ================================================
CREATE TABLE IF NOT EXISTS merch_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES brand_checklists(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL,
  scheduled_time TIME,
  window_start TIME,
  window_end TIME,
  estimated_duration_min INTEGER DEFAULT 60,
  priority VARCHAR(10) DEFAULT 'normal',
  visit_type VARCHAR(30) DEFAULT 'regular',
  recurrence VARCHAR(20),
  recurrence_parent_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'scheduled',
  notes TEXT,
  checkin_at TIMESTAMPTZ,
  checkin_latitude NUMERIC(10,7),
  checkin_longitude NUMERIC(10,7),
  checkin_photo_url TEXT,
  checkin_device TEXT,
  checkout_at TIMESTAMPTZ,
  checkout_latitude NUMERIC(10,7),
  checkout_longitude NUMERIC(10,7),
  checkout_photo_url TEXT,
  progress_pct NUMERIC(5,2) DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merch_routes_org ON merch_routes(organization_id);
CREATE INDEX IF NOT EXISTS idx_merch_routes_promoter ON merch_routes(promoter_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_merch_routes_pdv ON merch_routes(pdv_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_merch_routes_brand ON merch_routes(brand_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_merch_routes_status ON merch_routes(status);

-- ================================================
-- Route Person Assignments (múltiplos promotores por rota)
-- ================================================
CREATE TABLE IF NOT EXISTS route_person_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'executor',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  reason TEXT,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true
);

-- ================================================
-- Route Photos (todas as fotos da rota)
-- ================================================
CREATE TABLE IF NOT EXISTS route_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  photo_type VARCHAR(30) NOT NULL,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  exposure_point VARCHAR(50),
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_size_bytes INTEGER,
  compressed_size_bytes INTEGER,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  quality_score NUMERIC(5,2),
  quality_passed BOOLEAN DEFAULT true,
  quality_rejection_reason TEXT,
  watermark_applied BOOLEAN DEFAULT false,
  upload_source VARCHAR(20) DEFAULT 'app',
  uploaded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  contingency_reason TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_route_photos_route ON route_photos(route_id);

-- ================================================
-- Route Product Executions (execução por produto na rota)
-- ================================================
CREATE TABLE IF NOT EXISTS route_product_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  exposure_point VARCHAR(50) DEFAULT 'natural',
  status VARCHAR(20) DEFAULT 'pending',
  checked BOOLEAN DEFAULT false,
  qty_store INTEGER DEFAULT 0,
  qty_stock INTEGER DEFAULT 0,
  qty_total INTEGER GENERATED ALWAYS AS (qty_store + qty_stock) STORED,
  has_rupture BOOLEAN DEFAULT false,
  has_damage BOOLEAN DEFAULT false,
  has_discard BOOLEAN DEFAULT false,
  observation TEXT,
  executed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_route_prod_exec ON route_product_executions(route_id, product_id);

-- ================================================
-- Product Validity Entries (validade por produto)
-- ================================================
CREATE TABLE IF NOT EXISTS product_validity_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES route_product_executions(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  expiry_date DATE NOT NULL,
  qty_store INTEGER DEFAULT 0,
  qty_stock INTEGER DEFAULT 0,
  qty_total INTEGER GENERATED ALWAYS AS (qty_store + qty_stock) STORED,
  recorded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Product Ruptures (rupturas)
-- ================================================
CREATE TABLE IF NOT EXISTS product_ruptures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES route_product_executions(id) ON DELETE SET NULL,
  location VARCHAR(20) DEFAULT 'store',
  qty_store INTEGER DEFAULT 0,
  qty_stock INTEGER DEFAULT 0,
  qty_total INTEGER GENERATED ALWAYS AS (qty_store + qty_stock) STORED,
  reason VARCHAR(100),
  observation TEXT,
  photo_url TEXT,
  recorded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Product Damages (avarias)
-- ================================================
CREATE TABLE IF NOT EXISTS product_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  route_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES route_product_executions(id) ON DELETE SET NULL,
  promoter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location VARCHAR(20) DEFAULT 'store',
  qty_store INTEGER DEFAULT 0,
  qty_stock INTEGER DEFAULT 0,
  qty_total INTEGER GENERATED ALWAYS AS (qty_store + qty_stock) STORED,
  reason VARCHAR(255),
  description TEXT,
  photo_url TEXT,
  status VARCHAR(30) DEFAULT 'registered',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_damages_org ON product_damages(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_damages_status ON product_damages(status);

-- ================================================
-- Product Discards (descartes)
-- ================================================
CREATE TABLE IF NOT EXISTS product_discards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES route_product_executions(id) ON DELETE SET NULL,
  qty_store INTEGER DEFAULT 0,
  qty_stock INTEGER DEFAULT 0,
  qty_total INTEGER GENERATED ALWAYS AS (qty_store + qty_stock) STORED,
  reason VARCHAR(255),
  photo_url TEXT,
  observation TEXT,
  recorded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Damage Return Requests (solicitação de devolução)
-- ================================================
CREATE TABLE IF NOT EXISTS damage_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  promoter_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'awaiting_invoice',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Damage Return Items (itens da solicitação)
-- ================================================
CREATE TABLE IF NOT EXISTS damage_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES damage_return_requests(id) ON DELETE CASCADE,
  damage_id UUID NOT NULL REFERENCES product_damages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Return Invoices (notas de devolução)
-- ================================================
CREATE TABLE IF NOT EXISTS return_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES damage_return_requests(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100),
  invoice_date DATE,
  issuer_name VARCHAR(255),
  issuer_cnpj VARCHAR(20),
  photo_url TEXT,
  pdf_url TEXT,
  ocr_data JSONB,
  ocr_confidence NUMERIC(5,2),
  manually_reviewed BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Route Execution Logs (timeline da rota)
-- ================================================
CREATE TABLE IF NOT EXISTS route_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  source VARCHAR(20) DEFAULT 'app',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_route_exec_logs ON route_execution_logs(route_id);

-- ================================================
-- Route Edit Audit Logs (auditoria de edições)
-- ================================================
CREATE TABLE IF NOT EXISTS route_edit_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  edited_by UUID NOT NULL,
  editor_role VARCHAR(30),
  source VARCHAR(20) DEFAULT 'web',
  reason TEXT,
  route_was_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Stock Postponements (prorrogação de contagem)
-- ================================================
CREATE TABLE IF NOT EXISTS route_stock_postponements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  item_type VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  postponed_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  next_route_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Route Notifications
-- ================================================
CREATE TABLE IF NOT EXISTS route_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  route_id UUID REFERENCES merch_routes(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- PDV Service Windows (janelas de atendimento)
-- ================================================
CREATE TABLE IF NOT EXISTS pdv_service_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Promoter Home Bases (base residencial do promotor)
-- ================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_latitude NUMERIC(10,7);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_longitude NUMERIC(10,7);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS max_daily_visits INTEGER DEFAULT 10;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS max_daily_hours NUMERIC(4,1) DEFAULT 8;

-- ================================================
-- Brand access restriction mode
-- ================================================
ALTER TABLE brands ADD COLUMN IF NOT EXISTS promoter_access VARCHAR(20) DEFAULT 'open';
-- open, restricted, preferred
