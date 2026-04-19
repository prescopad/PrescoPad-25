import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { Prescription } from '../../types/prescription.types';
import { getPrescriptionById } from '../../services/dataService';
import type { AssistantStackParamList } from '../../types/navigation.types';

type ViewRouteProp = RouteProp<AssistantStackParamList, 'PrescriptionView'>;

export default function PrescriptionViewScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<ViewRouteProp>();
  const { prescriptionId } = route.params;

  const [rx, setRx] = useState<Prescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPrescription();
  }, [prescriptionId]);

  const loadPrescription = async () => {
    setIsLoading(true);
    try {
      const data = await getPrescriptionById(prescriptionId);
      setRx(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  if (isLoading || !rx) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
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
        <Text style={styles.headerTitle}>Prescription</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.paper}>
          {/* Rx Header & Date */}
          <View style={styles.rxRow}>
            <Text style={styles.rxSymbol}>Rx</Text>
            <View style={styles.rxMeta}>
              <Text style={styles.rxDate}>Date: {formatDate(rx.createdAt)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: rx.status === 'finalized' ? COLORS.successLight : COLORS.warningLight }]}>
                <Text style={[styles.statusText, { color: rx.status === 'finalized' ? COLORS.success : COLORS.warning }]}>
                  {rx.status === 'finalized' ? 'Issued' : 'Draft'}
                </Text>
              </View>
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

          {/* Medicines */}
          {rx.medicines.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MEDICINES</Text>
              {rx.medicines.map((med, index) => (
                <View key={med.id || index} style={styles.medRow}>
                  <View style={styles.medNumBadge}>
                    <Text style={styles.medNumText}>{index + 1}</Text>
                  </View>
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{med.medicineName}</Text>
                    <Text style={styles.medDetails}>
                      {[med.type, med.frequency, med.duration, med.timing].filter(Boolean).join(' | ')}
                    </Text>
                    {med.notes ? <Text style={styles.medNotes}>{med.notes}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Lab Tests */}
          {rx.labTests.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LAB TESTS</Text>
              {rx.labTests.map((test, index) => (
                <View key={test.id || index} style={styles.testRow}>
                  <Ionicons name="flask-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.testText}>
                    {test.testName}{test.notes ? ` - ${test.notes}` : ''}
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
              <Text style={styles.followUpText}>Follow-up: {formatDate(rx.followUpDate)}</Text>
            </View>
          ) : null}

          {/* Footer */}
          <View style={styles.paperFooter}>
            <Text style={styles.footerText}>Generated by PrescoPad</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, fontSize: 14, color: COLORS.textMuted },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: 50, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backButton: { padding: SPACING.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  headerSpacer: { width: 32 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },

  paper: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.xl, ...SHADOWS.lg,
  },
  rxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  rxSymbol: { fontSize: 28, fontWeight: '700', color: COLORS.primary, fontStyle: 'italic' },
  rxMeta: { alignItems: 'flex-end', gap: SPACING.xs },
  rxDate: { fontSize: 12, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '700' },

  patientSection: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.background, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  patientField: { flex: 1 },
  patientLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  patientValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },

  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5, marginBottom: SPACING.sm },
  diagnosisBox: {
    backgroundColor: COLORS.primarySurface, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopRightRadius: RADIUS.sm, borderBottomRightRadius: RADIUS.sm,
  },
  diagnosisText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  medRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  medNumBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md, marginTop: 2,
  },
  medNumText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  medInfo: { flex: 1 },
  medName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  medDetails: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  medNotes: { fontSize: 11, color: COLORS.textLight, fontStyle: 'italic', marginTop: 2 },

  testRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs, gap: SPACING.sm },
  testText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },

  adviceBox: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.warningLight,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopRightRadius: RADIUS.sm, borderBottomRightRadius: RADIUS.sm, gap: SPACING.sm,
  },
  adviceText: { fontSize: 12, color: COLORS.textSecondary, flex: 1, lineHeight: 18 },

  followUpRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  followUpText: { fontSize: 13, fontWeight: '600', color: COLORS.error },

  paperFooter: {
    marginTop: SPACING.xl, paddingTop: SPACING.md, borderTopWidth: 1,
    borderTopColor: COLORS.borderLight, alignItems: 'center',
  },
  footerText: { fontSize: 9, color: COLORS.textLight },
});
