import { Router } from 'express';
import * as AnalyticsController from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/analytics?period=today|week|month
router.get('/', AnalyticsController.getAnalytics);

export default router;
