export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logoBase64: string | null;
  ownerId: string;
}

export interface DoctorProfile {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  regNumber: string;
  signatureBase64: string | null;
  cloudId: string;
}

export interface AssistantProfile {
  id: string;
  name: string;
  phone: string;
  cloudId: string;
}
