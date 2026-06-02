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
  aiApplied: boolean; // true after AI/transcript auto-fill, so ConsultScreen can highlight empty fields
  queueItemId: string | null; // tracks which queue item this consultation belongs to
  aiFilledFields: Record<string, boolean>;
  manuallyEditedFields: Record<string, boolean>;

  // Draft management
  updateDraft: (partial: Partial<PrescriptionDraft>) => void;
  addMedicine: (med: MedicineDraft) => void;
  removeMedicine: (index: number) => void;
  addLabTest: (test: LabTestDraft) => void;
  removeLabTest: (index: number) => void;
  resetDraft: () => void;
  setAiApplied: (val: boolean) => void;
  setAiFilledFields: (fields: Record<string, boolean>) => void;
  setQueueItemId: (id: string | null) => void;

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
  symptoms: [],
  medicines: [],
  labTests: [],
};

export const usePrescriptionStore = create<PrescriptionStore>((set, get) => ({
  currentDraft: { ...emptyDraft },
  currentPrescription: null,
  recentPrescriptions: [],
  isLoading: false,
  aiApplied: false,
  queueItemId: null,
  aiFilledFields: {},
  manuallyEditedFields: {},

  updateDraft: (partial) => {
    set((state) => {
      const manuallyEdited = { ...state.manuallyEditedFields };
      if (state.aiApplied) {
        Object.keys(partial).forEach((key) => {
          if (['diagnosis', 'advice', 'followUpDate', 'medicines', 'labTests', 'symptoms'].includes(key)) {
            manuallyEdited[key] = true;
          }
        });
      }
      return {
        currentDraft: { ...state.currentDraft, ...partial },
        manuallyEditedFields: manuallyEdited,
      };
    });
  },

  addMedicine: (med) => {
    set((state) => {
      const manuallyEdited = { ...state.manuallyEditedFields };
      if (state.aiApplied) manuallyEdited.medicines = true;
      return {
        currentDraft: {
          ...state.currentDraft,
          medicines: [...state.currentDraft.medicines, med],
        },
        manuallyEditedFields: manuallyEdited,
      };
    });
  },

  removeMedicine: (index) => {
    set((state) => {
      const manuallyEdited = { ...state.manuallyEditedFields };
      if (state.aiApplied) manuallyEdited.medicines = true;
      return {
        currentDraft: {
          ...state.currentDraft,
          medicines: state.currentDraft.medicines.filter((_, i) => i !== index),
        },
        manuallyEditedFields: manuallyEdited,
      };
    });
  },

  addLabTest: (test) => {
    set((state) => {
      const manuallyEdited = { ...state.manuallyEditedFields };
      if (state.aiApplied) manuallyEdited.labTests = true;
      return {
        currentDraft: {
          ...state.currentDraft,
          labTests: [...state.currentDraft.labTests, test],
        },
        manuallyEditedFields: manuallyEdited,
      };
    });
  },

  removeLabTest: (index) => {
    set((state) => {
      const manuallyEdited = { ...state.manuallyEditedFields };
      if (state.aiApplied) manuallyEdited.labTests = true;
      return {
        currentDraft: {
          ...state.currentDraft,
          labTests: state.currentDraft.labTests.filter((_, i) => i !== index),
        },
        manuallyEditedFields: manuallyEdited,
      };
    });
  },

  resetDraft: () => set({
    currentDraft: { ...emptyDraft },
    currentPrescription: null,
    aiApplied: false,
    queueItemId: null,
    aiFilledFields: {},
    manuallyEditedFields: {},
  }),
  setAiApplied: (val) => set({ aiApplied: val }),
  setAiFilledFields: (fields) => set({ aiFilledFields: fields }),
  setQueueItemId: (id) => set({ queueItemId: id }),

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
