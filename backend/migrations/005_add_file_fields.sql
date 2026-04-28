-- Migration 005: Add file upload fields to form templates that require attachments.
-- Uses jsonb_set to append file fields — idempotent (checks before inserting).
-- Run: psql $DATABASE_URL -f backend/migrations/005_add_file_fields.sql

-- Helper macro: appends a file field only if a field with that name does not already exist.
-- Pattern: UPDATE ... WHERE NOT (fields @> '[{"name":"..."}]')

-- ── 伺書 (Inquiry) ──────────────────────────────────────────────────────────
-- Rakumo: 添付ファイル (multiple, optional)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"attachments","label":"添付ファイル","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"attachments"}]'::jsonb);

-- ── 在宅勤務・休暇申請 (Leave & Remote Work) ────────────────────────────────
-- Rakumo: 添付ファイル (doctor notes, certificates — multiple, optional)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"attachments","label":"添付ファイル（診断書など）","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"attachments"}]'::jsonb);

-- ── 慶弔休暇・特別休暇申請書 (Special Leave) ────────────────────────────────
-- Rakumo: 添付ファイル (multiple, optional)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"attachments","label":"添付ファイル","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"attachments"}]'::jsonb);

-- ── 健康保険・厚生年金被扶養者届 (Dependent Change) ─────────────────────────
-- Rakumo: 証明書類 required (family register, birth certificate, etc.)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"supporting_docs","label":"添付書類（戸籍謄本・住民票など）","type":"file","required":true,"multiple":true}]'::jsonb
)
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"supporting_docs"}]'::jsonb);

-- ── 休職・復職届 (Leave of Absence) ────────────────────────────────────────
-- Rakumo: 診断書 (medical certificate, optional)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"medical_certificate","label":"診断書","type":"file","required":false,"multiple":false}]'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000001'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"medical_certificate"}]'::jsonb);

-- ── 備品・名刺発注 (Supplies Order) ─────────────────────────────────────────
-- Rakumo: 添付資料 (quote, spec sheet — optional)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"attachments","label":"添付資料（見積書など）","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000003'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"attachments"}]'::jsonb);

-- ── 通勤交通費精算書 (Commuting Expense) ────────────────────────────────────
-- Rakumo: 定期券・領収書 (commute pass scan + receipts — multiple, required)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"commute_pass_scan","label":"定期券・申請書","type":"file","required":true,"multiple":false},{"name":"receipts","label":"領収書","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000005'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"commute_pass_scan"}]'::jsonb);

-- ── 出張申請・精算書 (Business Trip) ────────────────────────────────────────
-- Rakumo: 領収書・添付書類 (receipts — multiple, optional at apply time)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"receipts","label":"領収書・添付書類","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000006'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"receipts"}]'::jsonb);

-- ── 経費精算書 (Expense Report) ──────────────────────────────────────────────
-- Replace the "receipt_attached" select with an actual file upload field.
-- Step 1: Remove the old select field.
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(schema_definition -> 'fields') AS elem
    WHERE elem ->> 'name' != 'receipt_attached'
  )
)
WHERE id = 'a0000000-0000-0000-0000-000000000007'
  AND (schema_definition -> 'fields' @> '[{"name":"receipt_attached"}]'::jsonb);

-- Step 2: Add the file field.
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"receipt","label":"領収書","type":"file","required":true,"multiple":false}]'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000007'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"receipt"}]'::jsonb);

-- ── 支払依頼書 (Payment Request) ─────────────────────────────────────────────
-- Rakumo: 添付書類 (invoice, quote — multiple, optional)
UPDATE form_templates
SET schema_definition = jsonb_set(
  schema_definition,
  '{fields}',
  (schema_definition -> 'fields') || '[{"name":"attachments","label":"添付書類（請求書・見積書など）","type":"file","required":false,"multiple":true}]'::jsonb
)
WHERE id = 'a0000000-0000-0000-0000-000000000008'
  AND NOT (schema_definition -> 'fields' @> '[{"name":"attachments"}]'::jsonb);

-- Verify
SELECT id, title,
       jsonb_array_length(schema_definition -> 'fields') AS field_count,
       (
         SELECT string_agg(f ->> 'name', ', ')
         FROM jsonb_array_elements(schema_definition -> 'fields') f
         WHERE f ->> 'type' = 'file'
       ) AS file_fields
FROM form_templates
WHERE is_active = true
ORDER BY title;
