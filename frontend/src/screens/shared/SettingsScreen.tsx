import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ParamListBase } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { useAuthStore } from '../../store/useAuthStore';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
  showArrow?: boolean;
}

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<ParamListBase>;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps): React.JSX.Element {
  const { user, logout } = useAuthStore();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
          },
        },
      ],
    );
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'business-outline',
      label: 'Clinic Details',
      subtitle: 'Manage clinic and doctor information',
      onPress: () => navigation.navigate('ClinicProfile'),
      showArrow: true,
    },
    {
      icon: 'medical-outline',
      label: 'Manage Medicines & Tests',
      subtitle: 'Add or remove custom medicines and lab tests',
      onPress: () => navigation.navigate('MedicineTestManagement'),
      color: COLORS.success,
      showArrow: true,
    },
    {
      icon: 'sync-outline',
      label: 'Clinic Connection',
      subtitle: 'Connect doctor and assistant devices',
      onPress: () => navigation.navigate('ConnectionSettings'),
      showArrow: true,
    },
    {
      icon: 'information-circle-outline',
      label: 'About PrescoPad',
      subtitle: `Version ${APP_CONFIG.version}`,
      onPress: () => {
        Alert.alert(
          APP_CONFIG.name,
          `${APP_CONFIG.tagline}\n\nVersion: ${APP_CONFIG.version}\n\nDigital Prescription System for modern clinics.`,
        );
      },
      showArrow: false,
    },
    {
      icon: 'log-out-outline',
      label: 'Logout',
      subtitle: 'Sign out of your account',
      onPress: handleLogout,
      color: COLORS.error,
      showArrow: false,
    },
  ];

  const renderMenuItem = (item: MenuItem, index: number) => {
    const iconColor = item.color || COLORS.primary;
    const isLast = index === menuItems.length - 1;

    return (
      <TouchableOpacity
        key={item.label}
        style={[styles.menuItem, isLast && styles.menuItemLast]}
        onPress={item.onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.menuIconCircle, { backgroundColor: item.color ? COLORS.errorLight : COLORS.primarySurface }]}>
          <Ionicons name={item.icon} size={22} color={iconColor} />
        </View>
        <View style={styles.menuTextContainer}>
          <Text style={[styles.menuLabel, item.color ? { color: item.color } : null]}>
            {item.label}
          </Text>
          {item.subtitle ? (
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          ) : null}
        </View>
        {item.showArrow ? (
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <View style={styles.roleBadge}>
              <Ionicons
                name={user?.role === 'doctor' ? 'medkit' : 'people'}
                size={12}
                color={COLORS.primary}
              />
              <Text style={styles.roleText}>
                {user?.role === 'doctor' ? 'Doctor' : 'Assistant'}
              </Text>
            </View>
            <Text style={styles.phoneText}>{user?.phone || ''}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map(renderMenuItem)}
        </View>

        {/* App Info */}
        <Text style={styles.versionText}>
          {APP_CONFIG.name} v{APP_CONFIG.version}
        </Text>
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

  // Profile Section
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    ...SHADOWS.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  phoneText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // Menu Section
  menuSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Version text
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: SPACING.xxl,
  },
});
