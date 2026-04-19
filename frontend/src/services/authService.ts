import api from './api';
import { UserRole, AuthResponse } from '../types/auth.types';

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
  return response.data;
}

export async function loginWithPassword(
  phone: string,
  password: string,
  role: UserRole
): Promise<AuthResponse> {
  const response = await api.post('/auth/login', { phone, password, role });
  return response.data;
}

export async function getMe(): Promise<AuthResponse['user']> {
  const response = await api.get('/auth/me');
  return response.data.user;
}

export async function updateProfile(data: { name?: string; phone?: string; specialty?: string; regNumber?: string }): Promise<void> {
  await api.put('/auth/profile', data);
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
  return response.data;
}

export async function refreshSession(): Promise<AuthResponse> {
  const response = await api.post('/auth/refresh-session');
  return response.data;
}
