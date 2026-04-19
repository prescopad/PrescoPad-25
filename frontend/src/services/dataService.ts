import api from './api';
import { Patient, PatientFormData } from '../types/patient.types';
import { Prescription, PrescriptionDraft, PrescriptionMedicine, PrescriptionLabTest, PrescriptionStatus } from '../types/prescription.types';
import { QueueItem, QueueStatus } from '../types/queue.types';
import { Medicine, LabTest } from '../types/medicine.types';
import { searchMedicines as searchLocalMedicines, getFrequentMedicines as getLocalFrequentMedicines, searchLabTests as searchLocalLabTests, getFrequentLabTests as getLocalFrequentLabTests, getLabTestsByCategory as getLocalLabTestsByCategory, incrementMedicineUsage as incrementLocalMedicineUsage, incrementLabTestUsage as incrementLocalLabTestUsage } from '../database/queries/medicineQueries';

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING HELPERS (snake_case backend → camelCase frontend)
// ═══════════════════════════════════════════════════════════════════════════════

function mapPatient(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    name: row.name as string,
    age: row.age as number,
    gender: row.gender as Patient['gender'],
    weight: (row.weight as number) ?? null,
    phone: (row.phone as string) ?? '',
    address: (row.address as string) ?? '',
    bloodGroup: (row.blood_group as string) ?? '',
    allergies: (row.allergies as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  };
}

function mapQueueItem(row: Record<string, unknown>): QueueItem {
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    status: row.status as QueueStatus,
    addedBy: row.added_by as string,
    notes: (row.notes as string) ?? '',
    tokenNumber: row.token_number as number,
    addedAt: row.added_at as string,
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    patient: row.patient_name ? {
      id: row.patient_id as string,
      name: row.patient_name as string,
      age: row.patient_age as number,
      gender: row.patient_gender as Patient['gender'],
      weight: (row.patient_weight as number) ?? null,
      phone: (row.patient_phone as string) ?? '',
      address: (row.patient_address as string) ?? '',
      bloodGroup: (row.patient_blood_group as string) ?? '',
      allergies: (row.patient_allergies as string) ?? '',
      createdAt: '',
      updatedAt: '',
    } : undefined,
  };
}

function mapPrescription(row: Record<string, unknown>): Prescription {
  const medicines = (row.medicines as Record<string, unknown>[] | undefined)?.map(mapPrescriptionMedicine) ?? [];
  const labTests = (row.lab_tests as Record<string, unknown>[] | undefined)?.map(mapPrescriptionLabTest) ?? [];
  return {
    id: row.id as string,
    patientId: row.patient_id as string,
    patientName: row.patient_name as string,
    patientAge: row.patient_age as number,
    patientGender: row.patient_gender as string,
    patientPhone: (row.patient_phone as string) ?? '',
    doctorId: row.doctor_id as string,
    diagnosis: row.diagnosis as string,
    advice: (row.advice as string) ?? '',
    followUpDate: (row.follow_up_date as string) ?? null,
    pdfPath: null, // PDF is local-only
    pdfHash: (row.pdf_hash as string) ?? null,
    signature: (row.signature as string) ?? null,
    status: row.status as PrescriptionStatus,
    walletDeducted: Boolean(row.wallet_deducted),
    medicines,
    labTests,
    createdAt: row.created_at as string,
  };
}

function mapPrescriptionMedicine(row: Record<string, unknown>): PrescriptionMedicine {
  return {
    id: row.id as string,
    prescriptionId: row.prescription_id as string,
    medicineName: row.medicine_name as string,
    type: (row.type as string) ?? '',
    dosage: (row.dosage as string) ?? '',
    frequency: (row.frequency as string) ?? '',
    duration: (row.duration as string) ?? '',
    timing: (row.timing as string) ?? '',
    notes: (row.notes as string) ?? '',
  };
}

function mapPrescriptionLabTest(row: Record<string, unknown>): PrescriptionLabTest {
  return {
    id: row.id as string,
    prescriptionId: row.prescription_id as string,
    testName: row.test_name as string,
    category: (row.category as string) ?? '',
    notes: (row.notes as string) ?? '',
  };
}

function mapCustomMedicine(row: Record<string, unknown>): Medicine {
  return {
    id: row.id as string,
    name: row.name as string,
    type: (row.type ?? 'Tablet') as Medicine['type'],
    strength: (row.strength as string) ?? '',
    manufacturer: (row.manufacturer as string) ?? '',
    isCustom: true,
    usageCount: (row.usage_count as number) ?? 0,
  };
}

function mapCustomLabTest(row: Record<string, unknown>): LabTest {
  return {
    id: row.id as string,
    name: row.name as string,
    category: (row.category as string) ?? '',
    isCustom: true,
    usageCount: (row.usage_count as number) ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPatients(search?: string, limit = 100, offset = 0): Promise<Patient[]> {
  const params: Record<string, string | number> = { limit, offset };
  if (search) params.search = search;
  const res = await api.get('/data/patients', { params });
  return (res.data.patients as Record<string, unknown>[]).map(mapPatient);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  try {
    const res = await api.get(`/data/patients/${id}`);
    return mapPatient(res.data.patient);
  } catch {
    return null;
  }
}

export async function createPatient(data: PatientFormData): Promise<Patient> {
  const res = await api.post('/data/patients', {
    name: data.name,
    age: parseInt(data.age) || 0,
    gender: data.gender,
    weight: data.weight ? parseFloat(data.weight) : null,
    phone: data.phone,
    address: data.address,
    blood_group: data.bloodGroup,
    allergies: data.allergies,
  });
  return mapPatient(res.data.patient);
}

export async function updatePatient(id: string, data: Partial<PatientFormData>): Promise<Patient | null> {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.age !== undefined) payload.age = parseInt(data.age) || 0;
  if (data.gender !== undefined) payload.gender = data.gender;
  if (data.weight !== undefined) payload.weight = data.weight ? parseFloat(data.weight) : null;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.address !== undefined) payload.address = data.address;
  if (data.bloodGroup !== undefined) payload.blood_group = data.bloodGroup;
  if (data.allergies !== undefined) payload.allergies = data.allergies;

  const res = await api.put(`/data/patients/${id}`, payload);
  return mapPatient(res.data.patient);
}

export async function getRecentPatients(limit = 10): Promise<Patient[]> {
  return getPatients(undefined, limit, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

export async function getTodayQueue(): Promise<QueueItem[]> {
  const res = await api.get('/data/queue/today');
  return (res.data.queue as Record<string, unknown>[]).map(mapQueueItem);
}

export async function getTodayStats(): Promise<{ total: number; waiting: number; inProgress: number; completed: number }> {
  const res = await api.get('/data/queue/stats');
  const s = res.data.stats;
  return {
    total: s.total,
    waiting: s.waiting,
    inProgress: s.in_progress,
    completed: s.completed,
  };
}

export async function addToQueue(patientId: string, addedBy: string, notes?: string): Promise<QueueItem> {
  const res = await api.post('/data/queue', { patient_id: patientId, added_by: addedBy, notes: notes ?? '' });
  return mapQueueItem(res.data.item);
}

export async function updateQueueStatus(id: string, status: QueueStatus): Promise<void> {
  await api.put(`/data/queue/${id}/status`, { status });
}

export async function removeFromQueue(id: string): Promise<void> {
  await api.delete(`/data/queue/${id}`);
}

export async function getQueueFiltered(options?: { status?: string; todayOnly?: boolean; limit?: number; offset?: number }): Promise<QueueItem[]> {
  const params: Record<string, string | number | boolean> = {};
  if (options?.status) params.status = options.status;
  if (options?.todayOnly !== undefined) params.todayOnly = options.todayOnly;
  if (options?.limit) params.limit = options.limit;
  if (options?.offset) params.offset = options.offset;
  const res = await api.get('/data/queue/filtered', { params });
  return (res.data.queue as Record<string, unknown>[]).map(mapQueueItem);
}

export async function getQueueStatsFiltered(todayOnly?: boolean): Promise<{ total: number; waiting: number; inProgress: number; completed: number }> {
  const params: Record<string, boolean> = {};
  if (todayOnly !== undefined) params.todayOnly = todayOnly;
  const res = await api.get('/data/queue/stats/filtered', { params });
  const s = res.data.stats;
  return {
    total: s.total,
    waiting: s.waiting,
    inProgress: s.in_progress,
    completed: s.completed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createPrescription(draft: PrescriptionDraft, doctorId: string): Promise<Prescription> {
  const res = await api.post('/data/prescriptions', {
    patient_id: draft.patientId,
    patient_name: draft.patientName,
    patient_age: parseInt(draft.patientAge) || 0,
    patient_gender: draft.patientGender,
    patient_phone: draft.patientPhone,
    doctor_id: doctorId,
    diagnosis: draft.diagnosis,
    advice: draft.advice,
    follow_up_date: draft.followUpDate || null,
    medicines: draft.medicines.map(m => ({
      medicine_name: m.medicineName,
      type: m.type,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      timing: m.timing,
      notes: m.notes,
    })),
    lab_tests: draft.labTests.map(t => ({
      test_name: t.testName,
      category: t.category,
      notes: t.notes,
    })),
  });
  return mapPrescription(res.data.prescription);
}

export async function getPrescriptionById(id: string): Promise<Prescription | null> {
  try {
    const res = await api.get(`/data/prescriptions/${id}`);
    return mapPrescription(res.data.prescription);
  } catch {
    return null;
  }
}

export async function getRecentPrescriptions(limit = 20): Promise<Prescription[]> {
  const res = await api.get('/data/prescriptions', { params: { limit } });
  return (res.data.prescriptions as Record<string, unknown>[]).map(mapPrescription);
}

export async function getPrescriptionsByPatient(patientId: string): Promise<Prescription[]> {
  const res = await api.get(`/data/prescriptions/patient/${patientId}`);
  return (res.data.prescriptions as Record<string, unknown>[]).map(mapPrescription);
}

export async function finalizePrescription(id: string, signature: string, pdfHash: string): Promise<void> {
  await api.put(`/data/prescriptions/${id}/finalize`, { signature, pdf_hash: pdfHash });
}

export async function getTodayPrescriptionCount(): Promise<number> {
  const res = await api.get('/data/prescriptions/today/count');
  return res.data.count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDICINES (merged local seeded + cloud custom)
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchAllMedicines(query: string): Promise<Medicine[]> {
  // Search local seeded medicines
  const localResults = await searchLocalMedicines(query);

  // Search cloud custom medicines
  let cloudResults: Medicine[] = [];
  try {
    const res = await api.get('/data/custom-medicines', { params: { q: query } });
    cloudResults = (res.data.medicines as Record<string, unknown>[]).map(mapCustomMedicine);
  } catch { /* cloud unavailable, use local only */ }

  // Merge and deduplicate by name
  const seen = new Set(localResults.map(m => m.name.toLowerCase()));
  const merged = [...localResults];
  for (const m of cloudResults) {
    if (!seen.has(m.name.toLowerCase())) {
      seen.add(m.name.toLowerCase());
      merged.push(m);
    }
  }
  return merged;
}

export async function getAllFrequentMedicines(limit = 20): Promise<Medicine[]> {
  const localResults = await getLocalFrequentMedicines(limit);

  let cloudResults: Medicine[] = [];
  try {
    const res = await api.get('/data/custom-medicines/frequent', { params: { limit } });
    cloudResults = (res.data.medicines as Record<string, unknown>[]).map(mapCustomMedicine);
  } catch { /* cloud unavailable */ }

  const seen = new Set(localResults.map(m => m.name.toLowerCase()));
  const merged = [...localResults];
  for (const m of cloudResults) {
    if (!seen.has(m.name.toLowerCase())) {
      seen.add(m.name.toLowerCase());
      merged.push(m);
    }
  }
  return merged.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
}

export async function addCustomMedicine(name: string, type: string, strength: string): Promise<Medicine> {
  const res = await api.post('/data/custom-medicines', { name, type, strength });
  return mapCustomMedicine(res.data.medicine);
}

export async function incrementMedicineUsage(name: string, isCustom: boolean): Promise<void> {
  // Always increment local usage for seeded medicines (keeps local ranking)
  try { await incrementLocalMedicineUsage(name); } catch { /* not in local DB */ }
  // Increment cloud usage for custom medicines
  if (isCustom) {
    try { await api.put('/data/custom-medicines/usage', { name }); } catch { /* ignore */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAB TESTS (merged local seeded + cloud custom)
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchAllLabTests(query: string): Promise<LabTest[]> {
  const localResults = await searchLocalLabTests(query);

  let cloudResults: LabTest[] = [];
  try {
    const res = await api.get('/data/custom-lab-tests', { params: { q: query } });
    cloudResults = (res.data.labTests as Record<string, unknown>[]).map(mapCustomLabTest);
  } catch { /* cloud unavailable */ }

  const seen = new Set(localResults.map(t => t.name.toLowerCase()));
  const merged = [...localResults];
  for (const t of cloudResults) {
    if (!seen.has(t.name.toLowerCase())) {
      seen.add(t.name.toLowerCase());
      merged.push(t);
    }
  }
  return merged;
}

export async function getAllFrequentLabTests(limit = 20): Promise<LabTest[]> {
  const localResults = await getLocalFrequentLabTests(limit);

  let cloudResults: LabTest[] = [];
  try {
    const res = await api.get('/data/custom-lab-tests/frequent', { params: { limit } });
    cloudResults = (res.data.labTests as Record<string, unknown>[]).map(mapCustomLabTest);
  } catch { /* cloud unavailable */ }

  const seen = new Set(localResults.map(t => t.name.toLowerCase()));
  const merged = [...localResults];
  for (const t of cloudResults) {
    if (!seen.has(t.name.toLowerCase())) {
      seen.add(t.name.toLowerCase());
      merged.push(t);
    }
  }
  return merged.sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
}

export { getLocalLabTestsByCategory as getLabTestsByCategory };

export async function addCustomLabTest(name: string, category: string): Promise<LabTest> {
  const res = await api.post('/data/custom-lab-tests', { name, category });
  return mapCustomLabTest(res.data.labTest);
}

export async function incrementLabTestUsage(name: string, isCustom: boolean): Promise<void> {
  try { await incrementLocalLabTestUsage(name); } catch { /* not in local DB */ }
  if (isCustom) {
    try { await api.put('/data/custom-lab-tests/usage', { name }); } catch { /* ignore */ }
  }
}
