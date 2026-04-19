import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types/navigation.types';
import { useAuthStore } from '../store/useAuthStore';
import LandingScreen from '../screens/auth/LandingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import RegistrationScreen from '../screens/auth/RegistrationScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // If user is authenticated but profile incomplete, start at Registration
  const needsRegistration = isAuthenticated && user && !user.isProfileComplete;

  return (
    <Stack.Navigator
      initialRouteName={needsRegistration ? 'Registration' : 'Landing'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen
        name="Registration"
        component={RegistrationScreen}
        initialParams={needsRegistration ? { role: user.role } : undefined}
      />
    </Stack.Navigator>
  );
}
