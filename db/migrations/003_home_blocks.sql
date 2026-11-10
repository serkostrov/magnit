CREATE TABLE IF NOT EXISTS home_blocks (
  block_key TEXT PRIMARY KEY CHECK (block_key IN ('hero','metrics','categories','bestsellers','wizard','industry','applications','opt','process','delivery','compare','reviews','faq','final-cta')),
  sort_order INTEGER NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO home_blocks (block_key, title, sort_order)
VALUES
  ('hero', 'Первый экран', 0),
  ('metrics', 'Метрики', 1),
  ('categories', 'Категории', 2),
  ('bestsellers', 'Бестселлеры', 3),
  ('wizard', 'Подбор за 3 минуты', 4),
  ('industry', 'По отраслям', 5),
  ('applications', 'Применения', 6),
  ('opt', 'Оптовая форма', 7),
  ('process', 'Как работаем', 8),
  ('delivery', 'Доставка', 9),
  ('compare', 'Почему мы', 10),
  ('reviews', 'Отзывы', 11),
  ('faq', 'Частые вопросы', 12),
  ('final-cta', 'Финальный CTA', 13)
ON CONFLICT (block_key) DO NOTHING;
