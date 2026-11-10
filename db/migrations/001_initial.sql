-- Схема второго этапа. Все изменения должны добавляться отдельными файлами
-- 002_*.sql, 003_*.sql и т.д. Runner применяет их лексикографически один раз.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  sku TEXT,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL DEFAULT '',
  description_html TEXT NOT NULL DEFAULT '',
  seo_title TEXT,
  seo_description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  old_price NUMERIC(12,2),
  form TEXT NOT NULL DEFAULT 'Диск',
  main_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL DEFAULT '',
  badge TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
  quantity INTEGER,
  popularity INTEGER NOT NULL DEFAULT 0,
  characteristic_confidence NUMERIC(5,4),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS product_collections (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_slug)
);

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  external_url TEXT,
  UNIQUE (product_id, url)
);

CREATE TABLE IF NOT EXISTS product_characteristics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC(5,4),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  old_amount NUMERIC(12,2),
  currency CHAR(3) NOT NULL DEFAULT 'RUB',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS home_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'confirmed', 'completed', 'cancelled')),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  inn TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  delivery_method TEXT NOT NULL DEFAULT '',
  delivery_address TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  consent_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  external_product_id TEXT,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('quiz', 'wholesale', 'contact', 'other')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(main_category_id);
CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS leads_kind_idx ON leads(kind);
