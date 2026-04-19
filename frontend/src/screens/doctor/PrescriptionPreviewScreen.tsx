import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { usePrescriptionStore } from '../../store/usePrescriptionStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import { generatePrescriptionPDF } from '../../services/pdfService';
import { hashPDF } from '../../services/cryptoService';
import { DoctorStackParamList } from '../../types/navigation.types';

type Props = NativeStackScreenProps<DoctorStackParamList, 'PrescriptionPreview'>;

export default function PrescriptionPreviewScreen({ navigation, route }: Props): React.JSX.Element {
  const prescriptionId = route.params.prescriptionId;
  const readOnly = route.params.readOnly ?? false;
  const { currentPrescription, loadPrescription, finalizePrescription } = usePrescriptionStore();
  const { canAfford, deductForPrescription, balance } = useWalletStore();
  const { clinic, doctorProfile } = useClinicStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (prescriptionId) {
      loadPrescription(prescriptionId);
    }
  }, [prescriptionId]);

  const rx = currentPrescription;

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleSignAndIssue = async () => {
    if (!rx) return;

    setIsSigning(true);
    try {
      // Step 1: Check wallet balance
      const affordable = canAfford();
      if (!affordable) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${APP_CONFIG.wallet.currencySymbol}${APP_CONFIG.wallet.costPerPrescription} to issue a prescription. Current balance: ${APP_CONFIG.wallet.currencySymbol}${balance}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Recharge',
              onPress: () => navigation.getParent()?.navigate('DoctorWallet'),
            },
          ],
        );
        setIsSigning(false);
        return;
      }

      // Step 2: Generate PDF
      const pdfPath = await generatePrescriptionPDF(rx, clinic, doctorProfile);

      // Step 3: Hash PDF
      const pdfHash = await hashPDF(pdfPath);

      // Step 4: Finalize prescription
      const signature = doctorProfile?.signatureBase64 || 'digital-signature';
      await finalizePrescription(rx.id, signature, pdfPath, pdfHash);

      // Step 5: Deduct wallet
      await deductForPrescription();

      // Step 6: Navigate to success
      const updatedRx = usePrescriptionStore.getState().currentPrescription;
      navigation.replace('RxSuccess', { prescription: updatedRx || rx });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to issue prescription';
      Alert.alert('Error', msg);
    } finally {
      setIsSigning(false);
    }
  };

  if (!rx) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading prescription...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prescription Preview</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Prescription Paper */}
        <View style={styles.paper}>
          {/* Clinic Header */}
          <View style={styles.clinicHeader}>
            <Text style={styles.clinicName}>{clinic?.name || 'PrescoPad Clinic'}</Text>
            {clinic?.address ? (
              <Text style={styles.clinicInfo}>{clinic.address}</Text>
            ) : null}
            {(clinic?.phone || clinic?.email) ? (
              <Text style={styles.clinicInfo}>
                {[clinic?.phone, clinic?.email].filter(Boolean).join(' | ')}
              </Text>
            ) : null}
            <Text style={styles.doctorInfo}>
              Dr. {doctorProfile?.name || 'Doctor'}
              {doctorProfile?.specialty ? ` | ${doctorProfile.specialty}` : ''}
              {doctorProfile?.regNumber ? ` | Reg: ${doctorProfile.regNumber}` : ''}
            </Text>
          </View>

          {/* Rx Header & Date */}
          <View style={styles.rxRow}>
            <Text style={styles.rxSymbol}>Rx</Text>
            <View style={styles.rxMeta}>
              <Text style={styles.rxDate}>Date: {formatDate(rx.createdAt)}</Text>
              <Text style={styles.rxId}>ID: {rx.id}</Text>
            </View>
          </View>

          {/* Patient Details */}
          <View style={styles.patientSection}>
            <View style={styles.patientField}>
              <Text style={styles.patientLabel}>PATIENT</Text>
              <Text style={styles.patientValue}>{rx.patientName}</Text>
            </View>
            <View style={styles.patientField}>
              <Text style={styles.patientLabel}>AGE / GENDER</Text>
              <Text style={styles.patientValue}>{rx.patientAge} yrs / {rx.patientGender}</Text>
            </View>
            <View style={styles.patientField}>
              <Text style={styles.patientLabel}>PHONE</Text>
              <Text style={styles.patientValue}>{rx.patientPhone || 'N/A'}</Text>
            </View>
          </View>

          {/* Diagnosis */}
          {rx.diagnosis ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DIAGNOSIS</Text>
              <View style={styles.diagnosisBox}>
                <Text style={styles.diagnosisText}>{rx.diagnosis}</Text>
              </View>
            </View>
          ) : null}

          {/* Medicines Table */}
          {rx.medicines.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MEDICINES</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colNum]}>#</Text>
                  <Text style={[styles.tableHeaderCell, styles.colName]}>Name</Text>
                  <Text style={[styles.tableHeaderCell, styles.colDosage]}>Dosage</Text>
                  <Text style={[styles.tableHeaderCell, styles.colDuration]}>Duration</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTiming]}>Timing</Text>
                </View>
                {/* Table Rows */}
                {rx.medicines.map((med, index) => (
                  <View key={med.id || index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colNum]}>{index + 1}</Text>
                    <View style={styles.colName}>
                      <Text style={styles.medName}>{med.medicineName}</Text>
                      <Text style={styles.medType}>{med.type}</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.colDosage]}>{med.frequency}</Text>
                    <Text style={[styles.tableCell, styles.colDuration]}>{med.duration}</Text>
                    <Text style={[styles.tableCell, styles.colTiming]}>{med.timing}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Lab Tests */}
          {rx.labTests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LAB TESTS / INVESTIGATIONS</Text>
              {rx.labTests.map((test, index) => (
                <View key={test.id || index} style={styles.labTestRow}>
                  <Ionicons name="flask-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.labTestText}>
                    {test.testName}
                    {test.notes ? ` - ${test.notes}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Advice */}
          {rx.advice ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ADVICE</Text>
              <View style={styles.adviceBox}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.warning} />
                <Text style={styles.adviceText}>{rx.advice}</Text>
              </View>
            </View>
          ) : null}

          {/* Follow-up */}
          {rx.followUpDate ? (
            <View style={styles.followUpRow}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.error} />
              <Text style={styles.followUpText}>
                Follow-up: {formatDate(rx.followUpDate)}
              </Text>
            </View>
          ) : null}

          {/* Signature Area */}
          <View style={styles.signatureSection}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureDoctorName}>Dr. {doctorProfile?.name || 'Doctor'}</Text>
              {doctorProfile?.regNumber ? (
                <Text style={styles.signatureReg}>Reg. No: {doctorProfile.regNumber}</Text>
              ) : null}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.paperFooter}>
            <Text style={styles.footerText}>Generated by PrescoPad - Digital Prescription System</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sign & Issue Button — hidden in read-only mode */}
      {!readOnly && (
        <View style={styles.bottomBar}>
          <View style={styles.costInfo}>
            <Ionicons name="wallet-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.costText}>
              Cost: {APP_CONFIG.wallet.currencySymbol}{APP_CONFIG.wallet.costPerPrescription}
            </Text>
            <Text style={styles.balanceText}>
              Balance: {APP_CONFIG.wallet.currencySymbol}{balance}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.signButton, isSigning && styles.buttonDisabled]}
            onPress={handleSignAndIssue}
            disabled={isSigning}
            activeOpacity={0.8}
          >
            {isSigning ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
                <Text style={styles.signButtonText}>Sign & Issue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 50,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },

  // Paper styling
  paper: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  clinicHeader: {
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary,
    paddingBottom: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  clinicName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  clinicInfo: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  doctorInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontWeight: '600',
  },
  rxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  rxSymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  rxMeta: {
    alignItems: 'flex-end',
  },
  rxDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  rxId: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },

  // Patient section
  patientSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  patientField: {
    flex: 1,
  },
  patientLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  patientValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  diagnosisBox: {
    backgroundColor: COLORS.primarySurface,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopRightRadius: RADIUS.sm,
    borderBottomRightRadius: RADIUS.sm,
  },
  diagnosisText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Medicines table
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  colNum: {
    width: 24,
    textAlign: 'center',
  },
  colName: {
    flex: 2,
    paddingHorizontal: SPACING.xs,
  },
  colDosage: {
    flex: 1.2,
    paddingHorizontal: SPACING.xs,
  },
  colDuration: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  colTiming: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  medName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  medType: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // Lab tests
  labTestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  labTestText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },

  // Advice
  adviceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopRightRadius: RADIUS.sm,
    borderBottomRightRadius: RADIUS.sm,
    gap: SPACING.sm,
  },
  adviceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // Follow-up
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  followUpText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Signature
  signatureSection: {
    marginTop: SPACING.xxxl,
    alignItems: 'flex-end',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: COLORS.textSecondary,
    width: 180,
    paddingTop: SPACING.xs,
    alignItems: 'center',
  },
  signatureDoctorName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  signatureReg: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // Paper footer
  paperFooter: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 9,
    color: COLORS.textLight,
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.lg,
  },
  costInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  costText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  balanceText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  signButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
