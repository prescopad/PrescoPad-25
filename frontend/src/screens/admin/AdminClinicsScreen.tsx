import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator,
  RefreshControl, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { fetchAdminClinics, AdminClinic } from '../../services/adminService';

export default function AdminClinicsScreen(): React.JSX.Element {
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      const r = await fetchAdminClinics({ search: search.trim() || undefined, limit: 200 });
      setClinics(r.clinics);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.failedLoadClinics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('admin.clinics')}</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchClinics')}
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={clinics}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const solo = item.soloMode ?? item.solo_mode;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.name}>{item.name}</Text>
                  {solo ? (
                    <View style={styles.soloBadge}><Text style={styles.soloBadgeText}>{t('admin.solo')}</Text></View>
                  ) : null}
                </View>
                {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
                <View style={styles.metrics}>
                  <Metric label={t('admin.doctors')} value={item.doctorCount} />
                  <Metric label={t('admin.assistants')} value={item.assistantCount} />
                  <Metric label={t('admin.rx')} value={item.prescriptionCount} />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>{t('admin.noClinics')}</Text>}
        />
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  controls: { padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 8, gap: SPACING.xs },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  list: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  soloBadge: { backgroundColor: COLORS.warningLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  soloBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.warning },
  address: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  metrics: { flexDirection: 'row', marginTop: SPACING.sm, gap: SPACING.lg },
  metric: { alignItems: 'flex-start' },
  metricValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  metricLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
