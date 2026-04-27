import { Request, Response } from 'express';
import { query } from '../config/db';
import { WorkflowEngine, WorkflowAction } from '../services/workflowEngine';
import { sseManager } from '../services/sseService';
import { CacheService, CacheKeys } from '../services/cacheService';
import { z } from 'zod';

const ActionSchema = z.object({
  action:  z.enum(['APPROVE', 'REJECT', 'RETURN']),
  comment: z.string().optional(),
});

export const ApprovalController = {
  /** Returns PENDING + RETURNED approval steps for the current user. */
  async inbox(req: Request, res: Response): Promise<void> {
    const { userId } = req.user!;

    const result = await query(
      `SELECT
         a.id, a.application_number, a.status, a.created_at,
         ft.title AS template_title,
         u.full_name AS applicant_name,
         s.step_order, s.created_at AS step_created_at,
         s.status AS step_status
       FROM approval_steps s
       JOIN applications a ON a.id = s.application_id
       JOIN form_templates ft ON ft.id = a.template_id
       JOIN users u ON u.id = a.applicant_id
       WHERE s.approver_id = $1 AND s.status IN ('PENDING', 'RETURNED')
       ORDER BY s.status ASC, s.created_at ASC`,
      [userId]
    );

    res.json(result.rows);
  },

  /** APPROVE, REJECT, or RETURN — then push SSE events to all affected users. */
  async takeAction(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parsed = ActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { action, comment } = parsed.data;

    if ((action === 'REJECT' || action === 'RETURN') && !comment) {
      res.status(400).json({ error: 'A comment is required when rejecting or returning an application.' });
      return;
    }

    const actorId = req.user!.userId;
    await WorkflowEngine.advanceWorkflow(id, action as WorkflowAction, actorId, comment);

    // Look up applicant + next pending approver in one query
    const notifyRow = await query<{ applicant_id: string; next_approver_id: string | null }>(
      `SELECT
         a.applicant_id,
         (SELECT approver_id FROM approval_steps
          WHERE application_id = a.id AND status = 'PENDING'
          ORDER BY step_order ASC LIMIT 1) AS next_approver_id
       FROM applications a
       WHERE a.id = $1`,
      [id]
    );

    const { applicant_id, next_approver_id } = notifyRow.rows[0] ?? {};

    // Collect all user IDs whose dashboard stats are now stale
    const statsUsers: string[] = [actorId];
    if (applicant_id && applicant_id !== actorId) statsUsers.push(applicant_id);
    if (next_approver_id && next_approver_id !== actorId) statsUsers.push(next_approver_id);

    // Invalidate Redis dashboard-stats caches so next fetch hits fresh DB data
    await Promise.all(statsUsers.map((uid) => CacheService.del(CacheKeys.dashboardStats(uid))));

    // Push SSE events — only to users who are currently connected
    sseManager.send(actorId, { type: 'inbox_update' });
    sseManager.send(actorId, { type: 'stats_update' });

    if (applicant_id) {
      sseManager.send(applicant_id, {
        type: 'application_update',
        data: { applicationId: id },
      });
      sseManager.send(applicant_id, { type: 'stats_update' });
    }

    if (next_approver_id && next_approver_id !== actorId) {
      sseManager.send(next_approver_id, { type: 'inbox_update' });
      sseManager.send(next_approver_id, { type: 'stats_update' });
    }

    res.json({ message: `Application ${action.toLowerCase()}d successfully.` });
  },
};
