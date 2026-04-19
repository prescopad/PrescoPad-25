import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePatientStore } from '../../store/usePatientStore';
import { useQueueStore } from '../../store/useQueueStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Gender, PatientFormData, BLOOD_GROUPS } from '../../types/patient.types';
import type { AssistantStackParamList } from '../../types/navigation.types';

type NavigationProp = NativeStackNavigationProp<AssistantStackParamList>;

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: Gender.MALE },
  { label: 'Female', value: Gender.FEMALE },
  { label: 'Other', value: Gender.OTHER },
];

export default function AddPatientScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const createPatient = usePatientStore((s) => s.createPatient);
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState<PatientFormData>({
    name: '',
    age: '',
    gender: Gender.MALE,
    weight: '',
    phone: '',
    address: '',
    bloodGroup: '',
    allergies: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof PatientFormData, value: string | Gender) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PatientFormData, string>> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!form.age.trim()) {
      newErrors.age = 'Age is required';
    } else {
      const ageNum = parseInt(form.age, 10);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        newErrors.age = 'Enter a valid age (0-150)';
      }
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (form.phone.trim().length < 10) {
      newErrors.phone = 'Enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!user) return;

    setIsSubmitting(true);
    try {
      const patient = await createPatient(form);

      Alert.alert(
        'Patient Registered',
        `${patient.name} has been registered successfully. Add to queue?`,
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Yes, Add to Queue',
            onPress: async () => {
              try {
                await addToQueue(patient.id, user.id);
                navigation.goBack();
              } catch {
                Alert.alert('Error', 'Patient registered but failed to add to queue.');
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to register patient';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register New Patient</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Full Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            placeholder="Enter patient name"
            placeholderTextColor={COLORS.textLight}
            value={form.name}
            onChangeText={(text) => updateField('name', text)}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Age & Weight Row */}
        <View style={styles.row}>
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.label}>
              Age <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.age ? styles.inputError : null]}
              placeholder="Age"
              placeholderTextColor={COLORS.textLight}
              value={form.age}
              onChangeText={(text) =>
                updateField('age', text.replace(/[^0-9]/g, ''))
              }
              keyboardType="numeric"
              maxLength={3}
            />
            {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
          </View>
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="Weight"
              placeholderTextColor={COLORS.textLight}
              value={form.weight}
              onChangeText={(text) =>
                updateField('weight', text.replace(/[^0-9.]/g, ''))
              }
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTIONS.map((opt) => {
              const isSelected = form.gender === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelected,
                  ]}
                  onPress={() => updateField('gender', opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Phone <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.phoneInputContainer}>
            <Text style={styles.countryCode}>+91</Text>
            <TextInput
              style={[
                styles.phoneInput,
                errors.phone ? styles.inputError : null,
              ]}
              placeholder="Enter phone number"
              placeholderTextColor={COLORS.textLight}
              value={form.phone}
              onChangeText={(text) =>
                updateField('phone', text.replace(/[^0-9]/g, '').slice(0, 10))
              }
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* Address */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter address"
            placeholderTextColor={COLORS.textLight}
            value={form.address}
            onChangeText={(text) => updateField('address', text)}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Blood Group */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Blood Group</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bloodGroupRow}
          >
            {BLOOD_GROUPS.map((bg) => {
              const isSelected = form.bloodGroup === bg;
              return (
                <TouchableOpacity
                  key={bg}
                  style={[
                    styles.bloodChip,
                    isSelected && styles.bloodChipSelected,
                  ]}
                  onPress={() =>
                    updateField('bloodGroup', isSelected ? '' : bg)
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.bloodChipText,
                      isSelected && styles.bloodChipTextSelected,
                    ]}
                  >
                    {bg}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Allergies */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Allergies</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Penicillin, Dust, Peanuts"
            placeholderTextColor={COLORS.textLight}
            value={form.allergies}
            onChangeText={(text) => updateField('allergies', text)}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons
                name="person-add-outline"
                size={20}
                color={COLORS.white}
              />
              <Text style={styles.submitButtonText}>Register Patient</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: COLORS.error,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  textArea: {
    minHeight: 64,
    paddingTop: 13,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  chipTextSelected: {
    color: COLORS.primary,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: SPACING.md,
    paddingRight: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 13,
    letterSpacing: 0.8,
    borderWidth: 0,
  },
  bloodGroupRow: {
    gap: SPACING.sm,
  },
  bloodChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  bloodChipSelected: {
    backgroundColor: COLORS.errorLight,
    borderColor: COLORS.error,
  },
  bloodChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  bloodChipTextSelected: {
    color: COLORS.error,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    marginTop: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
