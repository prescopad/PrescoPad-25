import { PoolClient } from 'pg';
import { query, queryOne, transaction } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// ─── Patient Types ───────────────────────────────────────────────────────────

interface PatientInput {
  name: string;
  age: number;
  gender: string;
  weight?: number | null;
  phone?: string;
  address?: string;
  blood_group?: string;
  allergies?: string;
}

interface PatientRow {
  id: string;
  clinic_id: string;
  name: string;
  age: number;
  gender: string;
  weight: number | null;
  phone: string;
  address: string;
  blood_group: string;
  allergies: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Queue Types ─────────────────────────────────────────────────────────────

interface QueueRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  status: string;
  added_by: string;
  notes: string;
  token_number: number;
  added_at: string;
  started_at: string | null;
  completed_at: string | null;
  is_deleted: boolean;
  updated_at: string;
  // joined patient fields
  patient_name?: string;
  patient_age?: number;
  patient_gender?: string;
  patient_phone?: string;
  patient_weight?: number | null;
  patient_address?: string;
  patient_blood_group?: string;
  patient_allergies?: string;
}

interface QueueStats {
  total: number;
  waiting: number;
  in_progress: number;
  completed: number;
}

// ─── Prescription Types ──────────────────────────────────────────────────────

interface PrescriptionInput {
  patient_id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  patient_phone?: string;
  doctor_id: string;
  diagnosis: string;
  advice?: string;
  follow_up_date?: string | null;
  medicines: PrescriptionMedicineInput[];
  lab_tests: PrescriptionLabTestInput[];
}

interface PrescriptionMedicineInput {
  medicine_name: string;
  type?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  timing?: string;
  notes?: string;
}

interface PrescriptionLabTestInput {
  test_name: string;
  category?: string;
  notes?: string;
}

interface PrescriptionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  patient_phone: string;
  doctor_id: string;
  diagnosis: string;
  advice: string;
  follow_up_date: string | null;
  pdf_hash: string | null;
  signature: string | null;
  status: string;
  wallet_deducted: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface PrescriptionMedicineRow {
  id: string;
  prescription_id: string;
  medicine_name: string;
  type: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  notes: string;
}

interface PrescriptionLabTestRow {
  id: string;
  prescription_id: string;
  test_name: string;
  category: string;
  notes: string;
}

// ─── Custom Medicine/Lab Test Types ──────────────────────────────────────────

interface CustomMedicineRow {
  id: string;
  clinic_id: string;
  name: string;
  type: string;
  strength: string;
  manufacturer: string;
  usage_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomLabTestRow {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  usage_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// Generate prescription IDs: RX-XXXXXX
function generateRxId(): string {
  const ts = Date.now().toString();
  return `RX-${ts.slice(-6)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPatients(
  clinicId: string,
  search?: string,
  limit = 100,
  offset = 0
): Promise<PatientRow[]> {
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    return query<PatientRow>(
      `SELECT * FROM patients
       WHERE clinic_id = $1 AND is_deleted = false
         AND (name ILIKE $2 OR phone ILIKE $2)
       ORDER BY updated_at DESC
       LIMIT $3 OFFSET $4`,
      [clinicId, pattern, limit, offset]
    );
  }
  return query<PatientRow>(
    `SELECT * FROM patients
     WHERE clinic_id = $1 AND is_deleted = false
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [clinicId, limit, offset]
  );
}

export async function getPatientById(
  clinicId: string,
  patientId: string
): Promise<PatientRow | null> {
  return queryOne<PatientRow>(
    `SELECT * FROM patients WHERE id = $1 AND clinic_id = $2 AND is_deleted = false`,
    [patientId, clinicId]
  );
}

export async function createPatient(
  clinicId: string,
  data: PatientInput
): Promise<PatientRow> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const rows = await query<PatientRow>(
    `INSERT INTO patients (id, clinic_id, name, age, gender, weight, phone, address, blood_group, allergies, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $11)
     RETURNING *`,
    [id, clinicId, data.name, data.age, data.gender, data.weight ?? null, data.phone ?? '', data.address ?? '', data.blood_group ?? '', data.allergies ?? '', now]
  );
  return rows[0];
}

export async function updatePatient(
  clinicId: string,
  patientId: string,
  data: Partial<PatientInput>
): Promise<PatientRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, keyof PatientInput> = {
    name: 'name', age: 'age', gender: 'gender', weight: 'weight',
    phone: 'phone', address: 'address', blood_group: 'blood_group', allergies: 'allergies',
  };

  for (const [col, key] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return getPatientById(clinicId, patientId);

  fields.push(`updated_at = $${idx++}`);
  values.push(new Date().toISOString());

  values.push(patientId);
  values.push(clinicId);

  const rows = await query<PatientRow>(
    `UPDATE patients SET ${fields.join(', ')}
     WHERE id = $${idx++} AND clinic_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

export async function getTodayQueue(clinicId: string): Promise<QueueRow[]> {
  return query<QueueRow>(
    `SELECT sq.*,
            sp.name AS patient_name,
            sp.age AS patient_age,
            sp.gender AS patient_gender,
            sp.phone AS patient_phone,
            sp.weight AS patient_weight,
            sp.address AS patient_address,
            sp.blood_group AS patient_blood_group,
            sp.allergies AS patient_allergies
     FROM queue sq
     LEFT JOIN patients sp ON sq.patient_id = sp.id AND sp.clinic_id = sq.clinic_id
     WHERE sq.clinic_id = $1
       AND DATE(sq.added_at) = CURRENT_DATE
       AND sq.is_deleted = false
     ORDER BY sq.token_number ASC`,
    [clinicId]
  );
}

export async function getTodayStats(clinicId: string): Promise<QueueStats> {
  const row = await queryOne<QueueStats>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
     FROM queue
     WHERE clinic_id = $1
       AND DATE(added_at) = CURRENT_DATE
       AND is_deleted = false`,
    [clinicId]
  );
  return row ?? { total: 0, waiting: 0, in_progress: 0, completed: 0 };
}

export async function addToQueue(
  clinicId: string,
  patientId: string,
  addedBy: string,
  notes = ''
): Promise<QueueRow> {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next token number for today
  const maxRow = await queryOne<{ max_token: number }>(
    `SELECT COALESCE(MAX(token_number), 0)::int AS max_token
     FROM queue
     WHERE clinic_id = $1 AND DATE(added_at) = CURRENT_DATE`,
    [clinicId]
  );
  const tokenNumber = (maxRow?.max_token ?? 0) + 1;

  const rows = await query<QueueRow>(
    `INSERT INTO queue (id, clinic_id, patient_id, status, added_by, notes, token_number, added_at, is_deleted, updated_at)
     VALUES ($1, $2, $3, 'waiting', $4, $5, $6, $7, false, $7)
     RETURNING *`,
    [id, clinicId, patientId, addedBy, notes, tokenNumber, now]
  );

  // Return with patient data joined
  const item = await queryOne<QueueRow>(
    `SELECT sq.*,
            sp.name AS patient_name,
            sp.age AS patient_age,
            sp.gender AS patient_gender,
            sp.phone AS patient_phone
     FROM queue sq
     LEFT JOIN patients sp ON sq.patient_id = sp.id AND sp.clinic_id = sq.clinic_id
     WHERE sq.id = $1 AND sq.clinic_id = $2`,
    [rows[0].id, clinicId]
  );
  return item!;
}

export async function updateQueueStatus(
  clinicId: string,
  queueItemId: string,
  status: string
): Promise<QueueRow | null> {
  const now = new Date().toISOString();
  let extraField = '';

  if (status === 'in_progress') {
    extraField = `, started_at = '${now}'`;
  } else if (status === 'completed' || status === 'cancelled') {
    extraField = `, completed_at = '${now}'`;
  }

  const rows = await query<QueueRow>(
    `UPDATE queue SET status = $1, updated_at = $2 ${extraField}
     WHERE id = $3 AND clinic_id = $4
     RETURNING *`,
    [status, now, queueItemId, clinicId]
  );
  return rows[0] ?? null;
}

export async function getQueueFiltered(
  clinicId: string,
  options: { status?: string; todayOnly?: boolean; limit?: number; offset?: number }
): Promise<QueueRow[]> {
  const conditions = ['sq.clinic_id = $1', 'sq.is_deleted = false'];
  const params: unknown[] = [clinicId];
  let paramIdx = 2;

  if (options.todayOnly !== false) {
    conditions.push(`DATE(sq.added_at) = CURRENT_DATE`);
  }

  if (options.status && options.status !== 'all') {
    conditions.push(`sq.status = $${paramIdx++}`);
    params.push(options.status);
  }

  const limit = options.limit ?? 200;
  const offset = options.offset ?? 0;

  return query<QueueRow>(
    `SELECT sq.*,
            sp.name AS patient_name,
            sp.age AS patient_age,
            sp.gender AS patient_gender,
            sp.phone AS patient_phone,
            sp.weight AS patient_weight,
            sp.address AS patient_address,
            sp.blood_group AS patient_blood_group,
            sp.allergies AS patient_allergies
     FROM queue sq
     LEFT JOIN patients sp ON sq.patient_id = sp.id AND sp.clinic_id = sq.clinic_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sq.added_at DESC, sq.token_number ASC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );
}

export async function getQueueStats(
  clinicId: string,
  todayOnly = true
): Promise<QueueStats> {
  const dateFilter = todayOnly ? `AND DATE(added_at) = CURRENT_DATE` : '';
  const row = await queryOne<QueueStats>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
     FROM queue
     WHERE clinic_id = $1 AND is_deleted = false ${dateFilter}`,
    [clinicId]
  );
  return row ?? { total: 0, waiting: 0, in_progress: 0, completed: 0 };
}

export async function getQueueHistoryByPatient(
  clinicId: string,
  patientId: string
): Promise<QueueRow[]> {
  return query<QueueRow>(
    `SELECT sq.*,
            sp.name AS patient_name, sp.age AS patient_age,
            sp.gender AS patient_gender, sp.phone AS patient_phone
     FROM queue sq
     LEFT JOIN patients sp ON sq.patient_id = sp.id AND sp.clinic_id = sq.clinic_id
     WHERE sq.clinic_id = $1 AND sq.patient_id = $2 AND sq.is_deleted = false
     ORDER BY sq.added_at DESC`,
    [clinicId, patientId]
  );
}

export async function removeFromQueue(
  clinicId: string,
  queueItemId: string
): Promise<void> {
  await query(
    `UPDATE queue SET is_deleted = true, updated_at = $1
     WHERE id = $2 AND clinic_id = $3`,
    [new Date().toISOString(), queueItemId, clinicId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function createPrescription(
  clinicId: string,
  data: PrescriptionInput
): Promise<PrescriptionRow & { medicines: PrescriptionMedicineRow[]; lab_tests: PrescriptionLabTestRow[] }> {
  const rxId = generateRxId();
  const now = new Date().toISOString();

  return transaction(async (client: PoolClient) => {
    // Insert prescription
    const rxResult = await client.query(
      `INSERT INTO prescriptions
         (id, clinic_id, patient_id, patient_name, patient_age, patient_gender, patient_phone,
          doctor_id, diagnosis, advice, follow_up_date, status, wallet_deducted, is_deleted, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', 0, false, $12, $12)
       RETURNING *`,
      [rxId, clinicId, data.patient_id, data.patient_name, data.patient_age, data.patient_gender,
       data.patient_phone ?? '', data.doctor_id, data.diagnosis, data.advice ?? '', data.follow_up_date ?? null, now]
    );
    const prescription = rxResult.rows[0] as PrescriptionRow;

    // Insert medicines
    const medicines: PrescriptionMedicineRow[] = [];
    for (const med of data.medicines) {
      const medId = uuidv4();
      const medResult = await client.query(
        `INSERT INTO prescription_medicines
           (id, clinic_id, prescription_id, medicine_name, type, dosage, frequency, duration, timing, notes, is_deleted, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $11)
         RETURNING *`,
        [medId, clinicId, rxId, med.medicine_name, med.type ?? '', med.dosage ?? '',
         med.frequency ?? '', med.duration ?? '', med.timing ?? '', med.notes ?? '', now]
      );
      medicines.push(medResult.rows[0] as PrescriptionMedicineRow);
    }

    // Insert lab tests
    const labTests: PrescriptionLabTestRow[] = [];
    for (const test of data.lab_tests) {
      const testId = uuidv4();
      const testResult = await client.query(
        `INSERT INTO prescription_lab_tests
           (id, clinic_id, prescription_id, test_name, category, notes, is_deleted, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7, $7)
         RETURNING *`,
        [testId, clinicId, rxId, test.test_name, test.category ?? '', test.notes ?? '', now]
      );
      labTests.push(testResult.rows[0] as PrescriptionLabTestRow);
    }

    return { ...prescription, medicines, lab_tests: labTests };
  });
}

export async function getPrescriptionById(
  clinicId: string,
  prescriptionId: string
): Promise<(PrescriptionRow & { medicines: PrescriptionMedicineRow[]; lab_tests: PrescriptionLabTestRow[]; doctor_name?: string }) | null> {
  const prescription = await queryOne<PrescriptionRow & { doctor_name?: string }>(
    `SELECT p.*, u.name as doctor_name
     FROM prescriptions p
     LEFT JOIN users u ON p.doctor_id = u.id
     WHERE p.id = $1 AND p.clinic_id = $2 AND p.is_deleted = false`,
    [prescriptionId, clinicId]
  );
  if (!prescription) return null;

  const medicines = await query<PrescriptionMedicineRow>(
    `SELECT * FROM prescription_medicines
     WHERE prescription_id = $1 AND clinic_id = $2 AND is_deleted = false
     ORDER BY created_at ASC`,
    [prescriptionId, clinicId]
  );

  const labTests = await query<PrescriptionLabTestRow>(
    `SELECT * FROM prescription_lab_tests
     WHERE prescription_id = $1 AND clinic_id = $2 AND is_deleted = false
     ORDER BY created_at ASC`,
    [prescriptionId, clinicId]
  );

  return { ...prescription, medicines, lab_tests: labTests };
}

export async function getRecentPrescriptions(
  clinicId: string,
  limit = 20
): Promise<(PrescriptionRow & { doctor_name?: string })[]> {
  return query<PrescriptionRow & { doctor_name?: string }>(
    `SELECT p.*, u.name as doctor_name
     FROM prescriptions p
     LEFT JOIN users u ON p.doctor_id = u.id
     WHERE p.clinic_id = $1 AND p.is_deleted = false AND status = 'finalized'
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [clinicId, limit]
  );
}

export async function getPrescriptionsByPatient(
  clinicId: string,
  patientId: string
): Promise<(PrescriptionRow & { doctor_name?: string })[]> {
  return query<PrescriptionRow & { doctor_name?: string }>(
    `SELECT p.*, u.name as doctor_name
     FROM prescriptions p
     LEFT JOIN users u ON p.doctor_id = u.id
     WHERE p.clinic_id = $1 AND p.patient_id = $2 AND p.is_deleted = false
     ORDER BY p.created_at DESC`,
    [clinicId, patientId]
  );
}

export async function finalizePrescription(
  clinicId: string,
  prescriptionId: string,
  signature: string,
  pdfHash: string
): Promise<PrescriptionRow | null> {
  const now = new Date().toISOString();

  return transaction(async (client: PoolClient) => {
    // Finalize the prescription
    const rxResult = await client.query(
      `UPDATE prescriptions
       SET status = 'finalized', signature = $1, pdf_hash = $2, wallet_deducted = 1, updated_at = $3
       WHERE id = $4 AND clinic_id = $5
       RETURNING *`,
      [signature, pdfHash, now, prescriptionId, clinicId]
    );
    if (rxResult.rows.length === 0) return null;
    const rx = rxResult.rows[0] as PrescriptionRow;

    // Auto-complete the active queue item for this patient today
    await client.query(
      `UPDATE queue
       SET status = 'completed', completed_at = $1, updated_at = $1
       WHERE clinic_id = $2
         AND patient_id = $3
         AND status = 'in_progress'
         AND DATE(added_at) = CURRENT_DATE
         AND is_deleted = false`,
      [now, clinicId, rx.patient_id]
    );

    return rx;
  });
}

export async function getTodayPrescriptionCount(clinicId: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM prescriptions
     WHERE clinic_id = $1 AND DATE(created_at) = CURRENT_DATE AND status = 'finalized' AND is_deleted = false`,
    [clinicId]
  );
  return row?.count ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM MEDICINES
// ═══════════════════════════════════════════════════════════════════════════════

export async function addCustomMedicine(
  clinicId: string,
  data: { name: string; type: string; strength: string }
): Promise<CustomMedicineRow> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const rows = await query<CustomMedicineRow>(
    `INSERT INTO custom_medicines (id, clinic_id, name, type, strength, manufacturer, usage_count, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '', 0, false, $6, $6)
     ON CONFLICT (clinic_id, name) DO UPDATE SET usage_count = custom_medicines.usage_count + 1, updated_at = $6
     RETURNING *`,
    [id, clinicId, data.name, data.type, data.strength, now]
  );
  return rows[0];
}

export async function incrementMedicineUsage(
  clinicId: string,
  name: string
): Promise<void> {
  await query(
    `UPDATE custom_medicines SET usage_count = usage_count + 1, updated_at = $1
     WHERE clinic_id = $2 AND name = $3 AND is_deleted = false`,
    [new Date().toISOString(), clinicId, name]
  );
}

export async function searchCustomMedicines(
  clinicId: string,
  searchQuery: string
): Promise<CustomMedicineRow[]> {
  const pattern = `%${searchQuery.trim()}%`;
  return query<CustomMedicineRow>(
    `SELECT * FROM custom_medicines
     WHERE clinic_id = $1 AND is_deleted = false AND name ILIKE $2
     ORDER BY usage_count DESC
     LIMIT 30`,
    [clinicId, pattern]
  );
}

export async function getFrequentCustomMedicines(
  clinicId: string,
  limit = 20
): Promise<CustomMedicineRow[]> {
  return query<CustomMedicineRow>(
    `SELECT * FROM custom_medicines
     WHERE clinic_id = $1 AND is_deleted = false
     ORDER BY usage_count DESC
     LIMIT $2`,
    [clinicId, limit]
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM LAB TESTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function addCustomLabTest(
  clinicId: string,
  data: { name: string; category: string }
): Promise<CustomLabTestRow> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const rows = await query<CustomLabTestRow>(
    `INSERT INTO custom_lab_tests (id, clinic_id, name, category, usage_count, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, false, $5, $5)
     ON CONFLICT (clinic_id, name) DO UPDATE SET usage_count = custom_lab_tests.usage_count + 1, updated_at = $5
     RETURNING *`,
    [id, clinicId, data.name, data.category, now]
  );
  return rows[0];
}

export async function incrementLabTestUsage(
  clinicId: string,
  name: string
): Promise<void> {
  await query(
    `UPDATE custom_lab_tests SET usage_count = usage_count + 1, updated_at = $1
     WHERE clinic_id = $2 AND name = $3 AND is_deleted = false`,
    [new Date().toISOString(), clinicId, name]
  );
}

export async function searchCustomLabTests(
  clinicId: string,
  searchQuery: string
): Promise<CustomLabTestRow[]> {
  const pattern = `%${searchQuery.trim()}%`;
  return query<CustomLabTestRow>(
    `SELECT * FROM custom_lab_tests
     WHERE clinic_id = $1 AND is_deleted = false AND (name ILIKE $2 OR category ILIKE $2)
     ORDER BY usage_count DESC
     LIMIT 30`,
    [clinicId, pattern]
  );
}

export async function getFrequentCustomLabTests(
  clinicId: string,
  limit = 20
): Promise<CustomLabTestRow[]> {
  return query<CustomLabTestRow>(
    `SELECT * FROM custom_lab_tests
     WHERE clinic_id = $1 AND is_deleted = false
     ORDER BY usage_count DESC
     LIMIT $2`,
    [clinicId, limit]
  );
}

export async function deleteCustomMedicine(
  clinicId: string,
  medicineId: string
): Promise<void> {
  await query(
    `UPDATE custom_medicines
     SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND clinic_id = $2`,
    [medicineId, clinicId]
  );
}

export async function deleteCustomLabTest(
  clinicId: string,
  testId: string
): Promise<void> {
  await query(
    `UPDATE custom_lab_tests
     SET is_deleted = true, updated_at = NOW()
     WHERE id = $1 AND clinic_id = $2`,
    [testId, clinicId]
  );
}
