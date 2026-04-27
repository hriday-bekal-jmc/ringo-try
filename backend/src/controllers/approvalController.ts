import { Request, Response } from 'express';
import { query } from '../config/db';
import { WorkflowEngine, WorkflowAction } from '../services/workflowEngine';
import { z } from 'zod';

const ActionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'RETURN']),
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

  /** Approve, Reject, or Return an application from the inbox. */
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

    await WorkflowEngine.advanceWorkflow(id, action as WorkflowAction, req.user!.userId, comment);

    res.json({ message: `Application ${action.toLowerCase()}d successfully.` });
  },
};
