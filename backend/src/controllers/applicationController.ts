import { Request, Response } from 'express';
import { query, pool } from '../config/db';
import { WorkflowEngine, ApproverStep } from '../services/workflowEngine';
import { sseManager } from '../services/sseService';
import { CacheService, CacheKeys } from '../services/cacheService';
import { z } from 'zod';

const CreateApplicationSchema = z.object({
  templateId: z.string().uuid(),
  formData: z.record(z.unknown()),
  approvers: z.array(z.object({ approverId: z.string().uuid(), stepOrder: z.number().int().positive() })).optional(),
  isDraft: z.boolean().optional(),
});

const SubmitDraftSchema = z.object({
  approvers: z.array(z.object({ approverId: z.string().uuid(), stepOrder: z.number().int().positive() })),
  version: z.number().int().positive(),
  formData: z.record(z.unknown()).optional(),
});

const UpdateApplicationSchema = z.object({
  formData: z.record(z.unknown()),
  version: z.number().int().positive(),
});

export const ApplicationController = {
  async create(req: Request, res: Response): Promise<void> {
    const parsed = CreateApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { templateId, formData, approvers, isDraft } = parsed.data;
    const applicantId = req.user!.userId;

    if (!isDraft && (!approvers || approvers.length === 0)) {
      res.status(400).json({ error: '承認者を1名以上選択してください。' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generate year-scoped application number atomically inside the transaction.
      // ON CONFLICT DO UPDATE is atomic — safe under concurrent inserts.
      const seqResult = await client.query<{ year: number; seq: number }>(
        `INSERT INTO application_year_seq (year, seq)
         VALUES (EXTRACT(YEAR FROM NOW())::INT, 1)
         ON CONFLICT (year)
         DO UPDATE SET seq = application_year_seq.seq + 1
         RETURNING year, seq`
      );
      const { year, seq } = seqResult.rows[0];
      const applicationNumber = `${year}-${String(seq).padStart(5, '0')}`;

      const result = await client.query<{ id: string }>(
        `INSERT INTO applications (applicant_id, template_id, form_data, status, application_number)
         VALUES ($1, $2, $3, 'DRAFT', $4)
         RETURNING id`,
        [applicantId, templateId, JSON.stringify(formData), applicationNumber]
      );

      const { id: applicationId } = result.rows[0];
      const application_number = applicationNumber;

      await client.query('COMMIT');
      client.release();

      if (!isDraft && approvers && approvers.length > 0) {
        await WorkflowEngine.createApprovalSteps(applicationId, approvers as ApproverStep[]);
        await query(
          `UPDATE applications SET status = 'PENDING_APPROVAL', updated_at = NOW() WHERE id = $1`,
          [applicationId]
        );
        await WorkflowEngine.logAudit(applicationId, applicantId, 'SUBMIT', { templateId });
        await notifyOnSubmit(applicationId, applicantId);
      }

      // Applicant's draft count changed regardless
      await CacheService.del(CacheKeys.dashboardStats(applicantId));
      sseManager.send(applicantId, { type: 'stats_update' });

      res.status(201).json({ id: applicationId, application_number });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  },

  async submitDraft(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parsed = SubmitDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { approvers, version, formData } = parsed.data;
    const { userId } = req.user!;

    const result = await query<{ id: string }>(
      formData
        ? `UPDATE applications
           SET form_data = $4, status = 'PENDING_APPROVAL', version = version + 1, updated_at = NOW()
           WHERE id = $1 AND version = $2 AND status = 'DRAFT' AND applicant_id = $3
           RETURNING id`
        : `UPDATE applications
           SET status = 'PENDING_APPROVAL', version = version + 1, updated_at = NOW()
           WHERE id = $1 AND version = $2 AND status = 'DRAFT' AND applicant_id = $3
           RETURNING id`,
      formData ? [id, version, userId, JSON.stringify(formData)] : [id, version, userId]
    );

    if (result.rows.length === 0) {
      res.status(409).json({ error: 'Draft not found, already submitted, or version conflict.' });
      return;
    }

    await WorkflowEngine.createApprovalSteps(id, approvers as ApproverStep[]);
    await WorkflowEngine.logAudit(id, userId, 'SUBMIT', {});

    await notifyOnSubmit(id, userId);
    await CacheService.del(CacheKeys.dashboardStats(userId));
    sseManager.send(userId, { type: 'stats_update' });

    res.json({ message: 'Application submitted successfully.' });
  },

  async listMine(req: Request, res: Response): Promise<void> {
    const { userId } = req.user!;
    const { status } = req.query;

    const conditions = ['a.applicant_id = $1'];
    const params: unknown[] = [userId];

    if (status) {
      conditions.push(`a.status = $${params.length + 1}`);
      params.push(status);
    }

    const result = await query(
      `SELECT
         a.id, a.application_number, a.status, a.version,
         ft.title AS template_title, ft.title_en,
         a.created_at, a.updated_at
       FROM applications a
       JOIN form_templates ft ON ft.id = a.template_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC`,
      params
    );

    res.json(result.rows);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { userId, role } = req.user!;

    const appResult = await query(
      `SELECT
         a.*, ft.title AS template_title, ft.schema_definition,
         wp.pattern_code, u.full_name AS applicant_name
       FROM applications a
       JOIN form_templates ft ON ft.id = a.template_id
       JOIN workflow_patterns wp ON wp.id = ft.pattern_id
       JOIN users u ON u.id = a.applicant_id
       WHERE a.id = $1`,
      [id]
    );

    if (appResult.rows.length === 0) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }

    const app = appResult.rows[0] as { applicant_id: string };

    // Employees can only view their own applications
    if (role === 'EMPLOYEE' && app.applicant_id !== userId) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const stepsResult = await query(
      `SELECT s.*, u.full_name AS approver_name
       FROM approval_steps s
       JOIN users u ON u.id = s.approver_id
       WHERE s.application_id = $1
       ORDER BY s.step_order`,
      [id]
    );

    res.json({ ...appResult.rows[0], steps: stepsResult.rows });
  },

  /** Optimistic lock: only updates if the version matches. */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parsed = UpdateApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { formData, version } = parsed.data;

    const result = await query<{ id: string; version: number }>(
      `UPDATE applications
       SET form_data = $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 AND version = $3 AND status = 'DRAFT'
       RETURNING id, version`,
      [JSON.stringify(formData), id, version]
    );

    if (result.rows.length === 0) {
      res.status(409).json({
        error: 'Conflict: the application was modified by another session. Please refresh and try again.',
      });
      return;
    }

    res.json(result.rows[0]);
  },

  /**
   * Resubmit a RETURNED application with updated form data.
   * Resets the entire approval chain from step 1 so the chain runs again in order.
   */
  async resubmit(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parsed = UpdateApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { formData, version } = parsed.data;
    const { userId } = req.user!;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<{ id: string }>(
        `UPDATE applications
         SET form_data = $1, version = version + 1, status = 'PENDING_APPROVAL', updated_at = NOW()
         WHERE id = $2 AND version = $3 AND status = 'RETURNED' AND applicant_id = $4
         RETURNING id`,
        [JSON.stringify(formData), id, version, userId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: 'Application not found, not in RETURNED status, or version conflict.',
        });
        return;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await WorkflowEngine.resetApprovalChain(id);
    await WorkflowEngine.logAudit(id, userId, 'RESUBMIT', {});

    await notifyOnSubmit(id, userId);
    await CacheService.del(CacheKeys.dashboardStats(userId));
    sseManager.send(userId, { type: 'stats_update' });

    res.json({ message: 'Application resubmitted successfully.' });
  },

  /** Returns users with approver roles, searchable via pg_trgm. */
  async getApprovers(req: Request, res: Response): Promise<void> {
    const { search, departmentId } = req.query;
    const params: unknown[] = [];
    const conditions = ["u.role IN ('MANAGER', 'GM', 'PRESIDENT', 'ADMIN') AND u.is_active = true"];

    if (search && String(search).length >= 2) {
      params.push(search);
      conditions.push(`u.full_name ILIKE '%' || $${params.length} || '%'`);
    }

    if (departmentId) {
      params.push(departmentId);
      conditions.push(`u.department_id = $${params.length}`);
    }

    const result = await query(
      `SELECT u.id, u.full_name, u.role, u.email, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY similarity(u.full_name, $1) DESC NULLS LAST, u.full_name
       LIMIT 20`,
      params
    );

    res.json(result.rows);
  },
};

// Notify the first pending approver after any submit / resubmit
async function notifyOnSubmit(applicationId: string, applicantId: string): Promise<void> {
  const row = await query<{ approver_id: string }>(
    `SELECT approver_id FROM approval_steps
     WHERE application_id = $1 AND status = 'PENDING'
     ORDER BY step_order ASC LIMIT 1`,
    [applicationId]
  );
  const firstApproverId = row.rows[0]?.approver_id;
  if (firstApproverId) {
    await CacheService.del(CacheKeys.dashboardStats(firstApproverId));
    sseManager.send(firstApproverId, { type: 'inbox_update' });
    sseManager.send(firstApproverId, { type: 'stats_update' });
  }
  // If the applicant and approver are different, applicant's application list changed too
  if (firstApproverId !== applicantId) {
    sseManager.send(applicantId, { type: 'application_update', data: { applicationId } });
  }
}
