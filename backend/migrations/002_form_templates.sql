\encoding UTF8
-- =============================================================
-- RINGO -- Migration 002: Full scope matrix templates
-- Run: psql -U postgres -d ringo -f migrations/002_form_templates.sql
-- =============================================================

-- =============================================================
-- 1. NEW DEPARTMENTS
-- =============================================================

INSERT INTO departments (id, name, code) VALUES
    ('33333333-3333-3333-3333-333333333333', '美容',    'BIYOU'),
    ('44444444-4444-4444-4444-444444444444', '保健パート', 'KENPO_PART'),
    ('55555555-5555-5555-5555-555555555555', 'DX人材',  'DX')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 2. DEACTIVATE REPLACED TEMPLATES
-- (These are merged into new consolidated forms)
-- =============================================================

UPDATE form_templates SET is_active = false
WHERE title_en IN (
    'Inquiry (GM Approval)',
    'Inquiry (President Approval)',
    'Leave & Remote Work'
);

-- =============================================================
-- 3. NEW / UPDATED FORM TEMPLATES
-- Dept UUIDs:
--   11111111 = 保健 (KENPO)
--   22222222 = 総務 (SOUMU)
--   33333333 = 美容 (BIYOU)
--   44444444 = 保健パート (KENPO_PART)
--   55555555 = DX人材 (DX)
-- =============================================================

-- ── 伺書 (merged Inquiry form) ─────────────────────────────
DO $$
DECLARE v_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '伺書',
         'Inquiry',
         '{"template_name":"Inquiry (Ukagai)","fields":[{"name":"subject","label":"件名","type":"text","required":true},{"name":"body","label":"内容","type":"textarea","required":true},{"name":"target_date","label":"実施予定日","type":"date","required":false},{"name":"reason","label":"理由・背景","type":"textarea","required":true},{"name":"decision_level","label":"決裁区分","type":"select","required":true,"options":["GM決裁","社長決裁"]},{"name":"attachments","label":"添付ファイル","type":"file","required":false,"multiple":true}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'MUST'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 在宅勤務・休暇申請 (merged leave / remote) ─────────────
DO $$
DECLARE v_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '在宅勤務・休暇申請',
         'Leave & Remote Work Request',
         '{"template_name":"Leave / Remote Work","fields":[{"name":"request_type","label":"申請区分","type":"select","required":true,"options":["有給休暇","代休","特別休暇","欠勤","遅刻・早退","在宅勤務"]},{"name":"start_date","label":"開始日","type":"date","required":true},{"name":"end_date","label":"終了日","type":"date","required":true},{"name":"start_time","label":"開始時刻 (遅刻・在宅の場合)","type":"text","required":false},{"name":"end_time","label":"終了時刻 (早退の場合)","type":"text","required":false},{"name":"reason","label":"理由","type":"textarea","required":false},{"name":"attachments","label":"添付ファイル（診断書など）","type":"file","required":false,"multiple":true}],"validations":[{"rule":"end_date >= start_date","message":"終了日は開始日以降にしてください"}]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'MUST'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'MUST'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'MUST'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'MUST')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 慶弔休暇・特別休暇申請書 ───────────────────────────────
DO $$
DECLARE v_id UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '慶弔休暇・特別休暇申請書',
         'Special / Bereavement Leave',
         '{"template_name":"Special Leave","fields":[{"name":"leave_type","label":"休暇種別","type":"select","required":true,"options":["慶弔休暇","特別休暇"]},{"name":"event_type","label":"事由","type":"text","required":true},{"name":"relationship","label":"続柄","type":"text","required":false},{"name":"start_date","label":"開始日","type":"date","required":true},{"name":"end_date","label":"終了日","type":"date","required":true}],"validations":[{"rule":"end_date >= start_date","message":"終了日は開始日以降にしてください"}]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 慶弔見舞金申請書 ───────────────────────────────────────
DO $$
DECLARE v_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '慶弔見舞金申請書',
         'Condolence / Celebration Gift',
         '{"template_name":"Condolence Gift","fields":[{"name":"event_type","label":"事由","type":"select","required":true,"options":["結婚","出産","死亡","傷病","その他"]},{"name":"recipient_name","label":"対象者氏名","type":"text","required":true},{"name":"relationship","label":"続柄","type":"text","required":true},{"name":"amount_requested","label":"申請金額 (円)","type":"text","required":true},{"name":"note","label":"備考","type":"textarea","required":false}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 健康保険・厚生年金被扶養者（異動）届 ───────────────────
DO $$
DECLARE v_id UUID := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '健康保険・厚生年金保険被扶養者（異動）届',
         'Health Insurance Dependent Change',
         '{"template_name":"Dependent Change","fields":[{"name":"change_type","label":"異動区分","type":"select","required":true,"options":["被扶養者追加","被扶養者削除","氏名変更"]},{"name":"dependent_name","label":"被扶養者氏名","type":"text","required":true},{"name":"relationship","label":"続柄","type":"text","required":true},{"name":"birth_date","label":"生年月日","type":"date","required":true},{"name":"effective_date","label":"異動年月日","type":"date","required":true},{"name":"reason","label":"理由","type":"textarea","required":false},{"name":"supporting_docs","label":"添付書類（戸籍謄本・住民票など）","type":"file","required":true,"multiple":true}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 休職・復職届 ──────────────────────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '休職・復職届',
         'Leave of Absence / Return to Work',
         '{"template_name":"Leave of Absence","fields":[{"name":"request_type","label":"申請区分","type":"select","required":true,"options":["休職","復職"]},{"name":"start_date","label":"開始日","type":"date","required":true},{"name":"end_date","label":"終了予定日","type":"date","required":false},{"name":"reason","label":"理由","type":"textarea","required":true},{"name":"medical_certificate","label":"診断書","type":"file","required":false,"multiple":false}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 退職願 ────────────────────────────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '退職願',
         'Resignation',
         '{"template_name":"Resignation","fields":[{"name":"last_working_day","label":"最終出勤日","type":"date","required":true},{"name":"reason","label":"退職理由","type":"textarea","required":true},{"name":"message","label":"一言","type":"textarea","required":false}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 備品・名刺・封筒・パンフ・ゴム印発注 ──────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000003';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '備品・名刺・封筒・パンフ・ゴム印発注',
         'Supplies & Print Order',
         '{"template_name":"Supplies Order","fields":[{"name":"item_type","label":"品目種別","type":"select","required":true,"options":["備品","名刺","封筒","パンフレット","ゴム印","その他"]},{"name":"item_name","label":"品名・仕様","type":"text","required":true},{"name":"quantity","label":"数量","type":"text","required":true},{"name":"delivery_date","label":"希望納期","type":"date","required":false},{"name":"reason","label":"使用目的","type":"textarea","required":true},{"name":"attachments","label":"添付資料（見積書など）","type":"file","required":false,"multiple":true}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 鍵貸出申請書 ──────────────────────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000004';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '鍵貸出申請書',
         'Key Loan Application',
         '{"template_name":"Key Loan","fields":[{"name":"key_type","label":"鍵の種別","type":"text","required":true},{"name":"usage_date","label":"使用日","type":"date","required":true},{"name":"return_date","label":"返却予定日","type":"date","required":true},{"name":"purpose","label":"使用目的","type":"textarea","required":true}],"validations":[{"rule":"return_date >= usage_date","message":"返却日は使用日以降にしてください"}]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 通勤交通費精算書 (PATTERN_3) ──────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_3'),
         '通勤交通費精算書',
         'Commuting Expense Claim',
         '{"template_name":"Commuting Expense","fields":[{"name":"period_from","label":"精算期間 (開始)","type":"date","required":true},{"name":"period_to","label":"精算期間 (終了)","type":"date","required":true},{"name":"route","label":"経路","type":"text","required":true},{"name":"monthly_fare","label":"月額定期代 (円)","type":"text","required":true},{"name":"total_amount","label":"精算金額合計 (円)","type":"text","required":true},{"name":"commute_pass_scan","label":"定期券・申請書","type":"file","required":true,"multiple":false},{"name":"receipts","label":"領収書","type":"file","required":false,"multiple":true}],"validations":[{"rule":"period_to >= period_from","message":"終了日は開始日以降にしてください"}]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 出張申請・精算書 (PATTERN_3) ──────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000006';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_3'),
         '出張申請・精算書',
         'Business Trip Application',
         '{"template_name":"Business Trip","fields":[{"name":"destination","label":"出張先","type":"text","required":true},{"name":"purpose","label":"目的","type":"textarea","required":true},{"name":"start_date","label":"出発日","type":"date","required":true},{"name":"end_date","label":"帰着日","type":"date","required":true},{"name":"transportation","label":"交通手段","type":"text","required":true},{"name":"accommodation","label":"宿泊先","type":"text","required":false},{"name":"estimated_cost","label":"概算費用 (円)","type":"text","required":true},{"name":"receipts","label":"領収書・添付書類","type":"file","required":false,"multiple":true}],"validations":[{"rule":"end_date >= start_date","message":"帰着日は出発日以降にしてください"}]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'SHOULD'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 経費精算書 (PATTERN_3) ────────────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000007';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_3'),
         '経費精算書',
         'Expense Report',
         '{"template_name":"Expense Report","fields":[{"name":"expense_date","label":"発生日","type":"date","required":true},{"name":"category","label":"費目","type":"select","required":true,"options":["交通費","宿泊費","接待費","消耗品費","通信費","その他"]},{"name":"description","label":"内容・詳細","type":"textarea","required":true},{"name":"amount","label":"金額 (円)","type":"text","required":true},{"name":"receipt","label":"領収書","type":"file","required":true,"multiple":false}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'MUST'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 支払依頼書 (PATTERN_3) ────────────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000008';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_3'),
         '支払依頼書',
         'Payment Request',
         '{"template_name":"Payment Request","fields":[{"name":"payee","label":"支払先","type":"text","required":true},{"name":"amount","label":"金額 (円)","type":"text","required":true},{"name":"due_date","label":"支払期日","type":"date","required":true},{"name":"purpose","label":"支払目的","type":"textarea","required":true},{"name":"bank_name","label":"金融機関名","type":"text","required":false},{"name":"bank_account","label":"口座番号","type":"text","required":false},{"name":"attachments","label":"添付書類（請求書・見積書など）","type":"file","required":false,"multiple":true}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'MUST'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 稟議書 ────────────────────────────────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000009';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '稟議書',
         'Board Decision Document',
         '{"template_name":"Ringi","fields":[{"name":"subject","label":"件名","type":"text","required":true},{"name":"background","label":"背景・目的","type":"textarea","required":true},{"name":"proposal","label":"提案内容","type":"textarea","required":true},{"name":"expected_cost","label":"概算費用 (円)","type":"text","required":false},{"name":"alternatives","label":"代替案・検討事項","type":"textarea","required":false}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'MUST'),
    (v_id, '22222222-2222-2222-2222-222222222222', 'SHOULD'),
    (v_id, '33333333-3333-3333-3333-333333333333', 'SHOULD'),
    (v_id, '55555555-5555-5555-5555-555555555555', 'SHOULD')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── 残業申請 (保健・保健パートのみ) ──────────────────────
DO $$
DECLARE v_id UUID := 'a0000000-0000-0000-0000-000000000010';
BEGIN
  INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
  SELECT v_id,
         (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
         '残業申請',
         'Overtime Application',
         '{"template_name":"Overtime","fields":[{"name":"work_date","label":"残業日","type":"date","required":true},{"name":"start_time","label":"開始時刻","type":"text","required":true},{"name":"end_time","label":"終了予定時刻","type":"text","required":true},{"name":"reason","label":"残業理由","type":"textarea","required":true},{"name":"manager_confirmed","label":"上長確認","type":"select","required":true,"options":["確認済み","未確認"]}],"validations":[]}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = v_id);

  INSERT INTO template_permissions (template_id, department_id, access_level) VALUES
    (v_id, '11111111-1111-1111-1111-111111111111', 'MUST'),
    (v_id, '44444444-4444-4444-4444-444444444444', 'MUST')
  ON CONFLICT (template_id, department_id) DO NOTHING;
END $$;

-- ── Update permissions for existing templates ────────────────

-- PC Take-out: 総務 SHOULD, 保健 WONT, DX SHOULD (美容 not in scope)
INSERT INTO template_permissions (template_id, department_id, access_level)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', dept_id, level
FROM (VALUES
    ('33333333-3333-3333-3333-333333333333'::uuid, 'WONT'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'SHOULD')
) AS t(dept_id, level)
ON CONFLICT (template_id, department_id) DO UPDATE SET access_level = EXCLUDED.access_level;

-- Add new dept permissions to remaining active templates (all get SHOULD for new depts)
INSERT INTO template_permissions (template_id, department_id, access_level)
SELECT ft.id, d.id, 'SHOULD'
FROM form_templates ft
CROSS JOIN (
  SELECT id FROM departments WHERE code IN ('BIYOU', 'DX')
) d
WHERE ft.is_active = true
  AND ft.id NOT IN (
    -- Templates that already have specific permissions for these depts
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-000000000010',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
ON CONFLICT (template_id, department_id) DO NOTHING;
