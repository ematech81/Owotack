import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../../src/store/authStore";
import { draftStorage } from "../../src/utils/draft";
import { DraftBanner } from "../../src/components/common/DraftBanner";
import { useStockStore } from "../../src/store/stockStore";
import { IStockItem } from "../../src/services/stockService";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira, formatDate } from "../../src/utils/formatters";

// ─── Constants ────────────────────────────────────────────────────────────────
const UNIT_PRESETS = ["Pieces", "Unit", "Carton", "Bag", "Crate"];

const CATEGORIES = [
  "Computer",
  "Gadgets",
  "Accessories",
  "Phones",
  "Food Items",
  "Provisions",
  "Drinks",
  "Electronics",
  "Fashion",
];

const MONTH_NAMES_CAL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function stockStatus(item: IStockItem): { label: string; color: string } {
  const threshold = item.lowStockThreshold ?? 5;
  if (item.qty === 0) return { label: "Out of stock", color: "#EF4444" };
  if (item.qty <= threshold) return { label: `${item.qty} left`, color: "#F59E0B" };
  return { label: `${item.qty} ${item.unit}s`, color: "#22C55E" };
}

// ─── Date Picker Modal ────────────────────────────────────────────────────────
function DatePickerModal({ visible, value, onConfirm, onClose, colors }: {
  visible: boolean;
  value: Date | null;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => (value ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (value ?? today).getMonth());
  const [selected, setSelected] = useState<Date | null>(value);

  React.useEffect(() => {
    if (visible) {
      const ref = value ?? today;
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
      setSelected(value);
    }
  }, [visible]);

  const navigateMonth = (dir: -1 | 1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel = (d: number) =>
    !!selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isTod = (d: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dpStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[dpStyles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={dpStyles.calHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={dpStyles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[dpStyles.monthTitle, { color: colors.textPrimary }]}>
              {MONTH_NAMES_CAL[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth(1)} style={dpStyles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={dpStyles.dayRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={[dpStyles.dayLabel, { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>
          <View style={dpStyles.grid}>
            {cells.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[dpStyles.cell, d && isSel(d) && { backgroundColor: colors.primary, borderRadius: 20 }]}
                onPress={() => {
                  if (!d) return;
                  const date = new Date(viewYear, viewMonth, d);
                  setSelected(date);
                  onConfirm(date);
                }}
                disabled={!d}
              >
                {d ? (
                  <>
                    <Text style={[dpStyles.cellText, { color: isSel(d) ? "#fff" : isTod(d) ? colors.primary : colors.textPrimary }]}>
                      {d}
                    </Text>
                    {isTod(d) && !isSel(d) && <View style={[dpStyles.todayDot, { backgroundColor: colors.primary }]} />}
                  </>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[dpStyles.cancelBtn, { borderTopColor: colors.border }]} onPress={onClose}>
            <Text style={[dpStyles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  container: { width: "100%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  monthTitle: { fontSize: 16, fontWeight: "700" },
  dayRow: { flexDirection: "row", paddingHorizontal: 8, marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 8 },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 14, fontWeight: "500" },
  todayDot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 4 },
  cancelBtn: { borderTopWidth: 1, paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "600" },
});

// ─── Unit Selector ────────────────────────────────────────────────────────────
function UnitSelector({ value, onChange, colors, styles }: {
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const normalized = value.toLowerCase();
  const isPreset = UNIT_PRESETS.map((u) => u.toLowerCase()).includes(normalized);
  const isCustom = value !== "" && !isPreset;

  return (
    <View>
      <View style={unitStyles.chipsRow}>
        {UNIT_PRESETS.map((u) => {
          const active = normalized === u.toLowerCase();
          return (
            <TouchableOpacity
              key={u}
              style={[unitStyles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }]}
              onPress={() => onChange(u.toLowerCase())}
            >
              <Text style={[unitStyles.chipText, { color: active ? "#fff" : colors.textSecondary }]}>{u}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[unitStyles.chip, { borderColor: isCustom ? colors.primary : colors.border, backgroundColor: isCustom ? colors.primary : colors.surface }]}
          onPress={() => { if (!isCustom) onChange("custom"); }}
        >
          <Text style={[unitStyles.chipText, { color: isCustom ? "#fff" : colors.textSecondary }]}>Others</Text>
        </TouchableOpacity>
      </View>
      {isCustom && (
        <TextInput
          style={[styles.formInput, { marginTop: 8 }]}
          value={value === "custom" ? "" : value}
          onChangeText={onChange}
          placeholder="e.g. dozen, roll, pack..."
          placeholderTextColor={colors.textMuted}
          autoFocus
        />
      )}
    </View>
  );
}

const unitStyles = StyleSheet.create({
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
});

// ─── Category Selector ────────────────────────────────────────────────────────
function CategorySelector({ value, onChange, colors, styles }: {
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const lowerVal = value.toLowerCase();
  const isPreset = CATEGORIES.some((c) => c.toLowerCase() === lowerVal);
  const isCustom = value !== "" && value !== "custom" && !isPreset;

  return (
    <View>
      <View style={unitStyles.chipsRow}>
        {CATEGORIES.map((c) => {
          const active = lowerVal === c.toLowerCase();
          return (
            <TouchableOpacity
              key={c}
              style={[
                unitStyles.chip,
                { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface },
              ]}
              onPress={() => onChange(c)}
            >
              <Text style={[unitStyles.chipText, { color: active ? "#fff" : colors.textSecondary }]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[
            unitStyles.chip,
            { borderColor: isCustom || value === "custom" ? colors.primary : colors.border, backgroundColor: isCustom || value === "custom" ? colors.primary : colors.surface },
          ]}
          onPress={() => { if (!isCustom) onChange("custom"); }}
        >
          <Text style={[unitStyles.chipText, { color: isCustom || value === "custom" ? "#fff" : colors.textSecondary }]}>Others</Text>
        </TouchableOpacity>
      </View>
      {(isCustom || value === "custom") && (
        <TextInput
          style={[styles.formInput, { marginTop: 8 }]}
          value={value === "custom" ? "" : value}
          onChangeText={onChange}
          placeholder="e.g. Stationery, Hardware, Auto Parts..."
          placeholderTextColor={colors.textMuted}
          autoFocus={value === "custom"}
        />
      )}
    </View>
  );
}

// ─── Stock Detail Modal ───────────────────────────────────────────────────────
function StockDetailModal({ itemId, onClose, colors, styles }: {
  itemId: string;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { items, adjustQty, deleteItem } = useStockStore();
  const item = items.find((i) => i._id === itemId);
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const s = stockStatus(item);

  const handleAdjust = (delta: number) => {
    if (item.qty + delta < 0) { Alert.alert("", "Quantity cannot go below 0"); return; }
    setLoading(true);
    adjustQty(item._id, delta)
      .catch((e: unknown) => Alert.alert("Error", e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  };

  const handleDelete = () => {
    Alert.alert("Delete Item", `Remove "${item.name}" from inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteItem(item._id); onClose(); } },
    ]);
  };

  const margin = item.sellingPrice > 0
    ? (((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100).toFixed(0)
    : null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.formLabel, { marginBottom: 0 }]}>{item.category}</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: s.color + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: s.color }]} />
            <Text style={[styles.statusBadgeText, { color: s.color }]}>{s.label}</Text>
          </View>

          {/* Stats */}
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={styles.detailValue}>{item.qty} {item.unit}s</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cost Price</Text>
              <Text style={styles.detailValue}>{formatNaira(item.costPrice)} / {item.unit}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Selling Price</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>
                {formatNaira(item.sellingPrice)} / {item.unit}
              </Text>
            </View>
            {margin !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Profit Margin</Text>
                <Text style={[styles.detailValue, { color: "#22C55E" }]}>{margin}%</Text>
              </View>
            )}
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Stock Value</Text>
              <Text style={[styles.detailValue, { fontWeight: "800" }]}>
                {formatNaira(item.qty * (item.costPrice || item.sellingPrice))}
              </Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Date Entered</Text>
              <Text style={styles.detailValue}>{formatDate(item.dateEntered)}</Text>
            </View>
          </View>

          {/* Adjust Quantity */}
          <Text style={[styles.formSection, { marginTop: 4 }]}>Adjust Quantity</Text>
          <View style={styles.adjustRow}>
            <TouchableOpacity
              style={[styles.adjustBtn, { borderColor: "#EF4444" }, loading && { opacity: 0.5 }]}
              onPress={() => handleAdjust(-1)}
              disabled={loading}
            >
              <Ionicons name="remove" size={20} color="#EF4444" />
              <Text style={[styles.adjustBtnText, { color: "#EF4444" }]}>Remove 1</Text>
            </TouchableOpacity>
            <View style={styles.adjustQtyDisplay}>
              <Text style={[styles.adjustQtyNum, { color: colors.textPrimary }]}>{item.qty}</Text>
              <Text style={[styles.adjustQtyUnit, { color: colors.textMuted }]}>{item.unit}s</Text>
            </View>
            <TouchableOpacity
              style={[styles.adjustBtn, { borderColor: colors.primary }, loading && { opacity: 0.5 }]}
              onPress={() => handleAdjust(1)}
              disabled={loading}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[styles.adjustBtnText, { color: colors.primary }]}>Add 1</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Delete Item</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function StockScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const { items, stats, isLoading, loadItems, search, setSearch } = useStockStore();
  const [view, setView] = useState<"list" | "add">("list");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const initials = (user?.name ?? "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const styles = makeStyles(colors);

  // Derive filtered list from the full items array — stats always use all items
  const filteredItems = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.category.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  const handleSearch = (q: string) => {
    setSearch(q);
  };

  if (view === "add") {
    return <AddStockView colors={colors} styles={styles} onBack={() => setView("list")} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.headerTitle}>Stock Report</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => loadItems()} />}
      >
        {/* Total Stock Value Card */}
        <View style={styles.valueCard}>
          <Text style={styles.valueLabel}>TOTAL STOCK VALUE 💰</Text>
          <Text style={styles.valueAmount}>{formatNaira(stats?.totalValue ?? 0)}</Text>

          <View style={styles.subCardsRow}>
            <View style={styles.subCard}>
              <View style={[styles.subCardIcon, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="archive" size={18} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.subCardTitle}>Low / Out</Text>
                <Text style={styles.subCardValue}>
                  {(stats?.lowCount ?? 0) + (stats?.outCount ?? 0)}{"\n"}
                  <Text style={styles.subCardUnit}>Items</Text>
                </Text>
              </View>
            </View>

            <View style={[styles.subCard, { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
              <View style={[styles.subCardIcon, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="cube-outline" size={18} color="#059669" />
              </View>
              <View>
                <Text style={styles.subCardTitle}>Total Items</Text>
                <Text style={[styles.subCardValue, { color: "#059669" }]}>
                  {stats?.totalItems ?? 0}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search stock items..."
            placeholderTextColor={colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Products List */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Products Stock 📊</Text>
          <Text style={styles.updatedText}>{filteredItems.length} items</Text>
        </View>

        {filteredItems.length === 0 && !isLoading ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {search ? `No items match "${search}"` : "Tap 'Add Stock' to add your first item"}
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const s = stockStatus(item);
            return (
              <TouchableOpacity
                key={item._id}
                style={styles.itemRow}
                onPress={() => setSelectedItemId(item._id)}
                activeOpacity={0.7}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.itemQty, { color: s.color }]}>● {s.label}</Text>
                  <Text style={styles.itemPrice}>{formatNaira(item.sellingPrice)} / {item.unit}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setView("add")} activeOpacity={0.85}>
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>Add Stock</Text>
      </TouchableOpacity>

      {selectedItemId && (
        <StockDetailModal
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          colors={colors}
          styles={styles}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Add Stock View ───────────────────────────────────────────────────────────
interface StockEntry {
  name: string;
  category: string;
  qty: string;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  dateEntered: Date;
}

const emptyEntry = (): StockEntry => ({
  name: "", category: "", qty: "", unit: "pieces",
  costPrice: "", sellingPrice: "", dateEntered: new Date(),
});

interface StockDraft { entries: Array<Omit<StockEntry, "dateEntered"> & { dateEntered: string }> }

function AddStockView({
  colors, styles, onBack,
}: {
  colors: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof makeStyles>;
  onBack: () => void;
}) {
  const { addItem } = useStockStore();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<StockEntry[]>([emptyEntry()]);
  const [datePickerIndex, setDatePickerIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const draftKey = user ? `draft:stock:${user._id}` : null;

  useEffect(() => {
    if (!draftKey) return;
    draftStorage.load<StockDraft>(draftKey).then((stored) => {
      if (!stored) return;
      const restored = stored.data.entries.map((e) => ({
        ...e, dateEntered: new Date(e.dateEntered),
      }));
      setEntries(restored.length ? restored : [emptyEntry()]);
      setDraftSavedAt(stored.savedAt);
    });
  }, [draftKey]);

  const handleSaveDraft = async () => {
    if (!draftKey) return;
    const serialized = entries.map((e) => ({ ...e, dateEntered: e.dateEntered.toISOString() }));
    const at = await draftStorage.save<StockDraft>(draftKey, { entries: serialized });
    setDraftSavedAt(at);
  };

  const handleDiscard = async () => {
    if (draftKey) await draftStorage.clear(draftKey);
    setDraftSavedAt(null);
    setEntries([emptyEntry()]);
  };

  const updateEntry = (index: number, field: keyof StockEntry, value: string | Date) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const addEntry = () => setEntries((prev) => [...prev, emptyEntry()]);

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const valid = entries.filter((e) => e.name.trim() && e.qty && !isNaN(Number(e.qty)));
    if (!valid.length) {
      Alert.alert("", "Add at least one item with a name and quantity");
      return;
    }
    setLoading(true);
    try {
      for (const e of valid) {
        await addItem({
          name: e.name.trim(),
          category: e.category === "custom" || !e.category.trim() ? "General" : e.category.trim(),
          qty: Number(e.qty),
          unit: e.unit.trim() || "unit",
          costPrice: e.costPrice ? Number(e.costPrice) : 0,
          sellingPrice: e.sellingPrice ? Number(e.sellingPrice) : 0,
          dateEntered: e.dateEntered.toISOString(),
        });
      }
      if (draftKey) await draftStorage.clear(draftKey);
      const count = valid.length;
      Alert.alert("Saved!", `${count} item${count > 1 ? "s" : ""} added to inventory`);
      onBack();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Stock</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {entries.map((entry, index) => {
            const costNum = Number(entry.costPrice) || 0;
            const sellNum = Number(entry.sellingPrice) || 0;
            const marginPct = sellNum > 0
              ? (((sellNum - costNum) / sellNum) * 100).toFixed(1)
              : null;
            const dateDisplay = entry.dateEntered.toLocaleDateString("en-NG", {
              day: "numeric", month: "short", year: "numeric",
            });

            return (
              <View key={index} style={styles.stockEntryCard}>
                {/* Card header */}
                <View style={styles.stockEntryHeader}>
                  <Text style={styles.stockEntryLabel}>Item {index + 1}</Text>
                  {entries.length > 1 && (
                    <TouchableOpacity onPress={() => removeEntry(index)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.formSection}>Item Details</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Item Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={entry.name}
                    onChangeText={(v) => updateEntry(index, "name", v)}
                    placeholder="e.g. Mama Gold Rice 50kg"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Category</Text>
                  <CategorySelector
                    value={entry.category}
                    onChange={(v) => updateEntry(index, "category", v)}
                    colors={colors}
                    styles={styles}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={entry.qty}
                    onChangeText={(v) => updateEntry(index, "qty", v)}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Unit</Text>
                  <UnitSelector
                    value={entry.unit}
                    onChange={(v) => updateEntry(index, "unit", v)}
                    colors={colors}
                    styles={styles}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Date Entered</Text>
                  <TouchableOpacity
                    style={[styles.formInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                    onPress={() => setDatePickerIndex(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{dateDisplay}</Text>
                    <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.formSection}>Pricing</Text>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Cost Price (₦)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={entry.costPrice}
                      onChangeText={(v) => updateEntry(index, "costPrice", v)}
                      placeholder="0.00 (optional)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Selling Price (₦)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={entry.sellingPrice}
                      onChangeText={(v) => updateEntry(index, "sellingPrice", v)}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {marginPct !== null && sellNum > 0 && (
                  <View style={styles.marginPreview}>
                    <Ionicons name="trending-up" size={15} color={colors.primary} />
                    <Text style={[styles.marginText, { color: colors.primary }]}>
                      Profit margin: {marginPct}%  ·  {formatNaira(sellNum - costNum)} per {entry.unit || "unit"}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Add More */}
          <TouchableOpacity
            style={styles.addMoreStockBtn}
            onPress={addEntry}
            disabled={loading}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addMoreStockText}>Add More</Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Ionicons name="bulb-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              Low-stock alerts appear on your Home screen when quantity drops below 5 items.
            </Text>
          </View>

          {draftSavedAt && (
            <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />
          )}

          {draftSavedAt ? (
            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>{loading ? "Saving..." : "Submit"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDraft}>
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Draft</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {datePickerIndex !== null && (
        <DatePickerModal
          visible
          value={entries[datePickerIndex]?.dateEntered ?? new Date()}
          onConfirm={(date) => { updateEntry(datePickerIndex, "dateEntered", date); setDatePickerIndex(null); }}
          onClose={() => setDatePickerIndex(null)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerTitle: { fontSize: 22, fontWeight: "700", color: colors.primary },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    backBtn: { padding: 4 },

    content: { paddingHorizontal: 20, paddingBottom: 40 },

    valueCard: {
      backgroundColor: colors.surface, borderRadius: 20, padding: 20,
      marginBottom: 16, shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    valueLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
    valueAmount: { fontSize: 34, fontWeight: "800", color: colors.primary, marginBottom: 20 },
    subCardsRow: { flexDirection: "row" },
    subCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 4, paddingRight: 4 },
    subCardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    subCardTitle: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    subCardValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
    subCardUnit: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },

    searchBar: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, height: 48, marginBottom: 20,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },

    listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    listTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    updatedText: { fontSize: 12, color: colors.textMuted },

    itemRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 16, marginBottom: 10,
    },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 3 },
    itemCategory: { fontSize: 12, color: colors.textMuted },
    itemRight: { alignItems: "flex-end", gap: 4 },
    itemQty: { fontSize: 13, fontWeight: "700" },
    itemPrice: { fontSize: 12, color: colors.textSecondary },

    empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },

    fab: {
      position: "absolute", bottom: 24, right: 20,
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24, paddingVertical: 14, borderRadius: 50,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    },
    fabText: { color: "#fff", fontSize: 15, fontWeight: "700" },

    // Modal shared
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },

    statusBadge: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 20, marginBottom: 16,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusBadgeText: { fontSize: 13, fontWeight: "700" },

    detailCard: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: colors.border,
    },
    detailRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    detailLabel: { fontSize: 14, color: colors.textSecondary },
    detailValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },

    adjustRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
    adjustBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderWidth: 1.5, borderRadius: 12, height: 48,
    },
    adjustBtnText: { fontSize: 14, fontWeight: "700" },
    adjustQtyDisplay: { alignItems: "center", minWidth: 52 },
    adjustQtyNum: { fontSize: 24, fontWeight: "800" },
    adjustQtyUnit: { fontSize: 11, marginTop: -2 },

    deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12 },
    deleteBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },

    // Add form
    formSection: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 14, marginTop: 4 },
    formGroup: { marginBottom: 14 },
    formRow: { flexDirection: "row", gap: 12 },
    formLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
    formInput: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, height: 48, paddingHorizontal: 14, fontSize: 15, color: colors.textPrimary,
    },
    marginPreview: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.primary + "18", borderRadius: 8, padding: 10, marginBottom: 14,
    },
    marginText: { fontSize: 13, fontWeight: "600", flex: 1 },
    infoCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      backgroundColor: "#E8F5E9", borderRadius: 10, padding: 12, marginBottom: 24, marginTop: 8,
    },
    infoText: { fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    stockEntryCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      marginBottom: 16, borderWidth: 1, borderColor: colors.border,
    },
    stockEntryHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      marginBottom: 12, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    stockEntryLabel: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
    addMoreStockBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary,
      marginBottom: 16,
    },
    addMoreStockText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    saveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: 12, height: 52,
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
