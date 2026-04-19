import { create } from 'zustand';
import { ComprehensiveAnalytics, TimePeriod } from '../types/analytics.types';
import * as AnalyticsService from '../services/analyticsService';

interface AnalyticsState {
  analytics: ComprehensiveAnalytics | null;
  period: TimePeriod;
  isLoading: boolean;
  error: string | null;

  loadAnalytics: (period: TimePeriod) => Promise<void>;
  setPeriod: (period: TimePeriod) => void;
  reset: () => void;
}

const initialState = {
  analytics: null,
  period: 'today' as TimePeriod,
  isLoading: false,
  error: null,
};

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  ...initialState,

  loadAnalytics: async (period: TimePeriod) => {
    set({ isLoading: true, error: null });
    try {
      const analytics = await AnalyticsService.getAnalytics(period);
      set({ analytics, period, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load analytics', isLoading: false });
    }
  },

  setPeriod: (period: TimePeriod) => {
    set({ period });
    get().loadAnalytics(period);
  },

  reset: () => set(initialState),
}));
