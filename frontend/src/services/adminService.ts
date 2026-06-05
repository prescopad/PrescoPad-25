import api from './api';

export interface AdminOverview {
  users: { doctors: number; assistants: number; admins: number; onlineDoctors: number };
  clinics: { total: number };
  patients: { total: number };
  prescriptions: { total: number; finalized: number; today: number; week: number; month: number };
  revenue: {
    totalCredits: number;
    totalDebits: number;
    totalRefunds: number;
    platformGross: number;
  };
  generatedAt: string;
}

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  role: 'doctor' | 'assistant' | 'admin';
  is_active?: boolean;
  isActive?: boolean;
  clinic_id?: string | null;
  clinicId?: string | null;
  created_at?: string;
  last_active_at?: string | null;
}

export interface AdminClinic {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  owner_id?: string;
  is_active?: boolean;
  solo_mode?: boolean;
  soloMode?: boolean;
  doctorCount: number;
  assistantCount: number;
  prescriptionCount: number;
  created_at?: string;
}

export interface AdminPatient {
  id: string;
  name: string;
  phone?: string;
  age?: number;
  gender?: string;
  clinic_id?: string;
  created_at?: string;
}

export interface AdminPrescription {
  id: string;
  clinic_id: string;
  patient_name?: string;
  diagnosis?: string;
  status: string;
  wallet_deducted?: number;
  created_at: string;
}

export interface AdminRevenue {
  period: string;
  byType: Record<string, { total: number; count: number }>;
  platformRevenue: number;
  generatedAt: string;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const r = await api.get('/admin/overview');
  return r.data.overview;
}

export async function fetchAdminUsers(params: {
  role?: 'doctor' | 'assistant' | 'admin';
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; users: AdminUser[] }> {
  const r = await api.get('/admin/users', { params });
  return { total: r.data.total ?? 0, users: r.data.users ?? [] };
}

export async function fetchAdminClinics(params: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; clinics: AdminClinic[] }> {
  const r = await api.get('/admin/clinics', { params });
  return { total: r.data.total ?? 0, clinics: r.data.clinics ?? [] };
}

export async function fetchAdminPatients(params: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; patients: AdminPatient[] }> {
  const r = await api.get('/admin/patients', { params });
  return { total: r.data.total ?? 0, patients: r.data.patients ?? [] };
}

export async function fetchAdminPrescriptions(params: {
  clinicId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; prescriptions: AdminPrescription[] }> {
  const r = await api.get('/admin/prescriptions', {
    params: { clinic_id: params.clinicId, limit: params.limit, offset: params.offset },
  });
  return { total: r.data.total ?? 0, prescriptions: r.data.prescriptions ?? [] };
}

export async function fetchAdminRevenue(period: 'today' | 'week' | 'month'): Promise<AdminRevenue> {
  const r = await api.get('/admin/revenue', { params: { period } });
  return r.data;
}

// ── User mutations ────────────────────────────────────────────────────────────

export async function setAdminUserActive(userId: string, isActive: boolean): Promise<AdminUser> {
  const r = await api.put(`/admin/users/${userId}/active`, null, { params: { is_active: isActive } });
  return r.data.user;
}

export async function promoteAdminUser(userId: string): Promise<AdminUser> {
  const r = await api.put(`/admin/users/${userId}/promote`);
  return r.data.user;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}

// ── Clinic mutations ──────────────────────────────────────────────────────────

export async function createAdminClinic(data: {
  name: string;
  address?: string;
  phone?: string;
  city?: string;
}): Promise<AdminClinic> {
  const r = await api.post('/admin/clinics', data);
  return r.data.clinic;
}

export async function updateAdminClinic(
  clinicId: string,
  data: { name?: string; address?: string; phone?: string; city?: string; is_active?: boolean },
): Promise<AdminClinic> {
  const r = await api.put(`/admin/clinics/${clinicId}`, data);
  return r.data.clinic;
}

export async function deleteAdminClinic(clinicId: string): Promise<void> {
  await api.delete(`/admin/clinics/${clinicId}`);
}
