import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import * as ConnectionService from '../services/connection.service';

export async function inviteAssistant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'doctor') throw new AppError('Only doctors can invite assistants', 403);
    if (!req.clinicId) throw new AppError('You must set up your clinic first', 400);
    const { assistantPhone } = req.body;
    if (!assistantPhone) throw new AppError('Assistant phone number is required', 400);
    const request = await ConnectionService.inviteAssistant(req.userId!, req.clinicId, assistantPhone);

    // Map snake_case to camelCase
    const mappedRequest = {
      id: request.id,
      doctorId: request.doctor_id,
      assistantId: request.assistant_id,
      clinicId: request.clinic_id,
      initiatedBy: request.initiated_by,
      status: request.status,
      createdAt: request.created_at,
    };

    res.status(201).json({ success: true, request: mappedRequest });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError((error as Error).message, 400));
  }
}

export async function requestToJoin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'assistant') throw new AppError('Only assistants can request to join', 403);
    const { doctorCode } = req.body;
    if (!doctorCode) throw new AppError('Doctor code is required', 400);
    const request = await ConnectionService.requestToJoin(req.userId!, doctorCode);

    // Map snake_case to camelCase
    const mappedRequest = {
      id: request.id,
      doctorId: request.doctor_id,
      assistantId: request.assistant_id,
      clinicId: request.clinic_id,
      initiatedBy: request.initiated_by,
      status: request.status,
      createdAt: request.created_at,
    };

    res.status(201).json({ success: true, request: mappedRequest });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError((error as Error).message, 400));
  }
}

export async function acceptRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestId = req.params.requestId as string;
    await ConnectionService.acceptRequest(requestId, req.userId!);
    res.json({ success: true, message: 'Connection accepted' });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError((error as Error).message, 400));
  }
}

export async function rejectRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const requestId = req.params.requestId as string;
    await ConnectionService.rejectRequest(requestId, req.userId!);
    res.json({ success: true, message: 'Connection rejected' });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError((error as Error).message, 400));
  }
}

export async function getPendingRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await ConnectionService.getPendingRequests(req.userId!, req.userRole!);

    // Map snake_case to camelCase for frontend
    const mappedRequests = requests.map(req => ({
      id: req.id,
      doctorId: req.doctor_id,
      assistantId: req.assistant_id,
      clinicId: req.clinic_id,
      initiatedBy: req.initiated_by,
      status: req.status,
      createdAt: req.created_at,
      doctorName: req.doctor_name,
      assistantName: req.assistant_name,
      clinicName: req.clinic_name,
      doctorCode: req.doctor_code,
      doctorPhone: req.doctor_phone,
      assistantPhone: req.assistant_phone,
      // Assistant profile details
      qualification: req.qualification,
      experienceYears: req.experience_years,
      city: req.city,
      assistantAddress: req.assistant_address,
    }));

    res.json({ success: true, requests: mappedRequests });
  } catch (error) {
    next(error);
  }
}

export async function getTeamMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.clinicId) throw new AppError('Not connected to a clinic', 400);
    const members = await ConnectionService.getTeamMembers(req.clinicId);

    // Map snake_case to camelCase for frontend
    const mappedMembers = members.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      role: m.role,
      lastActiveAt: m.last_active_at,
      qualification: m.qualification,
      experienceYears: m.experience_years,
      profileAddress: m.profile_address,
      city: m.city,
      specialty: m.specialty,
      regNumber: m.reg_number,
    }));

    res.json({ success: true, members: mappedMembers });
  } catch (error) {
    next(error);
  }
}

export async function disconnectAssistant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'doctor') throw new AppError('Only doctors can disconnect assistants', 403);
    if (!req.clinicId) throw new AppError('No clinic', 400);
    const assistantId = req.params.assistantId as string;
    await ConnectionService.disconnectAssistant(req.clinicId, assistantId);
    res.json({ success: true, message: 'Assistant disconnected' });
  } catch (error) {
    next(error);
  }
}
