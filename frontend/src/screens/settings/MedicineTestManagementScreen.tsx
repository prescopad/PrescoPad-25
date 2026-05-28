import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ParamListBase } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { Medicine, LabTest } from '../../types/medicine.types';
import api from '../../services/api';

interface MedicineTestManagementScreenProps {
  navigation: NativeStackNavigationProp<ParamListBase>;
}

export default function MedicineTestManagementScreen({ navigation }: MedicineTestManagementScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'medicines' | 'tests'>('medicines');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Tablet');
  const [formStrength, setFormStrength] = useState('');
  const [formCategory, setFormCategory] = useState('Blood');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'medicines') {
        await loadMedicines();
      } else {
        await loadTests();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMedicines = async () => {
    try {
      const res = await api.get('/data/custom-medicines/frequent', { params: { limit: 1000 } });
      const mapped = (res.data.medicines || []).map((row: any): Medicine => ({
        id: row.id,
        name: row.name,
        type: row.type || 'Tablet',
        strength: row.strength || '',
        manufacturer: row.manufacturer || '',
        isCustom: true,
        usageCount: row.usage_count || 0,
      }));
      setMedicines(mapped);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('manage.loadFailed', { type: t('manage.medicines') }));
    }
  };

  const loadTests = async () => {
    try {
      const res = await api.get('/data/custom-lab-tests/frequent', { params: { limit: 1000 } });
      const mapped = (res.data.labTests || []).map((row: any): LabTest => ({
        id: row.id,
        name: row.name,
        category: row.category || '',
        isCustom: true,
        usageCount: row.usage_count || 0,
      }));
      setTests(mapped);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('manage.loadFailed', { type: t('manage.labTests') }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddMedicine = async () => {
    if (!formName.trim()) {
      Alert.alert(t('common.error'), t('manage.nameRequired', { type: t('manage.medicineName') }));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/data/custom-medicines', {
        name: formName.trim(),
        type: formType,
        strength: formStrength.trim(),
      });
      Alert.alert(t('common.success'), t('manage.addedSuccess', { type: t('manage.medicineName') }));
      setShowAddModal(false);
      resetForm();
      await loadMedicines();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('manage.addFailed', { type: t('manage.medicineName') }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTest = async () => {
    if (!formName.trim()) {
      Alert.alert(t('common.error'), t('manage.nameRequired', { type: t('manage.testName') }));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/data/custom-lab-tests', {
        name: formName.trim(),
        category: formCategory,
      });
      Alert.alert(t('common.success'), t('manage.addedSuccess', { type: t('manage.testName') }));
      setShowAddModal(false);
      resetForm();
      await loadTests();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('manage.addFailed', { type: t('manage.testName') }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMedicine = (id: string, name: string) => {
    Alert.alert(
      t('manage.deleteMedicine'),
      t('manage.deleteConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/data/custom-medicines/${id}`);
              await loadMedicines();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('manage.deleteFailed', { type: t('manage.medicineName') }));
            }
          },
        },
      ]
    );
  };

  const handleDeleteTest = (id: string, name: string) => {
    Alert.alert(
      t('manage.deleteTest'),
      t('manage.deleteConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/data/custom-lab-tests/${id}`);
              await loadTests();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('manage.deleteFailed', { type: t('manage.testName') }));
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormName('');
    setFormType('Tablet');
    setFormStrength('');
    setFormCategory('Blood');
  };

  const getFilteredMedicines = () => {
    if (!searchQuery.trim()) return medicines;
    const query = searchQuery.toLowerCase();
    return medicines.filter(m => m.name.toLowerCase().includes(query));
  };

  const getFilteredTests = () => {
    if (!searchQuery.trim()) return tests;
    const query = searchQuery.toLowerCase();
    return tests.filter(t => t.name.toLowerCase().includes(query));
  };

  const renderMedicineItem = ({ item }: { item: Medicine }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemContent}>
        <View style={styles.itemIconCircle}>
          <Ionicons name="medical" size={20} color={COLORS.primary} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDetails}>
            {item.type}{item.strength ? ` • ${item.strength}` : ''} • {t('manage.usedTimes', { count: item.usageCount })}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteMedicine(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  const renderTestItem = ({ item }: { item: LabTest }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemContent}>
        <View style={styles.itemIconCircle}>
          <Ionicons name="flask" size={20} color={COLORS.primary} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDetails}>
            {item.category} • {t('manage.usedTimes', { count: item.usageCount })}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteTest(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={activeTab === 'medicines' ? 'medical-outline' : 'flask-outline'}
        size={64}
        color={COLORS.textLight}
      />
      <Text style={styles.emptyStateText}>
        {activeTab === 'medicines' ? t('manage.noCustomMedicines') : t('manage.noCustomTests')}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {t('manage.tapToAdd')}
      </Text>
    </View>
  );

  const renderAddModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeTab === 'medicines' ? t('manage.addMedicine') : t('manage.addLabTest')}
            </Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>
              {activeTab === 'medicines' ? t('manage.medicineName') : t('manage.testName')} *
            </Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder={t('manage.enterName')}
              placeholderTextColor={COLORS.textLight}
            />

            {activeTab === 'medicines' ? (
              <>
                <Text style={styles.fieldLabel}>{t('manage.typeLabel')}</Text>
                <View style={styles.typeSelector}>
                  {['Tablet', 'Syrup', 'Injection', 'Capsule', 'Ointment'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        formType === type && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormType(type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formType === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('manage.strengthLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={formStrength}
                  onChangeText={setFormStrength}
                  placeholder={t('manage.strengthPlaceholder')}
                  placeholderTextColor={COLORS.textLight}
                />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>{t('manage.categoryLabel')}</Text>
                <View style={styles.typeSelector}>
                  {['Blood', 'Urine', 'Imaging', 'Other'].map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.typeButton,
                        formCategory === category && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormCategory(category)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          formCategory === category && styles.typeButtonTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={activeTab === 'medicines' ? handleAddMedicine : handleAddTest}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>{t('common.add')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const currentData = activeTab === 'medicines' ? getFilteredMedicines() : getFilteredTests();
  const currentCount = activeTab === 'medicines' ? medicines.length : tests.length;

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('manage.title')}</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'medicines' && styles.tabActive]}
          onPress={() => {
            setActiveTab('medicines');
            setSearchQuery('');
          }}
        >
          <Ionicons
            name="medical"
            size={18}
            color={activeTab === 'medicines' ? COLORS.primary : COLORS.textLight}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'medicines' && styles.tabTextActive,
            ]}
          >
            {t('manage.medicinesCount', { count: medicines.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tests' && styles.tabActive]}
          onPress={() => {
            setActiveTab('tests');
            setSearchQuery('');
          }}
        >
          <Ionicons
            name="flask"
            size={18}
            color={activeTab === 'tests' ? COLORS.primary : COLORS.textLight}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'tests' && styles.tabTextActive,
            ]}
          >
            {t('manage.labTestsCount', { count: tests.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={activeTab === 'medicines' ? t('manage.searchMedicines') : t('manage.searchLabTests')}
          placeholderTextColor={COLORS.textLight}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : activeTab === 'medicines' ? (
        <FlatList<Medicine>
          data={getFilteredMedicines()}
          keyExtractor={item => item.id}
          renderItem={renderMedicineItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      ) : (
        <FlatList<LabTest>
          data={getFilteredTests()}
          keyExtractor={item => item.id}
          renderItem={renderTestItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      )}

      {renderAddModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  backBtn: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
  addBtn: {
    padding: SPACING.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: COLORS.primarySurface,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  deleteButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  typeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  typeButtonTextActive: {
    color: COLORS.white,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  submitButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});
