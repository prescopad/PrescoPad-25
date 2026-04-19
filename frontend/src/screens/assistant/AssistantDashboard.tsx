import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useQueueStore } from '../../store/useQueueStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePatientStore } from '../../store/usePatientStore';
import api from '../../services/api';
import { QueueItem, QueueStatus } from '../../types/queue.types';
import type { AssistantStackParamList } from '../../types/navigation.types';

type NavigationProp = NativeStackNavigationProp<AssistantStackParamList>;

function getStatusColor(status: QueueStatus): string {
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
}

function getStatusLabel(status: QueueStatus): string {
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
}

export default function AssistantDashboard(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { queueItems, stats, isLoading, doctorReady, loadQueue, loadStats, startPolling, stopPolling } =
    useQueueStore();
  const user = useAuthStore((s) => s.user);
  const { searchPatients, searchResults, clearSearch } = usePatientStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { setDoctorReady } = useQueueStore();

  // Poll doctor online status every 30 seconds
  useEffect(() => {
    const checkDoctorStatus = async () => {
      try {
        const res = await api.get('/clinic/doctor-status');
        setDoctorReady(res.data.online ?? false);
      } catch {
        setDoctorReady(false);
      }
    };

    checkDoctorStatus();
    const interval = setInterval(checkDoctorStatus, 30_000);
    return () => clearInterval(interval);
  }, [setDoctorReady]);

  useFocusEffect(
    useCallback(() => {
      loadQueue();
      loadStats();
      startPolling();
      return () => { stopPolling(); };
    }, [loadQueue, loadStats, startPolling, stopPolling]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadQueue(), loadStats()]);
    setRefreshing(false);
  }, [loadQueue, loadStats]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (text.trim().length > 0) {
        searchPatients(text.trim());
      } else {
        clearSearch();
      }
    },
    [searchPatients, clearSearch],
  );

  const handleAddPatientFromSearch = useCallback(
    async (patientId: string) => {
      if (!user) return;
      try {
        const { addToQueue } = useQueueStore.getState();
        await addToQueue(patientId, user.id);
        setSearchQuery('');
        clearSearch();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to add to queue';
        console.error(message);
      }
    },
    [user, clearSearch],
  );

  const activeQueue = queueItems.filter(
    (item) =>
      item.status === QueueStatus.WAITING ||
      item.status === QueueStatus.IN_PROGRESS,
  );

  const renderQueueItem = ({ item }: { item: QueueItem }) => {
    const statusColor = getStatusColor(item.status);
    const statusLabel = getStatusLabel(item.status);
    return (
      <TouchableOpacity
        style={styles.queueCard}
        activeOpacity={0.7}
        onPress={() => {
          if (item.patient) {
            navigation.navigate('PatientDetail', { patientId: item.patientId });
          }
        }}
      >
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenNumber}>{item.tokenNumber}</Text>
        </View>
        <View style={styles.queueInfo}>
          <Text style={styles.patientName} numberOfLines={1}>
            {item.patient?.name ?? 'Unknown Patient'}
          </Text>
          <Text style={styles.queueMeta}>
            {item.patient
              ? `${item.patient.age}y / ${item.patient.gender}`
              : `ID: ${item.patientId.slice(0, 8)}`}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({
    item,
  }: {
    item: { id: string; name: string; age: number; gender: string; phone: string };
  }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      activeOpacity={0.7}
      onPress={() => handleAddPatientFromSearch(item.id)}
    >
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultMeta}>
          {item.age}y / {item.gender} | {item.phone}
        </Text>
      </View>
      <Ionicons name="add-circle" size={28} color={COLORS.primary} />
    </TouchableOpacity>
  );

  const renderEmptyQueue = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>No Patients in Queue</Text>
      <Text style={styles.emptySubtitle}>
        Add patients using the search bar above or the button below
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Assistant Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              {user?.name ? `Welcome, ${user.name}` : 'Manage patient queue'}
            </Text>
          </View>
          <View style={styles.headerIcons}>
            {/* Online Indicator */}
            <View style={styles.syncIndicator}>
              <View
                style={[
                  styles.syncDot,
                  { backgroundColor: COLORS.success },
                ]}
              />
              <Text style={styles.syncText}>Online</Text>
            </View>
          </View>
        </View>

        {/* Doctor Ready Indicator */}
        <View style={styles.doctorReadyRow}>
          <View
            style={[
              styles.doctorReadyDot,
              {
                backgroundColor: doctorReady ? COLORS.success : COLORS.error,
              },
            ]}
          />
          <Text style={styles.doctorReadyText}>
            {doctorReady ? 'Doctor is Ready' : 'Doctor Not Available'}
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>In Queue</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>
            {stats.waiting}
          </Text>
          <Text style={styles.statLabel}>Waiting</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>
            {stats.inProgress}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
      </View>

      {/* Quick Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient to add to queue..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                clearSearch();
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results Dropdown */}
        {searchQuery.length > 0 && searchResults.length > 0 && (
          <View style={styles.searchResultsDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              keyboardShouldPersistTaps="handled"
              style={styles.searchResultsList}
            />
          </View>
        )}
      </View>

      {/* Active Queue */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={activeQueue}
          keyExtractor={(item) => item.id}
          renderItem={renderQueueItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyQueue}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PatientSearch')}
      >
        <Ionicons name="person-add" size={24} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },
  doctorReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  doctorReadyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  doctorReadyText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: -SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    ...SHADOWS.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  statCardMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    zIndex: 10,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 12,
    marginLeft: SPACING.sm,
  },
  searchResultsDropdown: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    maxHeight: 200,
    ...SHADOWS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  searchResultMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
    flexGrow: 1,
  },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  tokenContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  tokenNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  queueInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  queueMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
});
