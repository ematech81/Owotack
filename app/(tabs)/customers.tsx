import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/authStore";
import { useTheme } from "../../src/hooks/useTheme";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { customerDb } from "../../src/database/customerDb";
import { Customer } from "../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#2D6A4F", "#D97706", "#3B82F6", "#8B5CF6", "#EF4444", "#059669", "#0891B2"];

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type FilterKey = "all" | "active" | "disabled";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "disabled", label: "Disabled" },
];

const emptyForm = { name: "", phone: "", address: "", notes: "" };

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CustomersScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // ── Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const all = await customerDb.getAll(user._id);
      setCustomers(all);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Derived list
  const filtered = customers.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search);
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "active" && c.isActive) ||
      (activeFilter === "disabled" && !c.isActive);
    return matchSearch && matchFilter;
  });

  const counts = {
    all: customers.length,
    active: customers.filter((c) => c.isActive).length,
    disabled: customers.filter((c) => !c.isActive).length,
  };

  // ── Modal helpers
  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (customer: Customer) => {
    setEditTarget(customer);
    setForm({
      name: customer.name,
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!user?._id) return;
    if (!form.name.trim()) {
      Alert.alert("", "Customer name is required.");
      return;
    }
    setIsSaving(true);
    try {
      if (editTarget) {
        await customerDb.update(editTarget.id, {
          name: form.name,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await customerDb.insert(user._id, {
          name: form.name,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      }
      setModalVisible(false);
      await load();
    } catch {
      Alert.alert("Error", "Could not save customer. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (customer: Customer) => {
    const action = customer.isActive ? "disable" : "enable";
    const msg = customer.isActive
      ? `Disabling "${customer.name}" will hide them from Sales and Credit dropdowns.`
      : `Enabling "${customer.name}" will make them available in Sales and Credit dropdowns.`;

    Alert.alert(
      customer.isActive ? "Disable Customer" : "Enable Customer",
      msg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: customer.isActive ? "Disable" : "Enable",
          style: customer.isActive ? "destructive" : "default",
          onPress: async () => {
            await customerDb.setActive(customer.id, !customer.isActive);
            await load();
          },
        },
      ]
    );
  };

  const handleDelete = (customer: Customer) => {
    Alert.alert(
      "Delete Customer",
      `Are you sure you want to permanently delete "${customer.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await customerDb.softDelete(customer.id);
            await load();
          },
        },
      ]
    );
  };

  const handleMenuPress = (customer: Customer) => {
    const toggleLabel = customer.isActive ? "Disable" : "Enable";
    Alert.alert(customer.name, undefined, [
      { text: "Edit", onPress: () => openEdit(customer) },
      { text: toggleLabel, onPress: () => handleToggleActive(customer) },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(customer) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const s = makeStyles(colors);

  const renderItem = ({ item }: { item: Customer }) => {
    const color = avatarColor(item.name);
    return (
      <View style={s.card}>
        {/* Left accent */}
        <View style={[s.cardAccent, { backgroundColor: item.isActive ? color : colors.border }]} />

        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: item.isActive ? color + "20" : colors.border + "40" }]}>
          <Text style={[s.avatarText, { color: item.isActive ? color : colors.textMuted }]}>
            {initials(item.name)}
          </Text>
        </View>

        {/* Info */}
        <View style={s.cardInfo}>
          <View style={s.cardNameRow}>
            <Text style={[s.cardName, !item.isActive && { color: colors.textMuted }]} numberOfLines={1}>
              {item.name}
            </Text>
            {!item.isActive && (
              <View style={s.disabledBadge}>
                <Text style={s.disabledBadgeText}>Disabled</Text>
              </View>
            )}
          </View>
          {item.phone ? (
            <View style={s.metaRow}>
              <Ionicons name="call-outline" size={11} color={colors.textMuted} />
              <Text style={s.metaText}>{item.phone}</Text>
            </View>
          ) : null}
          {item.address ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={11} color={colors.textMuted} />
              <Text style={s.metaText} numberOfLines={1}>{item.address}</Text>
            </View>
          ) : null}
          {!item.phone && !item.address && (
            <Text style={s.metaNoDetails}>No contact details</Text>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity style={s.menuBtn} onPress={() => handleMenuPress(item)} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <AppStatusBar />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.title}>Customers</Text>
          <Text style={s.subtitle}>{counts.all} total · {counts.active} active</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={[s.searchInput, { color: colors.textPrimary }]}
          placeholder="Search by name or phone..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter chips ── */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={s.filterChip}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[
              s.filterChipText,
              activeFilter === f.key && { color: colors.primary, fontWeight: "700" },
            ]}>
              {f.label}
              {counts[f.key] > 0 ? ` (${counts[f.key]})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>
                {search ? "No customers match your search" : "No customers yet"}
              </Text>
              <Text style={s.emptyText}>
                {search
                  ? "Try a different name or phone number"
                  : "Customers added during sales and credits appear here. Tap + to add one manually."}
              </Text>
            </View>
          ) : (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )
        }
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={[s.fab, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Add / Edit Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[s.modalSafe, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

            {/* Modal header */}
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[s.modalAction, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: colors.textPrimary }]}>
                {editTarget ? "Edit Customer" : "New Customer"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                {isSaving
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={[s.modalAction, { color: colors.primary, fontWeight: "700" }]}>Save</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">

              {/* Avatar preview */}
              {form.name.trim() ? (
                <View style={s.previewWrap}>
                  <View style={[s.previewAvatar, { backgroundColor: avatarColor(form.name) + "20" }]}>
                    <Text style={[s.previewInitials, { color: avatarColor(form.name) }]}>
                      {initials(form.name)}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Full Name *</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Mama Chioma"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Phone Number</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="e.g. 0801 234 5678"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Address / Area</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="e.g. Onitsha Main Market"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="sentences"
              />

              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
              <TextInput
                style={[s.fieldInput, s.fieldTextArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Any extra details about this customer..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />

              {/* Danger zone in edit mode */}
              {editTarget ? (
                <View style={s.dangerZone}>
                  <TouchableOpacity
                    style={[s.dangerBtn, { borderColor: editTarget.isActive ? colors.textMuted : colors.primary }]}
                    onPress={() => { setModalVisible(false); setTimeout(() => handleToggleActive(editTarget), 300); }}
                  >
                    <Ionicons
                      name={editTarget.isActive ? "eye-off-outline" : "eye-outline"}
                      size={16}
                      color={editTarget.isActive ? colors.textMuted : colors.primary}
                    />
                    <Text style={[s.dangerBtnText, { color: editTarget.isActive ? colors.textMuted : colors.primary }]}>
                      {editTarget.isActive ? "Disable Customer" : "Enable Customer"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.dangerBtn, { borderColor: colors.danger }]}
                    onPress={() => { setModalVisible(false); setTimeout(() => handleDelete(editTarget), 300); }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[s.dangerBtnText, { color: colors.danger }]}>Delete Customer</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    // ── Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40, height: 40,
      alignItems: "center", justifyContent: "center",
      borderRadius: 20, backgroundColor: colors.background,
    },
    headerCenter: { alignItems: "center" },
    title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
    subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

    // ── Search
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 14 },

    // ── Filters
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    filterChip: { paddingHorizontal: 10, paddingVertical: 6 },
    filterChipText: { fontSize: 13, fontWeight: "500", color: colors.textMuted },

    // ── List
    list: { padding: 16, paddingBottom: 100 },

    // ── Card
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    cardAccent: { width: 4, alignSelf: "stretch" },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: "center", justifyContent: "center",
      marginLeft: 12,
    },
    avatarText: { fontSize: 15, fontWeight: "800" },
    cardInfo: { flex: 1, paddingVertical: 12, paddingHorizontal: 10 },
    cardNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
    cardName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 },
    disabledBadge: {
      backgroundColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    disabledBadgeText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    metaText: { fontSize: 12, color: colors.textMuted },
    metaNoDetails: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
    menuBtn: { padding: 14 },

    // ── Empty state
    empty: { alignItems: "center", paddingTop: 80, gap: 10 },
    emptyIconWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", maxWidth: 280, lineHeight: 20 },

    // ── FAB
    fab: {
      position: "absolute",
      bottom: 28,
      right: 20,
      width: 56, height: 56,
      borderRadius: 28,
      alignItems: "center", justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 8,
    },

    // ── Modal
    modalSafe: { flex: 1 },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 16, fontWeight: "700" },
    modalAction: { fontSize: 15 },
    modalBody: { padding: 20, paddingBottom: 40 },

    // ── Avatar preview in modal
    previewWrap: { alignItems: "center", marginBottom: 8 },
    previewAvatar: {
      width: 64, height: 64, borderRadius: 32,
      alignItems: "center", justifyContent: "center",
    },
    previewInitials: { fontSize: 22, fontWeight: "800" },

    // ── Form fields
    fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 16 },
    fieldInput: {
      borderWidth: 1, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15,
    },
    fieldTextArea: { height: 90, paddingTop: 12 },

    // ── Danger zone
    dangerZone: { marginTop: 32, gap: 10 },
    dangerBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderWidth: 1.5, borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 16,
    },
    dangerBtnText: { fontSize: 14, fontWeight: "600" },
  });
