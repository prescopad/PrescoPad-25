import { create } from 'zustand';
import { QueueItem, QueueStatus } from '../types/queue.types';
import * as DataService from '../services/dataService';

interface QueueFilter {
  status?: string;
  todayOnly: boolean;
}

interface QueueStore {
  queueItems: QueueItem[];
  activeItem: QueueItem | null;
  stats: { total: number; waiting: number; inProgress: number; completed: number };
  isLoading: boolean;
  doctorReady: boolean;
  pollInterval: ReturnType<typeof setInterval> | null;
  filter: QueueFilter;

  loadQueue: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadQueueFiltered: (filter?: QueueFilter) => Promise<void>;
  loadStatsFiltered: (todayOnly?: boolean) => Promise<void>;
  setFilter: (filter: QueueFilter) => void;
  addToQueue: (patientId: string, addedBy: string, notes?: string) => Promise<QueueItem>;
  startConsult: (queueItemId: string) => Promise<void>;
  completeConsult: (queueItemId: string) => Promise<void>;
  cancelQueueItem: (queueItemId: string) => Promise<void>;
  removeFromQueue: (queueItemId: string) => Promise<void>;
  setDoctorReady: (ready: boolean) => void;
  getNextPatient: () => QueueItem | undefined;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  queueItems: [],
  activeItem: null,
  stats: { total: 0, waiting: 0, inProgress: 0, completed: 0 },
  isLoading: false,
  doctorReady: false,
  pollInterval: null,
  filter: { todayOnly: true },

  loadQueue: async () => {
    try {
      const queueItems = await DataService.getTodayQueue();
      const activeItem = queueItems.find((q) => q.status === QueueStatus.IN_PROGRESS) ?? null;
      set({ queueItems, activeItem });
    } catch {
      // keep existing data on error
    }
  },

  loadStats: async () => {
    try {
      const stats = await DataService.getTodayStats();
      set({ stats });
    } catch {
      // keep existing stats on error
    }
  },

  loadQueueFiltered: async (filterOverride) => {
    try {
      const f = filterOverride || get().filter;
      const queueItems = await DataService.getQueueFiltered({
        status: f.status,
        todayOnly: f.todayOnly,
      });
      const activeItem = queueItems.find((q) => q.status === QueueStatus.IN_PROGRESS) ?? null;
      set({ queueItems, activeItem });
    } catch {
      // keep existing data on error
    }
  },

  loadStatsFiltered: async (todayOnly) => {
    try {
      const t = todayOnly ?? get().filter.todayOnly;
      const stats = await DataService.getQueueStatsFiltered(t);
      set({ stats });
    } catch {
      // keep existing stats on error
    }
  },

  setFilter: (filter) => {
    set({ filter });
    get().loadQueueFiltered(filter);
    get().loadStatsFiltered(filter.todayOnly);
  },

  addToQueue: async (patientId, addedBy, notes) => {
    const item = await DataService.addToQueue(patientId, addedBy, notes);
    await get().loadQueue();
    await get().loadStats();
    return item;
  },

  startConsult: async (queueItemId) => {
    await DataService.updateQueueStatus(queueItemId, QueueStatus.IN_PROGRESS);
    await get().loadQueue();
    await get().loadStats();
  },

  completeConsult: async (queueItemId) => {
    await DataService.updateQueueStatus(queueItemId, QueueStatus.COMPLETED);
    set({ activeItem: null });
    await get().loadQueue();
    await get().loadStats();
  },

  cancelQueueItem: async (queueItemId) => {
    await DataService.updateQueueStatus(queueItemId, QueueStatus.CANCELLED);
    await get().loadQueue();
    await get().loadStats();
  },

  removeFromQueue: async (queueItemId) => {
    await DataService.removeFromQueue(queueItemId);
    await get().loadQueue();
    await get().loadStats();
  },

  setDoctorReady: (ready) => set({ doctorReady: ready }),

  getNextPatient: () => {
    const { queueItems } = get();
    return queueItems.find((q) => q.status === QueueStatus.WAITING);
  },

  startPolling: () => {
    if (get().pollInterval) return;
    get().loadQueue();
    get().loadStats();
    const interval = setInterval(() => {
      get().loadQueue();
      get().loadStats();
    }, 10_000);
    set({ pollInterval: interval });
  },

  stopPolling: () => {
    const { pollInterval } = get();
    if (pollInterval) {
      clearInterval(pollInterval);
      set({ pollInterval: null });
    }
  },
}));
