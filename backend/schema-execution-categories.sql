-- Execution category preparation: enforces point_type + photo before product access
CREATE TABLE IF NOT EXISTS merch_execution_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES merch_routes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES merch_categories(id),
  category_name VARCHAR(255),
  point_type VARCHAR(20), -- 'natural' or 'extra'
  point_type_at TIMESTAMPTZ,
  category_before_photo TEXT,
  category_photo_at TIMESTAMPTZ,
  category_photo_latitude DOUBLE PRECISION,
  category_photo_longitude DOUBLE PRECISION,
  products_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  performed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_exec_categories_route ON merch_execution_categories(route_id);
