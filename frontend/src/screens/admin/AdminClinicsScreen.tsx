import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, StatusBar, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import {
  fetchAdminClinics, AdminClinic, createAdminClinic, updateAdminClinic, deleteAdminClinic,
} from '../../services/adminService';

type ClinicFormData = { name: string; address: string; phone: string; city: string };

const emptyForm: ClinicFormData = { name: '', address: '', phone: '', city: '' };

export default function AdminClinicsScreen(): React.JSX.Element {
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClinic, setEditingClinic] = useState<AdminClinic | null>(null);
  const [form, setForm] = useState<ClinicFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      const r = await fetchAdminClinics({ search: search.trim() || undefined, limit: 200 });
      setClinics(r.clinics);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('admin.failedLoadClinics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, t]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingClinic(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (clinic: AdminClinic) => {
    setEditingClinic(clinic);
    setForm({
      name: clinic.name,
      address: clinic.address ?? '',
      phone: clinic.phone ?? '',
      city: clinic.city ?? '',
    });
    setModalVisible(true);
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Clinic name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingClinic) {
        const updated = await updateAdminClinic(editingClinic.id, {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          city: form.city.trim() || undefined,
        });
        setClinics((prev) => prev.map((c) => (c.id === editingClinic.id ? { ...c, ...updated } : c)));
        Alert.alert('Success', 'Clinic updated successfully');
      } else {
        const created = await createAdminClinic({
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          city: form.city.trim() || undefined,
        });
        setClinics((prev) => [{ ...created, doctorCount: 0, assistantCount: 0, prescriptionCount: 0 }, ...prev]);
        Alert.alert('Success', 'Clinic created successfully');
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save clinic');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (clinic: AdminClinic) => {
    Alert.alert(
      'Delete Clinic',
      `Are you sure you want to delete "${clinic.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminClinic(clinic.id);
              setClinics((prev) => prev.filter((c) => c.id !== clinic.id));
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete clinic');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('admin.clinics')}</Text>
          <Text style={styles.headerSub}>{clinics.length} clinics</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.searchClinics')}
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={clinics}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const solo = item.soloMode ?? item.solo_mode;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.clinicIcon}>
                    <Ionicons name="business" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
                    {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
                  </View>
                  {solo ? (
                    <View style={styles.soloBadge}><Text style={styles.soloBadgeText}>Solo</Text></View>
                  ) : null}
                </View>

                <View style={styles.metrics}>
                  <Metric label="Doctors" value={item.doctorCount} icon="person" />
                  <Metric label="Assistants" value={item.assistantCount} icon="people" />
                  <Metric label="Rx" value={item.prescriptionCount} icon="document-text" />
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={() => openEdit(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={14} color={COLORS.white} />
                    <Text style={[styles.actionBtnText, { color: COLORS.white }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => onDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                    <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.empty}>{t('admin.noClinics')}</Text>
              <TouchableOpacity style={styles.createFirstBtn} onPress={openCreate}>
                <Text style={styles.createFirstBtnText}>Create First Clinic</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingClinic ? 'Edit Clinic' : 'Add Clinic'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <FormField
                label="Clinic Name *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. City Clinic"
              />
              <FormField
                label="Address"
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="Street address"
              />
              <FormField
                label="Phone"
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="+91 XXXXXXXXXX"
                keyboardType="phone-pad"
              />
              <FormField
                label="City"
                value={form.city}
                onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                placeholder="e.g. Mumbai"
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={onSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingClinic ? 'Update Clinic' : 'Create Clinic'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: any }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={14} color={COLORS.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function FormField({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  controls: { padding: SPACING.lg, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 8, gap: SPACING.xs },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  list: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.sm },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  clinicIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  address: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  city: { fontSize: 12, color: COLORS.textMuted },
  soloBadge: { backgroundColor: COLORS.warningLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  soloBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.warning },
  metrics: { flexDirection: 'row', marginTop: SPACING.sm, gap: SPACING.xl },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  metricLabel: { fontSize: 11, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  actionBtnDanger: { backgroundColor: COLORS.errorLight, borderColor: COLORS.error },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textMuted, fontSize: 14 },
  createFirstBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, marginTop: SPACING.sm,
  },
  createFirstBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  formField: { marginBottom: SPACING.md },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  formInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: 14, color: COLORS.text, backgroundColor: COLORS.white,
  },
  saveBtn: {
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
    borderRadius: RADIUS.full, alignItems: 'center', marginTop: SPACING.lg,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
