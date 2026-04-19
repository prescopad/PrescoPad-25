export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  autoRefill: boolean;
  autoRefillAmount: number;
  autoRefillThreshold: number;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  description: string;
  referenceId: string;
  createdAt: string;
}

export interface RechargeRequest {
  amount: number;
  paymentMethod: string;
}

export interface LocalWalletCache {
  balance: number;
  lastSyncedAt: string;
}
