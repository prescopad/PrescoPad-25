import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Alert, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { ConnectionRequest, TeamMember, ClinicListItem, DoctorListItem } from '../../types/connection.types';
import * as ConnectionService from '../../services/connectionService';
import { refreshSession } from '../../services/authService';

export default function ConnectionScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, setUser } = useAuthStore();
  const isDoctor = user?.role === 'doctor';

  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Doctor: invite by phone
  const [invitePhone, setInvitePhone] = useState('');
  const [inviting, setInviting] = useState(false);

  // Assistant: join by code
  const [doctorCode, setDoctorCode] = useState('');
  const [requesting, setRequesting] = useState(false);

  // Assistant: multi-step connection flow
  const [connectionStep, setConnectionStep] = useState<'select-hospital' | 'select-doctor' | 'verify-code'>('select-hospital');
  const [clinics, setClinics] = useState<ClinicListItem[]>([]);
  const [clinicSearch, setClinicSearch] = useState('');
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<ClinicListItem | null>(null);
  const [doctorsInHospital, setDoctorsInHospital] = useState<DoctorListItem[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorListItem | null>(null);

  // Expanded member details
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [requests, members] = await Promise.all([
        ConnectionService.getPendingRequests().catch(() => []),
        user?.clinicId ? ConnectionService.getTeamMembers().catch(() => []) : Promise.resolve([]),
      ]);
      setPendingRequests(requests);
      setTeamMembers(members);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (isDoctor || user?.clinicId) {
      return;
    }

    let isActive = true;

    const syncConnectionState = async () => {
      try {
        const session = await refreshSession();
        if (!isActive) return;

        if (session.user.clinicId) {
          await setUser(session.user, session.accessToken, session.refreshToken);
        }
      } catch {
        // Keep polling quietly until the doctor accepts or the session becomes available.
      }
    };

    syncConnectionState();
    const timer = setInterval(syncConnectionState, 15_000);

    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, [isDoctor, user?.clinicId, setUser]);

  const loadClinics = useCallback(async (search?: string) => {
    setLoadingClinics(true);
    try {
      const result = await ConnectionService.listClinics(search);
      setClinics(result);
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to load clinics');
      setClinics([]);
    } finally {
      setLoadingClinics(false);
    }
  }, []);

  // Load clinics for assistant on step 1
  useEffect(() => {
    if (!isDoctor && connectionStep === 'select-hospital') {
      loadClinics();
    }
  }, [isDoctor, connectionStep, loadClinics]);

  // Debounce clinic search
  useEffect(() => {
    if (!isDoctor && connectionStep === 'select-hospital') {
      const timer = setTimeout(() => {
        loadClinics(clinicSearch || undefined);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [clinicSearch, isDoctor, connectionStep, loadClinics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCopyCode = async () => {
    if (user?.doctorCode) {
      await Clipboard.setStringAsync(user.doctorCode);
      Alert.alert(t('common.done'), t('connection.codeCopied'));
    }
  };

  const handleInvite = async () => {
    const phone = invitePhone.trim().replace(/\D/g, '');
    if (phone.length < 10) {
      Alert.alert(t('common.invalid'), t('connection.enterValidPhone'));
      return;
    }

    setInviting(true);
    try {
      await ConnectionService.inviteAssistant(phone);
      Alert.alert(t('common.success'), t('connection.invitationSent'));
      setInvitePhone('');
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('connection.inviteSent');
      Alert.alert(t('common.error'), msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRequestToJoin = async () => {
    const code = doctorCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert(t('common.invalid'), t('connection.enterValidCode'));
      return;
    }

    setRequesting(true);
    try {
      await ConnectionService.requestToJoin(code);
      Alert.alert(t('common.success'), t('connection.joinRequestSent'));
      setDoctorCode('');
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('connection.joinSent');
      Alert.alert(t('common.error'), msg);
    } finally {
      setRequesting(false);
    }
  };

  // Multi-step connection flow helpers
  const loadDoctorsForHospital = async (clinicId: string) => {
    setLoadingDoctors(true);
    try {
      console.log('Loading doctors for clinic:', clinicId);
      const doctors = await ConnectionService.getDoctorsByClinic(clinicId);
      console.log('Doctors loaded:', doctors);
      setDoctorsInHospital(doctors);
    } catch (error) {
      console.error('Error loading doctors:', error);
      const errorMsg = error instanceof Error ? error.message : t('common.somethingWrong');
      Alert.alert(t('common.error'), t('connection.failedLoadDoctors', { error: errorMsg }));
      setDoctorsInHospital([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleVerifyAndConnect = async () => {
    if (!selectedDoctor || !doctorCode) return;

    // Verify code matches selected doctor
    if (doctorCode.trim().toUpperCase() !== selectedDoctor.doctorCode.toUpperCase()) {
      Alert.alert(t('common.invalid'), t('connection.enterCodeForDoctor', { name: selectedDoctor.name }));
      return;
    }

    setRequesting(true);
    try {
      await ConnectionService.requestToJoin(doctorCode);
      Alert.alert(t('common.success'), t('connection.requestSentMessage'));

      // Reset state
      setDoctorCode('');
      setSelectedHospital(null);
      setSelectedDoctor(null);
      setDoctorsInHospital([]);
      setConnectionStep('select-hospital');

      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('common.somethingWrong');
      Alert.alert(t('common.error'), msg);
    } finally {
      setRequesting(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await ConnectionService.acceptRequest(requestId);

      // Refresh session to get updated clinicId in JWT
      const session = await refreshSession();
      await setUser(session.user, session.accessToken, session.refreshToken);

      Alert.alert(t('common.success'), t('connection.connectionEstablished'));
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('common.somethingWrong');
      Alert.alert(t('common.error'), msg);
    }
  };

  const handleReject = (requestId: string) => {
    Alert.alert(t('connection.rejectRequest'), t('connection.areYouSure'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('connection.reject'),
        style: 'destructive',
        onPress: async () => {
          try {
            await ConnectionService.rejectRequest(requestId);
            loadData();
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : t('common.somethingWrong');
            Alert.alert(t('common.error'), msg);
          }
        },
      },
    ]);
  };

  const handleDisconnect = (memberId: string, memberName: string) => {
    Alert.alert(t('connection.disconnect'), `${memberName}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('connection.disconnect'),
        style: 'destructive',
        onPress: async () => {
          try {
            await ConnectionService.disconnectAssistant(memberId);
            Alert.alert(t('common.done'), `${memberName} ${t('connection.connectionEstablished')}`);
            loadData();
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : t('common.somethingWrong');
            Alert.alert(t('common.error'), msg);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
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
        <Text style={styles.headerTitle}>{t('connection.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isDoctor ? renderDoctorView() : renderAssistantView()}
      </ScrollView>
    </View>
  );

  function renderDoctorView() {
    return (
      <>
        {/* Doctor Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>{t('connection.yourDoctorCode')}</Text>
          <Text style={styles.codeValue}>{user?.doctorCode || '------'}</Text>
          <Text style={styles.codeHint}>{t('connection.shareCodeHint')}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={18} color={COLORS.white} />
            <Text style={styles.copyButtonText}>{t('connection.copyCode')}</Text>
          </TouchableOpacity>
        </View>

        {/* Invite by Phone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('connection.inviteAssistant')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={invitePhone}
              onChangeText={setInvitePhone}
              placeholder="Assistant phone number"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <TouchableOpacity
              style={[styles.sendButton, invitePhone.trim().length < 10 && styles.sendButtonDisabled]}
              onPress={handleInvite}
              disabled={inviting || invitePhone.trim().length < 10}
            >
              {inviting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="send" size={18} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('connection.pendingSection')}</Text>
            {pendingRequests.map(renderRequestCard)}
          </View>
        )}

        {/* Team Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('connection.yourTeam')}</Text>
          {teamMembers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color={COLORS.textLight} />
              <Text style={styles.emptyText}>{t('connection.noMembers')}</Text>
              <Text style={styles.emptySubtext}>{t('connection.noTeamHint')}</Text>
            </View>
          ) : (
            teamMembers
              .filter((m) => m.id !== user?.id)
              .map(renderTeamMemberCard)
          )}
        </View>
      </>
    );
  }

  function renderAssistantView() {
    const connectedDoctor = teamMembers.find((m) => m.role === 'doctor');

    // If already connected, show connected status
    if (connectedDoctor) {
      return (
        <>
          <View style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
            <Text style={styles.statusTitle}>{t('connection.connected')}</Text>
            <Text style={styles.statusSubtitle}>{t('connection.workingWith', { name: connectedDoctor.name })}</Text>
            {connectedDoctor.specialty && (
              <Text style={styles.statusDetail}>{connectedDoctor.specialty}</Text>
            )}
          </View>

          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              {pendingRequests.map(renderRequestCard)}
            </View>
          )}
        </>
      );
    }

    // Multi-step connection flow
    return (
      <>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressCircle, connectionStep === 'select-hospital' && styles.progressCircleActive]}>
              <Text style={[styles.progressNumber, connectionStep === 'select-hospital' && styles.progressNumberActive]}>1</Text>
            </View>
            <Text style={[styles.progressLabel, connectionStep === 'select-hospital' && styles.progressLabelActive]}>{t('queue.waiting')}</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={[styles.progressCircle, connectionStep === 'select-doctor' && styles.progressCircleActive]}>
              <Text style={[styles.progressNumber, connectionStep === 'select-doctor' && styles.progressNumberActive]}>2</Text>
            </View>
            <Text style={[styles.progressLabel, connectionStep === 'select-doctor' && styles.progressLabelActive]}>{t('auth.doctor')}</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={[styles.progressCircle, connectionStep === 'verify-code' && styles.progressCircleActive]}>
              <Text style={[styles.progressNumber, connectionStep === 'verify-code' && styles.progressNumberActive]}>3</Text>
            </View>
            <Text style={[styles.progressLabel, connectionStep === 'verify-code' && styles.progressLabelActive]}>{t('common.confirm')}</Text>
          </View>
        </View>

        {/* Step Content */}
        {connectionStep === 'select-hospital' && renderHospitalSelection()}
        {connectionStep === 'select-doctor' && renderDoctorSelection()}
        {connectionStep === 'verify-code' && renderCodeVerification()}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('connection.pendingSection')}</Text>
            {pendingRequests.map(renderRequestCard)}
          </View>
        )}
      </>
    );
  }

  function renderHospitalSelection() {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t('connection.selectHospital')}</Text>
        <Text style={styles.stepSubtitle}>{t('connection.searchHospital')}</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            value={clinicSearch}
            onChangeText={setClinicSearch}
            placeholder={t('connection.searchHospitalPlaceholder')}
            placeholderTextColor={COLORS.textLight}
          />
          {clinicSearch.length > 0 && (
            <TouchableOpacity onPress={() => setClinicSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {loadingClinics ? (
          <ActivityIndicator style={styles.loader} color={COLORS.primary} />
        ) : clinics.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={40} color={COLORS.textLight} />
            <Text style={styles.emptyText}>{t('connection.noHospitals')}</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {clinics.map((clinic) => (
              <TouchableOpacity
                key={clinic.id}
                style={[styles.hospitalCard, selectedHospital?.id === clinic.id && styles.hospitalCardSelected]}
                onPress={() => setSelectedHospital(clinic)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="business"
                  size={24}
                  color={selectedHospital?.id === clinic.id ? COLORS.primary : COLORS.textMuted}
                />
                <View style={styles.hospitalInfo}>
                  <Text style={[styles.hospitalName, selectedHospital?.id === clinic.id && styles.hospitalNameSelected]}>
                    {clinic.name}
                  </Text>
                  <Text style={styles.hospitalDoctor}>Dr. {clinic.doctorName}</Text>
                  {clinic.address && <Text style={styles.hospitalAddress}>{clinic.address}</Text>}
                </View>
                {selectedHospital?.id === clinic.id && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.nextButton, !selectedHospital && styles.nextButtonDisabled]}
          onPress={() => {
            if (selectedHospital) {
              setConnectionStep('select-doctor');
              loadDoctorsForHospital(selectedHospital.id);
            }
          }}
          disabled={!selectedHospital}
        >
          <Text style={styles.nextButtonText}>{t('connection.nextSelectDoctor')}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderDoctorSelection() {
    return (
      <View style={styles.stepContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setConnectionStep('select-hospital')}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
          <Text style={styles.backButtonText}>{t('connection.backToHospital')}</Text>
        </TouchableOpacity>

        <Text style={styles.stepTitle}>{t('connection.selectDoctor')}</Text>
        <Text style={styles.stepSubtitle}>{t('connection.doctorsAt', { hospital: selectedHospital?.name })}</Text>

        {loadingDoctors ? (
          <ActivityIndicator style={styles.loader} color={COLORS.primary} />
        ) : doctorsInHospital.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="person-outline" size={40} color={COLORS.textLight} />
            <Text style={styles.emptyText}>{t('connection.noDoctors')}</Text>
            <Text style={styles.emptySubtext}>{t('connection.tryDifferentHospital')}</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {doctorsInHospital.map((doctor) => (
              <TouchableOpacity
                key={doctor.id}
                style={[styles.doctorCard, selectedDoctor?.id === doctor.id && styles.doctorCardSelected]}
                onPress={() => setSelectedDoctor(doctor)}
                activeOpacity={0.7}
              >
                <View style={styles.doctorAvatar}>
                  <Text style={styles.doctorAvatarText}>{doctor.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.doctorInfo}>
                  <Text style={[styles.doctorName, selectedDoctor?.id === doctor.id && styles.doctorNameSelected]}>
                    Dr. {doctor.name}
                  </Text>
                  {doctor.specialty && <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>}
                  {doctor.regNumber && <Text style={styles.doctorReg}>Reg: {doctor.regNumber}</Text>}
                </View>
                {selectedDoctor?.id === doctor.id && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.nextButton, !selectedDoctor && styles.nextButtonDisabled]}
          onPress={() => selectedDoctor && setConnectionStep('verify-code')}
          disabled={!selectedDoctor}
        >
          <Text style={styles.nextButtonText}>{t('connection.nextVerifyCode')}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    );
  }

  function renderCodeVerification() {
    return (
      <View style={styles.stepContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setConnectionStep('select-doctor')}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
          <Text style={styles.backButtonText}>{t('connection.backToDoctorSelection')}</Text>
        </TouchableOpacity>

        <Text style={styles.stepTitle}>{t('connection.verifyCode')}</Text>
        <Text style={styles.stepSubtitle}>{t('connection.enterCodeForDoctor', { name: selectedDoctor?.name })}</Text>

        <View style={styles.codeInputContainer}>
          <TextInput
            style={styles.codeInputLarge}
            value={doctorCode}
            onChangeText={(text) => setDoctorCode(text.toUpperCase())}
            placeholder={t('connection.enterCodePlaceholder')}
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="characters"
            maxLength={6}
            autoFocus
          />
        </View>

        <View style={styles.selectedInfoCard}>
          <View style={styles.selectedInfoRow}>
            <Ionicons name="business" size={16} color={COLORS.textMuted} />
            <Text style={styles.selectedInfoLabel}>{t('connection.hospitalLabel')}</Text>
            <Text style={styles.selectedInfoValue}>{selectedHospital?.name}</Text>
          </View>
          <View style={styles.selectedInfoRow}>
            <Ionicons name="person" size={16} color={COLORS.textMuted} />
            <Text style={styles.selectedInfoLabel}>{t('connection.doctorLabel')}</Text>
            <Text style={styles.selectedInfoValue}>Dr. {selectedDoctor?.name}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, doctorCode.length !== 6 && styles.submitButtonDisabled]}
          onPress={handleVerifyAndConnect}
          disabled={requesting || doctorCode.length !== 6}
        >
          {requesting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.submitButtonText}>{t('connection.sendRequest')}</Text>
              <Ionicons name="send" size={18} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  function renderRequestCard(request: ConnectionRequest) {
    const isIncoming = isDoctor
      ? request.initiatedBy === 'assistant'
      : request.initiatedBy === 'doctor';
    const otherName = isDoctor ? request.assistantName : request.doctorName;

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestInfo}>
          <View style={styles.requestHeader}>
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>
                {isIncoming ? t('connection.incoming') : t('connection.sent')}
              </Text>
            </View>
            <Text style={styles.requestName}>{otherName || 'Unknown'}</Text>
          </View>

          {/* Show full assistant details for doctors */}
          {isDoctor && isIncoming && request.assistantPhone && (
            <View style={styles.assistantDetails}>
              <View style={styles.assistantDetailRow}>
                <Ionicons name="call-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.assistantDetailText}>{request.assistantPhone}</Text>
              </View>

              {request.qualification && (
                <View style={styles.assistantDetailRow}>
                  <Ionicons name="school-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.assistantDetailText}>{request.qualification}</Text>
                </View>
              )}

              {request.experienceYears != null && request.experienceYears > 0 && (
                <View style={styles.assistantDetailRow}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.assistantDetailText}>{request.experienceYears} years experience</Text>
                </View>
              )}

              {request.city && (
                <View style={styles.assistantDetailRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.assistantDetailText}>{request.city}</Text>
                </View>
              )}

              {request.assistantAddress && (
                <View style={styles.assistantDetailRow}>
                  <Ionicons name="home-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.assistantDetailText} numberOfLines={2}>{request.assistantAddress}</Text>
                </View>
              )}
            </View>
          )}

          {request.clinicName && !isDoctor && (
            <Text style={styles.requestClinic}>{request.clinicName}</Text>
          )}
        </View>

        {isIncoming && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(request.id)}
            >
              <Ionicons name="checkmark" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleReject(request.id)}
            >
              <Ionicons name="close" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
        {!isIncoming && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{t('connection.waiting')}</Text>
          </View>
        )}
      </View>
    );
  }

  function renderTeamMemberCard(member: TeamMember) {
    const isExpanded = expandedMemberId === member.id;
    const hasDetails = member.qualification || member.experienceYears || member.city || member.profileAddress || member.specialty || member.regNumber;

    return (
      <View key={member.id}>
        <TouchableOpacity
          style={[styles.memberCard, isExpanded && styles.memberCardExpanded]}
          onPress={() => setExpandedMemberId(isExpanded ? null : member.id)}
          activeOpacity={0.7}
        >
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {member.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberRole}>
              {member.role === 'doctor' ? t('settings.doctor') : t('settings.assistant')} · {member.phone}
            </Text>
          </View>
          {hasDetails && (
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textLight}
            />
          )}
          {isDoctor && member.role === 'assistant' && (
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={() => handleDisconnect(member.id, member.name)}
            >
              <Ionicons name="remove-circle-outline" size={22} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {isExpanded && hasDetails && (
          <View style={styles.memberDetails}>
            {member.role === 'assistant' && (
              <>
                {member.qualification ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="school-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Qualification:</Text>
                    <Text style={styles.detailValue}>{member.qualification}</Text>
                  </View>
                ) : null}
                {member.experienceYears ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Experience:</Text>
                    <Text style={styles.detailValue}>{member.experienceYears} years</Text>
                  </View>
                ) : null}
                {member.city ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>City:</Text>
                    <Text style={styles.detailValue}>{member.city}</Text>
                  </View>
                ) : null}
                {member.profileAddress ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="home-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Address:</Text>
                    <Text style={styles.detailValue}>{member.profileAddress}</Text>
                  </View>
                ) : null}
              </>
            )}
            {member.role === 'doctor' && (
              <>
                {member.specialty ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="medkit-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Specialty:</Text>
                    <Text style={styles.detailValue}>{member.specialty}</Text>
                  </View>
                ) : null}
                {member.regNumber ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="document-text-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.detailLabel}>Reg No:</Text>
                    <Text style={styles.detailValue}>{member.regNumber}</Text>
                  </View>
                ) : null}
              </>
            )}
            {member.lastActiveAt && (
              <View style={styles.detailRow}>
                <Ionicons name="pulse-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.detailLabel}>Last active:</Text>
                <Text style={styles.detailValue}>
                  {new Date(member.lastActiveAt).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
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
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: { width: 32 },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  // Doctor Code Card
  codeCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.lg,
  },
  codeLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 8,
    marginVertical: SPACING.md,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: SPACING.lg,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Status Card (Assistant)
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.md,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  statusSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },

  // Input Row
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  inputFlex: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  codeInput: {
    letterSpacing: 4,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 18,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Request Card
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  requestInfo: {
    flex: 1,
  },
  requestHeader: {
    marginBottom: SPACING.xs,
  },
  requestBadge: {
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  requestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  requestClinic: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  assistantDetails: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary || 'rgba(0,0,0,0.03)',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  assistantDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  assistantDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.full,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBadge: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.warning,
  },

  // Team Member Card
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberRole: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  memberCardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  disconnectButton: {
    padding: SPACING.sm,
  },

  // Member Details (expanded)
  memberDetails: {
    backgroundColor: COLORS.surfaceSecondary,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.borderLight,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },

  // Empty State
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Multi-step flow
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressCircleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  progressNumberActive: {
    color: COLORS.white,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressLabelActive: {
    color: COLORS.primary,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
    marginBottom: 20,
  },
  stepContainer: {
    marginBottom: SPACING.xl,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stepSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  loader: {
    marginVertical: SPACING.xl,
  },
  listContainer: {
    marginBottom: SPACING.lg,
  },
  hospitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  hospitalCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(76, 147, 255, 0.05)',
  },
  hospitalInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  hospitalNameSelected: {
    color: COLORS.primary,
  },
  hospitalDoctor: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  hospitalAddress: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  doctorCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(76, 147, 255, 0.05)',
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  doctorInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  doctorNameSelected: {
    color: COLORS.primary,
  },
  doctorSpecialty: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  doctorReg: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  codeInputContainer: {
    marginVertical: SPACING.lg,
  },
  codeInputLarge: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  selectedInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  selectedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  selectedInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginLeft: SPACING.xs,
  },
  selectedInfoValue: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  statusDetail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});
