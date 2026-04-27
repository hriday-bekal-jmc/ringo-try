import { Request, Response } from 'express';
import { query } from '../config/db';
import { CacheService, CacheKeys, TTL } from '../services/cacheService';

interface DashboardStats {
  pending_approvals: number;
  active_submissions: number;
  drafts: number;
  monthly_settlements: number;
}

export const DashboardController = {
  async stats(req: Request, res: Response): Promise<void> {
    const { userId, role } = req.user!;

    // Serve from Redis when available — SSE invalidates on every relevant action
    const cacheKey = CacheKeys.dashboardStats(userId);
    const cached = await CacheService.get<DashboardStats>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const [pendingApprovals, activeSubmissions, drafts, monthlySettlements] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM approval_steps WHERE approver_id = $1 AND status = 'PENDING'`,
        [userId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM applications WHERE applicant_id = $1 AND status = 'PENDING_APPROVAL'`,
        [userId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM applications WHERE applicant_id = $1 AND status = 'DRAFT'`,
        [userId]
      ),
      ['ACCOUNTING', 'ADMIN'].includes(role)
        ? query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM settlements
             WHERE status = 'SETTLED'
               AND DATE_TRUNC('month', settled_at) = DATE_TRUNC('month', NOW())`
          )
        : Promise.resolve({ rows: [{ count: '0' }] }),
    ]);

    const stats: DashboardStats = {
      pending_approvals:   parseInt(pendingApprovals.rows[0]?.count   ?? '0', 10),
      active_submissions:  parseInt(activeSubmissions.rows[0]?.count  ?? '0', 10),
      drafts:              parseInt(drafts.rows[0]?.count             ?? '0', 10),
      monthly_settlements: parseInt(monthlySettlements.rows[0]?.count ?? '0', 10),
    };

    await CacheService.set(cacheKey, stats, TTL.DASHBOARD_STATS);
    res.json(stats);
  },
};
