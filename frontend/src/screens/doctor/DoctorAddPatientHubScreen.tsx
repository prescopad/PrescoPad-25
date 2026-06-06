import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePatientStore } from '../../store/usePatientStore';
import { useQueueStore } from '../../store/useQueueStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Patient } from '../../types/patient.types';

type NavigationProp = NativeStackNavigationProp<Record<string, object | undefined>>;

export default function DoctorAddPatientHubScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { searchPatients, searchResults, clearSearch } = usePatientStore();
  const user = useAuthStore((s) => s.user);
  const { addToQueue } = useQueueStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (text.trim().length > 0) {
        searchPatients(text.trim());
      } else {
        clearSearch();
      }
    },
    [searchPatients, clearSearch],
  );

  const handleAddToQueue = useCallback(
    async (patientId: string, patientName: string) => {
      if (!user) return;
      setIsAdding(patientId);
      try {
        await addToQueue(patientId, user.id);
        setSearchQuery('');
        clearSearch();
        Alert.alert('Added to Queue', `${patientName} has been added to the queue.`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to add to queue';
        Alert.alert('Error', message);
      } finally {
        setIsAdding(null);
      }
    },
    [user, addToQueue, clearSearch],
  );

  const renderSearchResult = ({ item }: { item: Patient }) => {
    const adding = isAdding === item.id;
    return (
      <View style={styles.resultCard}>
        <View style={styles.resultIcon}>
          <Ionicons name="person" size={18} color={COLORS.primary} />
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.name}</Text>
          <Text style={styles.resultMeta}>
            {item.age} yrs · {item.gender} · {item.phone}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addQueueBtn, adding && styles.addQueueBtnDisabled]}
          onPress={() => handleAddToQueue(item.id, item.name)}
          disabled={adding}
          activeOpacity={0.75}
        >
          {adding ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="add" size={16} color={COLORS.white} />
              <Text style={styles.addQueueBtnText}>Queue</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <Text style={styles.headerSubtitle}>Register new or add existing patients to queue</Text>
      </View>

      {/* Register New Patient Card */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NEW PATIENT</Text>
        <TouchableOpacity
          style={styles.newPatientCard}
          onPress={() => navigation.navigate('AddPatientForm' as never)}
          activeOpacity={0.85}
        >
          <View style={styles.newPatientIconCircle}>
            <Ionicons name="person-add" size={28} color={COLORS.white} />
          </View>
          <View style={styles.newPatientInfo}>
            <Text style={styles.newPatientTitle}>Register New Patient</Text>
            <Text style={styles.newPatientSubtitle}>
              Fill in the patient details — name, age, phone, allergies and more
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Find Existing Patient */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EXISTING PATIENT</Text>
        <Text style={styles.searchHint}>Search by name or phone number to add them to today's queue</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient name or phone..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                clearSearch();
              }}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {searchQuery.length > 0 && (
          <View style={styles.resultsList}>
            {searchResults.length === 0 ? (
              <View style={styles.noResults}>
                <Ionicons name="person-outline" size={32} color={COLORS.textLight} />
                <Text style={styles.noResultsText}>No patients found for "{searchQuery}"</Text>
                <TouchableOpacity
                  style={styles.registerInsteadBtn}
                  onPress={() => navigation.navigate('AddPatientForm' as never)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.registerInsteadText}>Register as new patient</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {searchQuery.length === 0 && (
          <View style={styles.emptySearchHint}>
            <Ionicons name="people-outline" size={40} color={COLORS.textLight} />
            <Text style={styles.emptySearchText}>Type a name or phone number above to find existing patients</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.white,
    paddingTop: 56,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: SPACING.sm,
  },

  // New Patient Card
  newPatientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  newPatientIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  newPatientInfo: { flex: 1 },
  newPatientTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primaryDark },
  newPatientSubtitle: { fontSize: 12, color: COLORS.primary, marginTop: 3, lineHeight: 17 },

  // Divider
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },

  // Search
  searchHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.md },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: COLORS.text,
    paddingVertical: SPACING.md,
  },

  // Results
  resultsList: { marginTop: SPACING.md },
  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  resultIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  resultMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  addQueueBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  addQueueBtnDisabled: { opacity: 0.6 },
  addQueueBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  // No results
  noResults: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  noResultsText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  registerInsteadBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, gap: SPACING.xs,
    backgroundColor: COLORS.primarySurface,
    borderWidth: 1, borderColor: COLORS.primary + '30',
    marginTop: SPACING.xs,
  },
  registerInsteadText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Empty hint
  emptySearchHint: {
    alignItems: 'center', paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  emptySearchText: {
    fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
});
