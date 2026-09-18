import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, KeyboardAvoidingView, Platform,
  Modal, ScrollView, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../src/store/authStore";
import { useExpenseStore } from "../../src/store/expenseStore";
import { expenseDb } from "../../src/database/expenseDb";
import { Expense, ApiResponse } from "../../src/types";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNairaCompact as formatNaira } from "../../src/utils/formatters";
import { EXPENSE_CATEGORIES } from "../../src/constants/categories";
import { VoiceInput } from "../../src/components/common/VoiceInput";
import { OfflineBanner } from "../../src/components/common/OfflineBanner";
import { UpgradePromptModal } from "../../src/components/common/UpgradePromptModal";
import { checkExpensesLimit, recordExpenseUsage } from "../../src/utils/usageLimits";
import { saveErrorMessage } from "../../src/utils/errorMessages";
import { useUIStore } from "../../src/store/uiStore";
import api from "../../src/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month" | "all";
type CategoryFilter = "all" | string;

interface ExpenseItem {
  description: string;
  amount: string;
  category: string;
}

interface ParsedExpense {
  description: string;
  amount: number;
  category: string;
  confidence: number;
}

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "7 Days" },
  { key: "month", label: "30 Days" },
  { key: "all",   label: "All" },
];

const CATEGORY_ICONS: Record<string, { icon: string; color: string }> = {
  stock_purchase:  { icon: "cart-outline",      color: "#1B4332" },
  transportation:  { icon: "car-outline",        color: "#1E3A5F" },
  market_levy:     { icon: "business-outline",   color: "#7F3D17" },
  shop_rent:       { icon: "home-outline",        color: "#92400E" },
  labor:           { icon: "people-outline",      color: "#4C1D95" },
  utilities:       { icon: "flash-outline",       color: "#1E40AF" },
  communication:   { icon: "call-outline",        color: "#065F46" },
  packaging:       { icon: "cube-outline",        color: "#374151" },
  equipment:       { icon: "construct-outline",   color: "#9D174D" },
  personal:        { icon: "person-outline",      color: "#DC2626" },
  loan_repayment:  { icon: "cash-outline",        color: "#B45309" },
  other:           { icon: "receipt-outline",     color: "#6B7280" },
};

function catIcon(category: string): { icon: string; color: string } {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyItem = (): ExpenseItem => ({ description: "", amount: "", category: "other" });

// ─── Expense Card ─────────────────────────────────────────────────────────────

function ExpenseCard({ expense, colors }: { expense: Expense; colors: ReturnType<typeof useTheme> }) {
  const { icon, color } = catIcon(expense.category);
  const label = EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label ?? "Other";
  const date = new Date(expense.date);
  const dateStr = date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });

  return (
    <View style={[cardStyles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[cardStyles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={cardStyles.info}>
        <Text style={[cardStyles.desc, { color: colors.textPrimary }]} numberOfLines={1}>
          {expense.description}
        </Text>
        <View style={cardStyles.meta}>
          <View style={[cardStyles.catBadge, { backgroundColor: color + "18" }]}>
            <Text style={[cardStyles.catText, { color }]}>{label}</Text>
          </View>
          <Text style={[cardStyles.date, { color: colors.textMuted }]}>{dateStr}</Text>
          <View style={[cardStyles.syncDot, { backgroundColor: expense.syncStatus === "pending" ? "#F59E0B" : "#10B981" }]} />
        </View>
      </View>
      <Text style={cardStyles.amount}>{formatNaira(expense.amount)}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, padding: 14, marginBottom: 8,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  desc: { fontSize: 13, fontWeight: "700", marginBottom: 5 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catText: { fontSize: 10, fontWeight: "700" },
  date: { fontSize: 11 },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  amount: { fontSize: 14, fontWeight: "800", color: "#DC2626" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const { addExpense, parseText } = useExpenseStore();
  const planId = user?.subscription?.plan ?? "free";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(false);

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "voice">("manual");
  const [items, setItems] = useState<ExpenseItem[]>([emptyItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedExpense | null>(null);
  const [transcript, setTranscript] = useState("");

  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeUsed, setUpgradeUsed] = useState(0);
  const [upgradeLimit, setUpgradeLimit] = useState(0);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const today = toYMD(new Date());
      let data: Expense[];
      if (period === "today") {
        data = await expenseDb.getByDate(user._id, today);
      } else if (period === "week") {
        const start = new Date(); start.setDate(start.getDate() - 6);
        data = await expenseDb.getByDateRange(user._id, toYMD(start), today);
      } else if (period === "month") {
        const start = new Date(); start.setDate(start.getDate() - 29);
        data = await expenseDb.getByDateRange(user._id, toYMD(start), today);
      } else {
        data = await expenseDb.getRecent(user._id, 200);
      }
      setExpenses(data);
    } finally {
      setLoading(false);
    }
  }, [user?._id, period]);

  const loadRef = useRef(load);
  React.useEffect(() => { loadRef.current = load; }, [load]);

  useFocusEffect(useCallback(() => {
    loadRef.current();
    const uid = user?._id;
    const { isOnline } = useUIStore.getState();
    if (uid && isOnline) {
      const start = new Date(); start.setDate(start.getDate() - 29);
      const s = toYMD(start);
      const e = toYMD(new Date());
      api.get<ApiResponse<Expense[]>>("/expenses", {
        params: { startDate: `${s}T00:00:00.000Z`, endDate: `${e}T23:59:59.999Z`, limit: 200 },
      }).then((r) => expenseDb.upsertFromServer(uid, r.data.data).then(() => loadRef.current())).catch(() => {});
    }
  }, []));

  React.useEffect(() => { load(); }, [load]);

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = catFilter === "all"
    ? expenses
    : expenses.filter((e) => e.category === catFilter);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  // ── Add modal helpers ───────────────────────────────────────────────────────

  const resetModal = () => {
    setItems([emptyItem()]);
    setParsedResult(null);
    setTranscript("");
    setAddMode("manual");
  };

  const openAdd = () => { resetModal(); setShowAdd(true); };
  const closeAdd = () => { setShowAdd(false); resetModal(); };

  const updateItem = (i: number, field: keyof ExpenseItem, val: string) =>
    setItems((prev) => prev.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    setIsParsing(true);
    try {
      const result = await parseText(text) as ParsedExpense;
      setParsedResult(result);
      setItems([{ description: result.description, amount: result.amount.toString(), category: result.category }]);
    } catch {
      Alert.alert("Couldn't Parse", "Couldn't understand that. Try manual entry.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    const valid = items.filter((i) => i.description.trim() && Number(i.amount) > 0);
    if (!valid.length) {
      Alert.alert("", "Add at least one expense with description and amount.");
      return;
    }
    const limitCheck = await checkExpensesLimit(user._id, planId);
    const isLimited = limitCheck.limit !== -1;
    const remaining = isLimited ? limitCheck.limit - limitCheck.used : Infinity;
    if (!limitCheck.allowed || (isLimited && valid.length > remaining)) {
      setUpgradeUsed(limitCheck.used); setUpgradeLimit(limitCheck.limit);
      setUpgradeVisible(true); return;
    }
    setIsSaving(true);
    try {
      for (const item of valid) {
        await addExpense({
          date: new Date().toISOString(),
          description: item.description.trim(),
          amount: Number(item.amount),
          category: item.category,
          rawInput: transcript || undefined,
          userId: user._id,
        });
        await recordExpenseUsage(user._id);
      }
      closeAdd();
      load();
    } catch (err) {
      Alert.alert("Save Failed", saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const s = makeStyles(colors);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <OfflineBanner />

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Expenses</Text>
      </View>

      {/* ── Summary Card ── */}
      <LinearGradient
        colors={["#7F1D1D", "#DC2626"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.heroCard}
      >
        <View style={s.heroCircle1} />
        <View style={s.heroCircle2} />
        <Text style={s.heroLabel}>TOTAL EXPENSES</Text>
        <Text style={s.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatNaira(total)}
        </Text>
        <Text style={s.heroSub}>
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          {catFilter !== "all"
            ? ` · ${EXPENSE_CATEGORIES.find((c) => c.value === catFilter)?.label}`
            : ""}
        </Text>
      </LinearGradient>

      {/* ── Period Tabs ── */}
      <View style={s.periodRow}>
        {PERIOD_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.periodTab, period === t.key && s.periodTabActive]}
            onPress={() => setPeriod(t.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.periodTabText, period === t.key && s.periodTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Category Filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catScroll}
        style={{ flexShrink: 0 }}
      >
        <TouchableOpacity
          style={[s.catChip, catFilter === "all" && s.catChipActive]}
          onPress={() => setCatFilter("all")}
        >
          <Text style={[s.catChipText, catFilter === "all" && s.catChipTextActive]}>All</Text>
        </TouchableOpacity>
        {EXPENSE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[s.catChip, catFilter === cat.value && s.catChipActive]}
            onPress={() => setCatFilter(cat.value)}
          >
            <Text style={[s.catChipText, catFilter === cat.value && s.catChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.localId || e._id}
        renderItem={({ item }) => <ExpenseCard expense={item} colors={colors} />}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="receipt-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No expenses yet</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>
                Tap + to record your first expense
              </Text>
            </View>
          ) : null
        }
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={s.fab} onPress={openAdd} activeOpacity={0.85}>
        <LinearGradient colors={["#DC2626", "#7F1D1D"]} style={s.fabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Add Expense Modal ── */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={closeAdd}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={closeAdd} />
          <View style={[s.modalSheet, { backgroundColor: colors.background }]}>
            {/* Handle */}
            <View style={[s.handle, { backgroundColor: colors.border }]} />

            {/* Modal Header */}
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Record Expense</Text>
              <TouchableOpacity onPress={closeAdd} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Voice / Manual toggle */}
            <View style={[s.modeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(["manual", "voice"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[s.modeBtn, addMode === m && s.modeBtnActive]}
                  onPress={() => { setAddMode(m); if (m === "manual") { setParsedResult(null); setTranscript(""); } }}
                >
                  <Text style={[s.modeBtnText, { color: addMode === m ? "#fff" : colors.textMuted }]}>
                    {m === "voice" ? "🎙 Voice" : "Manual"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Voice Input */}
              {addMode === "voice" && !parsedResult && !isParsing && (
                <VoiceInput
                  onTranscript={handleTranscript}
                  hint={"e.g. \"Transport cost 2000\" or \"Market levy 500\""}
                />
              )}
              {isParsing && (
                <View style={s.parsing}>
                  <Text style={[s.parsingText, { color: colors.textSecondary }]}>Parsing your expense...</Text>
                </View>
              )}

              {/* Form Items */}
              {(addMode === "manual" || parsedResult) && (
                <>
                  {parsedResult && (
                    <Text style={s.parsedBadge}>
                      ✅ {Math.round(parsedResult.confidence * 100)}% confidence · "{transcript}"
                    </Text>
                  )}

                  {items.map((item, idx) => (
                    <View key={idx} style={[s.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {items.length > 1 && (
                        <View style={s.itemCardTop}>
                          <Text style={[s.itemCardLabel, { color: colors.textSecondary }]}>Expense {idx + 1}</Text>
                          <TouchableOpacity onPress={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                            <Ionicons name="trash-outline" size={15} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      )}

                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Description *</Text>
                      <TextInput
                        style={[s.field, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                        value={item.description}
                        onChangeText={(v) => updateItem(idx, "description", v)}
                        placeholder="e.g. Transport to market"
                        placeholderTextColor={colors.textMuted}
                      />

                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Amount (₦) *</Text>
                      <TextInput
                        style={[s.field, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary, marginBottom: 10 }]}
                        value={item.amount}
                        onChangeText={(v) => updateItem(idx, "amount", v)}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                      />

                      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingBottom: 4 }}>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <TouchableOpacity
                            key={cat.value}
                            style={[s.catChip, item.category === cat.value && s.catChipActive, { marginBottom: 0 }]}
                            onPress={() => updateItem(idx, "category", cat.value)}
                          >
                            <Text style={[s.catChipText, item.category === cat.value && s.catChipTextActive]}>
                              {cat.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {Number(item.amount) > 0 && (
                        <Text style={s.itemSubtotal}>{formatNaira(Number(item.amount))}</Text>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={s.addMore}
                    onPress={() => setItems((p) => [...p, emptyItem()])}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#DC2626" />
                    <Text style={s.addMoreText}>Add Another Expense</Text>
                  </TouchableOpacity>

                  {items.length > 1 && (
                    <View style={[s.totalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[s.totalLabel, { color: colors.textSecondary }]}>Total</Text>
                      <Text style={s.totalAmt}>
                        {formatNaira(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0))}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Submit */}
              {(addMode === "manual" || parsedResult) && (
                <TouchableOpacity
                  style={[s.submitBtn, isSaving && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#DC2626", "#7F1D1D"]} style={s.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={s.submitText}>{isSaving ? "Saving…" : "Save Expense"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {parsedResult && addMode === "voice" && (
                <TouchableOpacity
                  style={s.retryBtn}
                  onPress={() => { setParsedResult(null); setTranscript(""); }}
                >
                  <Text style={[s.retryText, { color: colors.textMuted }]}>Try Again</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <UpgradePromptModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        feature="expenses"
        used={upgradeUsed}
        limit={upgradeLimit}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
    headerTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },

    // Hero card
    heroCard: {
      marginHorizontal: 20, marginVertical: 12,
      borderRadius: 24, padding: 20, overflow: "hidden",
      ...Platform.select({
        ios: { shadowColor: "#DC2626", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16 },
        android: { elevation: 6 },
      }),
    },
    heroCircle1: {
      position: "absolute", width: 130, height: 130, borderRadius: 65,
      backgroundColor: "rgba(255,255,255,0.07)", top: -35, right: -25,
    },
    heroCircle2: {
      position: "absolute", width: 80, height: 80, borderRadius: 40,
      backgroundColor: "rgba(255,255,255,0.05)", bottom: -20, left: 20,
    },
    heroLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginBottom: 6 },
    heroAmount: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginBottom: 6 },
    heroSub: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "500" },

    // Period tabs
    periodRow: {
      flexDirection: "row", marginHorizontal: 20, marginBottom: 10,
      backgroundColor: colors.surface, borderRadius: 12, padding: 3,
      borderWidth: 1, borderColor: colors.border,
    },
    periodTab: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center" },
    periodTabActive: { backgroundColor: colors.primary },
    periodTabText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
    periodTabTextActive: { color: "#fff" },

    // Category chips
    catScroll: { paddingHorizontal: 20, paddingBottom: 10, gap: 6, flexDirection: "row" },
    catChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    catChipActive: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
    catChipText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
    catChipTextActive: { color: "#fff" },

    // List
    list: { paddingHorizontal: 20, paddingBottom: 100 },

    // Empty state
    empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
    emptyIcon: {
      width: 64, height: 64, borderRadius: 20,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, marginBottom: 4,
    },
    emptyTitle: { fontSize: 15, fontWeight: "700" },
    emptySub: { fontSize: 13, textAlign: "center" },

    // FAB
    fab: {
      position: "absolute", bottom: 28, right: 24,
      ...Platform.select({
        ios: { shadowColor: "#DC2626", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
        android: { elevation: 8 },
      }),
    },
    fabGrad: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    modalSheet: {
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: 12, maxHeight: "88%",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20 },
        android: { elevation: 16 },
      }),
    },
    handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
    modalHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 17, fontWeight: "800" },
    modeRow: {
      flexDirection: "row", marginHorizontal: 20, marginTop: 14,
      borderRadius: 12, padding: 3, borderWidth: 1,
    },
    modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
    modeBtnActive: { backgroundColor: colors.primary },
    modeBtnText: { fontSize: 13, fontWeight: "700" },
    modalBody: { padding: 20, paddingTop: 16 },

    // Form
    itemCard: {
      borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1,
    },
    itemCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    itemCardLabel: { fontSize: 12, fontWeight: "600" },
    fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
    field: {
      borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 15, marginBottom: 10,
    },
    itemSubtotal: { fontSize: 13, fontWeight: "700", color: "#DC2626", textAlign: "right", marginTop: 8 },
    addMore: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingVertical: 12 },
    addMoreText: { color: "#DC2626", fontWeight: "600", fontSize: 14 },
    totalRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1,
    },
    totalLabel: { fontSize: 13, fontWeight: "600" },
    totalAmt: { fontSize: 17, fontWeight: "800", color: "#DC2626" },

    // Submit
    submitBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 10 },
    submitGrad: { paddingVertical: 16, alignItems: "center" },
    submitText: { fontSize: 15, fontWeight: "800", color: "#fff" },
    retryBtn: { alignItems: "center", paddingVertical: 10 },
    retryText: { fontSize: 14, fontWeight: "600" },

    // Parsed
    parsing: { alignItems: "center", paddingVertical: 40 },
    parsingText: { fontSize: 14 },
    parsedBadge: { fontSize: 12, fontWeight: "600", color: "#059669", marginBottom: 14, lineHeight: 18 },
  });
