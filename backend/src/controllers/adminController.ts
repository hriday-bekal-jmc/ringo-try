import { Request, Response } from 'express';
import { query, pool } from '../config/db';
import { CacheService, CacheKeys } from '../services/cacheService';
import { z } from 'zod';
import * as argon2 from 'argon2';

const ROLES = z.enum(['EMPLOYEE', 'MANAGER', 'GM', 'PRESIDENT', 'ACCOUNTING', 'ADMIN']);

const CreateUserSchema = z.object({
  fullName:     z.string().min(1, '氏名は必須です'),
  email:        z.string().email('メールアドレスの形式が正しくありません'),
  password:     z.string().min(8, 'パスワードは8文字以上です'),
  role:         ROLES,
  departmentId: z.string().uuid().nullable().optional(),
  reportsTo:    z.string().uuid().nullable().optional(),
});

const UpdateUserSchema = z.object({
  fullName:     z.string().min(1).optional(),
  email:        z.string().email().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  role:         ROLES.optional(),
  isActive:     z.boolean().optional(),
  reportsTo:    z.string().uuid().nullable().optional(),
});

const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'パスワードは8文字以上です'),
});

const DelegationSchema = z.object({
  delegateeId: z.string().uuid(),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const AdminController = {
  async listUsers(req: Request, res: Response): Promise<void> {
    const { departmentId, role, search } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (departmentId) { params.push(departmentId); conditions.push(`u.department_id = $${params.length}`); }
    if (role)         { params.push(role);          conditions.push(`u.role = $${params.length}`); }
    if (search && String(search).length >= 1) {
      params.push(`%${search}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.created_at, u.updated_at,
              u.department_id,
              d.name AS department_name,
              r.full_name AS reports_to_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users r ON r.id = u.reports_to
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY u.full_name`,
      params
    );

    res.json(result.rows);
  },

  async getUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.created_at, u.updated_at,
              u.department_id, u.reports_to,
              d.name AS department_name,
              r.full_name AS reports_to_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN users r ON r.id = u.reports_to
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json(result.rows[0]);
  },

  async createUser(req: Request, res: Response): Promise<void> {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const { fullName, email, password, role, departmentId, reportsTo } = parsed.data;
    const passwordHash = await argon2.hash(password);

    const result = await query<{ id: string }>(
      `INSERT INTO users (full_name, email, password_hash, role, department_id, reports_to, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [fullName, email, passwordHash, role, departmentId ?? null, reportsTo ?? null]
    );

    await CacheService.invalidateByPattern('org:department:*');
    await CacheService.del(CacheKeys.globalMatrix());

    res.status(201).json({ id: result.rows[0].id, message: 'ユーザーを作成しました。' });
  },

  async updateUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    const { fullName, email, departmentId, role, isActive, reportsTo } = parsed.data;
    if (fullName !== undefined)     { params.push(fullName);     updates.push(`full_name = $${params.length}`); }
    if (email !== undefined)        { params.push(email);        updates.push(`email = $${params.length}`); }
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
      const result = await client.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id`,
        params
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      await client.query('COMMIT');

      await CacheService.del(CacheKeys.userProfile(userId));
      await CacheService.invalidateByPattern('org:department:*');
      await CacheService.del(CacheKeys.globalMatrix());
      await CacheService.invalidateByPattern('matrix:template:*');

      res.json({ message: 'ユーザー情報を更新しました。' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
      return;
    }

    const passwordHash = await argon2.hash(parsed.data.password);
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );

    res.json({ message: 'パスワードをリセットしました。' });
  },

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

  async listDelegations(_req: Request, res: Response): Promise<void> {
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
