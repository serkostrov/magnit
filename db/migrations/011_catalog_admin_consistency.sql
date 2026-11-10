UPDATE categories
SET sort_order = CASE slug
  WHEN 'diski' THEN 10
  WHEN 'pryamougolnye' THEN 20
  WHEN 'magnitnye-zahvaty' THEN 30
  WHEN 'krepleniya' THEN 40
  WHEN 'kolca' THEN 50
  WHEN 'zenkovka' THEN 60
  WHEN 'poiskovye' THEN 70
  WHEN 'magnitnyy-vinil-bez-kleevogo-sloya' THEN 80
  WHEN 'magnitnyy-vinil-s-kleevym-sloem' THEN 90
  WHEN 's-emniki' THEN 100
  ELSE sort_order
END,
updated_at = now()
WHERE slug IN (
  'diski',
  'pryamougolnye',
  'magnitnye-zahvaty',
  'krepleniya',
  'kolca',
  'zenkovka',
  'poiskovye',
  'magnitnyy-vinil-bez-kleevogo-sloya',
  'magnitnyy-vinil-s-kleevym-sloem',
  's-emniki'
);

UPDATE product_characteristics characteristic
SET label = settings.source_label
FROM catalog_filter_settings settings
WHERE lower(trim(characteristic.label)) = lower(trim(settings.source_label))
  AND characteristic.label <> settings.source_label;
