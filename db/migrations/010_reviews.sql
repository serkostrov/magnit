ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'in_progress', 'confirmed', 'paid', 'completed', 'cancelled'));

ALTER TABLE notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_entity_type_check;

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_entity_type_check
  CHECK (entity_type IN ('order', 'lead', 'review_request', 'review'));

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  request_id UUID NOT NULL UNIQUE REFERENCES review_requests(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'moderation' CHECK (status IN ('moderation', 'hidden', 'published')),
  consent_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  consent_ip TEXT NOT NULL DEFAULT '',
  consent_user_agent TEXT NOT NULL DEFAULT '',
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_requests_expires_idx
  ON review_requests(expires_at);

CREATE INDEX IF NOT EXISTS reviews_status_created_idx
  ON reviews(status, created_at DESC);
