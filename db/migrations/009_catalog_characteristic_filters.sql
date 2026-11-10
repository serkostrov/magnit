CREATE TABLE IF NOT EXISTS catalog_filter_settings (
  filter_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  source_label TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_filter_options (
  filter_key TEXT NOT NULL REFERENCES catalog_filter_settings(filter_key) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (filter_key, slug),
  UNIQUE (filter_key, value)
);

INSERT INTO catalog_filter_settings (filter_key, label, source_label, is_enabled, sort_order)
VALUES ('application', 'Применение', 'Применение', true, 10), ('industry', 'Отрасль', 'Отрасль', true, 20)
ON CONFLICT (filter_key) DO UPDATE SET label = EXCLUDED.label, source_label = EXCLUDED.source_label;

INSERT INTO catalog_filter_options (filter_key, slug, value, sort_order)
VALUES
  ('application', 'kalendari', 'Магниты для календарей', 10),
  ('application', 'korobki-i-shkatulki', 'Магниты для коробок и шкатулок', 20),
  ('application', 'reklamnye-paneli', 'Магниты для рекламных панелей', 30),
  ('application', 'gps-trekery-i-mayaki', 'Магниты для GPS-трекеров и маяков', 40),
  ('application', 'beydzhi-i-propuska', 'Магниты для бейджей и пропусков', 50),
  ('application', 'derzhateli-telefonov-v-avto', 'Магниты для держателей телефонов в авто', 60),
  ('application', 'markernye-doski', 'Магниты для маркерных досок', 70),
  ('application', 'detskie-konstruktory', 'Магниты для детских конструкторов', 80),
  ('application', 'avto-nakleyki', 'Магниты для авто-наклеек', 90),
  ('application', 'dveri-shkafov-i-kuhon', 'Магниты для дверей шкафов и кухонь', 100),
  ('industry', 'mebelnaya-furnitura', 'Мебельная фурнитура', 10),
  ('industry', 'upakovka-i-poligrafiya', 'Упаковка и полиграфия', 20),
  ('industry', 'reklama-i-suvenirka', 'Реклама и сувенирка', 30),
  ('industry', 'elektronika-i-pribory', 'Электроника и приборы', 40),
  ('industry', 'svarka-i-metalloobrabotka', 'Сварка и металлообработка', 50),
  ('industry', 'poiskovaya-rybalka', 'Поисковая рыбалка', 60),
  ('industry', 'magnitnye-derzhateli', 'Магнитные держатели', 70),
  ('industry', 'promyshlennost-i-osnastka', 'Промышленность и оснастка', 80)
ON CONFLICT (filter_key, slug) DO UPDATE SET value = EXCLUDED.value, sort_order = EXCLUDED.sort_order;

INSERT INTO catalog_filter_settings (filter_key, label, source_label, is_enabled, sort_order)
SELECT 'property-' || substr(md5(lower(trim(label))), 1, 16), min(trim(label)), min(trim(label)), false, 100
FROM product_characteristics
WHERE lower(trim(label)) NOT IN ('применение', 'отрасль', 'статус')
GROUP BY lower(trim(label))
ON CONFLICT (filter_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS product_characteristics_filter_idx
  ON product_characteristics (product_id, lower(trim(label)), value);
