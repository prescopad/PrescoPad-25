import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';

import AdminOverviewScreen from '../screens/admin/AdminOverviewScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminClinicsScreen from '../screens/admin/AdminClinicsScreen';
import AdminPatientsScreen from '../screens/admin/AdminPatientsScreen';
import AdminRevenueScreen from '../screens/admin/AdminRevenueScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'grid-outline';
          if (route.name === 'AdminOverview') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'AdminUsers') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'AdminClinics') iconName = focused ? 'business' : 'business-outline';
          else if (route.name === 'AdminPatients') iconName = focused ? 'person' : 'person-outline';
          else if (route.name === 'AdminRevenue') iconName = focused ? 'cash' : 'cash-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="AdminOverview" component={AdminOverviewScreen} options={{ tabBarLabel: 'Overview' }} />
      <Tab.Screen name="AdminUsers" component={AdminUsersScreen} options={{ tabBarLabel: 'Users' }} />
      <Tab.Screen name="AdminClinics" component={AdminClinicsScreen} options={{ tabBarLabel: 'Clinics' }} />
      <Tab.Screen name="AdminPatients" component={AdminPatientsScreen} options={{ tabBarLabel: 'Patients' }} />
      <Tab.Screen name="AdminRevenue" component={AdminRevenueScreen} options={{ tabBarLabel: 'Revenue' }} />
    </Tab.Navigator>
  );
}
