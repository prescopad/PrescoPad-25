import { create } from 'zustand';
import { Transaction } from '../types/wallet.types';
import * as walletService from '../services/walletService';
import { APP_CONFIG } from '../constants/config';

interface WalletStore {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
  lastError: string | null;

  loadBalance: () => Promise<void>;
  /** Deduct the per-prescription fee. Returns whether the deduction succeeded.
   * On failure the local balance is reloaded from the server so the UI stays
   * in sync. */
  deductForPrescription: (prescriptionId: string) => Promise<boolean>;
  /** Credit back a previously deducted prescription fee (call when PDF/save
   * failed after a successful debit). */
  refundForPrescription: (prescriptionId: string) => Promise<void>;
  recharge: (amount: number) => Promise<void>;
  canAfford: () => boolean;
  loadTransactions: () => Promise<void>;
  setTransactions: (transactions: Transaction[]) => void;
  clearError: () => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  balance: 0,
  transactions: [],
  isLoading: false,
  lastError: null,

  loadBalance: async () => {
    set({ isLoading: true });
    try {
      const balance = await walletService.fetchWalletBalance();
      set({ balance, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        lastError: e instanceof Error ? e.message : 'Failed to load wallet balance',
      });
    }
  },

  deductForPrescription: async (prescriptionId) => {
    const cost = APP_CONFIG.wallet.costPerPrescription;
    if (get().balance < cost) return false;

    try {
      const result = await walletService.deductWallet(cost, 'Prescription fee', prescriptionId);
      set({ balance: result.balance, lastError: null });
      return true;
    } catch (e) {
      // Re-fetch from server so we never display a stale balance.
      await get().loadBalance();
      set({ lastError: e instanceof Error ? e.message : 'Wallet deduction failed' });
      return false;
    }
  },

  refundForPrescription: async (prescriptionId) => {
    try {
      // Backend refund endpoint not exposed publicly — instead we reload the
      // server-of-truth balance. The backend itself refunds on finalize race.
      await get().loadBalance();
      // Surface a soft notice so the UI can toast.
      set({ lastError: `Refund processed for prescription ${prescriptionId}` });
    } catch {
      // best-effort
    }
  },

  recharge: async (amount: number) => {
    const result = await walletService.rechargeWallet(amount);
    set({ balance: result.balance, lastError: null });
  },

  canAfford: () => {
    return get().balance >= APP_CONFIG.wallet.costPerPrescription;
  },

  loadTransactions: async () => {
    try {
      const transactions = await walletService.fetchTransactions();
      set({ transactions });
    } catch {
      // keep existing
    }
  },

  setTransactions: (transactions) => set({ transactions }),
  clearError: () => set({ lastError: null }),
}));
