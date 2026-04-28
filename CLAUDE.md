# RINGO — Project Guide for Claude

Internal workflow + settlement system replacing Rakumo SaaS.
Manages employee ringi (申請), multi-step approval chains, monetary settlements, receipt handling.

## Commands

```bash
# Backend
cd backend && npm run dev          # ts-node-dev on port 3000
cd backend && npm run worker       # BullMQ CSV export worker
cd backend && npm run build        # tsc compile

# Frontend
cd frontend && npm run dev         # Vite on port 5173

# DB migrations (run in order)
psql $DATABASE_URL -f backend/migrations/001_initial_schema.sql
psql $DATABASE_URL -f backend/migrations/002_form_templates.sql
psql $DATABASE_URL -f backend/migrations/003_year_application_numbers.sql
psql $DATABASE_URL -f backend/migrations/004_perf_indexes.sql
```

## Stack

| Layer | Tech |
|---|---|
| Backend | Express + TypeScript, `express-async-errors`, `zod` validation |
| Auth | JWT in HttpOnly cookie, Argon2 password hash, optional Google OAuth |
| Database | PostgreSQL — `pg.Pool`, raw SQL (no ORM) |
| Cache | Redis via `ioredis`, cache-aside pattern, SCAN not KEYS |
| Queue | BullMQ on Redis — async CSV export only |
| Storage | Google Drive — Node never handles file bytes, direct upload via resumable URL |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| State | TanStack Query v5 — SSE events invalidate cache, no polling |
| Forms | react-hook-form uncontrolled inputs + zod schema |
| Realtime | SSE (`/api/events/stream`) — one connection per session via `useRealtimeSync` |

## Architecture Rules

- **No ORM** — all queries use `query()` wrapper in `backend/src/config/db.ts`
- **No new tables for new form types** — use JSONB `schema_definition` in `form_templates`
- **Optimistic locking** — `applications.version` column; 409 on conflict
- **Delegation** — always call `WorkflowEngine.resolveApprover()` before routing approval step
- **Cache invalidation** — call `CacheService.del(CacheKeys.userProfile(id))` on any role change; `CacheKeys.dashboardStats(id)` on any stat change
- **Redis optional** — app runs without Redis (caching + BullMQ disabled gracefully)
- **React.memo** — only on `AccountingGrid`; never on form inputs

## Key Files

```
backend/src/
  config/         db.ts · redis.ts · gdrive.ts
  middlewares/    authMiddleware.ts · roleMiddleware.ts
  services/       workflowEngine.ts · cacheService.ts · storageService.ts · sseService.ts
  controllers/    auth · template · application · approval · settlement · dashboard · admin · events
  routes/         (mirrors controllers)
  workers/        csvExportWorker.ts
  server.ts

frontend/src/
  context/        AuthContext.tsx
  hooks/          useApplication.ts  ← all React Query hooks
                  useRealtimeSync.ts ← SSE → cache invalidation
                  useAdmin.ts
  components/
    common/       Sidebar · Header · Modal · RingoLogo
    forms/        DynamicForm · StandardInput
    workflow/     ApprovalTimeline
  pages/          Dashboard · Application · ApplicationDetail · MyApplications
                  ApprovalInbox · Accounting · Admin · Login
  services/       apiClient.ts · gdriveClient.ts
```

## Roles

`EMPLOYEE` · `MANAGER` · `GM` · `PRESIDENT` · `ACCOUNTING` · `ADMIN`

Approver roles: `MANAGER`, `GM`, `PRESIDENT`, `ADMIN`

## Application Status Flow

```
DRAFT → PENDING_APPROVAL → APPROVED → PENDING_SETTLEMENT → SETTLED
                         → REJECTED
                         → RETURNED → (applicant edits) → PENDING_APPROVAL
```

## Sidebar Navigation (Rakumo-compatible)

```
ダッシュボード        /
申請
  全ての申請          /applications
  申請結果            /applications?view=results
承認  (approver roles only)
  全ての承認          /inbox?view=all
  承認予定            /inbox
  作業予定            /inbox?view=waiting
経理  (ACCOUNTING/ADMIN)
  経理・精算          /accounting
管理  (ADMIN)
  管理者設定          /admin
```

## API Routes

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout

GET    /api/templates
GET    /api/templates/:id

GET    /api/applications               (mine)
POST   /api/applications               (create / isDraft)
GET    /api/applications/approvers
GET    /api/applications/:id
PUT    /api/applications/:id           (optimistic update, DRAFT only)
POST   /api/applications/:id/submit    (submit draft)
POST   /api/applications/:id/resubmit  (after RETURNED)

GET    /api/applications/approvals/inbox    (PENDING + RETURNED)
GET    /api/applications/approvals/history  (all statuses, approver's history)
GET    /api/applications/approvals/waiting  (WAITING steps)
POST   /api/applications/approvals/:id/action

GET    /api/dashboard/stats

GET    /api/events/stream              (SSE)

GET    /api/settlements
GET    /api/settlements/:id
POST   /api/settlements/upload-url
POST   /api/settlements/:id/receipts
POST   /api/settlements/:id/settle
POST   /api/settlements/export         (→ BullMQ, returns 202)
GET    /api/settlements/export/status

GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
GET    /api/admin/departments
POST   /api/admin/delegations
```

## Database Tables

`departments` · `users` · `delegations` · `workflow_patterns` · `form_templates` · `template_permissions` · `applications` · `application_year_seq` · `approval_steps` · `settlements` · `receipts` · `audit_logs`

Application numbers: `YYYY-NNNNN` format, per-year sequence via `application_year_seq` table + `next_application_number()` PG function.

## Environment Variables

```
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/ringo
REDIS_URL=redis://localhost:6379
JWT_SECRET=
JWT_EXPIRES_IN=8h
COOKIE_DOMAIN=localhost
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GDRIVE_SERVICE_ACCOUNT_PATH=./secrets/gdrive-service-account.json
GDRIVE_FOLDER_ID=
FRONTEND_URL=http://localhost:5173
PORT=3000

# frontend/.env
VITE_API_URL=http://localhost:3000
```
