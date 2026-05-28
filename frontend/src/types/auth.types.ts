export enum UserRole {
  DOCTOR = 'doctor',
  ASSISTANT = 'assistant',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  clinicId: string;
  doctorCode?: string;
  isProfileComplete: boolean;
  /** True when this user's clinic has no assistants — the doctor gains
   * AddPatient / PatientSearch / queue management capabilities. */
  soloMode?: boolean;
  /** Cloudinary URL of the doctor's digital signature image (PNG/JPG).
   * Embedded into prescription PDFs when present. */
  signatureUrl?: string;
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
