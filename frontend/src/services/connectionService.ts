import api from './api';
import { ConnectionRequest, TeamMember, ClinicListItem, DoctorListItem } from '../types/connection.types';

export async function inviteAssistant(assistantPhone: string): Promise<ConnectionRequest> {
  const response = await api.post('/connection/invite', { assistantPhone });
  return response.data.request;
}

export async function requestToJoin(doctorCode: string): Promise<ConnectionRequest> {
  const response = await api.post('/connection/request', { doctorCode });
  return response.data.request;
}

export async function acceptRequest(requestId: string): Promise<void> {
  await api.put(`/connection/${requestId}/accept`);
}

export async function rejectRequest(requestId: string): Promise<void> {
  await api.put(`/connection/${requestId}/reject`);
}

export async function getPendingRequests(): Promise<ConnectionRequest[]> {
  const response = await api.get('/connection/pending');
  const raw: any[] = response.data.requests ?? [];
  return raw.map(normalizeRequest);
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const response = await api.get('/connection/team');
  const raw: any[] = response.data.members ?? [];
  return raw.map(normalizeMember);
}

export async function disconnectAssistant(assistantId: string): Promise<void> {
  await api.delete(`/connection/team/${assistantId}`);
}

export async function listClinics(search?: string): Promise<ClinicListItem[]> {
  const params = search ? { search } : {};
  const response = await api.get('/clinic/list', { params });
  const raw: any[] = response.data.clinics ?? [];
  return raw.map(normalizeClinic);
}

export async function getDoctorsByClinic(clinicId: string): Promise<DoctorListItem[]> {
  const response = await api.get(`/clinic/${clinicId}/doctors`);
  const raw: any[] = response.data.doctors ?? [];
  return raw.map(normalizeDoctor);
}

// ── normalizers ──────────────────────────────────────────────────────────────

function normalizeClinic(r: any): ClinicListItem {
  return {
    id: r.id ?? r._id ?? '',
    name: r.name ?? '',
    address: r.address ?? '',
    phone: r.phone ?? '',
    doctorName: r.doctor_name ?? r.doctorName ?? '',
    doctorSpecialty: r.doctor_specialty ?? r.doctorSpecialty ?? '',
    ownerId: r.owner_id ?? r.ownerId ?? '',
  };
}

function normalizeDoctor(r: any): DoctorListItem {
  return {
    id: r.id ?? r._id ?? '',
    name: r.name ?? '',
    specialty: r.specialty ?? '',
    regNumber: r.reg_number ?? r.regNumber ?? '',
    doctorCode: r.doctor_code ?? r.doctorCode ?? '',
  };
}

function normalizeRequest(r: any): ConnectionRequest {
  return {
    id: r.id ?? r._id ?? '',
    doctorId: r.doctor_id ?? r.doctorId ?? '',
    assistantId: r.assistant_id ?? r.assistantId ?? '',
    initiatedBy: r.initiated_by ?? r.initiatedBy ?? 'assistant',
    status: r.status ?? 'pending',
    doctorName: r.doctor_name ?? r.doctorName,
    assistantName: r.assistant_name ?? r.assistantName,
    clinicName: r.clinic_name ?? r.clinicName,
    createdAt: r.created_at ?? r.createdAt ?? '',
    qualification: r.qualification,
    experienceYears: r.experience_years ?? r.experienceYears,
    city: r.city,
    assistantAddress: r.assistant_address ?? r.assistantAddress,
    assistantPhone: r.assistant_phone ?? r.assistantPhone,
  };
}

function normalizeMember(r: any): TeamMember {
  return {
    id: r.id ?? r._id ?? '',
    name: r.name ?? '',
    phone: r.phone ?? '',
    role: r.role ?? 'assistant',
    lastActiveAt: r.last_active_at ?? r.lastActiveAt,
    qualification: r.qualification,
    experienceYears: r.experience_years ?? r.experienceYears,
    profileAddress: r.profile_address ?? r.profileAddress,
    city: r.city,
    specialty: r.specialty,
    regNumber: r.reg_number ?? r.regNumber,
  };
}
