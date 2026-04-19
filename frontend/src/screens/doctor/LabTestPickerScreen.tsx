import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { usePrescriptionStore } from '../../store/usePrescriptionStore';
import {
  searchAllLabTests,
  getAllFrequentLabTests,
  getLabTestsByCategory,
  addCustomLabTest,
  incrementLabTestUsage,
} from '../../services/dataService';
import { LabTest, LAB_TEST_CATEGORIES } from '../../types/medicine.types';
import { DoctorStackParamList } from '../../types/navigation.types';

interface SelectedLabTest {
  test: LabTest;
  notes: string;
}

type LabTestPickerScreenProps = NativeStackScreenProps<DoctorStackParamList, 'LabTestPicker'>;

export default function LabTestPickerScreen({ navigation }: LabTestPickerScreenProps): React.JSX.Element {
  const addLabTest = usePrescriptionStore((s) => s.addLabTest);

  const [query, setQuery] = useState('');
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTests, setSelectedTests] = useState<Map<string, SelectedLabTest>>(new Map());

  // Custom test
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<string>(LAB_TEST_CATEGORIES[0]);
  const [customNotes, setCustomNotes] = useState('');

  // Notes editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

  const searchInputRef = useRef<TextInput>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadFrequentTests();
  }, []);

  const loadFrequentTests = async () => {
    try {
      const tests = await getAllFrequentLabTests();
      setLabTests(tests);
    } catch {
      // Silently handle
    }
  };

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setSelectedCategory(null);
    setShowCustomForm(false);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length === 0) {
      loadFrequentTests();
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAllLabTests(text.trim());
        setLabTests(results);
      } catch {
        // Silently handle
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectCategory = async (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
      loadFrequentTests();
      return;
    }

    setSelectedCategory(category);
    setQuery('');
    setShowCustomForm(false);
    setIsSearching(true);

    try {
      const results = await getLabTestsByCategory(category);
      setLabTests(results);
    } catch {
      // Silently handle
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleTest = (test: LabTest) => {
    setSelectedTests((prev) => {
      const next = new Map(prev);
      if (next.has(test.id)) {
        next.delete(test.id);
        if (editingNotesId === test.id) {
          setEditingNotesId(null);
        }
      } else {
        next.set(test.id, { test, notes: '' });
      }
      return next;
    });
  };

  const handleUpdateNotes = (testId: string, notes: string) => {
    setSelectedTests((prev) => {
      const next = new Map(prev);
      const entry = next.get(testId);
      if (entry) {
        next.set(testId, { ...entry, notes });
      }
      return next;
    });
  };

  const handleAddTests = async () => {
    if (selectedTests.size === 0) {
      Alert.alert('No Tests Selected', 'Please select at least one lab test.');
      return;
    }

    for (const [, { test, notes }] of selectedTests) {
      addLabTest({
        testName: test.name,
        category: test.category,
        notes,
      });

      try {
        await incrementLabTestUsage(test.name, test.isCustom ?? false);
      } catch {
        // Non-critical
      }
    }

    navigation.goBack();
  };

  const handleAddCustomTest = async () => {
    if (!customName.trim()) {
      Alert.alert('Required', 'Please enter test name.');
      return;
    }

    try {
      const custom = await addCustomLabTest(customName.trim(), customCategory);

      addLabTest({
        testName: custom.name,
        category: custom.category,
        notes: customNotes,
      });

      navigation.goBack();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add custom test';
      Alert.alert('Error', msg);
    }
  };

  const renderLabTestItem = ({ item }: { item: LabTest }) => {
    const isSelected = selectedTests.has(item.id);
    const isEditingNotes = editingNotesId === item.id;

    return (
      <View>
        <TouchableOpacity
          style={[styles.testItem, isSelected && styles.testItemSelected]}
          onPress={() => handleToggleTest(item)}
          activeOpacity={0.7}
        >
          <View style={styles.testCheckbox}>
            {isSelected ? (
              <Ionicons name="checkbox" size={22} color={COLORS.primary} />
            ) : (
              <Ionicons name="square-outline" size={22} color={COLORS.textLight} />
            )}
          </View>
          <View style={styles.testInfo}>
            <Text style={[styles.testName, isSelected && styles.testNameSelected]}>
              {item.name}
            </Text>
            <Text style={styles.testCategory}>{item.category}</Text>
          </View>
          {isSelected && (
            <TouchableOpacity
              style={styles.notesToggle}
              onPress={() =>
                setEditingNotesId(isEditingNotes ? null : item.id)
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isEditingNotes ? 'chevron-up' : 'create-outline'}
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {isSelected && isEditingNotes && (
          <View style={styles.notesInputContainer}>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes for this test..."
              placeholderTextColor={COLORS.textLight}
              value={selectedTests.get(item.id)?.notes || ''}
              onChangeText={(text) => handleUpdateNotes(item.id, text)}
              multiline
            />
          </View>
        )}
      </View>
    );
  };

  const selectedCount = selectedTests.size;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search lab tests..."
          placeholderTextColor={COLORS.textLight}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
        {isSearching && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChips}
      >
        {LAB_TEST_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipSelected,
            ]}
            onPress={() => handleSelectCategory(category)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextSelected,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Custom form view */}
      {showCustomForm ? (
        <ScrollView
          style={styles.customFormScroll}
          contentContainerStyle={styles.customFormContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.customFormTitle}>Add Custom Lab Test</Text>

          <Text style={styles.fieldLabel}>Test Name *</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="Enter test name"
            placeholderTextColor={COLORS.textLight}
            value={customName}
            onChangeText={setCustomName}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Category *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {LAB_TEST_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, customCategory === cat && styles.chipSelected]}
                onPress={() => setCustomCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, customCategory === cat && styles.chipTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="Any specific instructions..."
            placeholderTextColor={COLORS.textLight}
            value={customNotes}
            onChangeText={setCustomNotes}
            multiline
          />

          <TouchableOpacity
            style={styles.addTestsButton}
            onPress={handleAddCustomTest}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color={COLORS.white} />
            <Text style={styles.addTestsButtonText}>Add Custom Test</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelCustomButton}
            onPress={() => setShowCustomForm(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelCustomText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          {/* Lab Test List */}
          <FlatList
            data={labTests}
            keyExtractor={(item) => item.id}
            renderItem={renderLabTestItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                {query.length > 0
                  ? 'Search Results'
                  : selectedCategory
                    ? `${selectedCategory} Tests`
                    : 'Frequently Ordered'}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="flask-outline" size={40} color={COLORS.textLight} />
                <Text style={styles.emptyText}>
                  {query.length > 0 ? 'No tests found' : 'No frequent tests'}
                </Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity
                style={styles.customButton}
                onPress={() => {
                  setShowCustomForm(true);
                  setCustomName(query);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.customButtonText}>
                  Add Custom Test{query ? `: "${query}"` : ''}
                </Text>
              </TouchableOpacity>
            }
          />

          {/* Bottom bar with Add button */}
          {selectedCount > 0 && (
            <View style={styles.bottomBar}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedCount}>
                  {selectedCount} test{selectedCount !== 1 ? 's' : ''} selected
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addTestsButton}
                onPress={handleAddTests}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={20} color={COLORS.white} />
                <Text style={styles.addTestsButtonText}>Add Tests</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },

  // Category Chips
  categoryChips: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  categoryChip: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  categoryChipTextSelected: {
    color: COLORS.white,
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  // Test Item
  testItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  testItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySurface,
  },
  testCheckbox: {
    marginRight: SPACING.md,
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  testNameSelected: {
    color: COLORS.primaryDark,
  },
  testCategory: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  notesToggle: {
    padding: SPACING.xs,
  },

  // Notes Input
  notesInputContainer: {
    backgroundColor: COLORS.white,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.xs,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    padding: SPACING.md,
  },
  notesInput: {
    fontSize: 13,
    color: COLORS.text,
    minHeight: 36,
    padding: 0,
  },

  // Custom Form
  customFormScroll: {
    flex: 1,
  },
  customFormContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  customFormTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  textInputField: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
  },
  chipsRow: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  chip: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  cancelCustomButton: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
  },
  cancelCustomText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // Custom Button (in list footer)
  customButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  customButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Bottom Bar
  bottomBar: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.lg,
  },
  selectedInfo: {
    marginBottom: SPACING.sm,
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  addTestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  addTestsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
