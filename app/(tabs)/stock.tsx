

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal,
  RefreshControl, Animated, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../../src/store/authStore";
import { draftStorage } from "../../src/utils/draft";
import { DraftBanner } from "../../src/components/common/DraftBanner";
import { checkStockLimit } from "../../src/utils/usageLimits";
import { UpgradePromptModal } from "../../src/components/common/UpgradePromptModal";
import { useStockStore } from "../../src/store/stockStore";
import { IStockItem } from "../../src/services/stockService";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira, formatDate } from "../../src/utils/formatters";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────────────────────────

const D = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 3,
    },
    medium: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.11,
      shadowRadius: 18,
      elevation: 6,
    },
    colored: (color: string) => ({
      shadowColor: color,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    }),
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIT_PRESETS = ["Pieces", "Unit", "Carton", "Bag", "Crate"];

const CATEGORIES = [
  "Computer", "Gadgets", "Accessories", "Phones",
  "Food Items", "Provisions", "Drinks", "Electronics", "Fashion",
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ─── Stock Status ─────────────────────────────────────────────────────────────

function stockStatus(item: IStockItem): {
  label: string; color: string; bg: string; icon: string; severity: "out" | "low" | "ok";
} {
  const threshold = item.lowStockThreshold ?? 5;
  if (item.qty === 0)
    return { label: "Out of stock", color: "#EF4444", bg: "#FEF2F2", icon: "close-circle", severity: "out" };
  if (item.qty <= threshold)
    return { label: `${item.qty} left`, color: "#F59E0B", bg: "#FFFBEB", icon: "warning", severity: "low" };
  return { label: `${item.qty} ${item.unit}s`, color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle", severity: "ok" };
}

// ─── Animated Press Wrapper ───────────────────────────────────────────────────

function PressCard({
  children, onPress, style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress} onPressIn={onIn} onPressOut={onOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
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

  useEffect(() => {
    if (visible) {
      const ref = value ?? today;
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
      setSelected(value);
    }
  }, [visible]);

  const navigateMonth = (dir: -1 | 1) => {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel = (d: number) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === d;

  const isTod = (d: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === d;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dpS.overlay}>
        <View style={[dpS.sheet, { backgroundColor: colors.surface }]}>
          {/* Handle */}
          <View style={dpS.handle} />

          {/* Header */}
          <View style={dpS.header}>
            <View>
              <Text style={[dpS.monthLabel, { color: colors.textPrimary }]}>
                {MONTH_NAMES[viewMonth]}
              </Text>
              <Text style={[dpS.yearLabel, { color: colors.textMuted }]}>{viewYear}</Text>
            </View>
            <View style={dpS.navRow}>
              <TouchableOpacity
                onPress={() => navigateMonth(-1)}
                style={[dpS.navBtn, { backgroundColor: colors.background }]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigateMonth(1)}
                style={[dpS.navBtn, { backgroundColor: colors.background }]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Day labels */}
          <View style={dpS.dayRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={[dpS.dayLabel, { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

          <View style={[dpS.divider, { backgroundColor: colors.border }]} />

          {/* Grid */}
          <View style={dpS.grid}>
            {cells.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  dpS.cell,
                  d && isSel(d) && { backgroundColor: colors.primary, borderRadius: D.radius.full },
                  d && isTod(d) && !isSel(d) && {
                    borderWidth: 1.5, borderColor: colors.primary, borderRadius: D.radius.full,
                  },
                ]}
                onPress={() => {
                  if (!d) return;
                  const date = new Date(viewYear, viewMonth, d);
                  setSelected(date);
                  onConfirm(date);
                }}
                disabled={!d}
              >
                {d ? (
                  <Text style={[
                    dpS.cellText,
                    { color: isSel(d) ? "#fff" : isTod(d) ? colors.primary : colors.textPrimary },
                    isSel(d) && { fontWeight: "700" },
                  ]}>
                    {d}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer */}
          <View style={[dpS.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[dpS.footerBtn, { backgroundColor: colors.background }]}
            >
              <Text style={[dpS.footerBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onConfirm(selected ?? today); onClose(); }}
              style={[dpS.footerBtnPrimary, { backgroundColor: colors.primary }]}
            >
              <Text style={dpS.footerBtnPrimaryText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dpS = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: D.radius.xxl,
    borderTopRightRadius: D.radius.xxl,
    padding: 24, paddingBottom: 36,
    ...D.shadow.medium,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center", marginBottom: 20,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  monthLabel: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  yearLabel: { fontSize: 14, marginTop: 2 },
  navRow: { flexDirection: "row", gap: 8 },
  navBtn: {
    width: 36, height: 36, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  dayRow: { flexDirection: "row", marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  divider: { height: 1, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.28%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center",
  },
  cellText: { fontSize: 14, fontWeight: "500" },
  footer: {
    flexDirection: "row", gap: 10,
    marginTop: 20, paddingTop: 16, borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 13, borderRadius: D.radius.lg,
  },
  footerBtnText: { fontSize: 14, fontWeight: "600" },
  footerBtnPrimary: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 13, borderRadius: D.radius.lg,
  },
  footerBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

// ─── Chip Selector (shared by Unit & Category) ────────────────────────────────

function ChipSelector({
  options, value, onChange, colors,
  customPlaceholder = "e.g. custom...",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useTheme>;
  customPlaceholder?: string;
}) {
  const lowerVal = value.toLowerCase();
  const isPreset = options.some((o) => o.toLowerCase() === lowerVal);
  const isCustom = value !== "" && value !== "custom" && !isPreset;

  return (
    <View style={chipS.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chipS.row}>
        {options.map((o) => {
          const active = lowerVal === o.toLowerCase();
          return (
            <TouchableOpacity
              key={o}
              style={[
                chipS.chip,
                { borderColor: active ? colors.primary : colors.border },
                active && { backgroundColor: colors.primary },
              ]}
              onPress={() => onChange(o.toLowerCase())}
            >
              <Text style={[chipS.label, { color: active ? "#fff" : colors.textSecondary }]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[
            chipS.chip,
            { borderColor: (isCustom || value === "custom") ? colors.primary : colors.border },
            (isCustom || value === "custom") && { backgroundColor: colors.primary },
          ]}
          onPress={() => { if (!isCustom) onChange("custom"); }}
        >
          <Text style={[chipS.label, {
            color: (isCustom || value === "custom") ? "#fff" : colors.textSecondary,
          }]}>
            Others
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {(isCustom || value === "custom") && (
        <TextInput
          style={chipS.customInput}
          value={value === "custom" ? "" : value}
          onChangeText={onChange}
          placeholder={customPlaceholder}
          autoFocus={value === "custom"}
        />
      )}
    </View>
  );
}

const chipS = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: D.radius.full, borderWidth: 1.5,
  },
  label: { fontSize: 13, fontWeight: "600" },
  customInput: {
    height: 46, borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: D.radius.md, paddingHorizontal: 14,
    fontSize: 14, marginTop: 4,
  },
});

// ─── Stock Detail Modal ───────────────────────────────────────────────────────

function StockDetailModal({ itemId, onClose, colors }: {
  itemId: string;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  const { items, adjustQty, deleteItem } = useStockStore();
  const item = items.find((i) => i._id === itemId);
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(item?.qty ?? 0);

  useEffect(() => { if (item) setQty(item.qty); }, [item?.qty]);

  if (!item) return null;

  const s = stockStatus(item);
  const margin = item.sellingPrice > 0
    ? (((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100).toFixed(0)
    : null;

  const handleAdjust = (delta: number) => {
    if (qty + delta < 0) { Alert.alert("", "Quantity cannot go below 0"); return; }
    setLoading(true);
    setQty((q) => q + delta);
    adjustQty(item._id, delta)
      .catch((e: unknown) => {
        setQty((q) => q - delta);
        Alert.alert("Error", e instanceof Error ? e.message : "Failed");
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = () => {
    Alert.alert("Delete Item", `Remove "${item.name}" from inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteItem(item._id); onClose(); } },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Hero gradient header */}
        <LinearGradient
          colors={[s.color + "22", colors.background]}
          style={detailS.heroGradient}
        >
          <View style={detailS.heroTop}>
            <TouchableOpacity
              onPress={onClose}
              style={[detailS.closeBtn, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="chevron-down" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={[detailS.deleteIconBtn, { backgroundColor: "#FEF2F2" }]}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          <View style={detailS.heroInfo}>
            <View style={[detailS.heroIcon, { backgroundColor: s.bg }]}>
              <Ionicons name="cube-outline" size={28} color={s.color} />
            </View>
            <Text style={[detailS.heroName, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={detailS.heroMeta}>
              <View style={[detailS.categoryChip, { backgroundColor: colors.surface }]}>
                <Text style={[detailS.categoryChipText, { color: colors.textSecondary }]}>
                  {item.category}
                </Text>
              </View>
              <View style={[detailS.statusChip, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon as any} size={12} color={s.color} />
                <Text style={[detailS.statusChipText, { color: s.color }]}>{s.label}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={detailS.content} showsVerticalScrollIndicator={false}>

          {/* Stat grid */}
          <View style={detailS.statGrid}>
            {[
              { label: "Cost Price", value: formatNaira(item.costPrice), icon: "pricetag-outline", color: "#6366F1" },
              { label: "Selling Price", value: formatNaira(item.sellingPrice), icon: "trending-up-outline", color: colors.primary },
              { label: "Stock Value", value: formatNaira(item.qty * (item.costPrice || item.sellingPrice)), icon: "wallet-outline", color: "#10B981" },
              { label: "Margin", value: margin ? `${margin}%` : "—", icon: "analytics-outline", color: "#F59E0B" },
            ].map((stat) => (
              <View key={stat.label} style={[detailS.statCard, { backgroundColor: colors.surface }, D.shadow.soft]}>
                <View style={[detailS.statIcon, { backgroundColor: stat.color + "18" }]}>
                  <Ionicons name={stat.icon as any} size={16} color={stat.color} />
                </View>
                <Text style={[detailS.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
                <Text style={[detailS.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Date row */}
          <View style={[detailS.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={[detailS.infoLabel, { color: colors.textSecondary }]}>Date Entered</Text>
            <Text style={[detailS.infoValue, { color: colors.textPrimary }]}>{formatDate(item.dateEntered)}</Text>
          </View>

          {/* Adjust quantity */}
          <View style={[detailS.adjustSection, { backgroundColor: colors.surface }, D.shadow.soft]}>
            <Text style={[detailS.adjustTitle, { color: colors.textPrimary }]}>Adjust Stock</Text>
            <Text style={[detailS.adjustSub, { color: colors.textMuted }]}>
              Tap to update current quantity
            </Text>

            <View style={detailS.adjustControls}>
              <TouchableOpacity
                style={[detailS.adjustBigBtn, { backgroundColor: "#FEF2F2" }]}
                onPress={() => handleAdjust(-1)}
                disabled={loading}
              >
                <Ionicons name="remove" size={22} color="#EF4444" />
              </TouchableOpacity>

              <View style={[detailS.qtyDisplay, { borderColor: colors.border }]}>
                <Text style={[detailS.qtyNum, { color: colors.textPrimary }]}>{qty}</Text>
                <Text style={[detailS.qtyUnit, { color: colors.textMuted }]}>{item.unit}s</Text>
              </View>

              <TouchableOpacity
                style={[detailS.adjustBigBtn, { backgroundColor: "#ECFDF5" }]}
                onPress={() => handleAdjust(1)}
                disabled={loading}
              >
                <Ionicons name="add" size={22} color="#10B981" />
              </TouchableOpacity>
            </View>

            {/* Progress bar indicator */}
            <View style={[detailS.progressBar, { backgroundColor: colors.background }]}>
              <View style={[
                detailS.progressFill,
                {
                  backgroundColor: s.color,
                  width: `${Math.min((qty / Math.max(qty + 10, 20)) * 100, 100)}%`,
                },
              ]} />
            </View>
            <Text style={[detailS.progressLabel, { color: colors.textMuted }]}>
              {s.severity === "out" ? "No stock remaining" :
                s.severity === "low" ? "Low stock — consider restocking" :
                "Stock level looks good"}
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const detailS = StyleSheet.create({
  heroGradient: { paddingBottom: 20 },
  heroTop: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, paddingTop: 16,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
    ...D.shadow.soft,
  },
  deleteIconBtn: {
    width: 38, height: 38, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  heroInfo: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  heroIcon: {
    width: 60, height: 60, borderRadius: D.radius.xl,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  heroName: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4, lineHeight: 30 },
  heroMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: D.radius.full,
  },
  categoryChipText: { fontSize: 12, fontWeight: "600" },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: D.radius.full,
  },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  content: { padding: 20, gap: 12 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: (SCREEN_WIDTH - 60) / 2,
    borderRadius: D.radius.lg, padding: 14, gap: 6,
  },
  statIcon: {
    width: 34, height: 34, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
  },
  statValue: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  statLabel: { fontSize: 11, fontWeight: "600" },
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: D.radius.lg, borderWidth: 1,
  },
  infoLabel: { fontSize: 14, fontWeight: "500", flex: 1 },
  infoValue: { fontSize: 14, fontWeight: "700" },
  adjustSection: {
    borderRadius: D.radius.xl, padding: 20, gap: 8,
  },
  adjustTitle: { fontSize: 16, fontWeight: "800" },
  adjustSub: { fontSize: 12, marginBottom: 8 },
  adjustControls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginVertical: 8,
  },
  adjustBigBtn: {
    width: 56, height: 56, borderRadius: D.radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  qtyDisplay: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderRadius: D.radius.xl,
    paddingHorizontal: 28, paddingVertical: 10,
  },
  qtyNum: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  qtyUnit: { fontSize: 12, fontWeight: "600", marginTop: -4 },
  progressBar: {
    height: 6, borderRadius: D.radius.full, overflow: "hidden", marginTop: 8,
  },
  progressFill: { height: "100%", borderRadius: D.radius.full },
  progressLabel: { fontSize: 11, fontWeight: "500" },
});

// ─── Stock Item Card ──────────────────────────────────────────────────────────

function StockItemCard({ item, onPress, colors }: {
  item: IStockItem;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>;
}) {
  const s = stockStatus(item);

  return (
    <PressCard onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={[itemCardS.card, { backgroundColor: colors.surface }, D.shadow.soft]}>
        {/* Left accent */}
        <View style={[itemCardS.accent, { backgroundColor: s.color }]} />

        <View style={[itemCardS.iconWrap, { backgroundColor: s.bg }]}>
          <Ionicons name="cube-outline" size={20} color={s.color} />
        </View>

        <View style={itemCardS.info}>
          <Text style={[itemCardS.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={itemCardS.metaRow}>
            <View style={[itemCardS.catChip, { backgroundColor: colors.background }]}>
              <Text style={[itemCardS.catText, { color: colors.textMuted }]}>{item.category}</Text>
            </View>
          </View>
        </View>

        <View style={itemCardS.right}>
          <View style={[itemCardS.statusBadge, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon as any} size={11} color={s.color} />
            <Text style={[itemCardS.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
          <Text style={[itemCardS.price, { color: colors.textSecondary }]}>
            {formatNaira(item.sellingPrice)} / {item.unit}
          </Text>
        </View>
      </View>
    </PressCard>
  );
}

const itemCardS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: D.radius.lg, overflow: "hidden",
  },
  accent: { width: 4, alignSelf: "stretch" },
  iconWrap: {
    width: 44, height: 44, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
    marginLeft: 12,
  },
  info: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, gap: 4 },
  name: { fontSize: 14, fontWeight: "700", letterSpacing: -0.1 },
  metaRow: { flexDirection: "row", gap: 6 },
  catChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: D.radius.full,
  },
  catText: { fontSize: 10, fontWeight: "600" },
  right: { paddingRight: 14, alignItems: "flex-end", gap: 6 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: D.radius.full,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  price: { fontSize: 11, fontWeight: "600" },
});

// ─── Hero Stats Card ──────────────────────────────────────────────────────────

function HeroStatsCard({ stats, colors }: {
  stats: any;
  colors: ReturnType<typeof useTheme>;
}) {
  const alertCount = (stats?.lowCount ?? 0) + (stats?.outCount ?? 0);

  return (
    <LinearGradient
      colors={[colors.primary, colors.primary + "CC"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={heroS.card}
    >
      {/* Decorative circles */}
      <View style={heroS.circle1} />
      <View style={heroS.circle2} />

      <View style={heroS.topRow}>
        <View>
          <Text style={heroS.totalLabel}>Total Stock Value</Text>
          <Text style={heroS.totalAmount}>{formatNaira(stats?.totalValue ?? 0)}</Text>
        </View>
        <View style={heroS.iconWrap}>
          <Ionicons name="storefront-outline" size={28} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      <View style={heroS.divider} />

      <View style={heroS.statsRow}>
        <View style={heroS.stat}>
          <View style={[heroS.statIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Ionicons name="cube-outline" size={14} color="#fff" />
          </View>
          <View>
            <Text style={heroS.statNum}>{stats?.totalItems ?? 0}</Text>
            <Text style={heroS.statLabel}>Total Items</Text>
          </View>
        </View>

        <View style={heroS.statSep} />

        <View style={heroS.stat}>
          <View style={[heroS.statIcon, { backgroundColor: alertCount > 0 ? "#FEF3C7" : "rgba(255,255,255,0.2)" }]}>
            <Ionicons
              name={alertCount > 0 ? "warning" : "checkmark-circle-outline"}
              size={14}
              color={alertCount > 0 ? "#D97706" : "#fff"}
            />
          </View>
          <View>
            <Text style={[heroS.statNum, alertCount > 0 && { color: "#FDE68A" }]}>
              {alertCount}
            </Text>
            <Text style={heroS.statLabel}>Low / Out</Text>
          </View>
        </View>

        <View style={heroS.statSep} />

        <View style={heroS.stat}>
          <View style={[heroS.statIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Ionicons name="trending-up-outline" size={14} color="#fff" />
          </View>
          <View>
            <Text style={heroS.statNum}>
              {stats?.totalItems > 0
                ? `${Math.round(((stats?.totalItems - alertCount) / stats.totalItems) * 100)}%`
                : "—"}
            </Text>
            <Text style={heroS.statLabel}>In Stock</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const heroS = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: D.radius.xxl, padding: 20, overflow: "hidden",
    ...D.shadow.medium,
  },
  circle1: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -50, right: -40,
  },
  circle2: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -25, left: 10,
  },
  topRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 16,
  },
  totalLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginBottom: 4 },
  totalAmount: { fontSize: 30, color: "#fff", fontWeight: "900", letterSpacing: -0.5 },
  iconWrap: {
    width: 56, height: 56, borderRadius: D.radius.xl,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 16 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statIcon: {
    width: 30, height: 30, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  statNum: { fontSize: 15, color: "#fff", fontWeight: "800" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  statSep: {
    width: 1, height: 30,
    backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 8,
  },
});

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, colors }: {
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useTheme>;
}) {
  const focused = useRef(new Animated.Value(0)).current;
  const borderColor = focused.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View style={[searchS.wrap, { borderColor, backgroundColor: colors.surface }, D.shadow.soft]}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        style={[searchS.input, { color: colors.textPrimary }]}
        value={value}
        onChangeText={onChange}
        placeholder="Search items, categories..."
        placeholderTextColor={colors.textMuted}
        onFocus={() => Animated.timing(focused, { toValue: 1, duration: 200, useNativeDriver: false }).start()}
        onBlur={() => Animated.timing(focused, { toValue: 0, duration: 200, useNativeDriver: false }).start()}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange("")}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const searchS = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: D.radius.full, borderWidth: 1.5,
    paddingHorizontal: 16, height: 48,
    marginHorizontal: 16, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 14, fontWeight: "500" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StockScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const { items, stats, isLoading, loadItems, search, setSearch } = useStockStore();
  const [view, setView] = useState<"list" | "add">("list");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [upgradeVisible, setUpgradeVisible] = useState(false);

  const planId = user?.subscription?.plan ?? "free";

  const initials = (user?.name ?? "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const filteredItems = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.category.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  useFocusEffect(useCallback(() => { loadItems(); }, []));

  if (view === "add") {
    return <AddStockView colors={colors} onBack={() => setView("list")} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>

      {/* ── Header ── */}
      <LinearGradient
        colors={[colors.primary + "14", colors.background]}
        style={screenS.heroGrad}
      >
        <View style={screenS.headerRow}>
          <View style={screenS.avatarWrap}>
            <LinearGradient colors={[colors.primary, colors.primary + "AA"]} style={screenS.avatar}>
              <Text style={screenS.avatarText}>{initials}</Text>
            </LinearGradient>
            <View>
              <Text style={[screenS.greeting, { color: colors.textMuted }]}>Inventory</Text>
              <Text style={[screenS.headerTitle, { color: colors.textPrimary }]}>Stock Report</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => loadItems()}
            style={[screenS.refreshBtn, { backgroundColor: colors.surface }, D.shadow.soft]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => loadItems()} tintColor={colors.primary} />
        }
      >
        {/* Hero Stats */}
        <HeroStatsCard stats={stats} colors={colors} />

        {/* Search */}
        <SearchBar value={search} onChange={setSearch} colors={colors} />

        {/* List header */}
        <View style={screenS.listHeader}>
          <View style={screenS.listTitleRow}>
            <Text style={[screenS.listTitle, { color: colors.textPrimary }]}>Products</Text>
            <View style={[screenS.countBadge, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[screenS.countText, { color: colors.primary }]}>
                {filteredItems.length} items
              </Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={screenS.listWrap}>
          {filteredItems.length === 0 && !isLoading ? (
            <View style={screenS.empty}>
              <LinearGradient
                colors={[colors.primary + "15", colors.primary + "05"]}
                style={screenS.emptyIconWrap}
              >
                <Ionicons name="cube-outline" size={40} color={colors.primary} />
              </LinearGradient>
              <Text style={[screenS.emptyTitle, { color: colors.textPrimary }]}>No Items Found</Text>
              <Text style={[screenS.emptySub, { color: colors.textMuted }]}>
                {search
                  ? `No items match "${search}"`
                  : "Tap 'Add Stock' to add your first item"}
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <StockItemCard
                key={item._id}
                item={item}
                onPress={() => setSelectedItemId(item._id)}
                colors={colors}
              />
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB */}
      <View style={screenS.fabWrap}>
        <TouchableOpacity
          style={[screenS.fab, D.shadow.colored(colors.primary)]}
          onPress={() => {
            const limitCheck = checkStockLimit(items.length, planId);
            if (!limitCheck.allowed) { setUpgradeVisible(true); return; }
            setView("add");
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primary, colors.primary + "DD"]}
            style={screenS.fabGrad}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={screenS.fabText}>Add Stock</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {selectedItemId && (
        <StockDetailModal
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          colors={colors}
        />
      )}

      <UpgradePromptModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        feature="stock"
        used={items.length}
        limit={checkStockLimit(items.length, planId).limit}
      />
    </SafeAreaView>
  );
}

const screenS = StyleSheet.create({
  heroGrad: { paddingBottom: 16 },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12,
  },
  avatarWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  greeting: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  listHeader: { paddingHorizontal: 16, marginBottom: 10 },
  listTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  listTitle: { fontSize: 17, fontWeight: "800" },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: D.radius.full },
  countText: { fontSize: 12, fontWeight: "700" },
  listWrap: { paddingHorizontal: 16 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptySub: { fontSize: 14, textAlign: "center", maxWidth: 250, lineHeight: 20 },
  fabWrap: {
    position: "absolute", bottom: 24, right: 20, left: 20,
    alignItems: "center",
  },
  fab: { borderRadius: D.radius.full, overflow: "hidden" },
  fabGrad: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 32, paddingVertical: 16,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

// ─── Add Stock View ───────────────────────────────────────────────────────────

interface StockEntry {
  name: string; category: string; qty: string;
  unit: string; costPrice: string; sellingPrice: string; dateEntered: Date;
}

const emptyEntry = (): StockEntry => ({
  name: "", category: "", qty: "", unit: "pieces",
  costPrice: "", sellingPrice: "", dateEntered: new Date(),
});

interface StockDraft { entries: Array<Omit<StockEntry, "dateEntered"> & { dateEntered: string }> }

function FormSection({ title, icon, colors }: { title: string; icon: string; colors: ReturnType<typeof useTheme> }) {
  return (
    <View style={addS.sectionRow}>
      <View style={[addS.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
        <Ionicons name={icon as any} size={14} color={colors.primary} />
      </View>
      <Text style={[addS.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

function FormField({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={addS.field}>
      <Text style={addS.fieldLabel}>
        {label}{required && <Text style={{ color: "#EF4444" }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function AddStockView({ colors, onBack }: {
  colors: ReturnType<typeof useTheme>;
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
      const restored = stored.data.entries.map((e) => ({ ...e, dateEntered: new Date(e.dateEntered) }));
      setEntries(restored.length ? restored : [emptyEntry()]);
      setDraftSavedAt(stored.savedAt);
    });
  }, [draftKey]);

  const saveDraft = async () => {
    if (!draftKey) return;
    const serialized = entries.map((e) => ({ ...e, dateEntered: e.dateEntered.toISOString() }));
    const at = await draftStorage.save<StockDraft>(draftKey, { entries: serialized });
    setDraftSavedAt(at);
  };

  const discardDraft = async () => {
    if (draftKey) await draftStorage.clear(draftKey);
    setDraftSavedAt(null);
    setEntries([emptyEntry()]);
  };

  const updateEntry = (index: number, field: keyof StockEntry, value: string | Date) =>
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));

  const handleSubmit = async () => {
    const valid = entries.filter((e) => e.name.trim() && e.qty && !isNaN(Number(e.qty)));
    if (!valid.length) { Alert.alert("", "Add at least one item with a name and quantity"); return; }
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
      Alert.alert("✓ Saved!", `${count} item${count > 1 ? "s" : ""} added to inventory`, [
        { text: "Done", onPress: onBack },
      ]);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* Header */}
        <LinearGradient
          colors={[colors.primary + "14", colors.background]}
          style={addS.headerGrad}
        >
          <View style={addS.headerRow}>
            <TouchableOpacity
              onPress={onBack}
              style={[addS.backBtn, { backgroundColor: colors.surface }, D.shadow.soft]}
            >
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={addS.headerMid}>
              <Text style={[addS.headerTitle, { color: colors.textPrimary }]}>Add Stock</Text>
              <Text style={[addS.headerSub, { color: colors.textMuted }]}>
                {entries.length} item{entries.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={saveDraft}
              style={[addS.draftBtn, { backgroundColor: colors.surface }, D.shadow.soft]}
            >
              <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
              <Text style={[addS.draftBtnText, { color: colors.primary }]}>Draft</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={addS.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {draftSavedAt && (
            <DraftBanner savedAt={draftSavedAt} onDiscard={discardDraft} />
          )}

          {entries.map((entry, index) => {
            const costNum = Number(entry.costPrice) || 0;
            const sellNum = Number(entry.sellingPrice) || 0;
            const profitPct = sellNum > 0
              ? (((sellNum - costNum) / sellNum) * 100).toFixed(1)
              : null;
            const profitAmt = sellNum - costNum;

            return (
              <View key={index} style={[addS.entryCard, { backgroundColor: colors.surface }, D.shadow.soft]}>

                {/* Card header */}
                <LinearGradient
                  colors={[colors.primary + "12", "transparent"]}
                  style={addS.entryCardHeader}
                >
                  <View style={addS.entryCardHeaderLeft}>
                    <View style={[addS.entryNum, { backgroundColor: colors.primary }]}>
                      <Text style={addS.entryNumText}>{index + 1}</Text>
                    </View>
                    <Text style={[addS.entryCardTitle, { color: colors.textPrimary }]}>
                      {entry.name.trim() || `Item ${index + 1}`}
                    </Text>
                  </View>
                  {entries.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setEntries((p) => p.filter((_, i) => i !== index))}
                      style={addS.removeBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </LinearGradient>

                <View style={addS.entryBody}>

                  {/* Item Details */}
                  <FormSection title="Item Details" icon="cube-outline" colors={colors} />

                  <FormField label="Item Name" required>
                    <View style={[addS.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Ionicons name="create-outline" size={16} color={colors.textMuted} style={addS.inputIcon} />
                      <TextInput
                        style={[addS.input, { color: colors.textPrimary }]}
                        value={entry.name}
                        onChangeText={(v) => updateEntry(index, "name", v)}
                        placeholder="e.g. Mama Gold Rice 50kg"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </FormField>

                  <FormField label="Category">
                    <ChipSelector
                      options={CATEGORIES}
                      value={entry.category}
                      onChange={(v) => updateEntry(index, "category", v)}
                      colors={colors}
                      customPlaceholder="e.g. Stationery, Hardware..."
                    />
                  </FormField>

                  <View style={addS.rowFields}>
                    <View style={{ flex: 1 }}>
                      <FormField label="Quantity" required>
                        <View style={[addS.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                          <Ionicons name="layers-outline" size={16} color={colors.textMuted} style={addS.inputIcon} />
                          <TextInput
                            style={[addS.input, { color: colors.textPrimary }]}
                            value={entry.qty}
                            onChangeText={(v) => updateEntry(index, "qty", v)}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                          />
                        </View>
                      </FormField>
                    </View>

                    <View style={{ flex: 1 }}>
                      <FormField label="Date Entered">
                        <TouchableOpacity
                          style={[addS.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}
                          onPress={() => setDatePickerIndex(index)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} style={addS.inputIcon} />
                          <Text style={[addS.input, { color: colors.textPrimary, lineHeight: 46 }]} numberOfLines={1}>
                            {entry.dateEntered.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                          </Text>
                        </TouchableOpacity>
                      </FormField>
                    </View>
                  </View>

                  <FormField label="Unit">
                    <ChipSelector
                      options={UNIT_PRESETS}
                      value={entry.unit}
                      onChange={(v) => updateEntry(index, "unit", v)}
                      colors={colors}
                      customPlaceholder="e.g. dozen, roll, pack..."
                    />
                  </FormField>

                  {/* Pricing */}
                  <FormSection title="Pricing" icon="pricetag-outline" colors={colors} />

                  <View style={addS.rowFields}>
                    <View style={{ flex: 1 }}>
                      <FormField label="Cost Price (₦)">
                        <View style={[addS.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                          <Text style={[addS.inputPrefix, { color: colors.textMuted }]}>₦</Text>
                          <TextInput
                            style={[addS.input, { color: colors.textPrimary }]}
                            value={entry.costPrice}
                            onChangeText={(v) => updateEntry(index, "costPrice", v)}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                          />
                        </View>
                      </FormField>
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Selling Price (₦)">
                        <View style={[addS.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                          <Text style={[addS.inputPrefix, { color: colors.textMuted }]}>₦</Text>
                          <TextInput
                            style={[addS.input, { color: colors.textPrimary }]}
                            value={entry.sellingPrice}
                            onChangeText={(v) => updateEntry(index, "sellingPrice", v)}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                          />
                        </View>
                      </FormField>
                    </View>
                  </View>

                  {/* Margin Preview */}
                  {profitPct !== null && sellNum > 0 && (
                    <View style={[
                      addS.marginCard,
                      { backgroundColor: profitAmt >= 0 ? "#ECFDF5" : "#FEF2F2" },
                    ]}>
                      <View style={[
                        addS.marginIconWrap,
                        { backgroundColor: profitAmt >= 0 ? "#D1FAE5" : "#FECACA" },
                      ]}>
                        <Ionicons
                          name={profitAmt >= 0 ? "trending-up" : "trending-down"}
                          size={16}
                          color={profitAmt >= 0 ? "#10B981" : "#EF4444"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[addS.marginTitle, { color: profitAmt >= 0 ? "#065F46" : "#991B1B" }]}>
                          {profitAmt >= 0 ? "Profit" : "Loss"} Margin: {profitPct}%
                        </Text>
                        <Text style={[addS.marginSub, { color: profitAmt >= 0 ? "#059669" : "#EF4444" }]}>
                          {formatNaira(Math.abs(profitAmt))} {profitAmt >= 0 ? "gain" : "loss"} per {entry.unit || "unit"}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Add More */}
          <TouchableOpacity
            style={[addS.addMoreBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "08" }]}
            onPress={() => setEntries((p) => [...p, emptyEntry()])}
            disabled={loading}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[addS.addMoreText, { color: colors.primary }]}>Add Another Item</Text>
          </TouchableOpacity>

          {/* Info card */}
          <View style={[addS.infoCard, { backgroundColor: colors.primary + "0E" }]}>
            <View style={[addS.infoIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[addS.infoText, { color: colors.textSecondary }]}>
              Low-stock alerts appear on your Home screen when quantity drops below 5 items.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[addS.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.primary, colors.primary + "DD"]}
              style={addS.submitGrad}
            >
              <Ionicons name={loading ? "hourglass-outline" : "checkmark-circle-outline"} size={20} color="#fff" />
              <Text style={addS.submitText}>{loading ? "Saving..." : `Save ${entries.length} Item${entries.length !== 1 ? "s" : ""}`}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 48 }} />
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

const addS = StyleSheet.create({
  headerGrad: { paddingBottom: 16 },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  headerMid: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1, fontWeight: "500" },
  draftBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: D.radius.full,
  },
  draftBtnText: { fontSize: 13, fontWeight: "700" },
  scroll: { padding: 16, gap: 12 },
  entryCard: {
    borderRadius: D.radius.xl, overflow: "hidden",
  },
  entryCardHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  entryCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  entryNum: {
    width: 24, height: 24, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  entryNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  entryCardTitle: { fontSize: 15, fontWeight: "700", maxWidth: SCREEN_WIDTH - 140 },
  removeBtn: {
    width: 34, height: 34, borderRadius: D.radius.full,
    backgroundColor: "#FEF2F2",
    alignItems: "center", justifyContent: "center",
  },
  entryBody: { padding: 16, gap: 14 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  sectionIcon: {
    width: 26, height: 26, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.1 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: D.radius.md,
    height: 46, paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  inputPrefix: { fontSize: 15, fontWeight: "700", marginRight: 6 },
  input: { flex: 1, fontSize: 14, fontWeight: "500", height: 46 },
  rowFields: { flexDirection: "row", gap: 10 },
  marginCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: D.radius.lg, padding: 14,
  },
  marginIconWrap: {
    width: 36, height: 36, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
  },
  marginTitle: { fontSize: 13, fontWeight: "700" },
  marginSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  addMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 52, borderRadius: D.radius.xl, borderWidth: 1.5,
  },
  addMoreText: { fontSize: 15, fontWeight: "700" },
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: D.radius.lg, padding: 14,
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  infoText: { fontSize: 12, lineHeight: 18, flex: 1, fontWeight: "500" },
  submitBtn: { borderRadius: D.radius.xl, overflow: "hidden" },
  submitGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});