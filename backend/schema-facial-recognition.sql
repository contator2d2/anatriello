-- =====================================================
-- Schema: Facial Recognition Configuration (HR + Access Control)
-- =====================================================

-- HR Facial recognition configuration per organization
CREATE TABLE IF NOT EXISTS facial_recognition_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Master toggle
  enabled BOOLEAN DEFAULT false,
  -- Use cases
  use_for_attendance BOOLEAN DEFAULT false,
  use_for_checkin BOOLEAN DEFAULT false,
  -- Threshold
  min_confidence NUMERIC(5,2) DEFAULT 70.00,
  -- Options
  require_photo_registration BOOLEAN DEFAULT true,
  auto_verify_on_clock_in BOOLEAN DEFAULT false,
  allow_manual_fallback BOOLEAN DEFAULT true,
  photo_quality_check BOOLEAN DEFAULT true,
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Face verification logs (for both HR and Access Control)
CREATE TABLE IF NOT EXISTS face_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Who
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  agency_promoter_id UUID REFERENCES agency_promoters(id) ON DELETE SET NULL,
  -- Context
  verification_context VARCHAR(30) NOT NULL, -- attendance, checkin, totem_entry, totem_exit
  -- Result
  confidence_score NUMERIC(5,2),
  result VARCHAR(20) NOT NULL, -- approved, rejected, error, fallback
  -- Images
  captured_image_url TEXT,
  -- Device info
  device_info TEXT,
  ip_address VARCHAR(45),
  -- Timestamps
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_verify_org ON face_verification_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_face_verify_employee ON face_verification_logs(employee_id, created_at);
