import { Router } from 'express';
import * as WalletController from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';
import { requireDoctor } from '../middleware/roleGuard';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Get wallet balance
router.get('/', WalletController.getWallet);

// Recharge wallet (doctor only)
router.post('/recharge', requireDoctor, WalletController.rechargeWallet);

// Deduct from wallet (doctor only)
router.post('/deduct', requireDoctor, WalletController.deductWallet);

// Get transaction history
router.get('/transactions', WalletController.getTransactions);

// Update auto-refill settings (doctor only)
router.put('/auto-refill', requireDoctor, WalletController.updateAutoRefill);

export default router;
