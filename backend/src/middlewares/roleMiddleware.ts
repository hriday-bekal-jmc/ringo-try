import { Request, Response, NextFunction } from 'express';

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}

export const ROLES = {
  EMPLOYEE:   'EMPLOYEE',
  MANAGER:    'MANAGER',
  GM:         'GM',
  PRESIDENT:  'PRESIDENT',
  ACCOUNTING: 'ACCOUNTING',
  ADMIN:      'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const APPROVER_ROLES = [ROLES.MANAGER, ROLES.GM, ROLES.PRESIDENT, ROLES.ADMIN];
export const ALL_ROLES = Object.values(ROLES);
