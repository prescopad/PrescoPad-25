import { create } from 'zustand';
import {
  Prescription,
  PrescriptionDraft,
  PrescriptionMedicine,
  PrescriptionLabTest,
} from '../types/prescription.types';
import * as DataService from '../services/dataService';

type MedicineDraft = Omit<PrescriptionMedicine, 'id' | 'prescriptionId'>;
type LabTestDraft = Omit<PrescriptionLabTest, 'id' | 'prescriptionId'>;

interface PrescriptionStore {
  currentDraft: PrescriptionDraft;
  currentPrescription: Prescription | null;
  recentPrescriptions: Prescription[];
  isLoading: boolean;

  // Draft management
  updateDraft: (partial: Partial<PrescriptionDraft>) => void;
  addMedicine: (med: MedicineDraft) => void;
  removeMedicine: (index: number) => void;
  addLabTest: (test: LabTestDraft) => void;
  removeLabTest: (index: number) => void;
  resetDraft: () => void;

  // Prescription lifecycle
  createPrescription: (doctorId: string) => Promise<Prescription>;
  finalizePrescription: (id: string, signature: string, pdfPath: string, pdfHash: string) => Promise<void>;
  loadRecentPrescriptions: () => Promise<void>;
  loadPrescription: (id: string) => Promise<Prescription | null>;
  getTodayCount: () => Promise<number>;
}

const emptyDraft: PrescriptionDraft = {
  patientId: '',
  patientName: '',
  patientAge: '',
  patientGender: '',
  patientWeight: '',
  patientPhone: '',
  diagnosis: '',
  advice: '',
  followUpDate: '',
  medicines: [],
  labTests: [],
};

export const usePrescriptionStore = create<PrescriptionStore>((set, get) => ({
  currentDraft: { ...emptyDraft },
  currentPrescription: null,
  recentPrescriptions: [],
  isLoading: false,

  updateDraft: (partial) => {
    set((state) => ({
      currentDraft: { ...state.currentDraft, ...partial },
    }));
  },

  addMedicine: (med) => {
    set((state) => ({
      currentDraft: {
        ...state.currentDraft,
        medicines: [...state.currentDraft.medicines, med],
      },
    }));
  },

  removeMedicine: (index) => {
    set((state) => ({
      currentDraft: {
        ...state.currentDraft,
        medicines: state.currentDraft.medicines.filter((_, i) => i !== index),
      },
    }));
  },

  addLabTest: (test) => {
    set((state) => ({
      currentDraft: {
        ...state.currentDraft,
        labTests: [...state.currentDraft.labTests, test],
      },
    }));
  },

  removeLabTest: (index) => {
    set((state) => ({
      currentDraft: {
        ...state.currentDraft,
        labTests: state.currentDraft.labTests.filter((_, i) => i !== index),
      },
    }));
  },

  resetDraft: () => set({ currentDraft: { ...emptyDraft }, currentPrescription: null }),

  createPrescription: async (doctorId) => {
    set({ isLoading: true });
    try {
      const prescription = await DataService.createPrescription(get().currentDraft, doctorId);
      set({ currentPrescription: prescription, isLoading: false });
      return prescription;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  finalizePrescription: async (id, signature, _pdfPath, pdfHash) => {
    await DataService.finalizePrescription(id, signature, pdfHash);
    const updated = await DataService.getPrescriptionById(id);
    set({ currentPrescription: updated });
  },

  loadRecentPrescriptions: async () => {
    set({ isLoading: true });
    try {
      const recentPrescriptions = await DataService.getRecentPrescriptions();
      set({ recentPrescriptions, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadPrescription: async (id) => {
    const prescription = await DataService.getPrescriptionById(id);
    set({ currentPrescription: prescription });
    return prescription;
  },

  getTodayCount: async () => {
    return DataService.getTodayPrescriptionCount();
  },
}));
