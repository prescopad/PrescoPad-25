import { query, queryOne } from '../config/database';

interface NotificationJob {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
}

export async function createNotification(
  userId: string,
  type: string,
  payload: Record<string, unknown>,
  scheduledAt?: Date
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO notification_jobs (user_id, type, payload, scheduled_at, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
    [userId, type, JSON.stringify(payload), scheduledAt?.toISOString() ?? new Date().toISOString()]
  );
  return rows[0].id;
}

export async function getPendingNotifications(userId: string): Promise<NotificationJob[]> {
  return query<NotificationJob>(
    `SELECT * FROM notification_jobs
     WHERE user_id = $1 AND status = 'pending' AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC`,
    [userId]
  );
}

export async function markNotificationSent(id: string): Promise<void> {
  await query(
    `UPDATE notification_jobs SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function getNotificationsByType(
  userId: string,
  type: string,
  limit = 20
): Promise<NotificationJob[]> {
  return query<NotificationJob>(
    `SELECT * FROM notification_jobs WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT $3`,
    [userId, type, limit]
  );
}

// Notification types
export const NOTIFICATION_TYPES = {
  LOW_BALANCE: 'low_balance',
  AUTO_REFILL: 'auto_refill',
  FOLLOW_UP_REMINDER: 'follow_up_reminder',
  WALLET_RECHARGED: 'wallet_recharged',
} as const;
