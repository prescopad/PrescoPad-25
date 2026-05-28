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
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePrescriptionStore } from '../../store/usePrescriptionStore';
import { useAuthStore } from '../../store/useAuthStore';
import { PrescriptionMedicine, PrescriptionLabTest } from '../../types/prescription.types';
import { DoctorStackParamList } from '../../types/navigation.types';

type MedicineDraft = Omit<PrescriptionMedicine, 'id' | 'prescriptionId'>;
type LabTestDraft = Omit<PrescriptionLabTest, 'id' | 'prescriptionId'>;

type ConsultScreenProps = NativeStackScreenProps<DoctorStackParamList, 'Consult'>;

export default function ConsultScreen({ navigation, route }: ConsultScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const { queueItem, patient } = route.params;
  const user = useAuthStore((s) => s.user);
  const {
    currentDraft,
    updateDraft,
    removeMedicine,
    removeLabTest,
    createPrescription,
    resetDraft,
    setQueueItemId,
    isLoading,
  } = usePrescriptionStore();

  const aiApplied = usePrescriptionStore((s) => s.aiApplied);
  const [isCreating, setIsCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Derived: which fields were left empty after AI applied?
  const missingDiagnosis   = aiApplied && !currentDraft.diagnosis.trim();
  const missingMedicines   = aiApplied && currentDraft.medicines.length === 0;
  const missingLabTests    = aiApplied && currentDraft.labTests.length === 0;
  const missingAdvice      = aiApplied && !currentDraft.advice.trim();
  const missingFollowUp    = aiApplied && !currentDraft.followUpDate.trim();

  // Reset draft when doctor leaves Consult via back button (not forward to Preview)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      resetDraft();
    });
    return unsubscribe;
  }, [navigation, resetDraft]);

  useEffect(() => {
    // Always store the queue item ID so finalization can mark it completed.
    setQueueItemId(queueItem.id);

    // If AI/transcript data was already applied, don't touch the draft — it's pre-filled.
    if (aiApplied) return;

    // Fresh consultation — initialise draft with patient info only.
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

  const handleDiagnosisChange = (text: string) => updateDraft({ diagnosis: text });
  const handleAdviceChange = (text: string) => updateDraft({ advice: text });

  // Follow-up date is selected via a native calendar picker. The draft stores
  // a DD/MM/YYYY string for display + backend compatibility; we round-trip via
  // a Date when opening the picker and on selection.
  const parseFollowUpToDate = (s: string): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // DD/MM/YYYY
    const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD (what the AI extraction emits)
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const [, yyyy, mm, dd] = iso;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (!isNaN(d.getTime())) return d;
    }
    return today;
  };

  const formatDateISO = (d: Date): string => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleDatePicked = (event: DateTimePickerEvent, selected?: Date) => {
    // Android closes the dialog itself; iOS keeps the spinner open until tapped away.
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    updateDraft({ followUpDate: formatDateISO(selected) });
  };

  const todayAtMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

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
        { text: t('common.cancel'), style: 'cancel' },
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
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeLabTest(index),
        },
      ]
    );
  };

  const handlePreview = async () => {
    if (!currentDraft.diagnosis.trim()) {
      Alert.alert(t('common.required'), t('consult.diagnosisRequired'));
      return;
    }
    if (currentDraft.medicines.length === 0 && currentDraft.labTests.length === 0) {
      Alert.alert(
        'Empty Prescription',
        t('consult.needMedOrTest'),
      );
      return;
    }
    if (!user?.id) {
      Alert.alert(t('common.error'), 'Doctor session not found. Please re-login.');
      return;
    }

    setIsCreating(true);
    try {
      const prescription = await createPrescription(user.id);
      navigation.navigate('PrescriptionPreview', { prescriptionId: prescription.id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create prescription';
      Alert.alert(t('common.error'), message);
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
              {patient?.allergies && !['no', 'none', 'n/a', 'nil', '-', 'nill'].includes(patient.allergies.toLowerCase().trim()) ? (
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

        {/* AI Transcription */}
        <TouchableOpacity
          style={styles.aiBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AITranscription', { queueItem, patient })}
        >
          <View style={styles.aiBtnIcon}>
            <Ionicons name="mic" size={18} color={COLORS.white} />
          </View>
          <View style={styles.aiBtnText}>
            <Text style={styles.aiBtnTitle}>{t('consult.aiRecording')}</Text>
            <Text style={styles.aiBtnSub}>Record, transcribe &amp; auto-fill prescription</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Diagnosis */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionTitle}>{t('consult.diagnosis')} *</Text>
            {missingDiagnosis && <MissingBadge />}
          </View>
          <TextInput
            style={[styles.diagnosisInput, missingDiagnosis && styles.inputMissing]}
            placeholder="Enter diagnosis..."
            placeholderTextColor={COLORS.textLight}
            value={currentDraft.diagnosis}
            onChangeText={handleDiagnosisChange}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Medicines */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionTitle}>
                {t('consult.medicines')} ({currentDraft.medicines.length})
              </Text>
              {missingMedicines && <MissingBadge />}
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddMedicine}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.addButtonText}>{t('common.add')}</Text>
            </TouchableOpacity>
          </View>

          {currentDraft.medicines.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptySection, missingMedicines && styles.emptySectionMissing]}
              onPress={handleAddMedicine}
              activeOpacity={0.7}
            >
              <Ionicons name="medical-outline" size={24} color={missingMedicines ? COLORS.warning : COLORS.textLight} />
              <Text style={[styles.emptyText, missingMedicines && styles.emptyTextMissing]}>Tap to add medicines</Text>
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
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionTitle}>
                {t('consult.labTests')} ({currentDraft.labTests.length})
              </Text>
              {missingLabTests && <MissingBadge />}
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddLabTest}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.addButtonText}>{t('common.add')}</Text>
            </TouchableOpacity>
          </View>

          {currentDraft.labTests.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptySection, missingLabTests && styles.emptySectionMissing]}
              onPress={handleAddLabTest}
              activeOpacity={0.7}
            >
              <Ionicons name="flask-outline" size={24} color={missingLabTests ? COLORS.warning : COLORS.textLight} />
              <Text style={[styles.emptyText, missingLabTests && styles.emptyTextMissing]}>Tap to add lab tests</Text>
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
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionTitle}>Additional Advice</Text>
            {missingAdvice && <MissingBadge />}
          </View>
          <TextInput
            style={[styles.adviceInput, missingAdvice && styles.inputMissing]}
            placeholder="Any additional advice for the patient..."
            placeholderTextColor={COLORS.textLight}
            value={currentDraft.advice}
            onChangeText={handleAdviceChange}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Follow-up Date */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionTitle}>{t('consult.followUp')}</Text>
            {missingFollowUp && <MissingBadge />}
          </View>
          <TouchableOpacity
            style={[styles.followUpRow, missingFollowUp && styles.inputMissing]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={missingFollowUp ? COLORS.warning : COLORS.textMuted} />
            <Text style={[styles.followUpInput, !currentDraft.followUpDate && { color: COLORS.textLight }]}>
              {currentDraft.followUpDate || t('consult.pickDate')}
            </Text>
            {currentDraft.followUpDate ? (
              <TouchableOpacity onPress={() => updateDraft({ followUpDate: '' })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={parseFollowUpToDate(currentDraft.followUpDate)}
              mode="date"
              minimumDate={todayAtMidnight}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleDatePicked}
            />
          )}
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
              <Text style={styles.previewButtonText}>{t('consult.preview')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MissingBadge() {
  return (
    <View style={badgeStyles.badge}>
      <Ionicons name="alert-circle-outline" size={12} color={COLORS.warning} />
      <Text style={badgeStyles.text}>Not in conversation</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  text: { fontSize: 10, fontWeight: '600', color: COLORS.warning },
});

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

  // AI Button
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    gap: SPACING.sm,
  },
  aiBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBtnText: { flex: 1 },
  aiBtnTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  aiBtnSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

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
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Highlighted (AI found nothing for this field)
  inputMissing: {
    borderColor: COLORS.warning,
    borderWidth: 1.5,
    backgroundColor: COLORS.warningLight,
  },
  emptySectionMissing: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warningLight,
  },
  emptyTextMissing: {
    color: COLORS.warning,
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
