import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, TextInput, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import {
  fetchAdminUsers, AdminUser, setAdminUserActive, promoteAdminUser, deleteAdminUser,
} from '../../services/adminService';

type RoleFilter = 'all' | 'doctor' | 'assistant' | 'admin';

const ROLE_CONFIG = {
  doctor: {
    label: 'Doctors',
    icon: 'medkit-outline' as const,
    color: COLORS.primary,
    bgColor: COLORS.primaryLight,
  },
  assistant: {
    label: 'Assistants',
    icon: 'people-outline' as const,
    color: COLORS.info,
    bgColor: COLORS.infoLight,
  },
  admin: {
    label: 'Admins',
    icon: 'shield-outline' as const,
    color: COLORS.warning,
    bgColor: COLORS.warningLight,
  },
} as const;

export default function AdminUsersScreen(): React.JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [activeRole, setActiveRole] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Works on both native (Alert) and web (window.confirm).
  const webConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = 'Confirm',
  ) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const roleParam = activeRole === 'all' ? undefined : activeRole as 'doctor' | 'assistant' | 'admin';

  const load = useCallback(async () => {
    try {
      const r = await fetchAdminUsers({ role: roleParam, search: search.trim() || undefined, limit: 500 });
      setUsers(r.users);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.failedLoadUsers'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleParam, search, t]);

  useEffect(() => { load(); }, [load]);

  const toggleSection = (role: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  };

  const onToggleActive = async (u: AdminUser) => {
    const isActive = (u.isActive ?? u.is_active) !== false;
    const action = isActive ? 'Deactivate' : 'Reactivate';
    webConfirm(
      `${action} User`,
      `Are you sure you want to ${action.toLowerCase()} ${u.name ?? u.phone}?`,
      async () => {
        try {
          const updated = await setAdminUserActive(u.id, !isActive);
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
        } catch (e) {
          Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.updateFailed'));
        }
      },
      action,
    );
  };

  const onPromote = async (u: AdminUser) => {
    webConfirm(
      t('admin.promoteConfirm'),
      t('admin.promoteMessage', { name: u.name ?? u.phone }),
      async () => {
        try {
          const updated = await promoteAdminUser(u.id);
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
        } catch (e) {
          Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.promoteFailed'));
        }
      },
      t('admin.promote'),
    );
  };

  const onDelete = async (u: AdminUser) => {
    webConfirm(
      'Delete User',
      `Are you sure you want to permanently delete ${u.name ?? u.phone}? This cannot be undone.`,
      async () => {
        try {
          await deleteAdminUser(u.id);
          setUsers((prev) => prev.filter((x) => x.id !== u.id));
        } catch (e) {
          Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed to delete user');
        }
      },
      'Delete',
    );
  };

  const doctorCount = useMemo(() => users.filter((u) => u.role === 'doctor').length, [users]);
  const assistantCount = useMemo(() => users.filter((u) => u.role === 'assistant').length, [users]);
  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

  const sections = useMemo(() => {
    const roles: ('doctor' | 'assistant' | 'admin')[] = ['doctor', 'assistant', 'admin'];
    return roles
      .filter((r) => activeRole === 'all' || r === activeRole)
      .map((r) => {
        const allForRole = users.filter((u) => u.role === r);
        return {
          role: r,
          title: ROLE_CONFIG[r].label,
          totalCount: allForRole.length,
          data: collapsedSections.has(r) ? [] : allForRole,
        };
      })
      .filter((s) => s.totalCount > 0);
  }, [users, activeRole, collapsedSections]);

  const tabData: { key: RoleFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: users.length, color: COLORS.text },
    { key: 'doctor', label: 'Doctors', count: doctorCount, color: COLORS.primary },
    { key: 'assistant', label: 'Assistants', count: assistantCount, color: COLORS.info },
    { key: 'admin', label: 'Admins', count: adminCount, color: COLORS.warning },
  ];

  const renderSectionHeader = ({ section }: { section: (typeof sections)[0] }) => {
    const cfg = ROLE_CONFIG[section.role];
    const isCollapsed = collapsedSections.has(section.role);
    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(section.role)}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionIconCircle, { backgroundColor: cfg.bgColor }]}>
          <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: cfg.color }]}>{section.title}</Text>
        <View style={[styles.sectionCountBadge, { backgroundColor: cfg.bgColor }]}>
          <Text style={[styles.sectionCountText, { color: cfg.color }]}>{section.totalCount}</Text>
        </View>
        <View style={styles.sectionChevron}>
          <Ionicons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={18}
            color={COLORS.textMuted}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: AdminUser }) => {
    const isActive = (item.isActive ?? item.is_active) !== false;
    const cfg = ROLE_CONFIG[item.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.doctor;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: cfg.bgColor }]}>
            <Text style={[styles.avatarText, { color: cfg.color }]}>
              {(item.name ?? item.phone ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{item.name ?? '—'}</Text>
            <Text style={styles.phone}>+91 {item.phone}</Text>
            {item.created_at && (
              <Text style={styles.dateText}>
                Joined {new Date(item.created_at).toLocaleDateString('en-IN')}
              </Text>
            )}
          </View>
          <View style={[styles.activeIndicator, { backgroundColor: isActive ? COLORS.success : COLORS.textLight }]} />
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
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('admin.users')}</Text>
          <Text style={styles.headerSub}>{users.length} total users</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStatPill}>
            <Ionicons name="medkit" size={11} color={COLORS.white} />
            <Text style={styles.headerStatText}>{doctorCount}</Text>
          </View>
          <View style={[styles.headerStatPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="people" size={11} color={COLORS.white} />
            <Text style={styles.headerStatText}>{assistantCount}</Text>
          </View>
          <View style={[styles.headerStatPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Ionicons name="shield" size={11} color={COLORS.white} />
            <Text style={styles.headerStatText}>{adminCount}</Text>
          </View>
        </View>
      </View>

      {/* Search */}
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

        {/* Role Filter Tabs */}
        <View style={styles.tabs}>
          {tabData.map((tab) => {
            const isActive = activeRole === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}
                onPress={() => setActiveRole(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && { color: tab.color, fontWeight: '700' }]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabBadge, isActive && { backgroundColor: tab.color }]}>
                  <Text style={[styles.tabBadgeText, isActive && { color: COLORS.white }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
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
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2 },
  headerStats: { flexDirection: 'row', gap: SPACING.xs },
  headerStatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  headerStatText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  controls: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 8, gap: SPACING.xs,
    margin: SPACING.lg, marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, gap: 4,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  tabBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full,
    minWidth: 20, alignItems: 'center',
  },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },

  list: { paddingBottom: 60 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  sectionIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCountBadge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  sectionCountText: { fontSize: 12, fontWeight: '700' },
  sectionChevron: { marginLeft: 'auto' as never },

  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.sm,
    borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  phone: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  dateText: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  activeIndicator: { width: 10, height: 10, borderRadius: 5 },

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
