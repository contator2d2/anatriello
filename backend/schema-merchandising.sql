-- Merchandising Module: Brands, Categories, Products, PDV Mix

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  razao_social VARCHAR(255),
  cnpj VARCHAR(20),
  logo_url TEXT,
  description TEXT,
  segment VARCHAR(100),
  responsible VARCHAR(255),
  phone VARCHAR(30),
  email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  subcategory_id UUID NOT NULL REFERENCES product_subcategories(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  internal_code VARCHAR(100),
  barcode VARCHAR(100),
  description TEXT,
  image_url TEXT,
  unit VARCHAR(20) DEFAULT 'un',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pdv_id, brand_id)
);

CREATE TABLE IF NOT EXISTS pdv_brand_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pdv_id UUID NOT NULL REFERENCES pdvs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  mandatory BOOLEAN DEFAULT false,
  priority VARCHAR(10) DEFAULT 'media',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pdv_id, brand_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_brands_org ON brands(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_pdv_brands_pdv ON pdv_brands(pdv_id);
CREATE INDEX IF NOT EXISTS idx_pdv_brands_brand ON pdv_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_pdv_brand_products_pdv ON pdv_brand_products(pdv_id);
CREATE INDEX IF NOT EXISTS idx_pdv_brand_products_brand ON pdv_brand_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_pdv_brand_products_product ON pdv_brand_products(product_id);
