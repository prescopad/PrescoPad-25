import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import * as DataService from '../services/data.service';
import { mapPrescription } from '../utils/mappers';

function requireClinic(req: AuthRequest): string {
  if (!req.clinicId) throw new AppError('No clinic associated with this account', 400);
  return req.clinicId;
}

function param(req: AuthRequest, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ─── Patients ────────────────────────────────────────────────────────────────

export async function listPatients(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { search, limit, offset } = req.query;
    const patients = await DataService.getPatients(
      clinicId,
      search as string | undefined,
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );
    res.json({ success: true, patients });
  } catch (error) { next(error); }
}

export async function getPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const patient = await DataService.getPatientById(clinicId, param(req, 'id'));
    if (!patient) throw new AppError('Patient not found', 404);
    res.json({ success: true, patient });
  } catch (error) { next(error); }
}

export async function createPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { name, age, gender, weight, phone, address, blood_group, allergies } = req.body;
    if (!name || age === undefined || !gender) {
      throw new AppError('name, age, and gender are required', 400);
    }
    const patient = await DataService.createPatient(clinicId, {
      name, age, gender, weight, phone, address, blood_group, allergies,
    });
    res.status(201).json({ success: true, patient });
  } catch (error) { next(error); }
}

export async function updatePatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const patient = await DataService.updatePatient(clinicId, param(req, 'id'), req.body);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json({ success: true, patient });
  } catch (error) { next(error); }
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export async function getTodayQueue(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const queue = await DataService.getTodayQueue(clinicId);
    res.json({ success: true, queue });
  } catch (error) { next(error); }
}

export async function getQueueStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const stats = await DataService.getTodayStats(clinicId);
    res.json({ success: true, stats });
  } catch (error) { next(error); }
}

export async function addToQueue(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { patient_id, added_by, notes } = req.body;
    if (!patient_id || !added_by) {
      throw new AppError('patient_id and added_by are required', 400);
    }
    const item = await DataService.addToQueue(clinicId, patient_id, added_by, notes);
    res.status(201).json({ success: true, item });
  } catch (error) { next(error); }
}

export async function updateQueueStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { status } = req.body;
    if (!status) throw new AppError('status is required', 400);
    const item = await DataService.updateQueueStatus(clinicId, param(req, 'id'), status);
    if (!item) throw new AppError('Queue item not found', 404);
    res.json({ success: true, item });
  } catch (error) { next(error); }
}

export async function removeFromQueue(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    await DataService.removeFromQueue(clinicId, param(req, 'id'));
    res.json({ success: true, message: 'Removed from queue' });
  } catch (error) { next(error); }
}

export async function getQueueFiltered(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { status, todayOnly, limit, offset } = req.query;
    const queue = await DataService.getQueueFiltered(clinicId, {
      status: status as string | undefined,
      todayOnly: todayOnly === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ success: true, queue });
  } catch (error) { next(error); }
}

export async function getQueueStatsFiltered(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const todayOnly = req.query.todayOnly === 'true';
    const stats = await DataService.getQueueStats(clinicId, todayOnly);
    res.json({ success: true, stats });
  } catch (error) { next(error); }
}

export async function getQueueHistoryByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const history = await DataService.getQueueHistoryByPatient(clinicId, param(req, 'patientId'));
    res.json({ success: true, history });
  } catch (error) { next(error); }
}

// ─── Prescriptions ───────────────────────────────────────────────────────────

export async function createPrescription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { patient_id, patient_name, patient_age, patient_gender, patient_phone,
            doctor_id, diagnosis, advice, follow_up_date, medicines, lab_tests } = req.body;
    if (!patient_id || !doctor_id || !diagnosis) {
      throw new AppError('patient_id, doctor_id, and diagnosis are required', 400);
    }
    const prescription = await DataService.createPrescription(clinicId, {
      patient_id, patient_name, patient_age, patient_gender, patient_phone,
      doctor_id, diagnosis, advice, follow_up_date,
      medicines: medicines || [],
      lab_tests: lab_tests || [],
    });
    res.status(201).json({ success: true, prescription: mapPrescription(prescription) });
  } catch (error) { next(error); }
}

export async function listPrescriptions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const prescriptions = await DataService.getRecentPrescriptions(clinicId, limit);
    res.json({ success: true, prescriptions: prescriptions.map(mapPrescription) });
  } catch (error) { next(error); }
}

export async function getPrescription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const prescription = await DataService.getPrescriptionById(clinicId, param(req, 'id'));
    if (!prescription) throw new AppError('Prescription not found', 404);
    res.json({ success: true, prescription: mapPrescription(prescription) });
  } catch (error) { next(error); }
}

export async function listPatientPrescriptions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const prescriptions = await DataService.getPrescriptionsByPatient(clinicId, param(req, 'patientId'));
    res.json({ success: true, prescriptions: prescriptions.map(mapPrescription) });
  } catch (error) { next(error); }
}

export async function finalizePrescription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { signature, pdf_hash } = req.body;
    if (!signature || !pdf_hash) {
      throw new AppError('signature and pdf_hash are required', 400);
    }
    const prescription = await DataService.finalizePrescription(clinicId, param(req, 'id'), signature, pdf_hash);
    if (!prescription) throw new AppError('Prescription not found', 404);
    res.json({ success: true, prescription: mapPrescription(prescription) });
  } catch (error) { next(error); }
}

export async function getTodayPrescriptionCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const count = await DataService.getTodayPrescriptionCount(clinicId);
    res.json({ success: true, count });
  } catch (error) { next(error); }
}

// ─── Custom Medicines ────────────────────────────────────────────────────────

export async function addCustomMedicine(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { name, type, strength } = req.body;
    if (!name) throw new AppError('name is required', 400);
    const medicine = await DataService.addCustomMedicine(clinicId, { name, type: type || 'Tablet', strength: strength || '' });
    res.status(201).json({ success: true, medicine });
  } catch (error) { next(error); }
}

export async function incrementMedicineUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { name } = req.body;
    if (!name) throw new AppError('name is required', 400);
    await DataService.incrementMedicineUsage(clinicId, name);
    res.json({ success: true });
  } catch (error) { next(error); }
}

export async function searchCustomMedicines(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const q = (req.query.q as string) || '';
    const medicines = await DataService.searchCustomMedicines(clinicId, q);
    res.json({ success: true, medicines });
  } catch (error) { next(error); }
}

export async function getFrequentCustomMedicines(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const medicines = await DataService.getFrequentCustomMedicines(clinicId, limit);
    res.json({ success: true, medicines });
  } catch (error) { next(error); }
}

// ─── Custom Lab Tests ────────────────────────────────────────────────────────

export async function addCustomLabTest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { name, category } = req.body;
    if (!name) throw new AppError('name is required', 400);
    const labTest = await DataService.addCustomLabTest(clinicId, { name, category: category || 'Other' });
    res.status(201).json({ success: true, labTest });
  } catch (error) { next(error); }
}

export async function incrementLabTestUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const { name } = req.body;
    if (!name) throw new AppError('name is required', 400);
    await DataService.incrementLabTestUsage(clinicId, name);
    res.json({ success: true });
  } catch (error) { next(error); }
}

export async function searchCustomLabTests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const q = (req.query.q as string) || '';
    const labTests = await DataService.searchCustomLabTests(clinicId, q);
    res.json({ success: true, labTests });
  } catch (error) { next(error); }
}

export async function getFrequentCustomLabTests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const labTests = await DataService.getFrequentCustomLabTests(clinicId, limit);
    res.json({ success: true, labTests });
  } catch (error) { next(error); }
}

export async function deleteCustomMedicine(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const medicineId = param(req, 'id');
    await DataService.deleteCustomMedicine(clinicId, medicineId);
    res.json({ success: true, message: 'Medicine deleted' });
  } catch (error) { next(error); }
}

export async function deleteCustomLabTest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clinicId = requireClinic(req);
    const testId = param(req, 'id');
    await DataService.deleteCustomLabTest(clinicId, testId);
    res.json({ success: true, message: 'Lab test deleted' });
  } catch (error) { next(error); }
}
