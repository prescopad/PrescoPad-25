import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requireDoctor(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'doctor') {
    res.status(403).json({ error: 'Doctor access required' });
    return;
  }
  next();
}
