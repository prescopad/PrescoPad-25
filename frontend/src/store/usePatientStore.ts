import { create } from 'zustand';
import { Patient, PatientFormData } from '../types/patient.types';
import * as DataService from '../services/dataService';

interface PatientStore {
  patients: Patient[];
  searchResults: Patient[];
  selectedPatient: Patient | null;
  isLoading: boolean;

  loadPatients: () => Promise<void>;
  searchPatients: (query: string) => Promise<void>;
  createPatient: (data: PatientFormData) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<PatientFormData>) => Promise<void>;
  selectPatient: (patient: Patient | null) => void;
  getPatientById: (id: string) => Promise<Patient | null>;
  clearSearch: () => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
  patients: [],
  searchResults: [],
  selectedPatient: null,
  isLoading: false,

  loadPatients: async () => {
    set({ isLoading: true });
    try {
      const patients = await DataService.getPatients();
      set({ patients, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  searchPatients: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const searchResults = await DataService.getPatients(query);
      set({ searchResults });
    } catch {
      set({ searchResults: [] });
    }
  },

  createPatient: async (data: PatientFormData) => {
    const patient = await DataService.createPatient(data);
    set((state) => ({ patients: [patient, ...state.patients] }));
    return patient;
  },

  updatePatient: async (id: string, data: Partial<PatientFormData>) => {
    const updated = await DataService.updatePatient(id, data);
    if (updated) {
      set((state) => ({
        patients: state.patients.map((p) => (p.id === id ? updated : p)),
        selectedPatient: state.selectedPatient?.id === id ? updated : state.selectedPatient,
      }));
    }
  },

  selectPatient: (patient) => set({ selectedPatient: patient }),

  getPatientById: async (id: string) => {
    return DataService.getPatientById(id);
  },

  clearSearch: () => set({ searchResults: [] }),
}));
