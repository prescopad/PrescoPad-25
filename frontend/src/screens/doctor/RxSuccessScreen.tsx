import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { usePrescriptionStore } from '../../store/usePrescriptionStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useClinicStore } from '../../store/useClinicStore';
import { buildShareText } from '../../services/pdfService';
import { shareViaWhatsApp, shareViaPDF, shareViaSMS } from '../../services/shareService';
import { Prescription } from '../../types/prescription.types';
import { DoctorStackParamList } from '../../types/navigation.types';

type Props = NativeStackScreenProps<DoctorStackParamList, 'RxSuccess'>;

export default function RxSuccessScreen({ navigation, route }: Props): React.JSX.Element {
  const prescription = route.params.prescription;
  const { resetDraft } = usePrescriptionStore();
  const { balance } = useWalletStore();
  const { doctorProfile } = useClinicStore();

  const handleShareWhatsApp = async () => {
    try {
      const text = buildShareText(prescription, doctorProfile);
      await shareViaWhatsApp(text, prescription.patientPhone);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Could not open WhatsApp';
      Alert.alert('Error', msg);
    }
  };

  const handleSharePDF = async () => {
    try {
      if (!prescription.pdfPath) {
        Alert.alert('Error', 'PDF not available');
        return;
      }
      await shareViaPDF(prescription.pdfPath);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Could not share PDF';
      Alert.alert('Error', msg);
    }
  };

  const handleShareSMS = async () => {
    try {
      const text = buildShareText(prescription, doctorProfile);
      await shareViaSMS(text, prescription.patientPhone);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Could not open SMS';
      Alert.alert('Error', msg);
    }
  };

  const handleBackToQueue = () => {
    resetDraft();
    navigation.popToTop();
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      <View style={styles.content}>
        {/* Success Animation */}
        <View style={styles.successCircle}>
          <View style={styles.successInnerCircle}>
            <Ionicons name="checkmark" size={56} color={COLORS.white} />
          </View>
        </View>

        <Text style={styles.title}>Prescription Issued!</Text>

        <Text style={styles.rxId}>
          {prescription.id}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.infoText}>{prescription.patientName}</Text>
        </View>

        <View style={styles.balanceCard}>
          <Ionicons name="wallet-outline" size={20} color={COLORS.success} />
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Wallet Balance Updated</Text>
            <Text style={styles.balanceAmount}>
              {APP_CONFIG.wallet.currencySymbol}{balance}
            </Text>
          </View>
        </View>

        {/* Share Buttons */}
        <View style={styles.shareSection}>
          <Text style={styles.shareTitle}>Share Prescription</Text>

          <TouchableOpacity
            style={[styles.shareButton, styles.whatsappButton]}
            onPress={handleShareWhatsApp}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={22} color={COLORS.white} />
            <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareButton, styles.pdfButton]}
            onPress={handleSharePDF}
            activeOpacity={0.8}
          >
            <Ionicons name="document-outline" size={22} color={COLORS.white} />
            <Text style={styles.shareButtonText}>Share as PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareButton, styles.smsButton]}
            onPress={handleShareSMS}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={22} color={COLORS.white} />
            <Text style={styles.shareButtonText}>Share via SMS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Back to Queue */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToQueue}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
          <Text style={styles.backButtonText}>Back to Queue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: 80,
  },

  // Success icon
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  successInnerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  rxId: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // Balance card
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    width: '100%',
    marginBottom: SPACING.xxl,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.success,
  },

  // Share section
  shareSection: {
    width: '100%',
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  whatsappButton: {
    backgroundColor: COLORS.whatsapp,
  },
  pdfButton: {
    backgroundColor: COLORS.primary,
  },
  smsButton: {
    backgroundColor: COLORS.debit,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: SPACING.sm,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
