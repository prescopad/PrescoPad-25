import { query } from '../config/database';

// Helper to parse date ranges
function getDateRange(period: 'today' | 'week' | 'month'): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    case 'week':
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: weekAgo, to: new Date() };
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: monthStart, to: new Date() };
  }
}

// TypeScript Interfaces
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

// Get prescription statistics for a period
export async function getPrescriptionStats(
  clinicId: string,
  period: 'today' | 'week' | 'month'
): Promise<PrescriptionStats> {
  const { from, to } = getDateRange(period);

  const result = await query<{
    total: string;
    finalized: string;
    draft: string;
  }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) as finalized,
       SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
     FROM prescriptions
     WHERE clinic_id = $1
       AND created_at >= $2
       AND created_at < $3
       AND is_deleted = false`,
    [clinicId, from.toISOString(), to.toISOString()]
  );

  return {
    total: Number(result.rows[0]?.total || 0),
    finalized: Number(result.rows[0]?.finalized || 0),
    draft: Number(result.rows[0]?.draft || 0),
  };
}

// Get revenue/earnings for a period
export async function getEarningsStats(
  clinicId: string,
  period: 'today' | 'week' | 'month'
): Promise<EarningsStats> {
  const { from, to } = getDateRange(period);

  // Query transactions from all users in this clinic
  const result = await query<{
    total_debit: string;
    total_credit: string;
    prescription_count: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) as total_debit,
       COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) as total_credit,
       COUNT(DISTINCT CASE WHEN t.type = 'debit' AND t.reference_id LIKE 'RX-%' THEN t.reference_id END) as prescription_count
     FROM transactions t
     JOIN wallets w ON t.wallet_id = w.id
     JOIN users u ON w.user_id = u.id
     WHERE u.clinic_id = $1
       AND t.created_at >= $2
       AND t.created_at < $3`,
    [clinicId, from.toISOString(), to.toISOString()]
  );

  return {
    totalDebit: parseFloat(result.rows[0]?.total_debit || '0'),
    totalCredit: parseFloat(result.rows[0]?.total_credit || '0'),
    netEarnings: parseFloat(result.rows[0]?.total_debit || '0'), // Debit = earnings (prescription fees)
    prescriptionRevenue: Number(result.rows[0]?.prescription_count || 0),
  };
}

// Get patient statistics for a period
export async function getPatientStats(
  clinicId: string,
  period: 'today' | 'week' | 'month'
): Promise<PatientStats> {
  const { from, to } = getDateRange(period);

  const result = await query<{
    new_patients: string;
    total_patients: string;
  }>(
    `SELECT
       COUNT(CASE WHEN created_at >= $2 AND created_at < $3 THEN 1 END) as new_patients,
       COUNT(*) as total_patients
     FROM patients
     WHERE clinic_id = $1 AND is_deleted = false`,
    [clinicId, from.toISOString(), to.toISOString()]
  );

  return {
    newPatients: Number(result.rows[0]?.new_patients || 0),
    totalPatients: Number(result.rows[0]?.total_patients || 0),
  };
}

// Get queue/consultation statistics
export async function getConsultationStats(
  clinicId: string,
  period: 'today' | 'week' | 'month'
): Promise<ConsultationStats> {
  const { from, to } = getDateRange(period);

  const result = await query<{
    total_consultations: string;
    completed: string;
    cancelled: string;
    avg_wait_minutes: string;
    avg_consult_minutes: string;
  }>(
    `SELECT
       COUNT(*) as total_consultations,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
       AVG(CASE WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (started_at - added_at))/60 END) as avg_wait_minutes,
       AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - started_at))/60 END) as avg_consult_minutes
     FROM queue
     WHERE clinic_id = $1
       AND added_at >= $2
       AND added_at < $3
       AND is_deleted = false`,
    [clinicId, from.toISOString(), to.toISOString()]
  );

  return {
    totalConsultations: Number(result.rows[0]?.total_consultations || 0),
    completed: Number(result.rows[0]?.completed || 0),
    cancelled: Number(result.rows[0]?.cancelled || 0),
    avgWaitMinutes: Math.round(Number(result.rows[0]?.avg_wait_minutes || 0)),
    avgConsultMinutes: Math.round(Number(result.rows[0]?.avg_consult_minutes || 0)),
  };
}

// Get popular medicines/tests
export async function getPopularItems(
  clinicId: string,
  period: 'today' | 'week' | 'month'
): Promise<PopularItemsStats> {
  // Note: usage_count is cumulative, not time-based
  // But we can still show top items for the period

  const topMedicines = await query<{ name: string; usage_count: number }>(
    `SELECT name, usage_count
     FROM custom_medicines
     WHERE clinic_id = $1 AND is_deleted = false
     ORDER BY usage_count DESC
     LIMIT 5`,
    [clinicId]
  );

  const topTests = await query<{ name: string; usage_count: number }>(
    `SELECT name, usage_count
     FROM custom_lab_tests
     WHERE clinic_id = $1 AND is_deleted = false
     ORDER BY usage_count DESC
     LIMIT 5`,
    [clinicId]
  );

  return {
    topMedicines: topMedicines.map((medicine) => ({ name: medicine.name, count: medicine.usage_count })),
    topTests: topTests.map((test) => ({ name: test.name, count: test.usage_count })),
  };
}

// Get comprehensive analytics (all stats at once)
export async function getComprehensiveAnalytics(
  clinicId: string,
  period: 'today' | 'week' | 'month'
): Promise<ComprehensiveAnalytics> {
  const [prescriptions, earnings, patients, consultations, popular] = await Promise.all([
    getPrescriptionStats(clinicId, period),
    getEarningsStats(clinicId, period),
    getPatientStats(clinicId, period),
    getConsultationStats(clinicId, period),
    getPopularItems(clinicId, period),
  ]);

  return {
    prescriptions,
    earnings,
    patients,
    consultations,
    popular,
  };
}
