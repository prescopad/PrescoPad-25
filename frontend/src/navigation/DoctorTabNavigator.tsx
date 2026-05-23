import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';
import { DoctorStackParamList } from '../types/navigation.types';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { getMe } from '../services/authService';

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

// Solo-mode screens (reused from assistant)
import AddPatientScreen from '../screens/assistant/AddPatientScreen';
import PatientSearchScreen from '../screens/assistant/PatientSearchScreen';
import PatientDetailScreen from '../screens/assistant/PatientDetailScreen';

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
const PatientStack = createNativeStackNavigator();

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

function DoctorPatientStack(): React.JSX.Element {
  return (
    <PatientStack.Navigator screenOptions={{ headerShown: false }}>
      <PatientStack.Screen name="AddPatientForm" component={AddPatientScreen} />
      <PatientStack.Screen name="PatientSearch" component={PatientSearchScreen} />
      <PatientStack.Screen name="PatientDetail" component={PatientDetailScreen} />
    </PatientStack.Navigator>
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
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const isSolo = Boolean(user?.soloMode);

  useEffect(() => {
    const sendHeartbeat = () => {
      api.post('/auth/heartbeat').catch(() => {});
    };
    // Refresh user.soloMode by re-reading /auth/me. Catches the case where an
    // assistant just accepted an invite — the doctor's solo tabs disappear.
    const refreshMe = async () => {
      try {
        const me = await getMe();
        const current = useAuthStore.getState();
        const tokenA = current.accessToken;
        const tokenR = current.refreshToken;
        if (tokenA && tokenR && (me.soloMode !== current.user?.soloMode || me.role !== current.user?.role)) {
          await setUser(me, tokenA, tokenR);
        }
      } catch {
        /* silent */
      }
    };

    sendHeartbeat();
    refreshMe();
    heartbeatRef.current = setInterval(sendHeartbeat, 60_000);
    meRefreshRef.current = setInterval(refreshMe, 60_000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sendHeartbeat();
        refreshMe();
        if (!heartbeatRef.current) heartbeatRef.current = setInterval(sendHeartbeat, 60_000);
        if (!meRefreshRef.current) meRefreshRef.current = setInterval(refreshMe, 60_000);
      } else {
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        if (meRefreshRef.current) { clearInterval(meRefreshRef.current); meRefreshRef.current = null; }
      }
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (meRefreshRef.current) clearInterval(meRefreshRef.current);
      sub.remove();
    };
  }, [setUser]);

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
          else if (route.name === 'DoctorPatients') iconName = focused ? 'person-add' : 'person-add-outline';
          else if (route.name === 'DoctorWallet') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'DoctorAnalytics') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          else if (route.name === 'DoctorSettings') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DoctorQueue" component={DoctorQueueStack} options={{ tabBarLabel: 'Queue' }} />

      {isSolo ? (
        <Tab.Screen
          name="DoctorPatients"
          component={DoctorPatientStack}
          options={{ tabBarLabel: 'Patients' }}
        />
      ) : null}

      <Tab.Screen name="DoctorWallet" component={DoctorWalletStack} options={{ tabBarLabel: 'Wallet' }} />
      <Tab.Screen name="DoctorAnalytics" component={DoctorAnalyticsStack} options={{ tabBarLabel: 'Analytics' }} />
      <Tab.Screen name="DoctorSettings" component={DoctorSettingsStack} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}
