ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS recipient_kind TEXT NOT NULL DEFAULT 'manager'
  CHECK (recipient_kind IN ('manager', 'customer'));

ALTER TABLE notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_channel_entity_type_entity_id_key;

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_entity_recipient_key
  UNIQUE (channel, entity_type, entity_id, recipient_kind);
