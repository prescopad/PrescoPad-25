import api from './api';
import { Transaction } from '../types/wallet.types';

export async function fetchWalletBalance(): Promise<number> {
  const response = await api.get('/wallet');
  return response.data.wallet.balance;
}

export async function rechargeWallet(amount: number): Promise<{
  balance: number;
  transactionId: string;
}> {
  const response = await api.post('/wallet/recharge', { amount });
  return response.data;
}

export async function deductWallet(
  amount: number,
  description: string,
  referenceId: string
): Promise<{ balance: number; transactionId: string }> {
  const response = await api.post('/wallet/deduct', {
    amount,
    description,
    referenceId,
  });
  return response.data;
}

export async function fetchTransactions(
  limit = 50,
  offset = 0
): Promise<Transaction[]> {
  const response = await api.get('/wallet/transactions', {
    params: { limit, offset },
  });
  return response.data.transactions;
}

export async function updateAutoRefill(
  autoRefill: boolean,
  autoRefillAmount?: number,
  autoRefillThreshold?: number
): Promise<void> {
  await api.put('/wallet/auto-refill', {
    autoRefill,
    autoRefillAmount,
    autoRefillThreshold,
  });
}
