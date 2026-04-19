import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import * as AnalyticsService from '../services/analytics.service';

function requireClinic(req: AuthRequest): string {
  if (!req.clinicId) throw new AppError('No clinic associated', 400);
  return req.clinicId;
}

export async function getAnalytics(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const period = (req.query.period as 'today' | 'week' | 'month') || 'today';

    if (!['today', 'week', 'month'].includes(period)) {
      throw new AppError('Invalid period. Use: today, week, or month', 400);
    }

    const analytics = await AnalyticsService.getComprehensiveAnalytics(clinicId, period);
    res.json({ success: true, analytics, period });
  } catch (error) {
    next(error);
  }
}
