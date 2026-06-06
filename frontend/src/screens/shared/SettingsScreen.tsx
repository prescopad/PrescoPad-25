import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ParamListBase } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { useAuthStore } from '../../store/useAuthStore';
import { SUPPORTED_LANGUAGES, setAppLanguage, getCurrentLanguage, LanguageCode } from '../../i18n';

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
  const { t } = useTranslation();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getCurrentLanguage());

  const handleSelectLanguage = async (code: LanguageCode) => {
    await setAppLanguage(code);
    setCurrentLang(code);
    setLangModalVisible(false);
  };

  const currentLangNative =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.native ?? 'English';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('settings.logoutConfirm'))) {
        logout();
      }
      return;
    }

    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout'),
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
      label: t('settings.clinicProfile'),
      subtitle: 'Manage clinic and doctor information',
      onPress: () => navigation.navigate('ClinicProfile'),
      showArrow: true,
    },
    {
      icon: 'medical-outline',
      label: t('settings.medicinesTests'),
      subtitle: 'Add or remove custom medicines and lab tests',
      onPress: () => navigation.navigate('MedicineTestManagement'),
      color: COLORS.success,
      showArrow: true,
    },
    {
      icon: 'sync-outline',
      label: t('settings.connection'),
      subtitle: 'Connect doctor and assistant devices',
      onPress: () => navigation.navigate('ConnectionSettings'),
      showArrow: true,
    },
    {
      icon: 'language-outline',
      label: t('settings.language'),
      subtitle: currentLangNative,
      onPress: () => setLangModalVisible(true),
      showArrow: true,
    },
    {
      icon: 'information-circle-outline',
      label: t('settings.about'),
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
      label: t('settings.logout'),
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
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
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
                {user?.role === 'doctor'
                  ? t('settings.doctor')
                  : user?.role === 'admin'
                    ? t('settings.admin')
                    : t('settings.assistant')}
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

      {/* Language picker */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('settings.chooseLanguage')}</Text>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const selected = lang.code === currentLang;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langRow, selected && styles.langRowSelected]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.langNative, selected && styles.langNativeSelected]}>
                      {lang.native}
                    </Text>
                    <Text style={styles.langLabel}>{lang.label}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
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

  // Language modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  langRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySurface,
  },
  langNative: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  langNativeSelected: {
    color: COLORS.primary,
  },
  langLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
