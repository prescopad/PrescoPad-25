import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { AuthStackParamList } from '../../types/navigation.types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.topSection}>
        <Image source={require('../../../assets/prescopad.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>{APP_CONFIG.name}</Text>
        <Text style={styles.tagline}>{APP_CONFIG.tagline}</Text>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.prompt}>I am a...</Text>

        <TouchableOpacity
          style={styles.roleButton}
          onPress={() => navigation.navigate('Login', { role: 'doctor' })}
          activeOpacity={0.8}
        >
          <View style={styles.roleIconContainer}>
            <Ionicons name="medkit" size={28} color={COLORS.white} />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Doctor</Text>
            <Text style={styles.roleSubtitle}>Prescribe, sign & manage clinic</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.roleButton}
          onPress={() => navigation.navigate('Login', { role: 'assistant' })}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconContainer, { backgroundColor: '#059669' }]}>
            <Ionicons name="people" size={28} color={COLORS.white} />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Assistant / Nurse</Text>
            <Text style={styles.roleSubtitle}>Register patients & manage queue</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  bottomSection: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    paddingBottom: 40,
  },
  prompt: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  roleSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
