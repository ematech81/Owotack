




import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput,
  FlatList, TouchableOpacity, RefreshControl,
  Modal, Pressable, ScrollView, Platform,
  Animated, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../src/store/authStore";
import { salesDb } from "../../src/database/salesDb";
import { expenseDb } from "../../src/database/expenseDb";
import { Sale, Expense } from "../../src/types";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira } from "../../src/utils/formatters";
import { draftStorage } from "../../src/utils/draft";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type SalesDraftData =
  | { mode: "manual"; items: Array<{ productName?: string; quantity?: number; unitPrice?: number; unit?: string }>; paymentType: string }
  | { mode: "voice"; transcript: string; parsedResult: { items: Array<{ productName: string; totalAmount: number }>; totalAmount: number } };

type LedgerEntry =
  | { kind: "sale"; data: Sale; key: string }
  | { kind: "expense"; data: Expense; key: string }
  | { kind: "sales_draft"; data: SalesDraftData; savedAt: string; key: string };

type LedgerFilter = "all" | "cash" | "transfer" | "pos" | "credit" | "draft";

const LEDGER_FILTERS: { key: LedgerFilter; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "cash", label: "Cash", icon: "cash-outline" },
  { key: "transfer", label: "Transfer", icon: "swap-horizontal-outline" },
  { key: "pos", label: "POS", icon: "card-outline" },
  { key: "credit", label: "Credit", icon: "time-outline" },
  { key: "draft", label: "Draft", icon: "create-outline" },
];

// ─── Design Tokens ────────────────────────────────────────────────────────────

const DESIGN = {
  radius: {
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
    full: 999,
  },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    medium: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
    strong: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.18,
      shadowRadius: 32,
      elevation: 14,
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayYMD = toYMD(new Date());

function labelForDate(ymd: string | null): string {
  if (!ymd) return "All Dates";
  if (ymd === todayYMD) return "Today";
  const d = new Date(ymd + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (toYMD(yesterday) === ymd) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatMeta(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Payment Type Config ──────────────────────────────────────────────────────

const PAYMENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  cash:     { color: "#059669", bg: "#D1FAE5", icon: "cash-outline" },
  transfer: { color: "#2563EB", bg: "#DBEAFE", icon: "swap-horizontal-outline" },
  pos:      { color: "#7C3AED", bg: "#EDE9FE", icon: "card-outline" },
  credit:   { color: "#D97706", bg: "#FEF3C7", icon: "time-outline" },
};

const getPaymentConfig = (type?: string) =>
  PAYMENT_CONFIG[type?.toLowerCase() ?? ""] ?? { color: "#6B7280", bg: "#F3F4F6", icon: "ellipsis-horizontal" };

// ─── Calendar Modal ───────────────────────────────────────────────────────────

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface CalendarProps {
  visible: boolean;
  selected: string | null;
  onSelect: (ymd: string | null) => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>;
}

function CalendarModal({ visible, selected, onSelect, onClose, colors }: CalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const last = new Date(cursor.year, cursor.month + 1, 0);
    const cells: (number | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const prevMonth = () =>
    setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });

  const nextMonth = () => {
    const nextIsAfterToday =
      cursor.year > today.getFullYear() ||
      (cursor.year === today.getFullYear() && cursor.month >= today.getMonth());
    if (nextIsAfterToday) return;
    setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
  };

  const isFuture = (day: number) => {
    const d = new Date(cursor.year, cursor.month, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d > t;
  };

  const isSelected = (day: number) =>
    selected === toYMD(new Date(cursor.year, cursor.month, day));

  const isToday = (day: number) =>
    toYMD(new Date(cursor.year, cursor.month, day)) === todayYMD;

  const canGoNext =
    cursor.year < today.getFullYear() ||
    (cursor.year === today.getFullYear() && cursor.month < today.getMonth());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={calStyles.overlay} onPress={onClose}>
        <Pressable style={[calStyles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>

          {/* Drag handle */}
          <View style={calStyles.handle} />

          {/* Header */}
          <View style={calStyles.header}>
            <View>
              <Text style={[calStyles.title, { color: colors.textPrimary }]}>
                {MONTHS[cursor.month]} {cursor.year}
              </Text>
              <Text style={[calStyles.subtitle, { color: colors.textMuted }]}>Select a date</Text>
            </View>
            <View style={calStyles.navRow}>
              <TouchableOpacity onPress={prevMonth} style={[calStyles.navBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} style={[calStyles.navBtn, { backgroundColor: colors.background }]} disabled={!canGoNext}>
                <Ionicons name="chevron-forward" size={18} color={canGoNext ? colors.textPrimary : colors.border} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Day labels */}
          <View style={calStyles.dayLabels}>
            {DAYS.map((d) => (
              <Text key={d} style={[calStyles.dayLabel, { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

          {/* Divider */}
          <View style={[calStyles.divider, { backgroundColor: colors.border }]} />

          {/* Grid */}
          <View style={calStyles.grid}>
            {grid.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={calStyles.cell} />;
              const future = isFuture(day);
              const sel = isSelected(day);
              const tod = isToday(day);
              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  style={[
                    calStyles.cell,
                    sel && { backgroundColor: colors.primary, borderRadius: DESIGN.radius.full },
                    tod && !sel && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: DESIGN.radius.full },
                  ]}
                  onPress={() => {
                    if (future) return;
                    onSelect(toYMD(new Date(cursor.year, cursor.month, day)));
                    onClose();
                  }}
                  disabled={future}
                >
                  <Text style={[
                    calStyles.dayNum,
                    { color: colors.textPrimary },
                    future && { color: colors.border },
                    tod && !sel && { color: colors.primary, fontWeight: "700" },
                    sel && { color: "#fff", fontWeight: "700" },
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={[calStyles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => { onSelect(null); onClose(); }}
              style={[calStyles.footerBtn, { backgroundColor: colors.background }]}
            >
              <Ionicons name="refresh-outline" size={15} color={colors.textSecondary} />
              <Text style={[calStyles.footerBtnText, { color: colors.textSecondary }]}>All Dates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onSelect(todayYMD); onClose(); }}
              style={[calStyles.footerBtnPrimary, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="today-outline" size={15} color="#fff" />
              <Text style={calStyles.footerBtnPrimaryText}>Today</Text>
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: DESIGN.radius.xl,
    borderTopRightRadius: DESIGN.radius.xl,
    padding: 24,
    paddingBottom: 36,
    ...DESIGN.shadow.strong,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2 },
  navRow: { flexDirection: "row", gap: 8 },
  navBtn: {
    width: 36, height: 36,
    borderRadius: DESIGN.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabels: { flexDirection: "row", marginBottom: 8 },
  dayLabel: {
    flex: 1, textAlign: "center",
    fontSize: 11, fontWeight: "700", letterSpacing: 0.5,
  },
  divider: { height: 1, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: { fontSize: 14, fontWeight: "500" },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: DESIGN.radius.lg,
  },
  footerBtnText: { fontSize: 14, fontWeight: "600" },
  footerBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: DESIGN.radius.lg,
  },
  footerBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

// ─── Transaction Row ──────────────────────────────────────────────────────────

interface TransactionRowProps {
  item: LedgerEntry;
  colors: ReturnType<typeof useTheme>;
}

function TransactionRow({ item, colors }: TransactionRowProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  // ── Draft ──────────────────────────────────────────────────────────────────
  if (item.kind === "sales_draft") {
    const draft = item.data;
    let draftName = "Draft Sale";
    let draftTotal = 0;
    let extraCount = 0;

    if (draft.mode === "manual") {
      draftName = draft.items[0]?.productName || "Draft Sale";
      extraCount = Math.max(0, draft.items.length - 1);
      draftTotal = draft.items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
    } else {
      draftName = draft.parsedResult.items[0]?.productName || "Draft Sale";
      extraCount = Math.max(0, draft.parsedResult.items.length - 1);
      draftTotal = draft.parsedResult.totalAmount;
    }

    const displayName = extraCount > 0 ? `${draftName} +${extraCount} more` : draftName;

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={() => router.navigate("/(tabs)/sales" as any)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={1}
        >
          <View style={[rowStyles.card, { backgroundColor: colors.surface }, DESIGN.shadow.soft]}>
            {/* Top stripe for draft */}
            <View style={[rowStyles.draftStripe]} />

            <View style={rowStyles.inner}>
              {/* Icon */}
              <View style={[rowStyles.iconWrap, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="create-outline" size={20} color="#D97706" />
              </View>

              {/* Content */}
              <View style={rowStyles.content}>
                <View style={rowStyles.topRow}>
                  <View style={[rowStyles.tag, { backgroundColor: "#FEF3C7" }]}>
                    <Text style={[rowStyles.tagText, { color: "#D97706" }]}>DRAFT</Text>
                  </View>
                  <View style={rowStyles.tapHint}>
                    <Text style={rowStyles.tapHintText}>Tap to continue →</Text>
                  </View>
                </View>
                <Text style={[rowStyles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <View style={rowStyles.metaRow}>
                  <Ionicons name={draft.mode === "voice" ? "mic-outline" : "list-outline"} size={11} color={colors.textMuted} />
                  <Text style={[rowStyles.meta, { color: colors.textMuted }]}>
                    {draft.mode} · {formatMeta(item.savedAt)}
                  </Text>
                </View>
              </View>

              {/* Amount */}
              <View style={rowStyles.amountCol}>
                {draftTotal > 0 && (
                  <Text style={[rowStyles.amount, { color: "#D97706" }]}>
                    {formatNaira(draftTotal)}
                  </Text>
                )}
                <View style={[rowStyles.unsavedBadge]}>
                  <Text style={rowStyles.unsavedBadgeText}>Unsaved</Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Sale / Expense ─────────────────────────────────────────────────────────
  const isSale = item.kind === "sale";
  const sale = isSale ? (item.data as Sale) : null;
  const expense = !isSale ? (item.data as Expense) : null;
  const dateStr = isSale
    ? (sale!.createdAt ?? sale!.date)
    : (expense!.createdAt ?? expense!.date);

  const paymentType = isSale ? sale!.paymentType?.toLowerCase() : undefined;
  const payConfig = getPaymentConfig(paymentType);

  const isSynced = item.data.syncStatus !== "pending";

  const accentColor = isSale ? colors.primary : "#EF4444";
  const iconBg = isSale ? "#ECFDF5" : "#FEF2F2";
  const amountPrefix = isSale ? "+" : "-";
  const amount = isSale ? sale!.totalAmount : expense!.amount;

  const displayName = isSale
    ? `${sale!.items[0]?.productName ?? "Sale"}${sale!.items.length > 1 ? ` +${sale!.items.length - 1}` : ""}`
    : expense!.description;

  const metaLabel = isSale ? sale!.paymentType : expense!.category;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={isSale ? () => router.push({ pathname: "/receipt", params: { saleId: sale!.localId } }) : undefined}
        activeOpacity={isSale ? 0.85 : 1}
      >
        <View style={[rowStyles.card, { backgroundColor: colors.surface }, DESIGN.shadow.soft]}>
          <View style={[rowStyles.accentBar, { backgroundColor: accentColor }]} />

          <View style={rowStyles.inner}>
            {/* Icon */}
            <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
              <Ionicons
                name={isSale ? "bag-handle-outline" : "receipt-outline"}
                size={20}
                color={accentColor}
              />
            </View>

            {/* Content */}
            <View style={rowStyles.content}>
              <View style={rowStyles.topRow}>
                {/* Type tag */}
                <View style={[rowStyles.tag, { backgroundColor: isSale ? "#ECFDF5" : "#FEF2F2" }]}>
                  <Text style={[rowStyles.tagText, { color: accentColor }]}>
                    {isSale ? "SALE" : "EXPENSE"}
                  </Text>
                </View>

                {/* Payment type chip (for sales) */}
                {isSale && paymentType && (
                  <View style={[rowStyles.payChip, { backgroundColor: payConfig.bg }]}>
                    <Ionicons name={payConfig.icon as any} size={9} color={payConfig.color} />
                    <Text style={[rowStyles.payChipText, { color: payConfig.color }]}>
                      {paymentType.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[rowStyles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {displayName}
              </Text>

              <View style={rowStyles.metaRow}>
                <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                <Text style={[rowStyles.meta, { color: colors.textMuted }]}>
                  {formatDateLabel(dateStr)} · {formatMeta(dateStr)}
                </Text>
              </View>

              {/* Sync badge */}
              <View style={rowStyles.badgeRow}>
                <View style={[
                  rowStyles.syncBadge,
                  { backgroundColor: isSynced ? "#F0FDF4" : "#EEF2FF" },
                ]}>
                  <Ionicons
                    name={isSynced ? "cloud-done-outline" : "time-outline"}
                    size={10}
                    color={isSynced ? "#16A34A" : "#6366F1"}
                  />
                  <Text style={[
                    rowStyles.syncBadgeText,
                    { color: isSynced ? "#16A34A" : "#6366F1" },
                  ]}>
                    {isSynced ? "Synced" : "Pending"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Amount + chevron hint for sales */}
            <View style={rowStyles.amountCol}>
              <Text style={[rowStyles.amount, { color: accentColor }]}>
                {amountPrefix}{formatNaira(amount)}
              </Text>
              {isSale && (
                <View style={rowStyles.receiptBtn}>
                  <Ionicons name="document-text-outline" size={12} color="#1A6B3C" />
                  <Text style={rowStyles.receiptBtnText}>Receipt</Text>
                  <Ionicons name="chevron-forward" size={11} color="#1A6B3C" />
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    borderRadius: DESIGN.radius.lg,
    marginBottom: 10,
    overflow: "hidden",
  },
  accentBar: {
    height: 3,
    width: "100%",
  },
  draftStripe: {
    height: 3,
    width: "100%",
    backgroundColor: "#D97706",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 44, height: 44,
    borderRadius: DESIGN.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 3 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: DESIGN.radius.sm,
  },
  tagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  payChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DESIGN.radius.sm,
  },
  payChipText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  name: { fontSize: 14, fontWeight: "700", letterSpacing: -0.1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 11, fontWeight: "500" },
  badgeRow: { flexDirection: "row", gap: 4, marginTop: 2 },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DESIGN.radius.full,
  },
  syncBadgeText: { fontSize: 9, fontWeight: "700" },
  amountCol: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  receiptBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#ECFDF5", paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  receiptBtnText: { fontSize: 10, fontWeight: "700", color: "#1A6B3C" },
  tapHint: {
    marginLeft: "auto",
  },
  tapHintText: {
    fontSize: 10,
    color: "#D97706",
    fontWeight: "600",
  },
  unsavedBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: DESIGN.radius.full,
  },
  unsavedBadgeText: {
    fontSize: 9,
    color: "#D97706",
    fontWeight: "700",
  },
});

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  sales: number;
  expenses: number;
  net: number;
  colors: ReturnType<typeof useTheme>;
}

function SummaryCard({ sales, expenses, net, colors }: SummaryCardProps) {
  const isPositive = net >= 0;

  return (
    <LinearGradient
      colors={isPositive ? ["#1a7a4a", "#22c55e"] : ["#991b1b", "#ef4444"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={summaryStyles.card}
    >
      {/* Decorative circles */}
      <View style={summaryStyles.circle1} />
      <View style={summaryStyles.circle2} />

      <View style={summaryStyles.topRow}>
        <View>
          <Text style={summaryStyles.netLabel}>Net Balance</Text>
          <Text style={summaryStyles.netAmount}>{formatNaira(net)}</Text>
        </View>
        <View style={summaryStyles.netBadge}>
          <Ionicons
            name={isPositive ? "trending-up" : "trending-down"}
            size={16}
            color={isPositive ? "#fff" : "#fff"}
          />
          <Text style={summaryStyles.netBadgeText}>
            {isPositive ? "Profit" : "Loss"}
          </Text>
        </View>
      </View>

      <View style={summaryStyles.divider} />

      <View style={summaryStyles.statsRow}>
        <View style={summaryStyles.stat}>
          <View style={summaryStyles.statIconWrap}>
            <Ionicons name="arrow-up" size={12} color="#fff" />
          </View>
          <View>
            <Text style={summaryStyles.statLabel}>Sales</Text>
            <Text style={summaryStyles.statValue}>{formatNaira(sales)}</Text>
          </View>
        </View>

        <View style={[summaryStyles.statDivider]} />

        <View style={summaryStyles.stat}>
          <View style={[summaryStyles.statIconWrap, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Ionicons name="arrow-down" size={12} color="#fff" />
          </View>
          <View>
            <Text style={summaryStyles.statLabel}>Expenses</Text>
            <Text style={summaryStyles.statValue}>{formatNaira(expenses)}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: DESIGN.radius.xl,
    padding: 20,
    overflow: "hidden",
    ...DESIGN.shadow.medium,
  },
  circle1: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -40,
    right: -30,
  },
  circle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -20,
    left: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  netLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginBottom: 4 },
  netAmount: { fontSize: 28, color: "#fff", fontWeight: "900", letterSpacing: -0.5 },
  netBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DESIGN.radius.full,
  },
  netBadgeText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  statIconWrap: {
    width: 28, height: 28,
    borderRadius: DESIGN.radius.full,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  statValue: { fontSize: 14, color: "#fff", fontWeight: "800" },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 12,
  },
});

// ─── Filter Pills ─────────────────────────────────────────────────────────────

interface FilterPillsProps {
  active: LedgerFilter;
  onChange: (f: LedgerFilter) => void;
  colors: ReturnType<typeof useTheme>;
}

function FilterPills({ active, onChange, colors }: FilterPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pillStyles.container}
      style={pillStyles.scroll}
    >
      {LEDGER_FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[
              pillStyles.pill,
              { backgroundColor: isActive ? colors.primary : colors.surface },
              { borderColor: isActive ? colors.primary : colors.border },
              isActive && DESIGN.shadow.soft,
            ]}
            activeOpacity={0.75}
          >
            <Ionicons
              name={f.icon as any}
              size={14}
              color={isActive ? "#fff" : colors.textMuted}
            />
            <Text style={[pillStyles.label, { color: isActive ? "#fff" : colors.textSecondary }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const pillStyles = StyleSheet.create({
  scroll: { marginBottom: 8, },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DESIGN.radius.full,
    borderWidth: 1.5,
    height: 40,
  },
  label: { fontSize: 13, fontWeight: "600", paddingBottom: 2 },
});

// ─── Date Range Filter Bar ─────────────────────────────────────────────────────

type DatePreset = "all" | "today" | "week" | "month" | "custom";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all",   label: "All" },
  { key: "today", label: "Today" },
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
];

interface FilterBarProps {
  preset: DatePreset;
  onPreset: (p: DatePreset) => void;
  onOpenCalendar: () => void;
  customerQuery: string;
  onCustomerQuery: (q: string) => void;
  count: number;
  colors: ReturnType<typeof useTheme>;
}

function FilterBar({ preset, onPreset, onOpenCalendar, customerQuery, onCustomerQuery, count, colors }: FilterBarProps) {
  return (
    <View style={fbStyles.wrapper}>
      {/* Date presets row */}
      <View style={fbStyles.presetsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fbStyles.presetsScroll}>
          {DATE_PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[fbStyles.presetBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => onPreset(p.key)}
                activeOpacity={0.75}
              >
                <Text style={[fbStyles.presetText, { color: active ? "#fff" : colors.textSecondary }]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              fbStyles.presetBtn,
              preset === "custom" && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={onOpenCalendar}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={13} color={preset === "custom" ? "#fff" : colors.textMuted} />
            <Text style={[fbStyles.presetText, { color: preset === "custom" ? "#fff" : colors.textSecondary }]}>
              Custom
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <View style={[fbStyles.countBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[fbStyles.countText, { color: colors.textMuted }]}>{count}</Text>
        </View>
      </View>

      {/* Customer search */}
      <View style={[fbStyles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="person-outline" size={15} color={colors.textMuted} />
        <TextInput
          style={[fbStyles.searchInput, { color: colors.textPrimary }]}
          placeholder="Filter by customer name..."
          placeholderTextColor={colors.textMuted}
          value={customerQuery}
          onChangeText={onCustomerQuery}
          returnKeyType="search"
        />
        {customerQuery.length > 0 && (
          <TouchableOpacity onPress={() => onCustomerQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const fbStyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  presetsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  presetsScroll: { flexDirection: "row", gap: 6, paddingRight: 8 },
  presetBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: DESIGN.radius.full,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  presetText: { fontSize: 12, fontWeight: "700" },
  countBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: DESIGN.radius.full, borderWidth: 1, marginLeft: "auto" as any,
  },
  countText: { fontSize: 11, fontWeight: "700" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderRadius: DESIGN.radius.lg,
    paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: "500" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  const today = new Date();
  const todayStr = toYMD(today);
  if (preset === "today") return { start: todayStr, end: todayStr };
  if (preset === "week") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { start: toYMD(mon), end: todayStr };
  }
  if (preset === "month") {
    return { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, end: todayStr };
  }
  return null;
}

export default function LedgerScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [calVisible, setCalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>("all");
  const [customerQuery, setCustomerQuery] = useState("");

  const load = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      let sales: Sale[];
      let expenses: Expense[];

      if (datePreset === "custom" && customDate) {
        [sales, expenses] = await Promise.all([
          salesDb.getByDate(user._id, customDate),
          expenseDb.getByDate(user._id, customDate),
        ]);
      } else if (datePreset !== "all") {
        const range = getDateRange(datePreset);
        if (range) {
          [sales, expenses] = await Promise.all([
            salesDb.getByDateRange(user._id, range.start, range.end),
            expenseDb.getByDateRange(user._id, range.start, range.end),
          ]);
        } else {
          [sales, expenses] = await Promise.all([salesDb.getRecent(user._id, 100), expenseDb.getRecent(user._id, 100)]);
        }
      } else {
        [sales, expenses] = await Promise.all([
          salesDb.getRecent(user._id, 100),
          expenseDb.getRecent(user._id, 100),
        ]);
      }

      const showDraft = datePreset === "all" || datePreset === "today";
      const storedDraft = showDraft ? await draftStorage.load<SalesDraftData>(`draft:sales:${user._id}`) : null;
      const draftDateMatch = datePreset !== "today" || (storedDraft && toYMD(new Date(storedDraft.savedAt)) === todayYMD);
      const draftEntries: LedgerEntry[] = storedDraft && draftDateMatch
        ? [{ kind: "sales_draft" as const, data: storedDraft.data, savedAt: storedDraft.savedAt, key: "sales_draft" }]
        : [];

      const getTime = (e: LedgerEntry): number => {
        if (e.kind === "sales_draft") return new Date(e.savedAt).getTime();
        return new Date((e.data as any).createdAt ?? (e.data as any).date).getTime();
      };

      const combined: LedgerEntry[] = [
        ...draftEntries,
        ...sales.map((s) => ({ kind: "sale" as const, data: s, key: `s-${s.localId || s._id}` })),
        ...expenses.map((e) => ({ kind: "expense" as const, data: e, key: `e-${e.localId || e._id}` })),
      ].sort((a, b) => getTime(b) - getTime(a));

      setEntries(combined);
    } finally {
      setLoading(false);
    }
  }, [user?._id, datePreset, customDate]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useFocusEffect(useCallback(() => { loadRef.current(); }, []));
  useEffect(() => { load(); }, [load]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    // Payment type filter
    if (activeFilter === "draft") result = result.filter((e) => e.kind === "sales_draft");
    else if (activeFilter !== "all") result = result.filter(
      (e) => e.kind === "sale" && (e.data as Sale).paymentType === activeFilter
    );
    // Customer name filter
    if (customerQuery.trim()) {
      const q = customerQuery.toLowerCase();
      result = result.filter((e) => {
        if (e.kind !== "sale") return true;
        const name = (e.data as Sale).customerName ?? "";
        return name.toLowerCase().includes(q);
      });
    }
    return result;
  }, [entries, activeFilter, customerQuery]);

  const totals = useMemo(() => {
    let sales = 0, expenses = 0;
    for (const e of filteredEntries) {
      if (e.kind === "sale") sales += (e.data as Sale).totalAmount;
      else if (e.kind === "expense") expenses += (e.data as Expense).amount;
    }
    return { sales, expenses, net: sales - expenses };
  }, [filteredEntries]);

  const hasSummary = filteredEntries.some(e => e.kind !== "sales_draft");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.primary + "18", colors.background]}
        style={screenStyles.heroGradient}
      >
        <View style={screenStyles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[screenStyles.iconBtn, { backgroundColor: colors.surface, ...DESIGN.shadow.soft }]}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={screenStyles.headerMid}>
            <Text style={[screenStyles.heroTitle, { color: colors.textPrimary }]}>
              Transaction Ledger
            </Text>
            <Text style={[screenStyles.heroSub, { color: colors.textMuted }]}>
              {datePreset === "custom" && customDate ? labelForDate(customDate) : datePreset === "all" ? "All dates" : datePreset}
              {" · "}{activeFilter !== "all" ? activeFilter : "all types"}
            </Text>
          </View>

          {/* Refresh btn */}
          <TouchableOpacity
            onPress={load}
            style={[screenStyles.iconBtn, { backgroundColor: colors.surface, ...DESIGN.shadow.soft }]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Summary Card ─────────────────────────────────────────────────────── */}
      {hasSummary && (
        <SummaryCard
          sales={totals.sales}
          expenses={totals.expenses}
          net={totals.net}
          colors={colors}
        />
      )}

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <FilterBar
        preset={datePreset}
        onPreset={(p) => { setDatePreset(p); if (p !== "custom") setCustomDate(null); }}
        onOpenCalendar={() => setCalVisible(true)}
        customerQuery={customerQuery}
        onCustomerQuery={setCustomerQuery}
        count={filteredEntries.length}
        colors={colors}
      />

      {/* ── Payment Filter Pills ──────────────────────────────────────────────── */}
      <FilterPills active={activeFilter} onChange={setActiveFilter} colors={colors} />

      {/* ── Transaction List ──────────────────────────────────────────────────── */}
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <TransactionRow item={item} colors={colors} />}
        contentContainerStyle={screenStyles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={screenStyles.empty}>
              <LinearGradient
                colors={[colors.primary + "15", colors.primary + "05"]}
                style={screenStyles.emptyIconGradient}
              >
                <Ionicons name="receipt-outline" size={40} color={colors.primary} />
              </LinearGradient>
              <Text style={[screenStyles.emptyTitle, { color: colors.textPrimary }]}>
                No Transactions
              </Text>
              <Text style={[screenStyles.emptySub, { color: colors.textMuted }]}>
                {datePreset !== "all"
                  ? `Nothing recorded for this period.`
                  : "Your ledger is empty. Transactions will appear here."}
              </Text>
            </View>
          ) : null
        }
      />

      <CalendarModal
        visible={calVisible}
        selected={customDate}
        onSelect={(ymd) => { setCustomDate(ymd); setDatePreset(ymd ? "custom" : "all"); }}
        onClose={() => setCalVisible(false)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  heroGradient: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: DESIGN.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMid: { alignItems: "center", flex: 1, paddingHorizontal: 8 },
  heroTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  heroSub: { fontSize: 12, marginTop: 2, fontWeight: "500" },
  list: { paddingHorizontal: 16, paddingBottom: 48 },
  empty: { alignItems: "center", paddingTop: 64, gap: 12 },
  emptyIconGradient: {
    width: 90, height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptySub: { fontSize: 14, textAlign: "center", maxWidth: 260, lineHeight: 20 },
});