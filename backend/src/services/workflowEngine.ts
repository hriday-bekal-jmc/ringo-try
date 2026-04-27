import { query } from '../config/db';

export interface ApproverStep {
  approverId: string;
  stepOrder: number;
}

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'RETURN';

// Maps the action verb to a past-tense step status stored in the DB
const ACTION_TO_STATUS: Record<WorkflowAction, string> = {
  APPROVE: 'APPROVED',
  REJECT:  'REJECTED',
  RETURN:  'RETURNED',
};

export const WorkflowEngine = {
  async resolveApprover(approverId: string, date = new Date()): Promise<string> {
    const dateStr = date.toISOString().split('T')[0];
    const result = await query<{ delegatee_id: string }>(
      `SELECT delegatee_id FROM delegations
       WHERE delegator_id = $1
         AND is_active = true
         AND start_date <= $2
         AND end_date >= $2
       LIMIT 1`,
      [approverId, dateStr]
    );
    return result.rows[0]?.delegatee_id ?? approverId;
  },

  /**
   * Creates approval_steps for a newly submitted application.
   * Only the first step (lowest step_order) starts as PENDING.
   * All subsequent steps are WAITING — they activate one at a time as each step is approved.
   */
  async createApprovalSteps(applicationId: string, steps: ApproverStep[]): Promise<void> {
    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

    for (let i = 0; i < sorted.length; i++) {
      const step = sorted[i];
      const resolvedApproverId = await this.resolveApprover(step.approverId);
      const status = i === 0 ? 'PENDING' : 'WAITING';
      await query(
        `INSERT INTO approval_steps (application_id, step_order, approver_id, status)
         VALUES ($1, $2, $3, $4)`,
        [applicationId, step.stepOrder, resolvedApproverId, status]
      );
    }

    await query(
      `UPDATE applications SET status = 'PENDING_APPROVAL', updated_at = NOW() WHERE id = $1`,
      [applicationId]
    );
  },

  /**
   * Resets the approval chain after a RETURN — step 1 becomes PENDING again,
   * all other steps go back to WAITING. Called by applicationController.resubmit.
   */
  async resetApprovalChain(applicationId: string): Promise<void> {
    await query(
      `UPDATE approval_steps
       SET status = 'WAITING', action_at = NULL, comments = NULL
       WHERE application_id = $1`,
      [applicationId]
    );
    await query(
      `UPDATE approval_steps SET status = 'PENDING'
       WHERE application_id = $1
         AND step_order = (SELECT MIN(step_order) FROM approval_steps WHERE application_id = $1)`,
      [applicationId]
    );
  },

  /**
   * Processes an approval action on the currently PENDING step.
   * APPROVE: activates the next WAITING step, or finalises the application.
   * REJECT:  terminates the chain; remaining WAITING steps are SKIPPED.
   * RETURN:  sends back to applicant; remaining WAITING steps stay intact for resubmit.
   */
  async advanceWorkflow(
    applicationId: string,
    action: WorkflowAction,
    actorId: string,
    comment?: string
  ): Promise<void> {
    const stepResult = await query<{ id: string; step_order: number; approver_id: string }>(
      `SELECT id, step_order, approver_id FROM approval_steps
       WHERE application_id = $1 AND status = 'PENDING'
       ORDER BY step_order ASC
       LIMIT 1`,
      [applicationId]
    );

    const currentStep = stepResult.rows[0];
    if (!currentStep) {
      throw new Error(`No pending approval step found for application ${applicationId}`);
    }

    if (currentStep.approver_id !== actorId) {
      throw new Error('You are not the designated approver for this step.');
    }

    const stepStatus = ACTION_TO_STATUS[action];
    await query(
      `UPDATE approval_steps SET status = $1, comments = $2, action_at = NOW() WHERE id = $3`,
      [stepStatus, comment ?? null, currentStep.id]
    );

    await this.logAudit(applicationId, actorId, action, { stepOrder: currentStep.step_order, comment });

    if (action === 'REJECT') {
      await query(
        `UPDATE applications SET status = 'REJECTED', updated_at = NOW() WHERE id = $1`,
        [applicationId]
      );
      await query(
        `UPDATE approval_steps SET status = 'SKIPPED' WHERE application_id = $1 AND status = 'WAITING'`,
        [applicationId]
      );
      return;
    }

    if (action === 'RETURN') {
      await query(
        `UPDATE applications SET status = 'RETURNED', updated_at = NOW() WHERE id = $1`,
        [applicationId]
      );
      // Remaining WAITING steps stay intact — they will be reactivated on resubmit
      return;
    }

    // APPROVE — activate the next waiting step in the chain
    const nextStepResult = await query<{ id: string }>(
      `SELECT id FROM approval_steps
       WHERE application_id = $1 AND step_order > $2 AND status = 'WAITING'
       ORDER BY step_order ASC
       LIMIT 1`,
      [applicationId, currentStep.step_order]
    );

    if (nextStepResult.rows.length > 0) {
      await query(
        `UPDATE approval_steps SET status = 'PENDING' WHERE id = $1`,
        [nextStepResult.rows[0].id]
      );
      return; // Still in PENDING_APPROVAL — next approver's turn
    }

    // All steps approved — determine pattern to finalise
    const patternResult = await query<{ pattern_code: string }>(
      `SELECT wp.pattern_code FROM applications a
       JOIN form_templates ft ON ft.id = a.template_id
       JOIN workflow_patterns wp ON wp.id = ft.pattern_id
       WHERE a.id = $1`,
      [applicationId]
    );

    const patternCode = patternResult.rows[0]?.pattern_code;

    if (patternCode === 'PATTERN_1') {
      await query(
        `UPDATE applications SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [applicationId]
      );
    } else if (patternCode === 'PATTERN_2' || patternCode === 'PATTERN_3') {
      await query(
        `UPDATE applications SET status = 'PENDING_SETTLEMENT', updated_at = NOW() WHERE id = $1`,
        [applicationId]
      );

      const appResult = await query<{ form_data: Record<string, unknown> }>(
        `SELECT form_data FROM applications WHERE id = $1`,
        [applicationId]
      );
      const estimatedPrice = appResult.rows[0]?.form_data?.estimated_price;
      const expectedAmount = estimatedPrice ? parseFloat(String(estimatedPrice)) : 0;

      await query(
        `INSERT INTO settlements (application_id, expected_amount)
         VALUES ($1, $2)
         ON CONFLICT (application_id) DO NOTHING`,
        [applicationId, expectedAmount]
      );
    }
  },

  async logAudit(
    applicationId: string,
    actorId: string,
    action: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await query(
      `INSERT INTO audit_logs (application_id, actor_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [applicationId, actorId, action, JSON.stringify(metadata)]
    );
  },
};
