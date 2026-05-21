import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { DoctorStackParamList } from '../../types/navigation.types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePrescriptionStore } from '../../store/usePrescriptionStore';
import { analyzeConsultationAudio, DiarizedSegment, PrescriptionAutofill } from '../../services/transcriptionService';

type Props = NativeStackScreenProps<DoctorStackParamList, 'AITranscription'>;

type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'done';

const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes hard cap
const EXTEND_MS = 60 * 1000;            // +1 minute extension

export default function AITranscriptionScreen({ navigation, route }: Props): React.JSX.Element {
  const { queueItem, patient } = route.params;

  // ── State ───────────────────────────────────────────────────────────────────
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [limitMs, setLimitMs] = useState(5 * 60 * 1000); // default 5 min
  const [autofill, setAutofill] = useState<PrescriptionAutofill | null>(null);
  const [transcript, setTranscript] = useState<DiarizedSegment[]>([]);
  const [fullText, setFullText] = useState('');
  const [error, setError] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  const { updateDraft, setAiApplied } = usePrescriptionStore();

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      _stopTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => null);
      }
    };
  }, []);

  // ── Time helpers ─────────────────────────────────────────────────────────────
  const _startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now() - startTimeRef.current + pausedElapsedRef.current;
      setElapsedMs(now);
      if (now >= limitMs) _handleTimeUp();
    }, 500);
  };

  const _stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const _handleTimeUp = () => {
    _stopTimer();
    Alert.alert(
      'Time limit reached',
      'Recording time is up. Do you want to extend by 1 minute or stop and process?',
      [
        { text: 'Extend +1 min', onPress: handleExtend },
        { text: 'Stop & Process', style: 'destructive', onPress: handleStopAndProcess },
      ],
    );
  };

  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const limitRemaining = Math.max(0, limitMs - elapsedMs);
  const progressPct = Math.min(1, elapsedMs / limitMs);

  // ── Recording controls ───────────────────────────────────────────────────────
  const handleStart = async () => {
    setError('');
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record consultations.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      pausedElapsedRef.current = 0;
      setElapsedMs(0);
      setRecordingState('recording');
      _startTimer();
    } catch (e: unknown) {
      setError('Could not start recording. Please try again.');
    }
  };

  const handlePause = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.pauseAsync();
      _stopTimer();
      pausedElapsedRef.current = elapsedMs;
      setRecordingState('paused');
    } catch {
      setError('Could not pause recording.');
    }
  };

  const handleResume = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.startAsync();
      setRecordingState('recording');
      _startTimer();
    } catch {
      setError('Could not resume recording.');
    }
  };

  const handleExtend = () => {
    setLimitMs((prev) => Math.min(prev + EXTEND_MS, MAX_DURATION_MS));
    if (recordingState === 'paused') {
      handleResume();
    } else {
      _startTimer();
    }
  };

  const handleExtendTwo = () => {
    setLimitMs((prev) => Math.min(prev + 2 * EXTEND_MS, MAX_DURATION_MS));
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard recording?',
      'This will delete the current recording and go back.',
      [
        { text: 'Cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            _stopTimer();
            if (recordingRef.current) {
              await recordingRef.current.stopAndUnloadAsync().catch(() => null);
              recordingRef.current = null;
            }
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleStopAndProcess = async () => {
    if (!recordingRef.current) return;
    _stopTimer();
    setRecordingState('processing');
    setError('');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('Recording URI not available');

      const result = await analyzeConsultationAudio(uri, patient.id);

      setFullText(result.full_transcript);
      setTranscript(result.diarized_transcript);
      setAutofill(result.prescription_autofill);
      setRecordingState('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Processing failed';
      setError(msg);
      setRecordingState('idle');
    }
  };

  // ── Apply autofill to prescription draft ────────────────────────────────────
  const handleApplyAndContinue = () => {
    if (!autofill) return;

    // Write everything in a single store update to avoid race conditions.
    // setAiApplied(true) tells ConsultScreen not to reset the draft on mount.
    const medicines = autofill.medicines.map((m) => ({
      medicineName: m.medicine_name,
      type: m.type || 'Tablet',
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.duration || '',
      timing: m.timing || '',
      notes: m.notes || '',
    }));

    const labTests = autofill.lab_tests.map((t) => ({
      testName: t.test_name,
      category: t.category || 'Other',
      notes: t.notes || '',
    }));

    // Single atomic update — no resetDraft() so nothing gets wiped mid-flight
    updateDraft({
      patientId: patient.id,
      patientName: patient.name,
      patientAge: patient.age ? String(patient.age) : '',
      patientGender: patient.gender || '',
      patientPhone: patient.phone || '',
      diagnosis: autofill.diagnosis || '',
      advice: autofill.advice || '',
      followUpDate: autofill.follow_up_date || '',
      medicines,
      labTests,
    });

    setAiApplied(true);
    navigation.navigate('Consult', { queueItem, patient });
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const renderIdle = () => (
    <View style={styles.centeredSection}>
      <View style={styles.micCircle}>
        <Ionicons name="mic" size={48} color={COLORS.white} />
      </View>
      <Text style={styles.idleTitle}>Ready to record</Text>
      <Text style={styles.idleSubtitle}>
        Tap start to begin recording the consultation.{'\n'}
        The AI will transcribe and extract prescription details automatically.
      </Text>
      <View style={styles.durationRow}>
        {[3, 5, 10, 15].map((min) => (
          <TouchableOpacity
            key={min}
            style={[styles.durationChip, limitMs === min * 60_000 && styles.durationChipActive]}
            onPress={() => setLimitMs(min * 60_000)}
          >
            <Text style={[styles.durationChipText, limitMs === min * 60_000 && styles.durationChipTextActive]}>
              {min} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
        <Ionicons name="mic" size={20} color={COLORS.white} />
        <Text style={styles.startBtnText}>Start Recording</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRecording = () => (
    <View style={styles.centeredSection}>
      {/* Pulsing mic */}
      <View style={[styles.micCircle, styles.micCircleActive]}>
        <Ionicons name="mic" size={48} color={COLORS.white} />
      </View>

      {/* Timer */}
      <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>
      <Text style={styles.timerLimit}>of {formatTime(limitMs)}</Text>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any }]} />
      </View>

      <Text style={styles.remainingText}>
        {formatTime(limitRemaining)} remaining
      </Text>

      {/* Controls row */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleDiscard}>
          <Ionicons name="trash-outline" size={22} color={COLORS.error} />
          <Text style={[styles.controlLabel, { color: COLORS.error }]}>Discard</Text>
        </TouchableOpacity>

        {recordingState === 'recording' ? (
          <TouchableOpacity style={[styles.controlBtn, styles.controlBtnPrimary]} onPress={handlePause}>
            <Ionicons name="pause" size={22} color={COLORS.white} />
            <Text style={[styles.controlLabel, { color: COLORS.white }]}>Pause</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.controlBtn, styles.controlBtnPrimary]} onPress={handleResume}>
            <Ionicons name="play" size={22} color={COLORS.white} />
            <Text style={[styles.controlLabel, { color: COLORS.white }]}>Resume</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.controlBtn} onPress={handleStopAndProcess}>
          <Ionicons name="stop-circle-outline" size={22} color={COLORS.text} />
          <Text style={styles.controlLabel}>Stop</Text>
        </TouchableOpacity>
      </View>

      {/* Extend time buttons */}
      <View style={styles.extendRow}>
        <TouchableOpacity style={styles.extendBtn} onPress={handleExtend}>
          <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.extendBtnText}>+1 min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extendBtn} onPress={handleExtendTwo}>
          <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.extendBtnText}>+2 min</Text>
        </TouchableOpacity>
      </View>

      {recordingState === 'paused' && (
        <View style={styles.pausedBadge}>
          <Ionicons name="pause-circle" size={16} color={COLORS.warning} />
          <Text style={styles.pausedText}>Paused</Text>
        </View>
      )}
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.centeredSection}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.processingTitle}>Analyzing consultation…</Text>
      <Text style={styles.processingSubtitle}>
        Transcribing audio → identifying speakers → extracting prescription data
      </Text>
    </View>
  );

  const renderDone = () => (
    <ScrollView style={styles.doneScroll} contentContainerStyle={styles.doneContent}>
      {/* Autofill preview card */}
      {autofill && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Extracted Prescription Data</Text>

          {autofill.diagnosis ? (
            <InfoRow icon="medical" label="Diagnosis" value={autofill.diagnosis} />
          ) : null}
          {autofill.advice ? (
            <InfoRow icon="chatbubble-outline" label="Advice" value={autofill.advice} />
          ) : null}
          {autofill.follow_up_date ? (
            <InfoRow icon="calendar-outline" label="Follow-up" value={autofill.follow_up_date} />
          ) : null}

          {autofill.medicines.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Medicines ({autofill.medicines.length})</Text>
              {autofill.medicines.map((m, i) => (
                <View key={i} style={styles.medRow}>
                  <Ionicons name="medkit-outline" size={14} color={COLORS.primary} />
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{m.medicine_name}</Text>
                    <Text style={styles.medDetail}>
                      {[m.type, m.dosage, m.frequency, m.duration, m.timing]
                        .filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {autofill.lab_tests.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Lab Tests ({autofill.lab_tests.length})</Text>
              {autofill.lab_tests.map((t, i) => (
                <View key={i} style={styles.medRow}>
                  <Ionicons name="flask-outline" size={14} color={COLORS.primary} />
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{t.test_name}</Text>
                    {t.category ? <Text style={styles.medDetail}>{t.category}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Transcript card */}
      {transcript.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Consultation Transcript</Text>
          {transcript.map((seg, i) => (
            <View key={i} style={styles.segRow}>
              <View style={[
                styles.speakerBadge,
                seg.speaker === 'Doctor' ? styles.speakerDoctor : styles.speakerPatient,
              ]}>
                <Text style={styles.speakerLabel}>
                  {seg.speaker === 'Doctor' ? 'Dr' : seg.speaker === 'Patient' ? 'Pt' : '?'}
                </Text>
              </View>
              <View style={styles.segBody}>
                <Text style={styles.segTime}>{formatTime(seg.start * 1000)}</Text>
                <Text style={styles.segText}>{seg.text}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <TouchableOpacity style={styles.applyBtn} onPress={handleApplyAndContinue}>
        <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
        <Text style={styles.applyBtnText}>Apply & Open Prescription</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.retryBtn} onPress={() => {
        setRecordingState('idle');
        setAutofill(null);
        setTranscript([]);
        setFullText('');
        setElapsedMs(0);
        pausedElapsedRef.current = 0;
      }}>
        <Ionicons name="refresh" size={16} color={COLORS.primary} />
        <Text style={styles.retryBtnText}>Record Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Consultation</Text>
          <Text style={styles.headerSub}>{patient.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate('TranscriptHistory', {
            patientId: patient.id,
            patientName: patient.name,
            queueItem,
            patient,
          })}
        >
          <Ionicons name="time-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error !== '' && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {recordingState === 'idle' && renderIdle()}
      {(recordingState === 'recording' || recordingState === 'paused') && renderRecording()}
      {recordingState === 'processing' && renderProcessing()}
      {recordingState === 'done' && renderDone()}
    </View>
  );
}

// ── Tiny sub-component ────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={COLORS.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  backBtn: { padding: SPACING.xs },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  historyBtn: { padding: SPACING.xs },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
  },
  errorText: { color: COLORS.error, fontSize: 13, flex: 1 },

  // ─── Idle ───
  centeredSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
  },
  micCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  micCircleActive: { backgroundColor: COLORS.error },

  idleTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  idleSubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  durationRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', justifyContent: 'center' },
  durationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  durationChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  durationChipText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  durationChipTextActive: { color: COLORS.primary },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  startBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  // ─── Recording ───
  timerText: { fontSize: 56, fontWeight: '800', color: COLORS.text, letterSpacing: 2 },
  timerLimit: { fontSize: 14, color: COLORS.textMuted, marginTop: -SPACING.sm },

  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
  },
  remainingText: { fontSize: 13, color: COLORS.textMuted },

  controlsRow: { flexDirection: 'row', gap: SPACING.lg, alignItems: 'center', marginTop: SPACING.sm },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceSecondary,
    minWidth: 80,
  },
  controlBtnPrimary: { backgroundColor: COLORS.primary, ...SHADOWS.md },
  controlLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text },

  extendRow: { flexDirection: 'row', gap: SPACING.md },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  extendBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  pausedText: { color: COLORS.warning, fontSize: 13, fontWeight: '600' },

  // ─── Processing ───
  processingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: SPACING.lg },
  processingSubtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // ─── Done ───
  doneScroll: { flex: 1 },
  doneContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: COLORS.text, marginTop: 1 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: 4 },
  medInfo: { flex: 1 },
  medName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  medDetail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  segRow: { flexDirection: 'row', gap: SPACING.sm, marginVertical: 4 },
  speakerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  speakerDoctor: { backgroundColor: COLORS.primaryLight },
  speakerPatient: { backgroundColor: COLORS.successLight },
  speakerLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  segBody: { flex: 1 },
  segTime: { fontSize: 10, color: COLORS.textLight, marginBottom: 2 },
  segText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },

  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
    marginTop: SPACING.sm,
  },
  applyBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  retryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});
