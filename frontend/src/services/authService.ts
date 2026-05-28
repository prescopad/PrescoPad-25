import api from './api';
import { UserRole, AuthResponse, User } from '../types/auth.types';

// Normalize Python backend snake_case response → camelCase AuthResponse
function normalizeAuthResponse(data: Record<string, unknown>): AuthResponse {
  const raw = data as Record<string, unknown>;
  const user = (raw.user ?? {}) as Record<string, unknown>;
  return {
    accessToken: (raw.access_token ?? raw.accessToken ?? '') as string,
    refreshToken: (raw.refresh_token ?? raw.refreshToken ?? '') as string,
    user: normalizeUser(user),
  };
}

function normalizeUser(u: Record<string, unknown>): User {
  return {
    id: (u.id ?? u._id ?? '') as string,
    phone: (u.phone ?? '') as string,
    name: (u.name ?? '') as string,
    role: (u.role ?? '') as User['role'],
    clinicId: (u.clinic_id ?? u.clinicId ?? '') as string,
    doctorCode: (u.doctor_code ?? u.doctorCode ?? undefined) as string | undefined,
    isProfileComplete: Boolean(u.is_profile_complete ?? u.isProfileComplete ?? false),
    soloMode: Boolean(u.solo_mode ?? u.soloMode ?? false),
    signatureUrl: (u.signature_url ?? u.signatureUrl ?? undefined) as string | undefined,
    createdAt: (u.created_at ?? u.createdAt ?? '') as string,
  };
}

export async function sendOTP(phone: string, role: UserRole): Promise<{ success: boolean; otp?: string }> {
  const response = await api.post('/auth/send-otp', { phone, role });
  return response.data;
}

export async function verifyOTP(
  phone: string,
  otp: string,
  role: UserRole
): Promise<AuthResponse> {
  const response = await api.post('/auth/verify-otp', { phone, otp, role });
  return normalizeAuthResponse(response.data);
}

export async function loginWithPassword(
  phone: string,
  password: string,
  role: UserRole
): Promise<AuthResponse> {
  const response = await api.post('/auth/login', { phone, password, role });
  return normalizeAuthResponse(response.data);
}

export async function getMe(): Promise<User> {
  const response = await api.get('/auth/me');
  const raw = response.data.user ?? response.data;
  return normalizeUser(raw as Record<string, unknown>);
}

export async function updateProfile(data: {
  name?: string;
  phone?: string;
  specialty?: string;
  regNumber?: string;
  signatureUrl?: string;
}): Promise<User> {
  const response = await api.put('/auth/profile', data);
  const raw = response.data.user ?? response.data;
  return normalizeUser(raw as Record<string, unknown>);
}

export async function completeRegistration(data: {
  name: string;
  specialty?: string;
  regNumber?: string;
  clinicName?: string;
  qualification?: string;
  experienceYears?: number;
  address?: string;
  city?: string;
  selectedClinicId?: string;
}): Promise<AuthResponse> {
  const response = await api.post('/auth/complete-registration', data);
  return normalizeAuthResponse(response.data);
}

export async function refreshSession(): Promise<AuthResponse> {
  const response = await api.post('/auth/refresh-session');
  return normalizeAuthResponse(response.data);
}
