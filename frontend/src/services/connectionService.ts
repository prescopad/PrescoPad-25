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
  return response.data.requests;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const response = await api.get('/connection/team');
  return response.data.members;
}

export async function disconnectAssistant(assistantId: string): Promise<void> {
  await api.delete(`/connection/team/${assistantId}`);
}

export async function listClinics(search?: string): Promise<ClinicListItem[]> {
  const params = search ? { search } : {};
  const response = await api.get('/clinic/list', { params });
  return response.data.clinics;
}

export async function getDoctorsByClinic(clinicId: string): Promise<DoctorListItem[]> {
  const response = await api.get(`/clinic/${clinicId}/doctors`);
  return response.data.doctors;
}
