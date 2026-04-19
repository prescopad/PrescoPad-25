import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Clinic, DoctorProfile } from '../types/clinic.types';
import api from '../services/api';

interface ClinicStore {
  clinic: Clinic | null;
  doctorProfile: DoctorProfile | null;
  isLoading: boolean;

  loadClinic: () => Promise<void>;
  loadDoctorProfile: () => Promise<void>;
  updateClinic: (data: Partial<Clinic>) => Promise<void>;
  updateDoctorProfile: (data: Partial<DoctorProfile>) => Promise<void>;
  saveSignature: (signatureBase64: string) => Promise<void>;
  setClinic: (clinic: Clinic) => void;
  setDoctorProfile: (profile: DoctorProfile) => void;
}

export const useClinicStore = create<ClinicStore>((set, get) => ({
  clinic: null,
  doctorProfile: null,
  isLoading: false,

  loadClinic: async () => {
    try {
      const res = await api.get('/clinic');
      const c = res.data.clinic;
      if (c) {
        set({
          clinic: {
            id: c.id,
            name: c.name || '',
            address: c.address || '',
            phone: c.phone || '',
            email: c.email || '',
            logoBase64: c.logo_url || c.logoBase64 || null,
            ownerId: c.owner_id || '',
          },
        });
      }
    } catch {
      // no clinic yet
    }
  },

  loadDoctorProfile: async () => {
    try {
      const res = await api.get('/auth/me');
      const u = res.data.user;
      // Load signature from local secure storage
      const signatureBase64 = await SecureStore.getItemAsync('doctorSignature');
      if (u) {
        set({
          doctorProfile: {
            id: u.id,
            name: u.name || '',
            phone: u.phone || '',
            specialty: u.specialty || '',
            regNumber: u.regNumber || '',
            signatureBase64: signatureBase64 || null,
            cloudId: u.id,
          },
        });
      }
    } catch {
      // not logged in
    }
  },

  updateClinic: async (data) => {
    const current = get().clinic;
    if (!current) return;

    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.address !== undefined) payload.address = data.address;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.email !== undefined) payload.email = data.email;
    if (data.logoBase64 !== undefined) payload.logo_url = data.logoBase64;

    await api.put('/clinic', payload);
    set({ clinic: { ...current, ...data } });
  },

  updateDoctorProfile: async (data) => {
    const current = get().doctorProfile;
    if (!current) return;

    // Update cloud fields (name, specialty, regNumber)
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.specialty !== undefined) payload.specialty = data.specialty;
    if (data.regNumber !== undefined) payload.regNumber = data.regNumber;

    if (Object.keys(payload).length > 0) {
      await api.put('/auth/profile', payload);
    }

    // Save signature locally (it's a large base64 blob, keep on device)
    if (data.signatureBase64 !== undefined) {
      if (data.signatureBase64) {
        await SecureStore.setItemAsync('doctorSignature', data.signatureBase64);
      } else {
        await SecureStore.deleteItemAsync('doctorSignature');
      }
    }

    set({ doctorProfile: { ...current, ...data } });
  },

  saveSignature: async (signatureBase64: string) => {
    const current = get().doctorProfile;
    if (!current) return;
    await SecureStore.setItemAsync('doctorSignature', signatureBase64);
    set({ doctorProfile: { ...current, signatureBase64 } });
  },

  setClinic: (clinic) => set({ clinic }),
  setDoctorProfile: (profile) => set({ doctorProfile: profile }),
}));
