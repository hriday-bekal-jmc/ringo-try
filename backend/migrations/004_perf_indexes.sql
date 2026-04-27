-- Migration 004: Performance indexes
-- Run: psql -d ringo -f backend/migrations/004_perf_indexes.sql
-- All use CONCURRENTLY so they can be applied without locking tables in production.
-- Safe to run multiple times (IF NOT EXISTS).

-- ── Critical: approval inbox query (polled/SSE-triggered per approver) ─────────
-- Covers: WHERE approver_id = $1 AND status IN ('PENDING','RETURNED')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_steps_approver_status
  ON approval_steps(approver_id, status);

-- Covers: ORDER BY step_order + step activation in advanceWorkflow
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_steps_application_order
  ON approval_steps(application_id, step_order);

-- ── Template permission matrix (cached 24h but hit on cache miss) ─────────────
-- Covers: WHERE department_id = $1 AND access_level IN ('MUST','SHOULD','COULD')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_template_permissions_dept_access
  ON template_permissions(department_id, access_level)
  WHERE access_level IN ('MUST', 'SHOULD', 'COULD');

-- ── Settlement list (accounting dashboard) ────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlements_status_created
  ON settlements(status, created_at DESC);

-- ── Application list (applicant's own applications) ───────────────────────────
-- Covers: WHERE applicant_id = $1 ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_applicant_created
  ON applications(applicant_id, created_at DESC);

-- ── Login lookup (email is UNIQUE but explicit index helps planner) ────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users(email);

-- ── Admin user list (filter by dept + role) ───────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_dept_role_active
  ON users(department_id, role)
  WHERE is_active = true;

-- ── Dashboard stats queries (now Redis-cached but still need fast DB hits) ─────
-- pending_approvals uses idx_approval_steps_approver_status (above) ✓
-- active_submissions / drafts: applicant_id + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_applicant_status
  ON applications(applicant_id, status);

-- monthly_settlements: status + settled_at (accounting only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlements_settled_at
  ON settlements(status, settled_at)
  WHERE status = 'SETTLED';
