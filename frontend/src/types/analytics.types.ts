export interface PrescriptionStats {
  total: number;
  finalized: number;
  draft: number;
}

export interface EarningsStats {
  totalDebit: number;
  totalCredit: number;
  netEarnings: number;
  prescriptionRevenue: number;
}

export interface PatientStats {
  newPatients: number;
  totalPatients: number;
}

export interface ConsultationStats {
  totalConsultations: number;
  completed: number;
  cancelled: number;
  avgWaitMinutes: number;
  avgConsultMinutes: number;
}

export interface PopularItem {
  name: string;
  count: number;
}

export interface PopularItemsStats {
  topMedicines: PopularItem[];
  topTests: PopularItem[];
}

export interface ComprehensiveAnalytics {
  prescriptions: PrescriptionStats;
  earnings: EarningsStats;
  patients: PatientStats;
  consultations: ConsultationStats;
  popular: PopularItemsStats;
}

export type TimePeriod = 'today' | 'week' | 'month';
