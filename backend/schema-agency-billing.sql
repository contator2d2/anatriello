-- =====================================================
-- Sistema de Billing para Agências Terceiras
-- =====================================================

-- Planos de cobrança para agências
CREATE TABLE IF NOT EXISTS agency_billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price_per_promoter NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_promoters INTEGER, -- NULL = ilimitado
  features JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assinaturas de agências
CREATE TABLE IF NOT EXISTS agency_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES agency_billing_plans(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, overdue, cancelled, blocked
  current_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  current_period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  promoter_count INTEGER DEFAULT 0,
  amount_due NUMERIC(10,2) DEFAULT 0,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  last_payment_at TIMESTAMPTZ,
  overdue_since DATE,
  auto_block_enabled BOOLEAN DEFAULT false,
  block_after_days INTEGER DEFAULT 15, -- dias após vencimento para bloquear
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faturas mensais
CREATE TABLE IF NOT EXISTS agency_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES agency_subscriptions(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL, -- primeiro dia do mês de referência
  promoter_count INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  final_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_invoices_agency ON agency_invoices(agency_id, reference_month);
CREATE INDEX IF NOT EXISTS idx_agency_invoices_status ON agency_invoices(status, due_date);

-- Log de ações de billing
CREATE TABLE IF NOT EXISTS agency_billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- invoice_created, payment_received, overdue_warning, auto_blocked, unblocked
  details JSONB DEFAULT '{}',
  performed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
