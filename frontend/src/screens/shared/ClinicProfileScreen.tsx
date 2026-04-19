import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ParamListBase } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';

interface ClinicProfileScreenProps {
  navigation: NativeStackNavigationProp<ParamListBase>;
}

export default function ClinicProfileScreen({ navigation }: ClinicProfileScreenProps): React.JSX.Element {
  const {
    clinic,
    doctorProfile,
    loadClinic,
    loadDoctorProfile,
    updateClinic,
    updateDoctorProfile,
    isLoading,
  } = useClinicStore();

  const { user } = useAuthStore();
  const isDoctor = user?.role === 'doctor';

  const [clinicName, setClinicName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadClinic();
    loadDoctorProfile();
  }, []);

  useEffect(() => {
    if (clinic) {
      setClinicName(clinic.name || '');
      setAddress(clinic.address || '');
      setPhone(clinic.phone || '');
      setEmail(clinic.email || '');
    }
  }, [clinic]);

  useEffect(() => {
    if (doctorProfile) {
      setDoctorName(doctorProfile.name || '');
      setSpecialty(doctorProfile.specialty || '');
      setRegNumber(doctorProfile.regNumber || '');
    }
  }, [doctorProfile]);

  const handleSave = async () => {
    if (!clinicName.trim()) {
      Alert.alert('Required', 'Clinic name is required');
      return;
    }
    if (!doctorName.trim()) {
      Alert.alert('Required', 'Doctor name is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateClinic({
        name: clinicName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });

      await updateDoctorProfile({
        name: doctorName.trim(),
        specialty: specialty.trim(),
        regNumber: regNumber.trim(),
      });

      Alert.alert('Saved', 'Clinic profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save profile';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clinic Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Restriction Banner for Assistants */}
          {!isDoctor && (
            <View style={styles.restrictionBanner}>
              <Ionicons name="information-circle" size={20} color={COLORS.info} />
              <Text style={styles.restrictionText}>
                Only doctors can edit clinic details. Contact your doctor to make changes.
              </Text>
            </View>
          )}

          {/* Clinic Details Section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Clinic Details</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Clinic Name *</Text>
              <TextInput
                style={[styles.input, !isDoctor && styles.inputDisabled]}
                value={clinicName}
                onChangeText={setClinicName}
                placeholder="Enter clinic name"
                placeholderTextColor={COLORS.textLight}
                editable={isDoctor}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.multilineInput, !isDoctor && styles.inputDisabled]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter clinic address"
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={isDoctor}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={[styles.input, !isDoctor && styles.inputDisabled]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.textLight}
                keyboardType="phone-pad"
                editable={isDoctor}
              />
            </View>

            <View style={styles.inputGroupLast}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, !isDoctor && styles.inputDisabled]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email address"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={isDoctor}
              />
            </View>
          </View>

          {/* Doctor Details Section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="medkit-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Doctor Details</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Doctor Name *</Text>
              <TextInput
                style={[styles.input, !isDoctor && styles.inputDisabled]}
                value={doctorName}
                onChangeText={setDoctorName}
                placeholder="Enter doctor name"
                placeholderTextColor={COLORS.textLight}
                editable={isDoctor}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Specialty</Text>
              <TextInput
                style={[styles.input, !isDoctor && styles.inputDisabled]}
                value={specialty}
                onChangeText={setSpecialty}
                placeholder="e.g., General Physician, Cardiologist"
                placeholderTextColor={COLORS.textLight}
                editable={isDoctor}
              />
            </View>

            <View style={styles.inputGroupLast}>
              <Text style={styles.label}>Registration Number</Text>
              <TextInput
                style={[styles.input, !isDoctor && styles.inputDisabled]}
                value={regNumber}
                onChangeText={setRegNumber}
                placeholder="Medical registration number"
                placeholderTextColor={COLORS.textLight}
                editable={isDoctor}
              />
            </View>
          </View>
        </ScrollView>

        {/* Save Button - Only for doctors */}
        {isDoctor && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
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
  backBtn: {
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

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },

  // Input fields
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceSecondary,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: SPACING.md,
  },
  inputDisabled: {
    backgroundColor: COLORS.disabled,
    color: COLORS.textMuted,
    opacity: 0.7,
  },

  // Restriction banner
  restrictionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.infoLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  restrictionText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 18,
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
  saveButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
