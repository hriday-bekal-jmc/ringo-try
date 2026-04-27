import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}
