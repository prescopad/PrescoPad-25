import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { fetchAdminPatients, AdminPatient } from '../../services/adminService';

export default function AdminPatientsScreen(): React.JSX.Element {
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const r = await fetchAdminPatients({ search: search.trim() || undefined, limit: 200 });
      setPatients(r.patients);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load patients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <Text style={styles.headerSub}>{patients.length} records</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={patients}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.name ?? 'P')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.phone ? <Text style={styles.sub}>+91 {item.phone}</Text> : null}
                  <Text style={styles.sub}>
                    {[item.age ? `${item.age} yrs` : null, item.gender]
                      .filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {item.created_at && (
                  <Text style={styles.date}>
                    {new Date(item.created_at).toLocaleDateString('en-IN')}
                  </Text>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.empty}>No patients found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  controls: { padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 8, gap: SPACING.xs,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  list: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.successLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.success },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  date: { fontSize: 11, color: COLORS.textLight },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textMuted, fontSize: 14 },
});
