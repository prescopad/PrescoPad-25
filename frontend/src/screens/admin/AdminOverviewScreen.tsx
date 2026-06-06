import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, StatusBar, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { fetchAdminOverview, AdminOverview } from '../../services/adminService';
import { useAuthStore } from '../../store/useAuthStore';
import { APP_CONFIG } from '../../constants/config';

export default function AdminOverviewScreen(): React.JSX.Element {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) logout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() },
      ]);
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const o = await fetchAdminOverview();
      setData(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.failedLoadOverview'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('admin.dashboard')}</Text>
          <Text style={styles.headerSubtitle}>{user?.name ?? user?.phone}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {data && (
          <>
            <SectionTitle title={t('admin.users')} />
            <View style={styles.grid}>
              <Stat label={t('admin.doctors')} value={data.users.doctors} color={COLORS.primary} icon="medkit" />
              <Stat label={t('admin.assistants')} value={data.users.assistants} color={COLORS.info} icon="people" />
              <Stat label={t('admin.admins')} value={data.users.admins} color={COLORS.warning} icon="shield-checkmark" />
              <Stat label={t('admin.onlineDoctors')} value={data.users.onlineDoctors} color={COLORS.success} icon="radio-button-on" />
            </View>

            <SectionTitle title={t('admin.activity')} />
            <View style={styles.grid}>
              <Stat label={t('admin.clinics')} value={data.clinics.total} color={COLORS.primary} icon="business" />
              <Stat label={t('admin.totalPatients')} value={data.patients.total} color={COLORS.info} icon="person" />
              <Stat label={t('admin.rxFinalized')} value={data.prescriptions.finalized} color={COLORS.success} icon="document-text" />
              <Stat label={t('admin.rxToday')} value={data.prescriptions.today} color={COLORS.warning} icon="today" />
            </View>

            <SectionTitle title={t('nav.revenue')} />
            <View style={styles.card}>
              <Row label={t('admin.totalCredits')} value={fmt(data.revenue.totalCredits)} />
              <Row label={t('admin.totalDebits')} value={fmt(data.revenue.totalDebits)} />
              <Row label={t('admin.refunds')} value={fmt(data.revenue.totalRefunds)} />
              <View style={styles.divider} />
              <Row label={t('admin.platformGross')} value={fmt(data.revenue.platformGross)} highlight />
            </View>

            <SectionTitle title={t('admin.prescriptionVolume')} />
            <View style={styles.card}>
              <Row label={t('common.today')} value={String(data.prescriptions.today)} />
              <Row label={t('admin.last7Days')} value={String(data.prescriptions.week)} />
              <Row label={t('admin.last30Days')} value={String(data.prescriptions.month)} />
              <Row label={t('admin.allTime')} value={String(data.prescriptions.total)} />
            </View>

            <Text style={styles.footnote}>
              {t('admin.updated')} {new Date(data.generatedAt).toLocaleString()}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function fmt(n: number): string {
  return `${APP_CONFIG.wallet.currencySymbol}${(n ?? 0).toFixed(2)}`;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginTop: SPACING.xl, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg,
    flexBasis: '48%', flexGrow: 1, ...SHADOWS.sm,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  rowLabel: { fontSize: 13, color: COLORS.textMuted },
  rowValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowValueHighlight: { color: COLORS.success, fontSize: 16 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  errorCard: { backgroundColor: COLORS.errorLight, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  errorText: { color: COLORS.error, fontSize: 13 },
  footnote: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.xl },
});
