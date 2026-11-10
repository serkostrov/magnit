ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS home_color TEXT NOT NULL DEFAULT 'blue';

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_home_color_check;

ALTER TABLE categories
  ADD CONSTRAINT categories_home_color_check
  CHECK (home_color IN ('blue', 'mint', 'sand', 'lilac', 'rose', 'cyan'));
