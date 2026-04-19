import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { useQueueStore } from '../../store/useQueueStore';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { QueueItem, QueueStatus } from '../../types/queue.types';
import { DoctorStackParamList } from '../../types/navigation.types';

type DoctorDashboardProps = NativeStackScreenProps<DoctorStackParamList, 'DoctorDashboard'>;

export default function DoctorDashboard({ navigation }: DoctorDashboardProps): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const clinic = useClinicStore((s) => s.clinic);
  const doctorProfile = useClinicStore((s) => s.doctorProfile);
  const { queueItems, stats, isLoading, loadQueueFiltered, loadStatsFiltered, startConsult, startPolling, stopPolling } = useQueueStore();
  const { balance, loadBalance } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'in_progress' | 'completed'>('all');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send heartbeat every 60 seconds while app is active
  useEffect(() => {
    const sendHeartbeat = () => {
      api.post('/auth/heartbeat').catch(() => { /* silent */ });
    };

    // Send immediately on mount
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 60_000);

    // Pause heartbeat when app goes to background
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sendHeartbeat();
        if (!heartbeatRef.current) {
          heartbeatRef.current = setInterval(sendHeartbeat, 60_000);
        }
      } else {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
      }
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      subscription.remove();
    };
  }, []);

  const loadData = useCallback(async () => {
    const todayOnly = !showAllHistory;
    const status = activeTab === 'all' ? undefined : activeTab;
    await Promise.all([
      loadQueueFiltered({ status, todayOnly }),
      loadStatsFiltered(todayOnly),
      loadBalance(),
    ]);
  }, [loadQueueFiltered, loadStatsFiltered, loadBalance, showAllHistory, activeTab]);

  // Start queue polling on focus, stop on blur
  useFocusEffect(
    useCallback(() => {
      loadData();
      startPolling();
      return () => { stopPolling(); };
    }, [loadData, startPolling, stopPolling])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTabChange = (tab: 'all' | 'waiting' | 'in_progress' | 'completed') => {
    setActiveTab(tab);
  };

  const handleToggleHistory = () => {
    setShowAllHistory((prev) => !prev);
  };

  // Re-load when filter or history toggle changes
  useEffect(() => {
    loadData();
  }, [activeTab, showAllHistory, loadData]);

  const handleStartConsult = async (item: QueueItem) => {
    if (item.status === QueueStatus.COMPLETED) {
      if (item.patient) {
        navigation.navigate('PatientHistory', { patientId: item.patient.id, patientName: item.patient.name });
      }
      return;
    }
    if (!item.patient) {
      Alert.alert('Error', 'Patient data not available for this queue item');
      return;
    }
    if (item.status === QueueStatus.IN_PROGRESS) {
      navigation.navigate('Consult', { queueItem: item, patient: item.patient });
      return;
    }
    try {
      await startConsult(item.id);
      navigation.navigate('Consult', { queueItem: item, patient: item.patient });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to start consultation';
      Alert.alert('Error', msg);
    }
  };

  const doctorName = doctorProfile?.name || user?.name || 'Doctor';
  const clinicName = clinic?.name || APP_CONFIG.name;

  const getStatusColor = (status: QueueStatus): string => {
    switch (status) {
      case QueueStatus.WAITING:
        return COLORS.warning;
      case QueueStatus.IN_PROGRESS:
        return COLORS.primary;
      case QueueStatus.COMPLETED:
        return COLORS.success;
      case QueueStatus.CANCELLED:
        return COLORS.error;
      default:
        return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status: QueueStatus): string => {
    switch (status) {
      case QueueStatus.WAITING:
        return 'Waiting';
      case QueueStatus.IN_PROGRESS:
        return 'In Progress';
      case QueueStatus.COMPLETED:
        return 'Completed';
      case QueueStatus.CANCELLED:
        return 'Cancelled';
      default:
        return status;
    }
  };

  const renderQueueItem = ({ item }: { item: QueueItem }) => {
    const statusColor = getStatusColor(item.status);
    const isTappable = item.status !== QueueStatus.CANCELLED;
    const isActive = item.status === QueueStatus.WAITING || item.status === QueueStatus.IN_PROGRESS;
    const patientName = item.patient?.name || 'Unknown Patient';
    const patientAge = item.patient?.age ?? '--';
    const patientGender = item.patient?.gender
      ? item.patient.gender.charAt(0).toUpperCase()
      : '--';

    return (
      <TouchableOpacity
        style={[styles.queueCard, isActive && styles.queueCardActive]}
        onPress={() => isTappable && handleStartConsult(item)}
        activeOpacity={isTappable ? 0.7 : 1}
        disabled={!isTappable}
      >
        <View style={styles.queueCardLeft}>
          <View style={[styles.tokenBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.tokenText}>{item.tokenNumber}</Text>
          </View>
        </View>

        <View style={styles.queueCardCenter}>
          <Text style={styles.patientName} numberOfLines={1}>
            {patientName}
          </Text>
          <Text style={styles.patientInfo}>
            {patientAge} yrs / {patientGender}
          </Text>
          {item.notes ? (
            <Text style={styles.queueNotes} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>

        <View style={styles.queueCardRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
          {isTappable && (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textMuted}
              style={styles.chevron}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hello, Dr. {doctorName}</Text>
            <Text style={styles.clinicName}>{clinicName}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.syncBadge}>
              <View style={[styles.syncDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.syncText}>Online</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconCircle, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="people-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconCircle, { backgroundColor: COLORS.warningLight }]}>
            <Ionicons name="time-outline" size={18} color={COLORS.warning} />
          </View>
          <Text style={styles.statValue}>{stats.waiting}</Text>
          <Text style={styles.statLabel}>Waiting</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconCircle, { backgroundColor: COLORS.successLight }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
          </View>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconCircle, { backgroundColor: COLORS.primarySurface }]}>
            <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>
            {APP_CONFIG.wallet.currencySymbol}{balance}
          </Text>
          <Text style={styles.statLabel}>Wallet</Text>
        </View>
      </View>

      {/* Queue Title + History Toggle */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Patient Queue</Text>
        <TouchableOpacity style={styles.historyToggle} onPress={handleToggleHistory}>
          <Ionicons name={showAllHistory ? 'calendar' : 'time-outline'} size={16} color={COLORS.primary} />
          <Text style={styles.historyToggleText}>
            {showAllHistory ? 'All History' : 'Today'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {([
          { key: 'all' as const, label: 'All', count: stats.total },
          { key: 'waiting' as const, label: 'Waiting', count: stats.waiting },
          { key: 'in_progress' as const, label: 'In Progress', count: stats.inProgress },
          { key: 'completed' as const, label: 'Done', count: stats.completed },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeTab === tab.key && styles.filterTabActive]}
            onPress={() => handleTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeTab === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
            <View style={[styles.filterTabBadge, activeTab === tab.key && styles.filterTabBadgeActive]}>
              <Text style={[styles.filterTabBadgeText, activeTab === tab.key && styles.filterTabBadgeTextActive]}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
      </View>
      <Text style={styles.emptyTitle}>No patients in queue</Text>
      <Text style={styles.emptySubtitle}>
        Patients added by your assistant will appear here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {isLoading && queueItems.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading queue...</Text>
        </View>
      ) : (
        <FlatList
          data={queueItems}
          keyExtractor={(item) => item.id}
          renderItem={renderQueueItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  listContent: {
    paddingBottom: SPACING.xxxl,
  },

  // Header
  header: {
    backgroundColor: COLORS.white,
    paddingTop: 52,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  clinicName: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pairButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  historyToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  filterTabTextActive: {
    color: COLORS.white,
  },
  filterTabBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    minWidth: 18,
    alignItems: 'center',
  },
  filterTabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterTabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterTabBadgeTextActive: {
    color: COLORS.white,
  },

  // Queue Cards
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  queueCardActive: {
    borderColor: COLORS.primary + '30',
  },
  queueCardLeft: {
    marginRight: SPACING.md,
  },
  tokenBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  queueCardCenter: {
    flex: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  patientInfo: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  queueNotes: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  queueCardRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevron: {
    marginTop: 2,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
    paddingHorizontal: SPACING.xxl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
