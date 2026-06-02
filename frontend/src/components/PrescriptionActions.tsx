/**
 * Three-button action bar shown wherever a prescription is viewable:
 *   - Share on WhatsApp (opens WA with the patient's number, then the share sheet
 *     so the doctor attaches the PDF)
 *   - Download PDF (saves a copy and opens the share sheet)
 *   - Print (native print dialog)
 *
 * The component owns PDF generation lazily — the first action that needs it
 * triggers `generatePrescriptionPDF`, the path is memoised in state so the
 * other two actions reuse it.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { Prescription } from '../types/prescription.types';
import { useClinicStore } from '../store/useClinicStore';
import { useAuthStore } from '../store/useAuthStore';
import { generatePrescriptionPDF, printPrescription } from '../services/pdfService';
import { exportPDFCopy, shareRxOnWhatsApp, shareViaPDF } from '../services/shareService';

interface Props {
  prescription: Prescription | null;
  /** Show only a subset (e.g. read-only views can hide WhatsApp share). */
  show?: { whatsapp?: boolean; download?: boolean; print?: boolean };
  layout?: 'row' | 'column';
}

export default function PrescriptionActions({ prescription, show, layout = 'row' }: Props): React.JSX.Element | null {
  const { t } = useTranslation();
  const { clinic, doctorProfile } = useClinicStore();
  const { user } = useAuthStore();
  const [busy, setBusy] = useState<null | 'whatsapp' | 'download' | 'print'>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [waStep, setWaStep] = useState<'idle' | 'text_sent' | 'completed'>('idle');

  if (!prescription) return null;
  const want = { whatsapp: true, download: true, print: true, ...show };

  const ensurePdf = async (): Promise<string> => {
    if (pdfPath) return pdfPath;
    // Inject the doctor's saved signature into the rx copy used for rendering.
    const rxForPdf = { ...prescription, signature: user?.signatureUrl || prescription.signature || null };
    const generated = await generatePrescriptionPDF(rxForPdf, clinic, doctorProfile);
    setPdfPath(generated);
    return generated;
  };

  const handleWhatsApp = async () => {
    if (busy) return;
    if (!prescription.patientPhone) {
      Alert.alert(t('common.error'), t('share.noPhone'));
      return;
    }
    setBusy('whatsapp');
    try {
      const message = t('share.defaultMessage', {
        patient: prescription.patientName,
        clinic: clinic?.name || 'PrescoPad',
      });
      // Step 1: Open direct WhatsApp chat with patient's pre-filled text message
      await shareRxOnWhatsApp(message, prescription.patientPhone);
      setWaStep('text_sent');
      setShowSuccessOverlay(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.somethingWrong');
      const looksLikeMissingWA = msg.toLowerCase().includes('whatsapp');
      Alert.alert(t('common.error'), looksLikeMissingWA ? t('share.whatsappMissing') : msg);
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    try {
      const path = await ensurePdf();
      const friendly = `${prescription.id}_${(prescription.patientName || 'patient').replace(/\s+/g, '_')}`;
      const exported = await exportPDFCopy(path, friendly);
      // Surface to the user — also opens the share sheet so they can save to Files / Drive.
      await shareViaPDF(exported);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('share.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    if (busy) return;
    setBusy('print');
    try {
      // Print works off the HTML directly — no file move needed.
      const rxForPrint = { ...prescription, signature: user?.signatureUrl || prescription.signature || null };
      await printPrescription(rxForPrint, clinic, doctorProfile);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('share.printFailed'));
    } finally {
      setBusy(null);
    }
  };

  const ButtonView = ({ active, icon, label, onPress, color }: {
    active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.btn,
        layout === 'column' && styles.columnBtn,
        { borderColor: color },
        busy && styles.btnDisabled
      ]}
      onPress={onPress}
      disabled={busy !== null}
      activeOpacity={0.7}
    >
      {active ? (
        <ActivityIndicator color={color} />
      ) : (
        <Ionicons name={icon} size={18} color={color} />
      )}
      <Text style={[styles.btnLabel, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  if (showSuccessOverlay) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successHeader}>
          <View style={styles.successBadge}>
            <Ionicons
              name={waStep === 'completed' ? 'checkmark-circle' : 'chatbubble-ellipses-outline'}
              size={24}
              color={waStep === 'completed' ? COLORS.success : COLORS.primary}
            />
          </View>
          <Text style={styles.successText}>
            {waStep === 'completed' ? (
              <Text>
                Prescription PDF and message sent to <Text style={styles.patientNameText}>{prescription.patientName}</Text> ✓
              </Text>
            ) : (
              <Text>
                Direct WhatsApp chat opened for <Text style={styles.patientNameText}>{prescription.patientName}</Text>! Tap below to send the PDF.
              </Text>
            )}
          </Text>
        </View>
        <View style={styles.successActions}>
          {waStep === 'text_sent' ? (
            <>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setWaStep('idle');
                  setShowSuccessOverlay(false);
                  handleWhatsApp();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color={COLORS.whatsapp} />
                <Text style={styles.retryBtnText}>Re-open Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sharePdfBtn}
                onPress={async () => {
                  try {
                    const path = await ensurePdf();
                    await shareViaPDF(path);
                    setWaStep('completed');
                  } catch (e) {
                    Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed to share PDF');
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
                <Text style={styles.sharePdfBtnText}>Send PDF</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setWaStep('idle');
                  setShowSuccessOverlay(false);
                  handleWhatsApp();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color={COLORS.whatsapp} />
                <Text style={styles.retryBtnText}>Send Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setWaStep('idle');
                  setShowSuccessOverlay(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, layout === 'column' && styles.column]}>
      {want.whatsapp && (
        <ButtonView
          active={busy === 'whatsapp'}
          icon="logo-whatsapp"
          label="Send to Patient (WhatsApp)"
          onPress={handleWhatsApp}
          color={COLORS.whatsapp}
        />
      )}
      {want.download && (
        <ButtonView
          active={busy === 'download'}
          icon="download-outline"
          label={t('share.download')}
          onPress={handleDownload}
          color={COLORS.primary}
        />
      )}
      {want.print && (
        <ButtonView
          active={busy === 'print'}
          icon="print-outline"
          label={t('share.print')}
          onPress={handlePrint}
          color={COLORS.textSecondary}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  column: {
    flexDirection: 'column',
  },
  columnBtn: {
    flex: 0,
    width: '100%',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnLabel: {
    fontWeight: '700',
    fontSize: 12,
  },
  successContainer: {
    backgroundColor: COLORS.successLight,
    borderColor: '#bbf7d0',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    ...SHADOWS.md,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  successBadge: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    padding: 2,
  },
  successText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  patientNameText: {
    fontWeight: '700',
  },
  successActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.whatsapp,
    backgroundColor: COLORS.white,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.whatsapp,
  },
  sharePdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  sharePdfBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  doneBtn: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});
