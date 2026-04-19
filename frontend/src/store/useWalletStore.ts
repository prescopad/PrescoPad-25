import { create } from 'zustand';
import { Transaction } from '../types/wallet.types';
import * as walletService from '../services/walletService';
import { APP_CONFIG } from '../constants/config';

interface WalletStore {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;

  loadBalance: () => Promise<void>;
  deductForPrescription: () => Promise<boolean>;
  recharge: (amount: number) => Promise<void>;
  canAfford: () => boolean;
  loadTransactions: () => Promise<void>;
  setTransactions: (transactions: Transaction[]) => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  balance: 0,
  transactions: [],
  isLoading: false,

  loadBalance: async () => {
    set({ isLoading: true });
    try {
      const balance = await walletService.fetchWalletBalance();
      set({ balance, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  deductForPrescription: async () => {
    const cost = APP_CONFIG.wallet.costPerPrescription;
    if (get().balance < cost) return false;

    try {
      const result = await walletService.deductWallet(cost, 'Prescription fee', '');
      set({ balance: result.balance });
      return true;
    } catch {
      return false;
    }
  },

  recharge: async (amount: number) => {
    const result = await walletService.rechargeWallet(amount);
    set({ balance: result.balance });
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
}));
