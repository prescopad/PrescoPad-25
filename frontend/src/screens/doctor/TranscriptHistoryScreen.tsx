import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DoctorStackParamList } from '../../types/navigation.types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getPatientTranscripts, Transcript } from '../../services/transcriptionService';

type Props = NativeStackScreenProps<DoctorStackParamList, 'TranscriptHistory'>;

export default function TranscriptHistoryScreen({ navigation, route }: Props): React.JSX.Element {
  const { patientId, patientName } = route.params;
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPatientTranscripts(patientId);
        setTranscripts(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Transcripts</Text>
          <Text style={styles.headerSub}>{patientName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading transcripts…</Text>
        </View>
      ) : transcripts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="mic-off-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No transcripts yet</Text>
          <Text style={styles.emptySub}>
            Transcripts from AI consultation recordings will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {transcripts.map((t) => {
            const isExpanded = expanded === t.id;
            const extraction = (t.medical_extraction || {}) as Record<string, unknown>;

            return (
              <View key={t.id} style={styles.card}>
                {/* Card header */}
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => setExpanded(isExpanded ? null : t.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardIconBox}>
                    <Ionicons name="mic" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardDate}>{formatDate(t.created_at)}</Text>
                    <Text style={styles.cardDuration}>
                      {formatDuration(t.audio_duration_seconds)} · {t.diarized_transcript?.length ?? 0} segments
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

                {/* Expanded content */}
                {isExpanded && (
                  <View style={styles.cardBody}>
                    {/* Extracted info */}
                    {extraction.diagnosis ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="medical" size={14} color={COLORS.primary} />
                        <Text style={styles.infoText}>
                          <Text style={styles.infoLabel}>Diagnosis: </Text>
                          {String(extraction.diagnosis)}
                        </Text>
                      </View>
                    ) : null}

                    {Array.isArray(extraction.prescribed_medicines) && extraction.prescribed_medicines.length > 0 && (
                      <View style={styles.infoRow}>
                        <Ionicons name="medkit-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.infoText}>
                          <Text style={styles.infoLabel}>Medicines: </Text>
                          {(extraction.prescribed_medicines as Record<string, unknown>[])
                            .map((m) => String(m.name || m.medicine_name || ''))
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      </View>
                    )}

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Diarized transcript */}
                    <Text style={styles.transcriptLabel}>Transcript</Text>
                    {(t.diarized_transcript || []).map((seg, i) => (
                      <View key={i} style={styles.segRow}>
                        <View style={[
                          styles.speakerBadge,
                          seg.speaker === 'Doctor' ? styles.speakerDoctor : styles.speakerPatient,
                        ]}>
                          <Text style={styles.speakerLabel}>
                            {seg.speaker === 'Doctor' ? 'Dr' : seg.speaker === 'Patient' ? 'Pt' : '?'}
                          </Text>
                        </View>
                        <Text style={styles.segText}>{seg.text}</Text>
                      </View>
                    ))}

                    {/* Full transcript fallback */}
                    {(!t.diarized_transcript || t.diarized_transcript.length === 0) && t.full_transcript ? (
                      <Text style={styles.fullText}>{t.full_transcript}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

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

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: COLORS.textMuted },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xxxl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  list: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { flex: 1 },
  cardDate: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardDuration: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  cardBody: { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoLabel: { fontWeight: '600', color: COLORS.text },
  infoText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },

  transcriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },

  segRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: 6 },
  speakerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  speakerDoctor: { backgroundColor: COLORS.primaryLight },
  speakerPatient: { backgroundColor: COLORS.successLight },
  speakerLabel: { fontSize: 9, fontWeight: '800', color: COLORS.primary },
  segText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },

  fullText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
});
