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
  searchAllMedicines,
  getAllFrequentMedicines,
  addCustomMedicine,
  incrementMedicineUsage,
} from '../../services/dataService';
import {
  Medicine,
  MedicineType,
  FREQUENCY_OPTIONS,
  TIMING_OPTIONS,
  DURATION_OPTIONS,
} from '../../types/medicine.types';
import { DoctorStackParamList } from '../../types/navigation.types';

type MedicinePickerScreenProps = NativeStackScreenProps<DoctorStackParamList, 'MedicinePicker'>;

export default function MedicinePickerScreen({ navigation }: MedicinePickerScreenProps): React.JSX.Element {
  const addMedicine = usePrescriptionStore((s) => s.addMedicine);

  const [query, setQuery] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  // Dosage form fields
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [timing, setTiming] = useState('');
  const [notes, setNotes] = useState('');

  // Custom medicine
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<string>(MedicineType.TABLET);
  const [customStrength, setCustomStrength] = useState('');

  const searchInputRef = useRef<TextInput>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadFrequentMedicines();
    // Auto-focus search bar
    setTimeout(() => searchInputRef.current?.focus(), 300);
  }, []);

  const loadFrequentMedicines = async () => {
    try {
      const frequentMeds = await getAllFrequentMedicines();
      setMedicines(frequentMeds);
    } catch {
      // Silently handle
    }
  };

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setSelectedMedicine(null);
    setShowCustomForm(false);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length === 0) {
      loadFrequentMedicines();
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAllMedicines(text.trim());
        setMedicines(results);
      } catch {
        // Silently handle
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectMedicine = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setFrequency('');
    setDuration('');
    setTiming('');
    setNotes('');
    setShowCustomForm(false);
  };

  const handleAddMedicine = async () => {
    if (!selectedMedicine) return;

    if (!frequency) {
      Alert.alert('Required', 'Please select a frequency.');
      return;
    }
    if (!duration) {
      Alert.alert('Required', 'Please select a duration.');
      return;
    }
    if (!timing) {
      Alert.alert('Required', 'Please select timing.');
      return;
    }

    addMedicine({
      medicineName: selectedMedicine.name,
      type: selectedMedicine.type,
      dosage: selectedMedicine.strength,
      frequency,
      duration,
      timing,
      notes,
    });

    // Increment usage count for ranking
    try {
      await incrementMedicineUsage(selectedMedicine.name, selectedMedicine.isCustom ?? false);
    } catch {
      // Non-critical
    }

    navigation.goBack();
  };

  const handleShowCustomForm = () => {
    setSelectedMedicine(null);
    setShowCustomForm(true);
    setCustomName(query);
    setCustomType(MedicineType.TABLET);
    setCustomStrength('');
  };

  const handleAddCustomMedicine = async () => {
    if (!customName.trim()) {
      Alert.alert('Required', 'Please enter medicine name.');
      return;
    }
    if (!frequency) {
      Alert.alert('Required', 'Please select a frequency.');
      return;
    }
    if (!duration) {
      Alert.alert('Required', 'Please select a duration.');
      return;
    }
    if (!timing) {
      Alert.alert('Required', 'Please select timing.');
      return;
    }

    try {
      const custom = await addCustomMedicine(customName.trim(), customType, customStrength);

      addMedicine({
        medicineName: custom.name,
        type: custom.type,
        dosage: customStrength,
        frequency,
        duration,
        timing,
        notes,
      });

      navigation.goBack();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add custom medicine';
      Alert.alert('Error', msg);
    }
  };

  const renderOptionChips = (
    options: readonly string[],
    selected: string,
    onSelect: (val: string) => void,
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsContainer}
    >
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, selected === option && styles.chipSelected]}
          onPress={() => onSelect(option)}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.chipText, selected === option && styles.chipTextSelected]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMedicineItem = ({ item }: { item: Medicine }) => {
    const isSelected = selectedMedicine?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.medicineItem, isSelected && styles.medicineItemSelected]}
        onPress={() => handleSelectMedicine(item)}
        activeOpacity={0.7}
      >
        <View style={styles.medicineInfo}>
          <Text style={[styles.medicineName, isSelected && styles.medicineNameSelected]}>
            {item.name}
          </Text>
          <Text style={styles.medicineDetails}>
            {item.type}{item.strength ? ` - ${item.strength}` : ''}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderDosageForm = () => (
    <View style={styles.dosageForm}>
      <View style={styles.dosageDivider} />

      <Text style={styles.dosageTitle}>
        {selectedMedicine ? selectedMedicine.name : customName} - Dosage Details
      </Text>

      {/* Custom fields if custom form */}
      {showCustomForm && (
        <>
          <Text style={styles.fieldLabel}>Medicine Name *</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="Medicine name"
            placeholderTextColor={COLORS.textLight}
            value={customName}
            onChangeText={setCustomName}
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {Object.values(MedicineType).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, customType === type && styles.chipSelected]}
                onPress={() => setCustomType(type)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, customType === type && styles.chipTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Strength</Text>
          <TextInput
            style={styles.textInputField}
            placeholder="e.g., 500mg, 10ml"
            placeholderTextColor={COLORS.textLight}
            value={customStrength}
            onChangeText={setCustomStrength}
          />
        </>
      )}

      <Text style={styles.fieldLabel}>Frequency *</Text>
      {renderOptionChips(FREQUENCY_OPTIONS, frequency, setFrequency)}

      <Text style={styles.fieldLabel}>Duration *</Text>
      {renderOptionChips(DURATION_OPTIONS, duration, setDuration)}

      <Text style={styles.fieldLabel}>Timing *</Text>
      {renderOptionChips(TIMING_OPTIONS, timing, setTiming)}

      <Text style={styles.fieldLabel}>Notes (optional)</Text>
      <TextInput
        style={styles.textInputField}
        placeholder="Any special instructions..."
        placeholderTextColor={COLORS.textLight}
        value={notes}
        onChangeText={setNotes}
      />

      <TouchableOpacity
        style={styles.addMedicineButton}
        onPress={showCustomForm ? handleAddCustomMedicine : handleAddMedicine}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={20} color={COLORS.white} />
        <Text style={styles.addMedicineButtonText}>Add Medicine</Text>
      </TouchableOpacity>
    </View>
  );

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
          placeholder="Search medicines..."
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

      {/* Selected medicine / Custom form -> dosage form */}
      {(selectedMedicine || showCustomForm) ? (
        <ScrollView
          style={styles.dosageScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderDosageForm()}
        </ScrollView>
      ) : (
        <>
          {/* Medicine List */}
          <FlatList
            data={medicines}
            keyExtractor={(item) => item.id}
            renderItem={renderMedicineItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                {query.length > 0 ? 'Search Results' : 'Frequently Used'}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="medical-outline" size={40} color={COLORS.textLight} />
                <Text style={styles.emptyText}>
                  {query.length > 0 ? 'No medicines found' : 'No frequent medicines'}
                </Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity
                style={styles.customButton}
                onPress={handleShowCustomForm}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.customButtonText}>
                  Add Custom Medicine{query ? `: "${query}"` : ''}
                </Text>
              </TouchableOpacity>
            }
          />
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

  // List
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  // Medicine Item
  medicineItem: {
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
  medicineItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySurface,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  medicineNameSelected: {
    color: COLORS.primaryDark,
  },
  medicineDetails: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Dosage Form
  dosageScroll: {
    flex: 1,
  },
  dosageForm: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  dosageDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  dosageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
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

  // Chips
  chipsContainer: {
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

  // Add Medicine Button
  addMedicineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  addMedicineButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Custom Button
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
