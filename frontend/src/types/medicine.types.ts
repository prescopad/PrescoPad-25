export enum MedicineType {
  TABLET = 'Tablet',
  CAPSULE = 'Capsule',
  SYRUP = 'Syrup',
  INJECTION = 'Injection',
  DROPS = 'Drops',
  CREAM = 'Cream',
  OINTMENT = 'Ointment',
  INHALER = 'Inhaler',
  POWDER = 'Powder',
  GEL = 'Gel',
  SPRAY = 'Spray',
  PATCH = 'Patch',
  SUPPOSITORY = 'Suppository',
}

export interface Medicine {
  id: string;
  name: string;
  type: MedicineType;
  strength: string;
  manufacturer: string;
  isCustom: boolean;
  usageCount: number;
}

export interface LabTest {
  id: string;
  name: string;
  category: string;
  isCustom: boolean;
  usageCount: number;
}

export const LAB_TEST_CATEGORIES = [
  'Blood',
  'Urine',
  'Imaging',
  'Cardiac',
  'Liver',
  'Kidney',
  'Thyroid',
  'Diabetes',
  'Lipid',
  'Infection',
  'Other',
] as const;

export const FREQUENCY_OPTIONS = [
  '1-0-0 (Morning)',
  '0-1-0 (Afternoon)',
  '0-0-1 (Night)',
  '1-0-1 (Morning & Night)',
  '1-1-1 (Thrice daily)',
  '1-1-0 (Morning & Afternoon)',
  '0-1-1 (Afternoon & Night)',
  '1-1-1-1 (Four times)',
  'SOS (As needed)',
  'Once weekly',
] as const;

export const TIMING_OPTIONS = [
  'Before Food',
  'After Food',
  'With Food',
  'Empty Stomach',
  'At Bedtime',
  'As Directed',
] as const;

export const DURATION_OPTIONS = [
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '21 days',
  '30 days',
  '60 days',
  '90 days',
  'As directed',
] as const;
