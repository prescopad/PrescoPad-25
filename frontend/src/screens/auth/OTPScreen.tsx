import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { sendOTP, verifyOTP } from '../../services/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { UserRole } from '../../types/auth.types';
import { AuthStackParamList } from '../../types/navigation.types';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

const RESEND_COOLDOWN_SECONDS = 30;

export default function OTPScreen({ navigation, route }: Props): React.JSX.Element {
  const { phone, role } = route.params;
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const loadBalance = useWalletStore((s) => s.loadBalance);
  const inputRef = useRef<TextInput>(null);

  // Resend cooldown timer.
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert(t('common.invalid'), t('auth.invalidOtp'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyOTP(phone, otp, role as UserRole);

      if (response.isNewUser || !response.user.isProfileComplete) {
        await setUser(response.user, response.accessToken, response.refreshToken);
        navigation.replace('Registration', { role });
      } else {
        await setUser(response.user, response.accessToken, response.refreshToken);
        loadBalance().catch(() => { /* silent */ });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('auth.otpVerificationFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || isResending) return;
    setIsResending(true);
    try {
      await sendOTP(phone, role as UserRole);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setOtp('');
      inputRef.current?.focus();
      Alert.alert(t('common.success'), t('auth.otpResent'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('common.somethingWrong');
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsResending(false);
    }
  };

  const resendDisabled = resendCountdown > 0 || isResending;
  const resendLabel = resendCountdown > 0
    ? t('auth.resendIn', { seconds: resendCountdown })
    : (isResending ? t('auth.sending') : t('auth.resend'));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />

        <Text style={styles.title}>{t('auth.verifyOtp')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.otpSentTo')}{'\n'}
          <Text style={styles.phoneText}>+91 {phone}</Text>
        </Text>

        <TextInput
          ref={inputRef}
          style={styles.otpInput}
          value={otp}
          onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="- - - - - -"
          placeholderTextColor={COLORS.textLight}
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={otp.length !== 6 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Verify & Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resendDisabled}
          activeOpacity={resendDisabled ? 1 : 0.6}
        >
          <Text style={[styles.resendText, resendDisabled && styles.resendDisabled]}>
            {resendLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  backButton: { padding: SPACING.lg, paddingTop: 50 },
  content: { flex: 1, paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xxxl },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  subtitle: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22, marginBottom: SPACING.xxxl },
  phoneText: { fontWeight: '700', color: COLORS.text },
  otpInput: {
    fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: 12,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingVertical: 16, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.surfaceSecondary, marginBottom: SPACING.xxl,
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 16, alignItems: 'center', ...SHADOWS.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  resendButton: { alignItems: 'center', marginTop: SPACING.xl },
  resendText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  resendDisabled: { color: COLORS.textMuted },
});
