import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePatientStore } from '../../store/usePatientStore';
import { useQueueStore } from '../../store/useQueueStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Patient } from '../../types/patient.types';
import { Prescription } from '../../types/prescription.types';
import { getPrescriptionsByPatient } from '../../services/dataService';
import type { AssistantStackParamList } from '../../types/navigation.types';

type NavigationProp = NativeStackNavigationProp<AssistantStackParamList>;
type DetailRouteProp = RouteProp<AssistantStackParamList, 'PatientDetail'>;

export default function PatientDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const { patientId } = route.params;

  const getPatientById = usePatientStore((s) => s.getPatientById);
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const user = useAuthStore((s) => s.user);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);
  const [isLoadingRx, setIsLoadingRx] = useState(true);
  const [addingToQueue, setAddingToQueue] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPatient();
      loadPrescriptions();
    }, [patientId]),
  );

  const loadPatient = async () => {
    setIsLoadingPatient(true);
    try {
      const data = await getPatientById(patientId);
      setPatient(data);
    } catch {
      Alert.alert('Error', 'Failed to load patient information.');
    } finally {
      setIsLoadingPatient(false);
    }
  };

  const loadPrescriptions = async () => {
    setIsLoadingRx(true);
    try {
      const rxList = await getPrescriptionsByPatient(patientId);
      setPrescriptions(rxList);
    } catch {
      // Silently handle
    } finally {
      setIsLoadingRx(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!user || !patient) return;
    setAddingToQueue(true);
    try {
      await addToQueue(patient.id, user.id);
      Alert.alert('Success', `${patient.name} has been added to the queue.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to add to queue';
      Alert.alert('Error', message);
    } finally {
      setAddingToQueue(false);
    }
  };

  const handleEditPatient = () => {
    navigation.navigate('AddPatientForm');
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoadingPatient) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
        <Ionicons name="person-outline" size={56} color={COLORS.textLight} />
        <Text style={styles.notFoundText}>Patient not found</Text>
        <TouchableOpacity
          style={styles.goBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Details</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEditPatient}
        >
          <Ionicons name="create-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {patient.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.nameSection}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <Text style={styles.patientSubtitle}>
                {patient.age} years / {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoRow
              icon="call-outline"
              label="Phone"
              value={patient.phone || '--'}
            />
            <InfoRow
              icon="location-outline"
              label="Address"
              value={patient.address || '--'}
            />
            <InfoRow
              icon="water-outline"
              label="Blood Group"
              value={patient.bloodGroup || '--'}
            />
            <InfoRow
              icon="fitness-outline"
              label="Weight"
              value={patient.weight ? `${patient.weight} kg` : '--'}
            />
            <InfoRow
              icon="warning-outline"
              label="Allergies"
              value={patient.allergies || 'None'}
              isLast
            />
          </View>
        </View>

        {/* Add to Queue Button */}
        <TouchableOpacity
          style={[styles.addQueueButton, addingToQueue && styles.addQueueButtonDisabled]}
          onPress={handleAddToQueue}
          disabled={addingToQueue}
          activeOpacity={0.85}
        >
          {addingToQueue ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={22} color={COLORS.white} />
              <Text style={styles.addQueueButtonText}>Add to Queue</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Previous Prescriptions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.sectionTitle}>Previous Prescriptions</Text>
            <Text style={styles.sectionCount}>({prescriptions.length})</Text>
          </View>

          {isLoadingRx ? (
            <View style={styles.rxLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : prescriptions.length === 0 ? (
            <View style={styles.emptyRxContainer}>
              <Ionicons
                name="document-outline"
                size={40}
                color={COLORS.textLight}
              />
              <Text style={styles.emptyRxText}>No prescriptions yet</Text>
            </View>
          ) : (
            prescriptions.map((rx) => (
              <TouchableOpacity
                key={rx.id}
                style={styles.rxCard}
                onPress={() => navigation.navigate('PrescriptionView', { prescriptionId: rx.id })}
                activeOpacity={0.7}
              >
                <View style={styles.rxCardHeader}>
                  <View style={styles.rxIdBadge}>
                    <Text style={styles.rxIdText}>{rx.id}</Text>
                  </View>
                  <Text style={styles.rxDate}>{formatDate(rx.createdAt)}</Text>
                </View>

                {rx.diagnosis ? (
                  <View style={styles.rxDiagnosisRow}>
                    <Text style={styles.rxDiagnosisLabel}>Diagnosis:</Text>
                    <Text style={styles.rxDiagnosis} numberOfLines={2}>
                      {rx.diagnosis}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.rxStatsRow}>
                  {rx.medicines.length > 0 && (
                    <View style={styles.rxStat}>
                      <Ionicons
                        name="medkit-outline"
                        size={14}
                        color={COLORS.primary}
                      />
                      <Text style={styles.rxStatText}>
                        {rx.medicines.length} medicine{rx.medicines.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {rx.labTests.length > 0 && (
                    <View style={styles.rxStat}>
                      <Ionicons
                        name="flask-outline"
                        size={14}
                        color={COLORS.warning}
                      />
                      <Text style={styles.rxStatText}>
                        {rx.labTests.length} test{rx.labTests.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {rx.followUpDate && (
                    <View style={styles.rxStat}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={COLORS.success}
                      />
                      <Text style={styles.rxStatText}>
                        Follow-up: {formatDate(rx.followUpDate)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ---- Info Row Sub-component ---- */
interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}

function InfoRow({ icon, label, value, isLast }: InfoRowProps): React.JSX.Element {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <View style={styles.infoRowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.infoRowContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
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
  notFoundText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
  goBackButton: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  goBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingTop: 52,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },

  /* Info Card */
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    ...SHADOWS.md,
    overflow: 'hidden',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.primarySurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  avatarLargeText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  nameSection: {
    flex: 1,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  patientSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoGrid: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  infoRowContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 1,
  },

  /* Add to Queue */
  addQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  addQueueButtonDisabled: {
    opacity: 0.6,
  },
  addQueueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  /* Prescriptions Section */
  sectionContainer: {
    marginTop: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  sectionCount: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rxLoading: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  emptyRxContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
  },
  emptyRxText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },

  /* Prescription Card */
  rxCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  rxCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  rxIdBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  rxIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rxDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  rxDiagnosisRow: {
    marginBottom: SPACING.sm,
  },
  rxDiagnosisLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rxDiagnosis: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  rxStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  rxStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  rxStatText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
