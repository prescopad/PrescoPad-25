import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants/theme';

// Assistant screens
import AssistantDashboard from '../screens/assistant/AssistantDashboard';
import AddPatientScreen from '../screens/assistant/AddPatientScreen';
import PatientSearchScreen from '../screens/assistant/PatientSearchScreen';
import PatientDetailScreen from '../screens/assistant/PatientDetailScreen';

// Shared screens
import SettingsScreen from '../screens/shared/SettingsScreen';
import ConnectionScreen from '../screens/shared/ConnectionScreen';
import PrescriptionViewScreen from '../screens/shared/PrescriptionViewScreen';
import ClinicProfileScreen from '../screens/shared/ClinicProfileScreen';
import MedicineTestManagementScreen from '../screens/settings/MedicineTestManagementScreen';

const Tab = createBottomTabNavigator();
const QueueStack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

function AssistantQueueStack(): React.JSX.Element {
  return (
    <QueueStack.Navigator screenOptions={{ headerShown: false }}>
      <QueueStack.Screen name="AssistantDashboard" component={AssistantDashboard} />
      <QueueStack.Screen name="PatientSearch" component={PatientSearchScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="PrescriptionView" component={PrescriptionViewScreen} options={{ headerShown: false }} />
    </QueueStack.Navigator>
  );
}

function AssistantPatientStack(): React.JSX.Element {
  return (
    <PatientStack.Navigator screenOptions={{ headerShown: false }}>
      <PatientStack.Screen name="AddPatientForm" component={AddPatientScreen} />
      <PatientStack.Screen name="PatientSearchNested" component={PatientSearchScreen} options={{ headerShown: false }} />
    </PatientStack.Navigator>
  );
}

function AssistantSettingsStack(): React.JSX.Element {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen name="ClinicProfile" component={ClinicProfileScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="ConnectionSettings" component={ConnectionScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="MedicineTestManagement" component={MedicineTestManagementScreen} options={{ headerShown: false }} />
    </SettingsStack.Navigator>
  );
}

export default function AssistantTabNavigator(): React.JSX.Element {
  const { t } = useTranslation();
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'AssistantQueue') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'AddPatient') iconName = focused ? 'person-add' : 'person-add-outline';
          else if (route.name === 'AssistantSettings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="AssistantQueue"
        component={AssistantQueueStack}
        options={{ tabBarLabel: t('nav.queue') }}
      />
      <Tab.Screen
        name="AddPatient"
        component={AssistantPatientStack}
        options={{ tabBarLabel: t('nav.addPatient') }}
      />
      <Tab.Screen
        name="AssistantSettings"
        component={AssistantSettingsStack}
        options={{ tabBarLabel: t('nav.settings') }}
      />
    </Tab.Navigator>
  );
}
