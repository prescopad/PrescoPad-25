import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as WalletService from '../services/wallet.service';
import * as PaymentService from '../services/payment.service';
import { AppError } from '../middleware/errorHandler';

export async function getWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const wallet = await WalletService.getWallet(req.userId!);
    res.json({
      success: true,
      wallet: {
        balance: parseFloat(wallet.balance),
        autoRefill: wallet.auto_refill,
        autoRefillAmount: parseFloat(wallet.auto_refill_amount),
        autoRefillThreshold: parseFloat(wallet.auto_refill_threshold),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function rechargeWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      throw new AppError('Valid amount required', 400);
    }

    // Create payment order (dummy)
    const order = await PaymentService.createPaymentOrder(amount);

    // In production, client would complete payment on Razorpay checkout
    // Then verify payment before crediting wallet
    // For now, auto-credit (dummy payment)

    const result = await WalletService.rechargeWallet(
      req.userId!,
      amount,
      `Wallet Recharge - ${order.orderId}`
    );

    res.json({
      success: true,
      balance: result.balance,
      transactionId: result.transactionId,
      orderId: order.orderId,
    });
  } catch (error) {
    next(error);
  }
}

export async function deductWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, description, referenceId } = req.body;

    if (!amount || amount <= 0) {
      throw new AppError('Valid amount required', 400);
    }

    const result = await WalletService.deductFromWallet(
      req.userId!,
      amount,
      description || 'Prescription Fee',
      referenceId || `RX-${Date.now()}`
    );

    res.json({
      success: true,
      balance: result.balance,
      transactionId: result.transactionId,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const transactions = await WalletService.getTransactions(req.userId!, limit, offset);

    res.json({
      success: true,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        description: t.description,
        referenceId: t.reference_id,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAutoRefill(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { autoRefill, autoRefillAmount, autoRefillThreshold } = req.body;

    await WalletService.updateAutoRefill(
      req.userId!,
      autoRefill,
      autoRefillAmount,
      autoRefillThreshold
    );

    res.json({ success: true, message: 'Auto-refill settings updated' });
  } catch (error) {
    next(error);
  }
}
