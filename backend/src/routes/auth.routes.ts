import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate, phoneValidation, roleValidation } from '../middleware/validate';

const router = Router();

// Send OTP to phone
router.post(
  '/send-otp',
  validate([phoneValidation, roleValidation]),
  AuthController.sendOTP
);

// Verify OTP
router.post(
  '/verify-otp',
  validate([
    phoneValidation,
    roleValidation,
    { field: 'otp', required: true, type: 'string', minLength: 6, maxLength: 6 },
  ]),
  AuthController.verifyOTPHandler
);

// Password login
router.post(
  '/login',
  validate([
    phoneValidation,
    roleValidation,
    { field: 'password', required: true, type: 'string', minLength: 6 },
  ]),
  AuthController.login
);

// Refresh access token
router.post('/refresh-token', AuthController.refreshToken);

// Complete registration (new user profile setup)
router.post('/complete-registration', authenticate, AuthController.completeRegistration);

// Refresh session (get fresh tokens with updated clinicId)
router.post('/refresh-session', authenticate, AuthController.refreshSession);

// Get current user (protected)
router.get('/me', authenticate, AuthController.getMe);

// Update profile (protected)
router.put('/profile', authenticate, AuthController.updateProfile);

// Heartbeat - update last_active_at (protected)
router.post('/heartbeat', authenticate, AuthController.heartbeat);

export default router;
