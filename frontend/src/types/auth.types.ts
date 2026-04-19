export enum UserRole {
  DOCTOR = 'doctor',
  ASSISTANT = 'assistant',
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  clinicId: string;
  doctorCode?: string;
  isProfileComplete: boolean;
  createdAt: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
  role: UserRole;
}

export interface OTPRequest {
  phone: string;
  role: UserRole;
}

export interface OTPVerifyRequest {
  phone: string;
  otp: string;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  isNewUser?: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
