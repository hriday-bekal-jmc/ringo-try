import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { CacheService, CacheKeys, TTL } from '../services/cacheService';

export interface JwtPayload {
  userId: string;
  role: string;
  departmentId: string | null;
  email: string;
}

declare global {
  namespace Express {
    interface User extends JwtPayload {}
  }
}

interface UserProfile {
  role: string;
  department_id: string | null;
  is_active: boolean;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  let decoded: JwtPayload;
  try {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
    decoded = jwt.verify(token, secret) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  // Always resolve the live role + active status from Redis → DB fallback.
  // This ensures role changes made by an admin take effect on the very next
  // request without requiring the affected user to log out and back in.
  // The cache entry is deleted by adminController.updateUser on every role change.
  const cacheKey = CacheKeys.userProfile(decoded.userId);
  let profile = await CacheService.get<UserProfile>(cacheKey);

  if (!profile) {
    const result = await query<UserProfile>(
      `SELECT role, department_id, is_active FROM users WHERE id = $1`,
      [decoded.userId]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(401).json({ error: 'Account not found.' });
      return;
    }
    profile = row;
    // Cache so subsequent requests within the same session are free
    await CacheService.set(cacheKey, profile, TTL.USER_PROFILE);
  }

  if (!profile.is_active) {
    res.status(401).json({ error: 'Account has been deactivated.' });
    return;
  }

  req.user = {
    userId:       decoded.userId,
    email:        decoded.email,
    role:         profile.role,
    departmentId: profile.department_id,
  };

  next();
}
