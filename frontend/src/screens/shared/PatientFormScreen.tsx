import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { Patient, Gender, BLOOD_GROUPS, PatientFormData } from '../../types/patient.types';
import { getPatientById, updatePatient } from '../../services/dataService';
import type { DoctorStackParamList } from '../../types/navigation.types';

type EditRouteProp = RouteProp<DoctorStackParamList, 'EditPatient'>;

export default function PatientFormScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<EditRouteProp>();
  const { t } = useTranslation();
  const { patientId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<PatientFormData>({
    name: '', age: '', gender: Gender.MALE, weight: '',
    phone: '', address: '', bloodGroup: '', allergies: '',
  });

  useEffect(() => {
    loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    setIsLoading(true);
    try {
      const patient = await getPatientById(patientId);
      if (patient) {
        setForm({
          name: patient.name,
          age: patient.age.toString(),
          gender: patient.gender,
          weight: patient.weight?.toString() || '',
          phone: patient.phone || '',
          address: patient.address || '',
          bloodGroup: patient.bloodGroup || '',
          allergies: patient.allergies || '',
        });
      }
    } catch {
      Alert.alert(t('common.error'), t('patient.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert(t('common.required'), t('patient.nameRequired'));
      return;
    }
    if (!form.age.trim() || parseInt(form.age) <= 0) {
      Alert.alert(t('common.required'), t('patient.ageRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await updatePatient(patientId, form);
      Alert.alert(t('common.success'), t('patient.savedInfo'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('common.somethingWrong');
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: keyof PatientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('patient.editPatient')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('patient.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder={t('patient.patientNamePlaceholder')}
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        {/* Age & Gender Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.rowHalf]}>
            <Text style={styles.label}>{t('patient.ageLabel')}</Text>
            <TextInput
              style={styles.input}
              value={form.age}
              onChangeText={(v) => updateField('age', v)}
              placeholder={t('patient.age')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
          <View style={[styles.inputGroup, styles.rowHalf]}>
            <Text style={styles.label}>{t('patient.genderLabel')}</Text>
            <View style={styles.genderRow}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, form.gender === g && styles.genderChipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, gender: g }))}
                >
                  <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>
                    {g.charAt(0).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Weight & Phone Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.rowHalf]}>
            <Text style={styles.label}>{t('patient.weightLabel')}</Text>
            <TextInput
              style={styles.input}
              value={form.weight}
              onChangeText={(v) => updateField('weight', v)}
              placeholder={t('patient.weightPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, styles.rowHalf]}>
            <Text style={styles.label}>{t('patient.phoneLabel')}</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(v) => updateField('phone', v)}
              placeholder={t('patient.phonePlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Blood Group */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('patient.bloodGroupLabel')}</Text>
          <View style={styles.bloodGroupRow}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[styles.bloodChip, form.bloodGroup === bg && styles.bloodChipActive]}
                onPress={() => updateField('bloodGroup', form.bloodGroup === bg ? '' : bg)}
              >
                <Text style={[styles.bloodChipText, form.bloodGroup === bg && styles.bloodChipTextActive]}>
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('patient.addressLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.address}
            onChangeText={(v) => updateField('address', v)}
            placeholder={t('patient.addressPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Allergies */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('patient.allergiesLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.allergies}
            onChangeText={(v) => updateField('allergies', v)}
            placeholder={t('patient.allergiesPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
              <Text style={styles.saveButtonText}>{t('patient.saveChanges')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: 50, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backButton: { padding: SPACING.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  headerSpacer: { width: 32 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

  inputGroup: { marginBottom: SPACING.xl },
  label: {
    fontSize: 13, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    fontSize: 16, color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.md },
  rowHalf: { flex: 1 },

  genderRow: { flexDirection: 'row', gap: SPACING.sm },
  genderChip: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.lg, borderWidth: 1.5,
    borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.white,
  },
  genderChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySurface },
  genderText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  genderTextActive: { color: COLORS.primary },

  bloodGroupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  bloodChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  bloodChipActive: { borderColor: COLORS.error, backgroundColor: COLORS.errorLight },
  bloodChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  bloodChipTextActive: { color: COLORS.error },

  saveButton: {
    flexDirection: 'row', backgroundColor: COLORS.success, borderRadius: RADIUS.lg,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, marginTop: SPACING.lg, ...SHADOWS.md,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
