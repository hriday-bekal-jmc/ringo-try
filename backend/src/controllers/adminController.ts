import { Request, Response } from 'express';
import { query, pool } from '../config/db';
import { CacheService, CacheKeys } from '../services/cacheService';
import { z } from 'zod';

const UpdateUserSchema = z.object({
  departmentId: z.string().uuid().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'GM', 'PRESIDENT', 'ACCOUNTING', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  reportsTo: z.string().uuid().nullable().optional(),
});

const DelegationSchema = z.object({
  delegateeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const AdminController = {
  async listUsers(req: Request, res: Response): Promise<void> {
    const { departmentId, role } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (departmentId) { params.push(departmentId); conditions.push(`u.department_id = $${params.length}`); }
    if (role)         { params.push(role);          conditions.push(`u.role = $${params.length}`); }

    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.created_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY u.full_name`,
      params
    );

    res.json(result.rows);
  },

  /** Update a user's department, role, or active status. Invalidates Redis cache. */
  async updateUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    const { departmentId, role, isActive, reportsTo } = parsed.data;
    if (departmentId !== undefined) { params.push(departmentId); updates.push(`department_id = $${params.length}`); }
    if (role !== undefined)         { params.push(role);         updates.push(`role = $${params.length}`); }
    if (isActive !== undefined)     { params.push(isActive);     updates.push(`is_active = $${params.length}`); }
    if (reportsTo !== undefined)    { params.push(reportsTo);    updates.push(`reports_to = $${params.length}`); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update.' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      params.push(userId);
      await client.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params
      );
      await client.query('COMMIT');

      // Invalidate affected Redis keys
      await CacheService.del(CacheKeys.userProfile(userId));
      await CacheService.invalidateByPattern('org:department:*');
      await CacheService.del(CacheKeys.globalMatrix());
      await CacheService.invalidateByPattern('matrix:template:*');

      res.json({ message: 'User updated and cache synchronized.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Create a delegation entry (manager going on leave). */
  async createDelegation(req: Request, res: Response): Promise<void> {
    const delegatorId = req.params.userId;
    const parsed = DelegationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { delegateeId, startDate, endDate } = parsed.data;

    const result = await query<{ id: string }>(
      `INSERT INTO delegations (delegator_id, delegatee_id, start_date, end_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [delegatorId, delegateeId, startDate, endDate]
    );

    res.status(201).json(result.rows[0]);
  },

  async listDelegations(req: Request, res: Response): Promise<void> {
    const result = await query(
      `SELECT d.*,
              u1.full_name AS delegator_name,
              u2.full_name AS delegatee_name
       FROM delegations d
       JOIN users u1 ON u1.id = d.delegator_id
       JOIN users u2 ON u2.id = d.delegatee_id
       WHERE d.is_active = true
       ORDER BY d.start_date`
    );
    res.json(result.rows);
  },

  async listDepartments(_req: Request, res: Response): Promise<void> {
    const result = await query(
      `SELECT d.*, parent.name AS parent_name
       FROM departments d
       LEFT JOIN departments parent ON parent.id = d.parent_id
       ORDER BY d.name`
    );
    res.json(result.rows);
  },
};
