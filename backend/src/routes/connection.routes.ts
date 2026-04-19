import { Router } from 'express';
import * as ConnectionController from '../controllers/connection.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/invite', ConnectionController.inviteAssistant);
router.post('/request', ConnectionController.requestToJoin);
router.put('/:requestId/accept', ConnectionController.acceptRequest);
router.put('/:requestId/reject', ConnectionController.rejectRequest);
router.get('/pending', ConnectionController.getPendingRequests);
router.get('/team', ConnectionController.getTeamMembers);
router.delete('/team/:assistantId', ConnectionController.disconnectAssistant);

export default router;
