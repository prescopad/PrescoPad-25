import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { fetchAdminRevenue, AdminRevenue } from '../../services/adminService';
import { APP_CONFIG } from '../../constants/config';

type Period = 'today' | 'week' | 'month';

export default function AdminRevenueScreen(): React.JSX.Element {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<AdminRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      setData(await fetchAdminRevenue(period));
    } catch {
      // surface in UI
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Revenue</Text>
      </View>

      <View style={styles.tabs}>
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.tab, period === p && styles.tabActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === 'today' ? 'Today' : p === 'week' ? '7 days' : '30 days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading || !data ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : (
          <>
            <View style={[styles.bigCard, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.bigCardLabel}>Platform revenue</Text>
              <Text style={styles.bigCardValue}>
                {APP_CONFIG.wallet.currencySymbol}{data.platformRevenue.toFixed(2)}
              </Text>
              <Text style={styles.bigCardSub}>(debits − refunds)</Text>
            </View>

            <View style={styles.card}>
              <Row label="Wallet credits in" value={data.byType.credit?.total ?? 0} count={data.byType.credit?.count ?? 0} />
              <Row label="Wallet debits (Rx fees)" value={data.byType.debit?.total ?? 0} count={data.byType.debit?.count ?? 0} />
              <Row label="Refunds" value={data.byType.refund?.total ?? 0} count={data.byType.refund?.count ?? 0} />
            </View>

            <Text style={styles.footnote}>
              Updated {new Date(data.generatedAt).toLocaleString()}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, count }: { label: string; value: number; count: number }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCount}>{count} txns</Text>
      </View>
      <Text style={styles.rowValue}>{APP_CONFIG.wallet.currencySymbol}{value.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, padding: SPACING.sm, gap: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.md },
  tabActive: { backgroundColor: COLORS.primarySurface },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  bigCard: { borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.md },
  bigCardLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  bigCardValue: { color: COLORS.white, fontSize: 36, fontWeight: '900', marginTop: SPACING.sm },
  bigCardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.lg, ...SHADOWS.sm },
  row: { flexDirection: 'row', paddingVertical: SPACING.sm, alignItems: 'center' },
  rowLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  rowCount: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  footnote: { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.xl },
});
