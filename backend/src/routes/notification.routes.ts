import { Router } from 'express';
import * as NotificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Get pending notifications
router.get('/', NotificationController.getNotifications);

// Mark notification as read
router.put('/:id/read', NotificationController.markRead);

export default router;
