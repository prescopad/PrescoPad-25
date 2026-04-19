import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePrescriptionStore } from '../../store/usePrescriptionStore';
import { useAuthStore } from '../../store/useAuthStore';
import { PrescriptionMedicine, PrescriptionLabTest } from '../../types/prescription.types';
import { DoctorStackParamList } from '../../types/navigation.types';

type MedicineDraft = Omit<PrescriptionMedicine, 'id' | 'prescriptionId'>;
type LabTestDraft = Omit<PrescriptionLabTest, 'id' | 'prescriptionId'>;

type ConsultScreenProps = NativeStackScreenProps<DoctorStackParamList, 'Consult'>;

export default function ConsultScreen({ navigation, route }: ConsultScreenProps): React.JSX.Element {
  const { queueItem, patient } = route.params;
  const user = useAuthStore((s) => s.user);
  const {
    currentDraft,
    updateDraft,
    removeMedicine,
    removeLabTest,
    resetDraft,
    createPrescription,
    isLoading,
  } = usePrescriptionStore();

  const [diagnosis, setDiagnosis] = useState(currentDraft.diagnosis);
  const [advice, setAdvice] = useState(currentDraft.advice);
  const [followUpDate, setFollowUpDate] = useState(currentDraft.followUpDate);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Initialize draft with patient data on mount
    resetDraft();
    updateDraft({
      patientId: patient?.id || queueItem.patientId,
      patientName: patient?.name || 'Unknown',
      patientAge: patient?.age?.toString() || '',
      patientGender: patient?.gender || '',
      patientWeight: patient?.weight?.toString() || '',
      patientPhone: patient?.phone || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiagnosisChange = (text: string) => {
    setDiagnosis(text);
    updateDraft({ diagnosis: text });
  };

  const handleAdviceChange = (text: string) => {
    setAdvice(text);
    updateDraft({ advice: text });
  };

  const handleFollowUpChange = (text: string) => {
    // Allow only digits and forward slashes for DD/MM/YYYY
    const cleaned = text.replace(/[^0-9/]/g, '');
    let formatted = cleaned;

    // Auto-insert slashes
    if (cleaned.length === 2 && followUpDate.length < 3) {
      formatted = cleaned + '/';
    } else if (cleaned.length === 5 && followUpDate.length < 6) {
      formatted = cleaned + '/';
    }

    if (formatted.length <= 10) {
      setFollowUpDate(formatted);
      updateDraft({ followUpDate: formatted });
    }
  };

  const handleAddMedicine = () => {
    navigation.navigate('MedicinePicker');
  };

  const handleAddLabTest = () => {
    navigation.navigate('LabTestPicker');
  };

  const handleRemoveMedicine = (index: number) => {
    Alert.alert(
      'Remove Medicine',
      `Remove ${currentDraft.medicines[index]?.medicineName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMedicine(index),
        },
      ]
    );
  };

  const handleRemoveLabTest = (index: number) => {
    Alert.alert(
      'Remove Lab Test',
      `Remove ${currentDraft.labTests[index]?.testName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeLabTest(index),
        },
      ]
    );
  };

  const handlePreview = async () => {
    if (!diagnosis.trim()) {
      Alert.alert('Required', 'Please enter a diagnosis.');
      return;
    }
    if (currentDraft.medicines.length === 0 && currentDraft.labTests.length === 0) {
      Alert.alert(
        'Empty Prescription',
        'Please add at least one medicine or lab test.',
      );
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'Doctor session not found. Please re-login.');
      return;
    }

    setIsCreating(true);
    try {
      const prescription = await createPrescription(user.id);
      navigation.navigate('PrescriptionPreview', { prescriptionId: prescription.id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create prescription';
      Alert.alert('Error', message);
    } finally {
      setIsCreating(false);
    }
  };

  const patientGenderDisplay = patient?.gender
    ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
    : '--';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Patient Info Card */}
        <View style={styles.patientCard}>
          <View style={styles.patientIconRow}>
            <View style={styles.patientIcon}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.patientDetails}>
              <Text style={styles.patientName}>{patient?.name || 'Unknown Patient'}</Text>
              <Text style={styles.patientMeta}>
                {patient?.age || '--'} yrs | {patientGenderDisplay} | {patient?.phone || '--'}
              </Text>
              {patient?.weight ? (
                <Text style={styles.patientMeta}>Weight: {patient.weight} kg</Text>
              ) : null}
              {patient?.allergies ? (
                <View style={styles.allergyBadge}>
                  <Ionicons name="warning" size={12} color={COLORS.error} />
                  <Text style={styles.allergyText}>Allergies: {patient.allergies}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.editPatientButton}
              onPress={() => patient && navigation.navigate('EditPatient', { patientId: patient.id })}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Diagnosis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnosis *</Text>
          <TextInput
            style={styles.diagnosisInput}
            placeholder="Enter diagnosis..."
            placeholderTextColor={COLORS.textLight}
            value={diagnosis}
            onChangeText={handleDiagnosisChange}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Medicines */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Medicines ({currentDraft.medicines.length})
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddMedicine}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {currentDraft.medicines.length === 0 ? (
            <TouchableOpacity
              style={styles.emptySection}
              onPress={handleAddMedicine}
              activeOpacity={0.7}
            >
              <Ionicons name="medical-outline" size={24} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Tap to add medicines</Text>
            </TouchableOpacity>
          ) : (
            currentDraft.medicines.map((med: MedicineDraft, index: number) => (
              <View key={`med-${index}`} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{med.medicineName}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveMedicine(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemDetail}>
                    {med.type}{med.dosage ? ` - ${med.dosage}` : ''}
                  </Text>
                  <Text style={styles.itemDetail}>
                    {med.frequency} | {med.duration} | {med.timing}
                  </Text>
                  {med.notes ? (
                    <Text style={styles.itemNotes}>{med.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Lab Tests */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Lab Tests ({currentDraft.labTests.length})
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddLabTest}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {currentDraft.labTests.length === 0 ? (
            <TouchableOpacity
              style={styles.emptySection}
              onPress={handleAddLabTest}
              activeOpacity={0.7}
            >
              <Ionicons name="flask-outline" size={24} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Tap to add lab tests</Text>
            </TouchableOpacity>
          ) : (
            currentDraft.labTests.map((test: LabTestDraft, index: number) => (
              <View key={`test-${index}`} style={styles.itemCard}>
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{test.testName}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveLabTest(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemDetail}>{test.category}</Text>
                  {test.notes ? (
                    <Text style={styles.itemNotes}>{test.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Additional Advice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Advice</Text>
          <TextInput
            style={styles.adviceInput}
            placeholder="Any additional advice for the patient..."
            placeholderTextColor={COLORS.textLight}
            value={advice}
            onChangeText={handleAdviceChange}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Follow-up Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up Date</Text>
          <View style={styles.followUpRow}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.followUpInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={COLORS.textLight}
              value={followUpDate}
              onChangeText={handleFollowUpChange}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        {/* Spacer for bottom button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Preview Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.previewButton,
            (isCreating || isLoading) && styles.previewButtonDisabled,
          ]}
          onPress={handlePreview}
          activeOpacity={0.8}
          disabled={isCreating || isLoading}
        >
          {isCreating || isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color={COLORS.white} />
              <Text style={styles.previewButtonText}>Preview Prescription</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },

  // Patient Card
  patientCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  patientIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  patientDetails: {
    flex: 1,
  },
  editPatientButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  patientMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  allergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
    gap: 4,
    alignSelf: 'flex-start',
  },
  allergyText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  // Inputs
  diagnosisInput: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
  },
  adviceInput: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 60,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  followUpInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Empty Section
  emptySection: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Item Cards (Medicines / Lab Tests)
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  itemDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemNotes: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.lg,
  },
  previewButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  previewButtonDisabled: {
    opacity: 0.6,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
