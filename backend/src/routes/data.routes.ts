import { Router } from 'express';
import * as DataController from '../controllers/data.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Patients ────────────────────────────────────────────────────────────────
router.get('/patients', DataController.listPatients);
router.get('/patients/:id', DataController.getPatient);
router.post('/patients', DataController.createPatient);
router.put('/patients/:id', DataController.updatePatient);

// ─── Queue ───────────────────────────────────────────────────────────────────
router.get('/queue/today', DataController.getTodayQueue);
router.get('/queue/stats', DataController.getQueueStats);
router.get('/queue/filtered', DataController.getQueueFiltered);
router.get('/queue/stats/filtered', DataController.getQueueStatsFiltered);
router.get('/queue/patient/:patientId', DataController.getQueueHistoryByPatient);
router.post('/queue', DataController.addToQueue);
router.put('/queue/:id/status', DataController.updateQueueStatus);
router.delete('/queue/:id', DataController.removeFromQueue);

// ─── Prescriptions ───────────────────────────────────────────────────────────
router.get('/prescriptions/today/count', DataController.getTodayPrescriptionCount);
router.get('/prescriptions/patient/:patientId', DataController.listPatientPrescriptions);
router.get('/prescriptions/:id', DataController.getPrescription);
router.get('/prescriptions', DataController.listPrescriptions);
router.post('/prescriptions', DataController.createPrescription);
router.put('/prescriptions/:id/finalize', DataController.finalizePrescription);

// ─── Custom Medicines ────────────────────────────────────────────────────────
router.get('/custom-medicines/frequent', DataController.getFrequentCustomMedicines);
router.get('/custom-medicines', DataController.searchCustomMedicines);
router.post('/custom-medicines', DataController.addCustomMedicine);
router.put('/custom-medicines/usage', DataController.incrementMedicineUsage);
router.delete('/custom-medicines/:id', DataController.deleteCustomMedicine);

// ─── Custom Lab Tests ────────────────────────────────────────────────────────
router.get('/custom-lab-tests/frequent', DataController.getFrequentCustomLabTests);
router.get('/custom-lab-tests', DataController.searchCustomLabTests);
router.post('/custom-lab-tests', DataController.addCustomLabTest);
router.put('/custom-lab-tests/usage', DataController.incrementLabTestUsage);
router.delete('/custom-lab-tests/:id', DataController.deleteCustomLabTest);

export default router;
