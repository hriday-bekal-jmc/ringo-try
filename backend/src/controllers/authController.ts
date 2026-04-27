import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { query } from '../config/db';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
  domain: process.env.COOKIE_DOMAIN ?? 'localhost',
};

function issueToken(res: Response, payload: object): void {
  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  });
  res.cookie('token', token, COOKIE_OPTIONS);
}

export const AuthController = {
  /** Standard email + password login */
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const result = await query<{
      id: string;
      role: string;
      department_id: string;
      email: string;
      full_name: string;
      password_hash: string;
      is_active: boolean;
    }>(
      `SELECT id, role, department_id, email, full_name, password_hash, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash || !user.is_active) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    issueToken(res, {
      userId: user.id,
      role: user.role,
      departmentId: user.department_id,
      email: user.email,
    });

    res.json({ id: user.id, fullName: user.full_name, email: user.email, role: user.role });
  },

  /** Google OAuth callback — called after Passport validates the token */
  async googleCallback(req: Request, res: Response): Promise<void> {
    const user = req.user as { userId: string; role: string; departmentId: string; email: string } | undefined;
    if (!user) {
      res.status(401).json({ error: 'Google authentication failed.' });
      return;
    }

    issueToken(res, user);
    res.redirect(process.env.FRONTEND_URL ?? 'http://localhost:5173');
  },

  async me(req: Request, res: Response): Promise<void> {
    const result = await query<{
      id: string;
      full_name: string;
      email: string;
      role: string;
      department_id: string;
    }>(
      `SELECT id, full_name, email, role, department_id FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json(user);
  },

  logout(_req: Request, res: Response): void {
    res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });
    res.json({ message: 'Logged out successfully.' });
  },
};
