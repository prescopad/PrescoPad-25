export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  weight: number | null;
  phone: string;
  address: string;
  bloodGroup: string;
  allergies: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientFormData {
  name: string;
  age: string;
  gender: Gender;
  weight: string;
  phone: string;
  address: string;
  bloodGroup: string;
  allergies: string;
}

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
