import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { DoctorStackParamList } from '../types/navigation.types';

// Doctor screens
import DoctorDashboard from '../screens/doctor/DoctorDashboard';
import ConsultScreen from '../screens/doctor/ConsultScreen';
import MedicinePickerScreen from '../screens/doctor/MedicinePickerScreen';
import LabTestPickerScreen from '../screens/doctor/LabTestPickerScreen';
import PrescriptionPreviewScreen from '../screens/doctor/PrescriptionPreviewScreen';
import RxSuccessScreen from '../screens/doctor/RxSuccessScreen';
import PatientHistoryScreen from '../screens/doctor/PatientHistoryScreen';
import AnalyticsScreen from '../screens/doctor/AnalyticsScreen';
import AITranscriptionScreen from '../screens/doctor/AITranscriptionScreen';
import TranscriptHistoryScreen from '../screens/doctor/TranscriptHistoryScreen';

// Shared screens
import WalletScreen from '../screens/shared/WalletScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import ClinicProfileScreen from '../screens/shared/ClinicProfileScreen';
import ConnectionScreen from '../screens/shared/ConnectionScreen';
import PatientFormScreen from '../screens/shared/PatientFormScreen';
import MedicineTestManagementScreen from '../screens/settings/MedicineTestManagementScreen';

const Tab = createBottomTabNavigator();
const QueueStack = createNativeStackNavigator<DoctorStackParamList>();
const WalletStack = createNativeStackNavigator();
const AnalyticsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

function DoctorQueueStack(): React.JSX.Element {
  return (
    <QueueStack.Navigator screenOptions={{ headerShown: false }}>
      <QueueStack.Screen name="DoctorDashboard" component={DoctorDashboard} />
      <QueueStack.Screen name="Consult" component={ConsultScreen} options={{ headerShown: true, title: 'Consultation' }} />
      <QueueStack.Screen name="MedicinePicker" component={MedicinePickerScreen} options={{ headerShown: true, title: 'Add Medicine' }} />
      <QueueStack.Screen name="LabTestPicker" component={LabTestPickerScreen} options={{ headerShown: true, title: 'Add Lab Test' }} />
      <QueueStack.Screen name="PrescriptionPreview" component={PrescriptionPreviewScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="RxSuccess" component={RxSuccessScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="PatientHistory" component={PatientHistoryScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="AITranscription" component={AITranscriptionScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="TranscriptHistory" component={TranscriptHistoryScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="EditPatient" component={PatientFormScreen} options={{ headerShown: false }} />
      <QueueStack.Screen name="Connection" component={ConnectionScreen} options={{ headerShown: false }} />
    </QueueStack.Navigator>
  );
}

function DoctorWalletStack(): React.JSX.Element {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="WalletMain" component={WalletScreen} />
    </WalletStack.Navigator>
  );
}

function DoctorAnalyticsStack(): React.JSX.Element {
  return (
    <AnalyticsStack.Navigator screenOptions={{ headerShown: false }}>
      <AnalyticsStack.Screen name="AnalyticsMain" component={AnalyticsScreen} />
    </AnalyticsStack.Navigator>
  );
}

function DoctorSettingsStack(): React.JSX.Element {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen name="ClinicProfile" component={ClinicProfileScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="ConnectionSettings" component={ConnectionScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="MedicineTestManagement" component={MedicineTestManagementScreen} options={{ headerShown: false }} />
    </SettingsStack.Navigator>
  );
}

export default function DoctorTabNavigator(): React.JSX.Element {
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
          if (route.name === 'DoctorQueue') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'DoctorWallet') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'DoctorAnalytics') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          else if (route.name === 'DoctorSettings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DoctorQueue"
        component={DoctorQueueStack}
        options={{ tabBarLabel: 'Queue' }}
      />
      <Tab.Screen
        name="DoctorWallet"
        component={DoctorWalletStack}
        options={{ tabBarLabel: 'Wallet' }}
      />
      <Tab.Screen
        name="DoctorAnalytics"
        component={DoctorAnalyticsStack}
        options={{ tabBarLabel: 'Analytics' }}
      />
      <Tab.Screen
        name="DoctorSettings"
        component={DoctorSettingsStack}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}
