import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import {
  fetchAdminUsers, AdminUser, setAdminUserActive, promoteAdminUser, deleteAdminUser,
} from '../../services/adminService';

type Role = 'doctor' | 'assistant' | 'admin' | undefined;

export default function AdminUsersScreen(): React.JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      const r = await fetchAdminUsers({ role, search: search.trim() || undefined, limit: 200 });
      setUsers(r.users);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.failedLoadUsers'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, search, t]);

  useEffect(() => { load(); }, [load]);

  const onToggleActive = async (u: AdminUser) => {
    const isActive = (u.isActive ?? u.is_active) !== false;
    try {
      const updated = await setAdminUserActive(u.id, !isActive);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.updateFailed'));
    }
  };

  const onPromote = async (u: AdminUser) => {
    Alert.alert(
      t('admin.promoteConfirm'),
      t('admin.promoteMessage', { name: u.name ?? u.phone }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.promote'),
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await promoteAdminUser(u.id);
              setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
            } catch (e) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.promoteFailed'));
            }
          },
        },
      ],
    );
  };

  const onDelete = async (u: AdminUser) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${u.name ?? u.phone}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminUser(u.id);
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
            } catch (e) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed to delete user');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('admin.users')}</Text>
        <Text style={styles.headerSub}>{users.length} users</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchUsers')}
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
        <View style={styles.chips}>
          <Chip label={t('common.all')} active={role === undefined} onPress={() => setRole(undefined)} />
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
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {(item.name ?? item.phone ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name ?? '—'}</Text>
                    <Text style={styles.phone}>+91 {item.phone}</Text>
                    {item.created_at && (
                      <Text style={styles.dateText}>
                        Joined {new Date(item.created_at).toLocaleDateString('en-IN')}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.roleBadge, roleStyle(item.role)]}>
                    <Text style={styles.roleBadgeText}>{item.role}</Text>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: isActive ? COLORS.success : COLORS.textLight }]} />
                  <Text style={[styles.statusText, { color: isActive ? COLORS.success : COLORS.textMuted }]}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => onToggleActive(item)}
                    style={[styles.actionBtn, !isActive && styles.actionBtnSuccess]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={14}
                      color={isActive ? COLORS.textSecondary : COLORS.success}
                    />
                    <Text style={[styles.actionBtnText, !isActive && { color: COLORS.success }]}>
                      {isActive ? 'Deactivate' : 'Reactivate'}
                    </Text>
                  </TouchableOpacity>

                  {item.role !== 'admin' && (
                    <TouchableOpacity
                      onPress={() => onPromote(item)}
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-up-circle-outline" size={14} color={COLORS.white} />
                      <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Promote</Text>
                    </TouchableOpacity>
                  )}

                  {item.role !== 'admin' && (
                    <TouchableOpacity
                      onPress={() => onDelete(item)}
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                      <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.empty}>{t('admin.noUsers')}</Text>
            </View>
          }
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
  chips: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm, flexWrap: 'wrap' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  list: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  phone: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  dateText: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  roleBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: RADIUS.full },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'capitalize' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  actionBtnDanger: { borderColor: COLORS.error, backgroundColor: COLORS.errorLight },
  actionBtnSuccess: { borderColor: COLORS.success, backgroundColor: COLORS.successLight },
  actionBtnPrimary: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  actionBtnTextDanger: { color: COLORS.error },
  actionBtnTextPrimary: { color: COLORS.white },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textMuted, fontSize: 14 },
});
