// Utility functions to map snake_case database fields to camelCase for frontend

export function mapPatient(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    gender: p.gender,
    weight: p.weight,
    phone: p.phone,
    address: p.address,
    bloodGroup: p.blood_group,
    allergies: p.allergies,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function mapQueueItem(q: any) {
  if (!q) return null;
  return {
    id: q.id,
    patientId: q.patient_id,
    patient: q.patient_name ? {
      id: q.patient_id,
      name: q.patient_name,
      age: q.patient_age,
      gender: q.patient_gender,
      phone: q.patient_phone,
    } : undefined,
    status: q.status,
    addedBy: q.added_by,
    notes: q.notes,
    addedAt: q.added_at,
    startedAt: q.started_at,
    completedAt: q.completed_at,
    tokenNumber: q.token_number,
  };
}

export function mapPrescriptionMedicine(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    prescriptionId: m.prescription_id,
    medicineName: m.medicine_name,
    type: m.type,
    dosage: m.dosage,
    frequency: m.frequency,
    duration: m.duration,
    timing: m.timing,
    notes: m.notes,
  };
}

export function mapPrescriptionLabTest(t: any) {
  if (!t) return null;
  return {
    id: t.id,
    prescriptionId: t.prescription_id,
    testName: t.test_name,
    category: t.category,
    notes: t.notes,
  };
}

export function mapPrescription(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    patientId: p.patient_id,
    patientName: p.patient_name,
    patientAge: p.patient_age,
    patientGender: p.patient_gender,
    patientPhone: p.patient_phone,
    doctorId: p.doctor_id,
    doctorName: p.doctor_name, // Added doctor name from JOIN
    diagnosis: p.diagnosis,
    advice: p.advice,
    followUpDate: p.follow_up_date,
    pdfPath: p.pdf_path,
    pdfHash: p.pdf_hash,
    signature: p.signature,
    status: p.status,
    walletDeducted: p.wallet_deducted,
    createdAt: p.created_at,
    medicines: (p.medicines || []).map(mapPrescriptionMedicine),
    labTests: (p.lab_tests || []).map(mapPrescriptionLabTest),
  };
}

export function mapTransaction(t: any) {
  if (!t) return null;
  return {
    id: t.id,
    userId: t.user_id,
    type: t.type,
    amount: t.amount,
    description: t.description,
    prescriptionId: t.prescription_id,
    createdAt: t.created_at,
  };
}

export function mapCustomMedicine(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    clinicId: m.clinic_id,
    name: m.name,
    type: m.type,
    strength: m.strength,
    usageCount: m.usage_count,
    createdAt: m.created_at,
  };
}

export function mapCustomLabTest(t: any) {
  if (!t) return null;
  return {
    id: t.id,
    clinicId: t.clinic_id,
    name: t.name,
    category: t.category,
    usageCount: t.usage_count,
    createdAt: t.created_at,
  };
}
