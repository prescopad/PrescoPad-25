import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as NotificationService from '../services/notification.service';

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notifications = await NotificationService.getPendingNotifications(req.userId!);

    res.json({
      success: true,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        payload: n.payload,
        scheduledAt: n.scheduled_at,
        status: n.status,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    await NotificationService.markNotificationSent(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
