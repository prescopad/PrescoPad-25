import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
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
import { getRecentPatients } from '../../services/dataService';
import type { AssistantStackParamList } from '../../types/navigation.types';

type NavigationProp = NativeStackNavigationProp<AssistantStackParamList>;

export default function PatientSearchScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { searchPatients, searchResults, clearSearch, isLoading } =
    usePatientStore();
  const addToQueue = useQueueStore((s) => s.addToQueue);
  const user = useAuthStore((s) => s.user);

  const [query, setQuery] = useState('');
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadRecentPatients();
    // Auto-focus the search input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => {
      clearTimeout(timer);
      clearSearch();
    };
  }, [clearSearch]);

  const loadRecentPatients = async () => {
    setLoadingRecent(true);
    try {
      const recent = await getRecentPatients(20);
      setRecentPatients(recent);
    } catch {
      // Silently handle error
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        if (text.trim().length > 0) {
          searchPatients(text.trim());
        } else {
          clearSearch();
        }
      }, 300);
    },
    [searchPatients, clearSearch],
  );

  const handlePatientPress = (patient: Patient) => {
    navigation.navigate('PatientDetail', { patientId: patient.id });
  };

  const handleLongPress = (patient: Patient) => {
    Alert.alert(
      'Add to Queue',
      `Add ${patient.name} to today's queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Queue',
          onPress: async () => {
            if (!user) return;
            try {
              await addToQueue(patient.id, user.id);
              Alert.alert('Success', `${patient.name} added to queue.`);
            } catch (error: unknown) {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Failed to add to queue';
              Alert.alert('Error', message);
            }
          },
        },
      ],
    );
  };

  const formatLastVisit = (dateStr: string): string => {
    if (!dateStr) return 'No visits';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const displayData = query.trim().length > 0 ? searchResults : recentPatients;
  const isSearching = query.trim().length > 0;

  const renderPatient = ({ item }: { item: Patient }) => (
    <TouchableOpacity
      style={styles.patientCard}
      activeOpacity={0.7}
      onPress={() => handlePatientPress(item)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.patientMeta}>
          {item.age}y / {item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}{' '}
          {item.phone ? `| ${item.phone}` : ''}
        </Text>
        <Text style={styles.lastVisit}>
          Last updated: {formatLastVisit(item.updatedAt)}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.textLight}
      />
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isLoading || loadingRecent) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (isSearching && searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="search-outline"
            size={56}
            color={COLORS.textLight}
          />
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different name or phone number
          </Text>
        </View>
      );
    }

    if (!isSearching && recentPatients.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="people-outline"
            size={56}
            color={COLORS.textLight}
          />
          <Text style={styles.emptyTitle}>No Patients Yet</Text>
          <Text style={styles.emptySubtitle}>
            Register your first patient to get started
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Search Bar */}
      <View style={styles.searchHeader}>
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={COLORS.textMuted}
            />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search by name or phone..."
              placeholderTextColor={COLORS.textLight}
              value={query}
              onChangeText={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  clearSearch();
                  inputRef.current?.focus();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Section Label */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isSearching
            ? `Search Results (${searchResults.length})`
            : 'Recent Patients'}
        </Text>
        {isSearching && (
          <Text style={styles.longPressHint}>Long press to add to queue</Text>
        )}
      </View>

      {/* Patient List */}
      <FlatList
        data={displayData}
        keyExtractor={(item) => item.id}
        renderItem={renderPatient}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchHeader: {
    backgroundColor: COLORS.white,
    paddingTop: 52,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 11,
    marginLeft: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  longPressHint: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 32,
    flexGrow: 1,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  patientMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lastVisit: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
});
