\encoding UTF8
-- =============================================================
-- RINGO -- Initial Schema Migration (idempotent)
-- Run: psql -U postgres -d ringo -f migrations/001_initial_schema.sql
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================
-- 1. ORGANIZATION & USERS
-- =============================================================

CREATE TABLE IF NOT EXISTS departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50) NOT NULL UNIQUE,
    parent_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    role          VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE',
    reports_to    UUID REFERENCES users(id) ON DELETE SET NULL,
    oauth_id      VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING GIN (full_name gin_trgm_ops);

-- =============================================================
-- 2. DELEGATION ENGINE
-- =============================================================

CREATE TABLE IF NOT EXISTS delegations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delegatee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_delegation_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_dates ON delegations(start_date, end_date);

-- =============================================================
-- 3. WORKFLOW PATTERNS & FORM TEMPLATES
-- =============================================================

CREATE TABLE IF NOT EXISTS workflow_patterns (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    pattern_code VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS form_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id        UUID NOT NULL REFERENCES workflow_patterns(id),
    title             VARCHAR(255) NOT NULL,
    title_en          VARCHAR(255),
    schema_definition JSONB NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_templates_schema ON form_templates USING GIN (schema_definition);

CREATE TABLE IF NOT EXISTS template_permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id   UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    access_level  VARCHAR(10) NOT NULL DEFAULT 'WONT',
    UNIQUE(template_id, department_id)
);

-- =============================================================
-- 4. APPLICATIONS (RINGI)
-- =============================================================

CREATE SEQUENCE IF NOT EXISTS application_number_seq START 1;

CREATE TABLE IF NOT EXISTS applications (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(20) NOT NULL UNIQUE
        DEFAULT 'APP-' || LPAD(nextval('application_number_seq')::TEXT, 6, '0'),
    applicant_id       UUID NOT NULL REFERENCES users(id),
    template_id        UUID NOT NULL REFERENCES form_templates(id),
    form_data          JSONB NOT NULL DEFAULT '{}',
    status             VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    version            INT NOT NULL DEFAULT 1,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_applicant_status ON applications(applicant_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_template ON applications(template_id);
CREATE INDEX IF NOT EXISTS idx_applications_form_data ON applications USING GIN (form_data);

-- =============================================================
-- 5. APPROVAL STEPS
-- =============================================================

CREATE TABLE IF NOT EXISTS approval_steps (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    step_order     INT NOT NULL,
    approver_id    UUID NOT NULL REFERENCES users(id),
    status         VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    comments       TEXT,
    action_at      TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_application ON approval_steps(application_id, step_order);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver ON approval_steps(approver_id, status);

-- =============================================================
-- 6. SETTLEMENTS
-- =============================================================

CREATE TABLE IF NOT EXISTS settlements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
    expected_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    actual_amount   NUMERIC(10, 2),
    currency        VARCHAR(3) NOT NULL DEFAULT 'JPY',
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    processed_by    UUID REFERENCES users(id),
    settled_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_application ON settlements(application_id);

-- =============================================================
-- 7. RECEIPTS
-- =============================================================

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

CREATE TABLE IF NOT EXISTS receipts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id  UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL UNIQUE
        DEFAULT 'RCPT-' || LPAD(nextval('receipt_number_seq')::TEXT, 5, '0'),
    receipt_amount NUMERIC(10, 2) NOT NULL,
    receipt_date   DATE NOT NULL,
    vendor_name    VARCHAR(255),
    drive_file_id  VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipts_settlement ON receipts(settlement_id);

-- =============================================================
-- 8. AUDIT LOGS
-- =============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    actor_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    action         VARCHAR(100) NOT NULL,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_application ON audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================
-- SEED DATA (all idempotent via ON CONFLICT DO NOTHING)
-- =============================================================

INSERT INTO workflow_patterns (name, pattern_code) VALUES
    ('Approval Only',            'PATTERN_1'),
    ('Settlement Only',          'PATTERN_2'),
    ('Approval + Settlement',    'PATTERN_3')
ON CONFLICT (pattern_code) DO NOTHING;

INSERT INTO departments (id, name, code) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Kenpo',  'KENPO'),
    ('22222222-2222-2222-2222-222222222222', 'Soumu',  'SOUMU')
ON CONFLICT (id) DO NOTHING;

-- Form templates with ASCII-safe JSON (Japanese in title columns, not in JSONB keys)
INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    gen_random_uuid(),
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
    'Inquiry (GM Approval)',
    'Inquiry (GM Approval)',
    '{"template_name":"Inquiry (GM Approval)","fields":[{"name":"subject","label":"Subject","type":"text","required":true},{"name":"body","label":"Content","type":"textarea","required":true},{"name":"target_date","label":"Date","type":"date","required":false},{"name":"reason","label":"Reason","type":"textarea","required":true}],"validations":[]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE title_en = 'Inquiry (GM Approval)');

INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    gen_random_uuid(),
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
    'Inquiry (President Approval)',
    'Inquiry (President Approval)',
    '{"template_name":"Inquiry (President Approval)","fields":[{"name":"subject","label":"Subject","type":"text","required":true},{"name":"body","label":"Content","type":"textarea","required":true},{"name":"target_date","label":"Date","type":"date","required":false},{"name":"reason","label":"Reason","type":"textarea","required":true}],"validations":[]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE title_en = 'Inquiry (President Approval)');

INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
    'PC Take-out Request',
    'PC Take-out Request',
    '{"template_name":"PC Take-out Request","fields":[{"name":"asset_id","label":"Asset ID","type":"text","required":true},{"name":"start_date","label":"Start Date","type":"date","required":true},{"name":"end_date","label":"End Date","type":"date","required":true},{"name":"destination","label":"Destination","type":"text","required":true},{"name":"reason","label":"Reason","type":"textarea","required":true}],"validations":[{"rule":"end_date >= start_date","message":"End date must be on or after start date"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    gen_random_uuid(),
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
    'Office Closure / Overtime',
    'Office Closure / Overtime',
    '{"template_name":"Office Closure / Overtime","fields":[{"name":"work_type","label":"Type","type":"select","required":true,"options":["Office Closure","Early Start","Overtime"]},{"name":"work_date","label":"Date","type":"date","required":true},{"name":"start_time","label":"Start Time","type":"text","required":true},{"name":"end_time","label":"End Time","type":"text","required":true},{"name":"reason","label":"Reason","type":"textarea","required":true}],"validations":[]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE title_en = 'Office Closure / Overtime');

INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    gen_random_uuid(),
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
    'Leave & Remote Work',
    'Leave & Remote Work',
    '{"template_name":"Leave & Remote Work","fields":[{"name":"leave_type","label":"Leave Type","type":"select","required":true,"options":["Paid Leave","Comp Leave","Special Leave","Remote Work"]},{"name":"start_date","label":"Start Date","type":"date","required":true},{"name":"end_date","label":"End Date","type":"date","required":true},{"name":"reason","label":"Reason","type":"textarea","required":false}],"validations":[{"rule":"end_date >= start_date","message":"End date must be on or after start date"}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE title_en = 'Leave & Remote Work');

INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    gen_random_uuid(),
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_3'),
    'Equipment Purchase',
    'Equipment Purchase',
    '{"template_name":"Equipment Purchase","fields":[{"name":"item_name","label":"Item Name","type":"text","required":true},{"name":"quantity","label":"Quantity","type":"text","required":true},{"name":"estimated_price","label":"Estimated Price (JPY)","type":"text","required":true},{"name":"catalog_url","label":"Reference URL","type":"text","required":false},{"name":"reason","label":"Purchase Reason","type":"textarea","required":true}],"validations":[]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE title_en = 'Equipment Purchase');

INSERT INTO form_templates (id, pattern_id, title, title_en, schema_definition)
SELECT
    gen_random_uuid(),
    (SELECT id FROM workflow_patterns WHERE pattern_code = 'PATTERN_1'),
    'Address / Commute Change',
    'Address / Commute Change',
    '{"template_name":"Address / Commute Change","fields":[{"name":"change_type","label":"Change Type","type":"select","required":true,"options":["Address Change","Commute Change","Both"]},{"name":"effective_date","label":"Effective Date","type":"date","required":true},{"name":"old_address","label":"Old Address","type":"textarea","required":false},{"name":"new_address","label":"New Address","type":"textarea","required":false},{"name":"old_route","label":"Old Commute Route","type":"textarea","required":false},{"name":"new_route","label":"New Commute Route","type":"textarea","required":false},{"name":"monthly_fare","label":"Monthly Fare (JPY)","type":"text","required":false}],"validations":[]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM form_templates WHERE title_en = 'Address / Commute Change');

-- Permissions
INSERT INTO template_permissions (template_id, department_id, access_level)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'SHOULD')
ON CONFLICT (template_id, department_id) DO NOTHING;

INSERT INTO template_permissions (template_id, department_id, access_level)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'SHOULD')
ON CONFLICT (template_id, department_id) DO NOTHING;

DO $$
DECLARE
    t RECORD;
    d UUID;
BEGIN
    FOR t IN SELECT id FROM form_templates WHERE id != 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' LOOP
        FOREACH d IN ARRAY ARRAY['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid] LOOP
            INSERT INTO template_permissions (template_id, department_id, access_level)
            VALUES (t.id, d, 'MUST')
            ON CONFLICT (template_id, department_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
