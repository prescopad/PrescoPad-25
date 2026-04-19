import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Switch,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ParamListBase } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { useWalletStore } from '../../store/useWalletStore';
import { Transaction, TransactionType } from '../../types/wallet.types';
import * as walletService from '../../services/walletService';

const RECHARGE_OPTIONS = [100, 500, 1000];

interface WalletScreenProps {
  navigation: NativeStackNavigationProp<ParamListBase>;
}

export default function WalletScreen({ navigation }: WalletScreenProps): React.JSX.Element {
  const {
    balance,
    transactions,
    loadBalance,
    loadTransactions,
    recharge,
  } = useWalletStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);

  // Auto-refill state
  const [autoRefill, setAutoRefill] = useState(false);
  const [autoRefillThreshold, setAutoRefillThreshold] = useState(
    String(APP_CONFIG.wallet.lowBalanceThreshold),
  );
  const [autoRefillAmount, setAutoRefillAmount] = useState(
    String(APP_CONFIG.wallet.defaultRechargeAmount),
  );

  const isLowBalance = balance < APP_CONFIG.wallet.lowBalanceThreshold;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadBalance(), loadTransactions()]);
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadBalance(), loadTransactions()]);
    setIsRefreshing(false);
  }, [loadBalance, loadTransactions]);

  const handleRecharge = async (amount: number) => {
    if (amount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount');
      return;
    }

    setIsRecharging(true);
    try {
      await recharge(amount);
      await loadTransactions();
      setShowRecharge(false);
      setCustomAmount('');
      Alert.alert('Success', `${APP_CONFIG.wallet.currencySymbol}${amount} added to your wallet`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Recharge failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setIsRecharging(false);
    }
  };

  const handleAutoRefillSave = async () => {
    try {
      const threshold = parseInt(autoRefillThreshold, 10) || APP_CONFIG.wallet.lowBalanceThreshold;
      const amount = parseInt(autoRefillAmount, 10) || APP_CONFIG.wallet.defaultRechargeAmount;
      await walletService.updateAutoRefill(autoRefill, amount, threshold);
      Alert.alert('Saved', 'Auto-refill settings updated');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update auto-refill';
      Alert.alert('Error', msg);
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === TransactionType.CREDIT;
    return (
      <View style={styles.txnRow}>
        <View style={[styles.txnIcon, isCredit ? styles.txnIconCredit : styles.txnIconDebit]}>
          <Ionicons
            name={isCredit ? 'arrow-up' : 'document-text-outline'}
            size={18}
            color={isCredit ? COLORS.success : COLORS.debit}
          />
        </View>
        <View style={styles.txnInfo}>
          <Text style={styles.txnDescription}>{item.description}</Text>
          <Text style={styles.txnDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text
          style={[
            styles.txnAmount,
            isCredit ? styles.txnAmountCredit : styles.txnAmountDebit,
          ]}
        >
          {isCredit ? '+' : '-'}{APP_CONFIG.wallet.currencySymbol}{item.amount}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardInner}>
            <View style={styles.balanceHeader}>
              <Ionicons name="wallet" size={24} color={COLORS.white} />
              <Text style={styles.balanceLabel}>Current Balance</Text>
            </View>
            <Text style={styles.balanceAmount}>
              {APP_CONFIG.wallet.currencySymbol}{balance.toFixed(2)}
            </Text>
          </View>

          {/* Low Balance Warning */}
          {isLowBalance ? (
            <View style={styles.lowBalanceWarning}>
              <Ionicons name="warning" size={16} color={COLORS.warning} />
              <Text style={styles.lowBalanceText}>
                Low balance! Recharge to continue issuing prescriptions.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.rechargeToggle}
            onPress={() => setShowRecharge(!showRecharge)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color={COLORS.white} />
            <Text style={styles.rechargeToggleText}>Recharge</Text>
          </TouchableOpacity>
        </View>

        {/* Recharge Options */}
        {showRecharge ? (
          <View style={styles.rechargeSection}>
            <Text style={styles.rechargeSectionTitle}>Select Amount</Text>
            <View style={styles.rechargeOptions}>
              {RECHARGE_OPTIONS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.rechargeOptionBtn}
                  onPress={() => handleRecharge(amount)}
                  disabled={isRecharging}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rechargeOptionText}>
                    {APP_CONFIG.wallet.currencySymbol}{amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customAmountRow}>
              <TextInput
                style={styles.customAmountInput}
                placeholder="Custom amount"
                placeholderTextColor={COLORS.textLight}
                value={customAmount}
                onChangeText={(text) => setCustomAmount(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[
                  styles.customRechargeBtn,
                  (!customAmount || isRecharging) && styles.buttonDisabled,
                ]}
                onPress={() => handleRecharge(parseInt(customAmount, 10))}
                disabled={!customAmount || isRecharging}
                activeOpacity={0.7}
              >
                {isRecharging ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.customRechargeBtnText}>Recharge</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Transaction History */}
        <View style={styles.txnSection}>
          <Text style={styles.txnSectionTitle}>Transaction History</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyTxn}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textLight} />
              <Text style={styles.emptyTxnText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((txn) => (
              <View key={txn.id}>
                {renderTransaction({ item: txn })}
              </View>
            ))
          )}
        </View>

        {/* Auto-Refill Settings */}
        <View style={styles.autoRefillSection}>
          <Text style={styles.txnSectionTitle}>Auto-Refill</Text>
          <View style={styles.autoRefillCard}>
            <View style={styles.autoRefillToggleRow}>
              <View style={styles.autoRefillInfo}>
                <Text style={styles.autoRefillLabel}>Enable Auto-Refill</Text>
                <Text style={styles.autoRefillDesc}>
                  Automatically recharge when balance is low
                </Text>
              </View>
              <Switch
                value={autoRefill}
                onValueChange={setAutoRefill}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={autoRefill ? COLORS.primary : COLORS.textLight}
              />
            </View>

            {autoRefill ? (
              <>
                <View style={styles.autoRefillInputRow}>
                  <Text style={styles.autoRefillInputLabel}>
                    Threshold ({APP_CONFIG.wallet.currencySymbol})
                  </Text>
                  <TextInput
                    style={styles.autoRefillInput}
                    value={autoRefillThreshold}
                    onChangeText={(text) => setAutoRefillThreshold(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <View style={styles.autoRefillInputRow}>
                  <Text style={styles.autoRefillInputLabel}>
                    Refill Amount ({APP_CONFIG.wallet.currencySymbol})
                  </Text>
                  <TextInput
                    style={styles.autoRefillInput}
                    value={autoRefillAmount}
                    onChangeText={(text) => setAutoRefillAmount(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <TouchableOpacity
                  style={styles.saveAutoRefillBtn}
                  onPress={handleAutoRefillSave}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveAutoRefillBtnText}>Save Settings</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 50,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    ...SHADOWS.lg,
  },
  balanceCardInner: {
    marginBottom: SPACING.lg,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  lowBalanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  lowBalanceText: {
    fontSize: 12,
    color: COLORS.white,
    flex: 1,
  },
  rechargeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  rechargeToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Recharge Section
  rechargeSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  rechargeSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  rechargeOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  rechargeOptionBtn: {
    flex: 1,
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  rechargeOptionText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customAmountRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  customAmountInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceSecondary,
  },
  customRechargeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customRechargeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Transaction section
  txnSection: {
    marginBottom: SPACING.xl,
  },
  txnSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  txnIconCredit: {
    backgroundColor: COLORS.successLight,
  },
  txnIconDebit: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  txnInfo: {
    flex: 1,
  },
  txnDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  txnDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txnAmountCredit: {
    color: COLORS.success,
  },
  txnAmountDebit: {
    color: COLORS.debit,
  },
  emptyTxn: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyTxnText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: SPACING.md,
  },

  // Auto-refill
  autoRefillSection: {
    marginBottom: SPACING.xxxl,
  },
  autoRefillCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  autoRefillToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoRefillInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  autoRefillLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  autoRefillDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  autoRefillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  autoRefillInputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  autoRefillInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    width: 100,
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    backgroundColor: COLORS.surfaceSecondary,
  },
  saveAutoRefillBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveAutoRefillBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
