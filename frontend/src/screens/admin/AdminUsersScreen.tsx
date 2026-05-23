import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import {
  fetchAdminUsers, AdminUser, setAdminUserActive, promoteAdminUser,
} from '../../services/adminService';

type Role = 'doctor' | 'assistant' | 'admin' | undefined;

export default function AdminUsersScreen(): React.JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const r = await fetchAdminUsers({ role, search: search.trim() || undefined, limit: 200 });
      setUsers(r.users);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, search]);

  useEffect(() => { load(); }, [load]);

  const onToggleActive = async (u: AdminUser) => {
    const isActive = (u.isActive ?? u.is_active) !== false;
    try {
      const updated = await setAdminUserActive(u.id, !isActive);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Update failed');
    }
  };

  const onPromote = async (u: AdminUser) => {
    Alert.alert('Promote to admin?', `${u.name ?? u.phone} will gain platform-wide admin access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Promote', style: 'destructive', onPress: async () => {
          try {
            const updated = await promoteAdminUser(u.id);
            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Promote failed');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone"
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
          />
        </View>
        <View style={styles.chips}>
          <Chip label="All" active={role === undefined} onPress={() => setRole(undefined)} />
          <Chip label="Doctors" active={role === 'doctor'} onPress={() => setRole('doctor')} />
          <Chip label="Assistants" active={role === 'assistant'} onPress={() => setRole('assistant')} />
          <Chip label="Admins" active={role === 'admin'} onPress={() => setRole('admin')} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={users}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          renderItem={({ item }) => {
            const isActive = (item.isActive ?? item.is_active) !== false;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name ?? '—'}</Text>
                    <Text style={styles.phone}>+91 {item.phone}</Text>
                  </View>
                  <View style={[styles.roleBadge, roleStyle(item.role)]}>
                    <Text style={styles.roleBadgeText}>{item.role}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => onToggleActive(item)}
                    style={[styles.actionBtn, !isActive && styles.actionBtnDanger]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionBtnText, !isActive && styles.actionBtnTextDanger]}>
                      {isActive ? 'Deactivate' : 'Reactivate'}
                    </Text>
                  </TouchableOpacity>
                  {item.role !== 'admin' && (
                    <TouchableOpacity
                      onPress={() => onPromote(item)}
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Promote</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
        />
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function roleStyle(role: AdminUser['role']) {
  if (role === 'doctor') return { backgroundColor: COLORS.primaryLight };
  if (role === 'assistant') return { backgroundColor: COLORS.infoLight };
  return { backgroundColor: COLORS.warningLight };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  controls: { padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 8, gap: SPACING.xs,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  chips: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm, flexWrap: 'wrap' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  list: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  phone: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: RADIUS.full },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  actionBtnDanger: { borderColor: COLORS.error, backgroundColor: COLORS.errorLight },
  actionBtnPrimary: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  actionBtnTextDanger: { color: COLORS.error },
  actionBtnTextPrimary: { color: COLORS.white },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
