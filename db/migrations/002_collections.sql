CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO collections (slug, title, sort_order, is_featured)
SELECT DISTINCT
  pc.collection_slug,
  CASE pc.collection_slug
    WHEN 'novinki' THEN 'Новинки'
    WHEN 'popular' THEN 'Популярное'
    WHEN 'adhesive' THEN 'Магниты с клеевым слоем'
    ELSE pc.collection_slug
  END,
  ROW_NUMBER() OVER (ORDER BY pc.collection_slug) - 1,
  true
FROM product_collections pc
WHERE pc.collection_slug <> ''
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS collections_sort_order_idx ON collections(sort_order, title);
CREATE INDEX IF NOT EXISTS product_collections_order_idx ON product_collections(collection_slug, sort_order, product_id);
