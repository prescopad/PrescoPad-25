import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAnalyticsStore } from '../../store/useAnalyticsStore';
import { TimePeriod } from '../../types/analytics.types';
import { COLORS, SPACING, RADIUS, SHADOWS, FONTS } from '../../constants/theme';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color: string;
  iconBg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, iconBg }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function AnalyticsScreen(): React.JSX.Element {
  const { analytics, period, isLoading, loadAnalytics, setPeriod } = useAnalyticsStore();

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadAnalytics(period);
    }, [period])
  );

  const handleRefresh = () => {
    loadAnalytics(period);
  };

  const renderPeriodTabs = () => (
    <View style={styles.periodTabs}>
      {(['today', 'week', 'month'] as TimePeriod[]).map(p => (
        <TouchableOpacity
          key={p}
          style={[styles.periodTab, period === p && styles.periodTabActive]}
          onPress={() => setPeriod(p)}
        >
          <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="analytics-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyStateText}>No data available for this period</Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading analytics...</Text>
    </View>
  );

  if (isLoading && !analytics) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics & Reports</Text>
        </View>
        {renderPeriodTabs()}
        {renderLoadingState()}
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics & Reports</Text>
        </View>
        {renderPeriodTabs()}
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics & Reports</Text>
      </View>

      {renderPeriodTabs()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Prescriptions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>
          <View style={styles.statsRow}>
            <StatCard
              icon="document-text-outline"
              label="Total"
              value={analytics.prescriptions.total}
              color={COLORS.primary}
              iconBg={COLORS.primaryLight}
            />
            <StatCard
              icon="checkmark-circle-outline"
              label="Finalized"
              value={analytics.prescriptions.finalized}
              color={COLORS.success}
              iconBg={COLORS.successLight}
            />
            <StatCard
              icon="create-outline"
              label="Draft"
              value={analytics.prescriptions.draft}
              color={COLORS.textMuted}
              iconBg={COLORS.borderLight}
            />
          </View>
        </View>

        {/* Earnings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.statsRow}>
            <StatCard
              icon="cash-outline"
              label="Net Earnings"
              value={`₹${analytics.earnings.netEarnings.toFixed(2)}`}
              color={COLORS.success}
              iconBg={COLORS.successLight}
            />
            <StatCard
              icon="document-outline"
              label="Prescriptions"
              value={analytics.earnings.prescriptionRevenue}
              color={COLORS.primary}
              iconBg={COLORS.primaryLight}
            />
          </View>
        </View>

        {/* Patients Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patients</Text>
          <View style={styles.statsRow}>
            <StatCard
              icon="person-add-outline"
              label="New Patients"
              value={analytics.patients.newPatients}
              color={COLORS.success}
              iconBg={COLORS.successLight}
            />
            <StatCard
              icon="people-outline"
              label="Total Patients"
              value={analytics.patients.totalPatients}
              color={COLORS.primary}
              iconBg={COLORS.primaryLight}
            />
          </View>
        </View>

        {/* Consultations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultations</Text>
          <View style={styles.statsRow}>
            <StatCard
              icon="checkmark-done-outline"
              label="Completed"
              value={analytics.consultations.completed}
              color={COLORS.success}
              iconBg={COLORS.successLight}
            />
            <StatCard
              icon="time-outline"
              label="Avg Wait"
              value={`${analytics.consultations.avgWaitMinutes}m`}
              color={COLORS.warning}
              iconBg={COLORS.warningLight}
            />
            <StatCard
              icon="timer-outline"
              label="Avg Duration"
              value={`${analytics.consultations.avgConsultMinutes}m`}
              color={COLORS.primary}
              iconBg={COLORS.primaryLight}
            />
          </View>
        </View>

        {/* Top Medicines Section */}
        {analytics.popular.topMedicines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Medicines</Text>
            {analytics.popular.topMedicines.map((item, idx) => (
              <View key={idx} style={styles.popularItem}>
                <Text style={styles.popularRank}>#{idx + 1}</Text>
                <Text style={styles.popularName}>{item.name}</Text>
                <Text style={styles.popularCount}>{item.count} uses</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top Lab Tests Section */}
        {analytics.popular.topTests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Lab Tests</Text>
            {analytics.popular.topTests.map((item, idx) => (
              <View key={idx} style={styles.popularItem}>
                <Text style={styles.popularRank}>#{idx + 1}</Text>
                <Text style={styles.popularName}>{item.name}</Text>
                <Text style={styles.popularCount}>{item.count} uses</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...FONTS.heading,
    fontSize: 22,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  periodTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  periodTabActive: {
    backgroundColor: COLORS.primary,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  periodTabTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  popularRank: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: SPACING.md,
    width: 30,
  },
  popularName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  popularCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});
