import { Router } from 'express';
import * as ClinicController from '../controllers/clinic.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// List all clinics (for assistant registration)
router.get('/list', ClinicController.listClinics);

// Get doctors by clinic ID
router.get('/:clinicId/doctors', ClinicController.listDoctorsByClinic);

// Get clinic details
router.get('/', ClinicController.getClinic);

// Create or update clinic (doctor only)
router.put('/', ClinicController.createOrUpdateClinic);

// Get doctor online status (for assistants to check)
router.get('/doctor-status', ClinicController.getDoctorStatus);

export default router;
