import api from './api';
import { APP_CONFIG } from '../constants/config';

export interface DiarizedSegment {
  start: number;
  end: number;
  speaker: 'Doctor' | 'Patient' | 'Unknown';
  text: string;
}

export interface AutofillMedicine {
  medicine_name: string;
  type: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  notes: string;
}

export interface AutofillLabTest {
  test_name: string;
  category: string;
  notes: string;
}

export interface PrescriptionAutofill {
  diagnosis: string;
  advice: string;
  follow_up_date: string;
  medicines: AutofillMedicine[];
  lab_tests: AutofillLabTest[];
}

export interface TranscriptionResult {
  transcript_id: string;
  full_transcript: string;
  diarized_transcript: DiarizedSegment[];
  prescription_autofill: PrescriptionAutofill;
}

export interface Transcript {
  id: string;
  doctor_id: string;
  patient_id: string;
  clinic_id: string;
  full_transcript: string;
  diarized_transcript: DiarizedSegment[];
  medical_extraction: Record<string, unknown>;
  audio_duration_seconds: number;
  created_at: string;
}

/**
 * Upload an audio file to the backend for transcription and medical extraction.
 * Returns auto-fill data for the prescription draft.
 */
export async function analyzeConsultationAudio(
  audioUri: string,
  patientId: string,
): Promise<TranscriptionResult> {
  const formData = new FormData();

  // React Native / Expo FormData accepts { uri, name, type }
  formData.append('audio', {
    uri: audioUri,
    name: 'consultation.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);

  formData.append('patient_id', patientId);

  const response = await api.post('/transcription/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000, // transcription can take up to 2 min
  });

  return response.data.result as TranscriptionResult;
}

/**
 * Fetch all transcripts for a patient (newest first).
 */
export async function getPatientTranscripts(patientId: string): Promise<Transcript[]> {
  const response = await api.get(`/transcription/patient/${patientId}`);
  return response.data.transcripts as Transcript[];
}

/**
 * Fetch a single transcript by ID.
 */
export async function getTranscript(transcriptId: string): Promise<Transcript> {
  const response = await api.get(`/transcription/${transcriptId}`);
  return response.data.transcript as Transcript;
}
