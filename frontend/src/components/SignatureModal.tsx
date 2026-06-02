import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (signaturePath: string, saveToProfile: boolean) => void;
}

export default function SignatureModal({
  visible,
  onClose,
  onConfirm,
}: SignatureModalProps): React.JSX.Element {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [saveToProfile, setSaveToProfile] = useState<boolean>(true);
  const canvasRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        // Start a new path segment
        setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        // Append line to current path
        setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        // Complete the current path segment and add to list of paths
        setCurrentPath((prev) => {
          if (prev) {
            setPaths((existing) => [...existing, prev]);
          }
          return '';
        });
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const handleConfirm = () => {
    // Combine all drawn segments into a single SVG path string
    const combinedPath = [...paths, currentPath].filter(Boolean).join(' ');
    if (!combinedPath.trim()) {
      alert('Please draw your signature before confirming.');
      return;
    }
    onConfirm(combinedPath, saveToProfile);
    handleClear();
  };

  const handleCancel = () => {
    handleClear();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Doctor Signature</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Draw your signature inside the box using a stylus or your finger.
          </Text>

          {/* Canvas Box */}
          <View
            ref={canvasRef}
            style={styles.canvasContainer}
            {...panResponder.panHandlers}
          >
            {paths.length === 0 && !currentPath && (
              <View style={styles.placeholder}>
                <Ionicons name="create-outline" size={32} color={COLORS.textLight} />
                <Text style={styles.placeholderText}>Sign Here</Text>
              </View>
            )}

            <Svg style={StyleSheet.absoluteFill}>
              {/* Render completed paths */}
              {paths.map((p, index) => (
                <Path
                  key={`path-${index}`}
                  d={p}
                  stroke={COLORS.text}
                  strokeWidth={3.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {/* Render active drawing path */}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={COLORS.text}
                  strokeWidth={3.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
          </View>

          {/* Settings / Save Option */}
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.7}
            onPress={() => setSaveToProfile(!saveToProfile)}
          >
            <View style={[styles.checkbox, saveToProfile && styles.checkboxActive]}>
              {saveToProfile && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
            </View>
            <Text style={styles.checkboxLabel}>Save signature to profile for future reuse</Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>

            <View style={styles.rightButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
    lineHeight: 16,
  },
  canvasContainer: {
    width: '100%',
    height: 180,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.md,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  placeholderText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  rightButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
