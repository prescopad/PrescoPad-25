import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { UserRole } from '../types/auth.types';
import AuthStack from './AuthStack';
import DoctorTabNavigator from './DoctorTabNavigator';
import AssistantTabNavigator from './AssistantTabNavigator';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function RootNavigator(): React.JSX.Element {
  const { isAuthenticated, isLoading, user, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show AuthStack if not authenticated OR if profile is incomplete
  const showAuth = !isAuthenticated || (isAuthenticated && user && !user.isProfileComplete);

  return (
    <NavigationContainer>
      {showAuth ? (
        <AuthStack />
      ) : user?.role === UserRole.DOCTOR ? (
        <DoctorTabNavigator />
      ) : (
        <AssistantTabNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
