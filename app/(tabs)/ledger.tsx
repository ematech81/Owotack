

// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   View, Text, StyleSheet,
//   FlatList, TouchableOpacity, RefreshControl,
//   Modal, Pressable,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { router } from "expo-router";
// import { useFocusEffect } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { useAuthStore } from "../../src/store/authStore";
// import { salesDb } from "../../src/database/salesDb";
// import { expenseDb } from "../../src/database/expenseDb";
// import { Sale, Expense } from "../../src/types";
// import { useTheme } from "../../src/hooks/useTheme";
// import { formatNaira } from "../../src/utils/formatters";

// // ─── Types ────────────────────────────────────────────────────────────────────

// type LedgerEntry =
//   | { kind: "sale"; data: Sale; key: string }
//   | { kind: "expense"; data: Expense; key: string };

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const toYMD = (d: Date) =>
//   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// const todayYMD = toYMD(new Date());

// function labelForDate(ymd: string | null): string {
//   if (!ymd) return "All Dates";
//   if (ymd === todayYMD) return "Today";
//   const d = new Date(ymd + "T12:00:00");
//   const yesterday = new Date();
//   yesterday.setDate(yesterday.getDate() - 1);
//   if (toYMD(yesterday) === ymd) return "Yesterday";
//   return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
// }

// function formatMeta(iso: string): string {
//   return new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true });
// }

// // ─── Calendar Modal ───────────────────────────────────────────────────────────

// const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
// const MONTHS = [
//   "January", "February", "March", "April", "May", "June",
//   "July", "August", "September", "October", "November", "December",
// ];

// interface CalendarProps {
//   visible: boolean;
//   selected: string | null;
//   onSelect: (ymd: string | null) => void;
//   onClose: () => void;
//   colors: ReturnType<typeof useTheme>;
// }

// function CalendarModal({ visible, selected, onSelect, onClose, colors }: CalendarProps) {
//   const today = new Date();
//   const [cursor, setCursor] = useState(() => ({
//     year: today.getFullYear(),
//     month: today.getMonth(),
//   }));

//   const s = makeStyles(colors);

//   const grid = useMemo(() => {
//     const first = new Date(cursor.year, cursor.month, 1);
//     const last = new Date(cursor.year, cursor.month + 1, 0);
//     const cells: (number | null)[] = Array(first.getDay()).fill(null);
//     for (let d = 1; d <= last.getDate(); d++) cells.push(d);
//     while (cells.length % 7 !== 0) cells.push(null);
//     return cells;
//   }, [cursor]);

//   const prevMonth = () =>
//     setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });

//   const nextMonth = () => {
//     const nextIsAfterToday =
//       cursor.year > today.getFullYear() ||
//       (cursor.year === today.getFullYear() && cursor.month >= today.getMonth());
//     if (nextIsAfterToday) return;
//     setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
//   };

//   const isFuture = (day: number) => {
//     const d = new Date(cursor.year, cursor.month, day);
//     d.setHours(0, 0, 0, 0);
//     const t = new Date();
//     t.setHours(0, 0, 0, 0);
//     return d > t;
//   };

//   const isSelected = (day: number) =>
//     selected === toYMD(new Date(cursor.year, cursor.month, day));

//   const isToday = (day: number) =>
//     toYMD(new Date(cursor.year, cursor.month, day)) === todayYMD;

//   const canGoNext =
//     cursor.year < today.getFullYear() ||
//     (cursor.year === today.getFullYear() && cursor.month < today.getMonth());

//   return (
//     <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
//       <Pressable style={s.overlay} onPress={onClose}>
//         <Pressable style={s.calBox} onPress={() => {}}>

//           {/* Month navigation */}
//           <View style={s.calHeader}>
//             <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
//               <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
//             </TouchableOpacity>
//             <Text style={s.calMonth}>
//               {MONTHS[cursor.month]} {cursor.year}
//             </Text>
//             <TouchableOpacity onPress={nextMonth} style={s.navBtn} disabled={!canGoNext}>
//               <Ionicons name="chevron-forward" size={20} color={canGoNext ? colors.textPrimary : colors.border} />
//             </TouchableOpacity>
//           </View>

//           {/* Day labels */}
//           <View style={s.dayLabels}>
//             {DAYS.map((d) => (
//               <Text key={d} style={s.dayLabel}>{d}</Text>
//             ))}
//           </View>

//           {/* Day grid */}
//           <View style={s.grid}>
//             {grid.map((day, idx) => {
//               if (!day) return <View key={`e-${idx}`} style={s.cell} />;
//               const future = isFuture(day);
//               const sel = isSelected(day);
//               const tod = isToday(day);
//               return (
//                 <TouchableOpacity
//                   key={`d-${day}`}
//                   style={[s.cell, sel && { backgroundColor: colors.primary, borderRadius: 22 }]}
//                   onPress={() => {
//                     if (future) return;
//                     onSelect(toYMD(new Date(cursor.year, cursor.month, day)));
//                     onClose();
//                   }}
//                   disabled={future}
//                 >
//                   <Text
//                     style={[
//                       s.dayNum,
//                       future && { color: colors.border },
//                       tod && !sel && { color: colors.primary, fontWeight: "700" },
//                       sel && { color: "#fff", fontWeight: "700" },
//                     ]}
//                   >
//                     {day}
//                   </Text>
//                   {tod && !sel && <View style={[s.todayDot, { backgroundColor: colors.primary }]} />}
//                 </TouchableOpacity>
//               );
//             })}
//           </View>

//           {/* Footer */}
//           <View style={s.calFooter}>
//             <TouchableOpacity
//               onPress={() => { onSelect(null); onClose(); }}
//               style={s.clearBtn}
//             >
//               <Text style={[s.clearText, { color: colors.textSecondary }]}>Show All Dates</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               onPress={() => { onSelect(todayYMD); onClose(); }}
//               style={[s.todayBtn, { backgroundColor: colors.primary }]}
//             >
//               <Text style={s.todayBtnText}>Today</Text>
//             </TouchableOpacity>
//           </View>

//         </Pressable>
//       </Pressable>
//     </Modal>
//   );
// }

// // ─── Main Screen ──────────────────────────────────────────────────────────────

// export default function LedgerScreen() {
//   const colors = useTheme();
//   const { user } = useAuthStore();
//   const [entries, setEntries] = useState<LedgerEntry[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedDate, setSelectedDate] = useState<string | null>(null);
//   const [calVisible, setCalVisible] = useState(false);

//   const load = useCallback(async () => {
//     if (!user?._id) return;
//     setLoading(true);
//     try {
//       let sales: Sale[];
//       let expenses: Expense[];

//       if (selectedDate) {
//         [sales, expenses] = await Promise.all([
//           salesDb.getByDate(user._id, selectedDate),
//           expenseDb.getByDate(user._id, selectedDate),
//         ]);
//       } else {
//         [sales, expenses] = await Promise.all([
//           salesDb.getRecent(user._id, 50),
//           expenseDb.getRecent(user._id, 50),
//         ]);
//       }

//       const combined: LedgerEntry[] = [
//         ...sales.map((s) => ({ kind: "sale" as const, data: s, key: `s-${s.localId || s._id}` })),
//         ...expenses.map((e) => ({ kind: "expense" as const, data: e, key: `e-${e.localId || e._id}` })),
//       ].sort((a, b) => {
//         const ta = new Date(a.data.createdAt ?? a.data.date).getTime();
//         const tb = new Date(b.data.createdAt ?? b.data.date).getTime();
//         return tb - ta;
//       });

//       setEntries(combined);
//     } finally {
//       setLoading(false);
//     }
//   }, [user?._id, selectedDate]);

//   const loadRef = useRef(load);
//   useEffect(() => { loadRef.current = load; }, [load]);

//   useFocusEffect(useCallback(() => { loadRef.current(); }, []));
//   useEffect(() => { load(); }, [load]);

//   const totals = useMemo(() => {
//     let sales = 0, expenses = 0;
//     for (const e of entries) {
//       if (e.kind === "sale") sales += (e.data as Sale).totalAmount;
//       else expenses += (e.data as Expense).amount;
//     }
//     return { sales, expenses, net: sales - expenses };
//   }, [entries]);

//   const styles = makeStyles(colors);

//   const renderItem = ({ item }: { item: LedgerEntry }) => {
//     const isSale = item.kind === "sale";
//     const sale = isSale ? (item.data as Sale) : null;
//     const expense = !isSale ? (item.data as Expense) : null;
//     const dateStr = isSale
//       ? (sale!.createdAt ?? sale!.date)
//       : (expense!.createdAt ?? expense!.date);

//     return (
//       <View style={styles.row}>
//         <View style={[styles.rowIcon, { backgroundColor: isSale ? "#E8F5E9" : "#FEE2E2" }]}>
//           <Ionicons
//             name={isSale ? "bag-handle" : "receipt"}
//             size={18}
//             color={isSale ? colors.primary : colors.danger}
//           />
//         </View>
//         <View style={styles.rowInfo}>
//           <Text style={styles.rowName} numberOfLines={1}>
//             {isSale
//               ? `${sale!.items[0]?.productName ?? "Sale"}${sale!.items.length > 1 ? ` +${sale!.items.length - 1} more` : ""}`
//               : expense!.description}
//           </Text>
//           <Text style={styles.rowMeta}>
//             {isSale ? sale!.paymentType : expense!.category}
//             {" • "}{formatMeta(dateStr)}
//             {" • "}{item.data.syncStatus === "pending" ? "⏳" : "✅"}
//           </Text>
//         </View>
//         <Text style={[styles.rowAmount, { color: isSale ? colors.primary : colors.danger }]}>
//           {isSale ? "+" : "-"}{formatNaira(isSale ? sale!.totalAmount : expense!.amount)}
//         </Text>
//       </View>
//     );
//   };

//   return (
//     <SafeAreaView style={styles.safe}>
//       {/* Header */}
//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
//           <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
//         </TouchableOpacity>
//         <Text style={styles.title}>Transaction Ledger</Text>
//         <View style={{ width: 40 }} />
//       </View>

//       {/* Date filter bar */}
//       <View style={styles.filterBar}>
//         <TouchableOpacity
//           style={[styles.dateChip, { borderColor: selectedDate ? colors.primary : colors.border }]}
//           onPress={() => setCalVisible(true)}
//         >
//           <Ionicons
//             name="calendar-outline"
//             size={15}
//             color={selectedDate ? colors.primary : colors.textMuted}
//           />
//           <Text style={[styles.dateChipText, { color: selectedDate ? colors.primary : colors.textSecondary }]}>
//             {labelForDate(selectedDate)}
//           </Text>
//           <Ionicons name="chevron-down" size={13} color={selectedDate ? colors.primary : colors.textMuted} />
//         </TouchableOpacity>

//         {selectedDate && (
//           <TouchableOpacity
//             style={styles.clearChip}
//             onPress={() => setSelectedDate(null)}
//           >
//             <Ionicons name="close-circle" size={16} color={colors.textMuted} />
//           </TouchableOpacity>
//         )}
//       </View>

//       {/* Summary strip */}
//       {entries.length > 0 && (
//         <View style={[styles.summaryStrip, { backgroundColor: colors.surface }]}>
//           <View style={styles.summaryItem}>
//             <Text style={styles.summaryLabel}>Sales</Text>
//             <Text style={[styles.summaryValue, { color: colors.primary }]}>
//               {formatNaira(totals.sales)}
//             </Text>
//           </View>
//           <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
//           <View style={styles.summaryItem}>
//             <Text style={styles.summaryLabel}>Expenses</Text>
//             <Text style={[styles.summaryValue, { color: colors.danger }]}>
//               {formatNaira(totals.expenses)}
//             </Text>
//           </View>
//           <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
//           <View style={styles.summaryItem}>
//             <Text style={styles.summaryLabel}>Net</Text>
//             <Text style={[styles.summaryValue, { color: totals.net >= 0 ? colors.primary : colors.danger }]}>
//               {formatNaira(totals.net)}
//             </Text>
//           </View>
//         </View>
//       )}

//       <FlatList
//         data={entries}
//         keyExtractor={(item) => item.key}
//         renderItem={renderItem}
//         contentContainerStyle={styles.list}
//         showsVerticalScrollIndicator={false}
//         refreshControl={
//           <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
//         }
//         ListEmptyComponent={
//           !loading ? (
//             <View style={styles.empty}>
//               <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
//               <Text style={styles.emptyText}>
//                 {selectedDate ? `No transactions on ${labelForDate(selectedDate)}` : "No transactions yet"}
//               </Text>
//             </View>
//           ) : null
//         }
//       />

//       <CalendarModal
//         visible={calVisible}
//         selected={selectedDate}
//         onSelect={setSelectedDate}
//         onClose={() => setCalVisible(false)}
//         colors={colors}
//       />
//     </SafeAreaView>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────

// const makeStyles = (colors: ReturnType<typeof useTheme>) =>
//   StyleSheet.create({
//     safe: { flex: 1, backgroundColor: colors.background },

//     header: {
//       flexDirection: "row", alignItems: "center", justifyContent: "space-between",
//       paddingHorizontal: 16, paddingVertical: 12,
//       borderBottomWidth: 1, borderBottomColor: colors.border,
//     },
//     backBtn: {
//       width: 40, height: 40, alignItems: "center", justifyContent: "center",
//       borderRadius: 20, backgroundColor: colors.surface,
//     },
//     title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },

//     filterBar: {
//       flexDirection: "row", alignItems: "center", gap: 8,
//       paddingHorizontal: 16, paddingVertical: 10,
//     },
//     dateChip: {
//       flexDirection: "row", alignItems: "center", gap: 6,
//       borderWidth: 1, borderRadius: 20,
//       paddingHorizontal: 14, paddingVertical: 7,
//       backgroundColor: colors.surface,
//     },
//     dateChipText: { fontSize: 13, fontWeight: "600" },
//     clearChip: { padding: 4 },

//     summaryStrip: {
//       flexDirection: "row", marginHorizontal: 16, marginBottom: 4,
//       borderRadius: 12, padding: 12,
//       shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
//       shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
//     },
//     summaryItem: { flex: 1, alignItems: "center" },
//     summaryLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
//     summaryValue: { fontSize: 14, fontWeight: "700" },
//     summaryDivider: { width: 1, marginVertical: 2 },

//     list: { padding: 16, paddingBottom: 48 },
//     row: {
//       flexDirection: "row", alignItems: "center", gap: 12,
//       backgroundColor: colors.surface, borderRadius: 12,
//       padding: 12, marginBottom: 8,
//     },
//     rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
//     rowInfo: { flex: 1 },
//     rowName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
//     rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
//     rowAmount: { fontSize: 15, fontWeight: "700" },

//     empty: { alignItems: "center", paddingTop: 80, gap: 12 },
//     emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },

//     // Calendar modal
//     overlay: {
//       flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
//       justifyContent: "center", alignItems: "center",
//     },
//     calBox: {
//       width: 320, backgroundColor: colors.surface,
//       borderRadius: 20, padding: 20,
//       shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
//       shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
//     },
//     calHeader: {
//       flexDirection: "row", alignItems: "center", justifyContent: "space-between",
//       marginBottom: 16,
//     },
//     navBtn: { padding: 6 },
//     calMonth: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },

//     dayLabels: { flexDirection: "row", marginBottom: 4 },
//     dayLabel: {
//       flex: 1, textAlign: "center",
//       fontSize: 12, fontWeight: "600", color: colors.textMuted,
//     },

//     grid: { flexDirection: "row", flexWrap: "wrap" },
//     cell: {
//       width: `${100 / 7}%`, aspectRatio: 1,
//       alignItems: "center", justifyContent: "center",
//     },
//     dayNum: { fontSize: 14, color: colors.textPrimary },
//     todayDot: {
//       width: 4, height: 4, borderRadius: 2,
//       position: "absolute", bottom: 4,
//     },

//     calFooter: {
//       flexDirection: "row", alignItems: "center",
//       justifyContent: "space-between", marginTop: 16,
//     },
//     clearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
//     clearText: { fontSize: 13, fontWeight: "600" },
//     todayBtn: {
//       paddingHorizontal: 20, paddingVertical: 8,
//       borderRadius: 20,
//     },
//     todayBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
//   });



import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet,
  FlatList, TouchableOpacity, RefreshControl,
  Modal, Pressable, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/authStore";
import { salesDb } from "../../src/database/salesDb";
import { expenseDb } from "../../src/database/expenseDb";
import { Sale, Expense } from "../../src/types";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira } from "../../src/utils/formatters";
import { draftStorage } from "../../src/utils/draft";

// ─── Types ────────────────────────────────────────────────────────────────────

type SalesDraftData =
  | { mode: "manual"; items: Array<{ productName?: string; quantity?: number; unitPrice?: number; unit?: string }>; paymentType: string }
  | { mode: "voice"; transcript: string; parsedResult: { items: Array<{ productName: string; totalAmount: number }>; totalAmount: number } };

type LedgerEntry =
  | { kind: "sale"; data: Sale; key: string }
  | { kind: "expense"; data: Expense; key: string }
  | { kind: "sales_draft"; data: SalesDraftData; savedAt: string; key: string };

type LedgerFilter = "all" | "cash" | "transfer" | "pos" | "credit";

const LEDGER_FILTERS: { key: LedgerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cash", label: "Cash" },
  { key: "transfer", label: "Transfer" },
  { key: "pos", label: "POS" },
  { key: "credit", label: "Credit" },
];

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

// ─── Calendar Modal ───────────────────────────────────────────────────────────

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const s = makeStyles(colors);

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
    const t = new Date();
    t.setHours(0, 0, 0, 0);
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
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.calBox} onPress={() => {}}>

          {/* Calendar title */}
          <Text style={s.calTitle}>Select Date</Text>

          {/* Month navigation */}
          <View style={s.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.calMonth}>
              {MONTHS[cursor.month]} {cursor.year}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn} disabled={!canGoNext}>
              <Ionicons name="chevron-forward" size={20} color={canGoNext ? colors.textPrimary : colors.border} />
            </TouchableOpacity>
          </View>

          {/* Day labels */}
          <View style={s.dayLabels}>
            {DAYS.map((d) => (
              <Text key={d} style={s.dayLabel}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={s.grid}>
            {grid.map((day, idx) => {
              if (!day) return <View key={`e-${idx}`} style={s.cell} />;
              const future = isFuture(day);
              const sel = isSelected(day);
              const tod = isToday(day);
              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  style={[s.cell, sel && { backgroundColor: colors.primary, borderRadius: 22 }]}
                  onPress={() => {
                    if (future) return;
                    onSelect(toYMD(new Date(cursor.year, cursor.month, day)));
                    onClose();
                  }}
                  disabled={future}
                >
                  <Text
                    style={[
                      s.dayNum,
                      future && { color: colors.border },
                      tod && !sel && { color: colors.primary, fontWeight: "700" },
                      sel && { color: "#fff", fontWeight: "700" },
                    ]}
                  >
                    {day}
                  </Text>
                  {tod && !sel && <View style={[s.todayDot, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={s.calFooter}>
            <TouchableOpacity
              onPress={() => { onSelect(null); onClose(); }}
              style={s.clearBtn}
            >
              <Text style={[s.clearText, { color: colors.textSecondary }]}>Show All Dates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onSelect(todayYMD); onClose(); }}
              style={[s.todayBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={s.todayBtnText}>Today</Text>
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  syncStatus: string | undefined;
  paymentStatus?: string; // "paid" | "draft" | undefined
  colors: ReturnType<typeof useTheme>;
}

function StatusBadge({ syncStatus, paymentStatus, colors }: StatusBadgeProps) {
  // Payment/draft flag
  const isPaid = paymentStatus === "paid";
  const isDraft = paymentStatus === "draft";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
      {/* Paid / Draft badge */}
      {isPaid && (
        <View style={[badgeStyles.badge, { backgroundColor: "#D1FAE5" }]}>
          <Ionicons name="checkmark-circle" size={10} color="#059669" />
          <Text style={[badgeStyles.badgeText, { color: "#059669" }]}>Paid</Text>
        </View>
      )}
      {isDraft && (
        <View style={[badgeStyles.badge, { backgroundColor: "#FEF3C7" }]}>
          <Ionicons name="create-outline" size={10} color="#D97706" />
          <Text style={[badgeStyles.badgeText, { color: "#D97706" }]}>Draft</Text>
        </View>
      )}

      {/* Sync status badge */}
      {syncStatus === "pending" ? (
        <View style={[badgeStyles.badge, { backgroundColor: "#EEF2FF" }]}>
          <Ionicons name="time-outline" size={10} color="#6366F1" />
          <Text style={[badgeStyles.badgeText, { color: "#6366F1" }]}>Pending</Text>
        </View>
      ) : (
        <View style={[badgeStyles.badge, { backgroundColor: "#F0FDF4" }]}>
          <Ionicons name="cloud-done-outline" size={10} color="#16A34A" />
          <Text style={[badgeStyles.badgeText, { color: "#16A34A" }]}>Synced</Text>
        </View>
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LedgerScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calVisible, setCalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>("all");

  const load = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      let sales: Sale[];
      let expenses: Expense[];

      if (selectedDate) {
        [sales, expenses] = await Promise.all([
          salesDb.getByDate(user._id, selectedDate),
          expenseDb.getByDate(user._id, selectedDate),
        ]);
      } else {
        [sales, expenses] = await Promise.all([
          salesDb.getRecent(user._id, 50),
          expenseDb.getRecent(user._id, 50),
        ]);
      }

      const storedDraft = await draftStorage.load<SalesDraftData>(`draft:sales:${user._id}`);
      const draftDateMatch = !selectedDate || (storedDraft && toYMD(new Date(storedDraft.savedAt)) === selectedDate);
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
  }, [user?._id, selectedDate]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useFocusEffect(useCallback(() => { loadRef.current(); }, []));
  useEffect(() => { load(); }, [load]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === "all") return entries;
    return entries.filter(
      (e) => e.kind === "sale" && (e.data as Sale).paymentType === activeFilter
    );
  }, [entries, activeFilter]);

  const totals = useMemo(() => {
    let sales = 0, expenses = 0;
    for (const e of filteredEntries) {
      if (e.kind === "sale") sales += (e.data as Sale).totalAmount;
      else if (e.kind === "expense") expenses += (e.data as Expense).amount;
    }
    return { sales, expenses, net: sales - expenses };
  }, [filteredEntries]);

  const styles = makeStyles(colors);

  const renderItem = ({ item }: { item: LedgerEntry }) => {
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
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.navigate("/(tabs)/sales" as any)}
          activeOpacity={0.75}
        >
          <View style={[styles.rowAccentBar, { backgroundColor: "#D97706" }]} />
          <View style={[styles.rowIcon, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="create-outline" size={18} color="#D97706" />
          </View>
          <View style={styles.rowInfo}>
            <View style={[styles.typePill, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.typePillText, { color: "#D97706" }]}>DRAFT</Text>
            </View>
            <Text style={styles.rowName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.rowMeta}>
              {draft.mode} · {formatMeta(item.savedAt)} · tap to continue
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
              <View style={[badgeStyles.badge, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="create-outline" size={10} color="#D97706" />
                <Text style={[badgeStyles.badgeText, { color: "#D97706" }]}>Unsaved</Text>
              </View>
            </View>
          </View>
          <View style={styles.rowRight}>
            {draftTotal > 0 && (
              <Text style={[styles.rowAmount, { color: "#D97706" }]}>{formatNaira(draftTotal)}</Text>
            )}
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginTop: 4 }} />
          </View>
        </TouchableOpacity>
      );
    }

    const isSale = item.kind === "sale";
    const sale = isSale ? (item.data as Sale) : null;
    const expense = !isSale ? (item.data as Expense) : null;
    const dateStr = isSale
      ? (sale!.createdAt ?? sale!.date)
      : (expense!.createdAt ?? expense!.date);

    // ── Payment/draft flag resolution ──────────────────────────────────────
    // For sales: use paymentStatus field if available; fall back to paymentType
    // For expenses: use status field if available
    const paymentStatus: string | undefined = isSale
      ? (sale as any).paymentStatus ?? ((sale!.paymentType?.toLowerCase() === "draft") ? "draft" : "paid")
      : (expense as any).status ?? undefined;

    return (
      <View style={styles.row}>
        {/* Left accent bar */}
        <View style={[styles.rowAccentBar, { backgroundColor: isSale ? colors.primary : colors.danger }]} />

        {/* Icon */}
        <View style={[styles.rowIcon, { backgroundColor: isSale ? "#E8F5E9" : "#FEE2E2" }]}>
          <Ionicons
            name={isSale ? "bag-handle" : "receipt"}
            size={18}
            color={isSale ? colors.primary : colors.danger}
          />
        </View>

        {/* Info */}
        <View style={styles.rowInfo}>
          {/* Type pill */}
          <View style={[styles.typePill, { backgroundColor: isSale ? "#E8F5E9" : "#FEE2E2" }]}>
            <Text style={[styles.typePillText, { color: isSale ? colors.primary : colors.danger }]}>
              {isSale ? "SALE" : "EXPENSE"}
            </Text>
          </View>

          <Text style={styles.rowName} numberOfLines={1}>
            {isSale
              ? `${sale!.items[0]?.productName ?? "Sale"}${sale!.items.length > 1 ? ` +${sale!.items.length - 1} more` : ""}`
              : expense!.description}
          </Text>

          <Text style={styles.rowMeta}>
            {isSale ? sale!.paymentType : expense!.category}
            {" · "}{formatMeta(dateStr)}
          </Text>

          {/* Status badges */}
          <StatusBadge
            syncStatus={item.data.syncStatus}
            paymentStatus={paymentStatus}
            colors={colors}
          />
        </View>

        {/* Amount */}
        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, { color: isSale ? colors.primary : colors.danger }]}>
            {isSale ? "+" : "-"}{formatNaira(isSale ? sale!.totalAmount : expense!.amount)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Transaction Ledger</Text>
          <Text style={styles.subtitle}>{filteredEntries.length} transaction{filteredEntries.length !== 1 ? "s" : ""}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Date filter bar ── */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[
            styles.dateChip,
            selectedDate && { borderColor: colors.primary, backgroundColor: colors.primary + "12" },
          ]}
          onPress={() => setCalVisible(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={selectedDate ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.dateChipText, { color: selectedDate ? colors.primary : colors.textSecondary }]}>
            {labelForDate(selectedDate)}
          </Text>
          <Ionicons name="chevron-down" size={13} color={selectedDate ? colors.primary : colors.textMuted} />
        </TouchableOpacity>

        {selectedDate && (
          <TouchableOpacity style={styles.clearChip} onPress={() => setSelectedDate(null)}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Payment type filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        {LEDGER_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Summary strip ── */}
      {filteredEntries.some(e => e.kind !== "sales_draft") && (
        <View style={styles.summaryStrip}>
          <View style={[styles.summaryItem, { backgroundColor: "#E8F5E9" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#C6F6D5" }]}>
              <Ionicons name="trending-up" size={14} color={colors.primary} />
            </View>
            <Text style={styles.summaryLabel}>Sales</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {formatNaira(totals.sales)}
            </Text>
          </View>

          <View style={[styles.summaryItem, { backgroundColor: "#FEE2E2" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#FECACA" }]}>
              <Ionicons name="trending-down" size={14} color={colors.danger} />
            </View>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>
              {formatNaira(totals.expenses)}
            </Text>
          </View>

          <View style={[styles.summaryItem, { backgroundColor: totals.net >= 0 ? "#EEF2FF" : "#FEE2E2" }]}>
            <View style={[
              styles.summaryIconWrap,
              { backgroundColor: totals.net >= 0 ? "#C7D2FE" : "#FECACA" },
            ]}>
              <Ionicons
                name="stats-chart"
                size={14}
                color={totals.net >= 0 ? "#6366F1" : colors.danger}
              />
            </View>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text style={[styles.summaryValue, { color: totals.net >= 0 ? "#6366F1" : colors.danger }]}>
              {formatNaira(totals.net)}
            </Text>
          </View>
        </View>
      )}

      {/* ── List ── */}
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Transactions</Text>
              <Text style={styles.emptyText}>
                {selectedDate
                  ? `Nothing recorded on ${labelForDate(selectedDate)}`
                  : "Your ledger is empty. Transactions will appear here."}
              </Text>
            </View>
          ) : null
        }
      />

      <CalendarModal
        visible={calVisible}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setCalVisible(false)}
        colors={colors}
      />
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
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backBtn: {
      width: 40, height: 40,
      alignItems: "center", justifyContent: "center",
      borderRadius: 20,
      backgroundColor: colors.background,
    },
    headerCenter: { alignItems: "center" },
    title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
    subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

    // ── Filter bar
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },

    // ── Payment filter chips
    filterChips: {
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    filterChipActive: {},
    filterChipText: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
    filterChipTextActive: { color: colors.primary, fontWeight: "700" },
    dateChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    dateChipText: { fontSize: 13, fontWeight: "600" },
    clearChip: { padding: 2 },

    // ── Summary strip
    summaryStrip: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 16,
      gap: 6,
      padding: 6,
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    summaryItem: { flex: 1, alignItems: "center", gap: 4, borderRadius: 12, paddingVertical: 10 },
    summaryIconWrap: {
      width: 28, height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    summaryLabel: { fontSize: 11, color: colors.textMuted },
    summaryValue: { fontSize: 13, fontWeight: "800" },
    summaryDivider: { width: 1, marginVertical: 4 },

    // ── List
    list: { padding: 16, paddingBottom: 48 },

    // ── Row
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    rowAccentBar: {
      width: 4,
      alignSelf: "stretch",
    },
    rowIcon: {
      width: 40, height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },
    rowInfo: { flex: 1, paddingVertical: 10, paddingHorizontal: 10 },
    typePill: {
      alignSelf: "flex-start",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginBottom: 4,
    },
    typePillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
    rowName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    rowRight: { paddingRight: 14, alignItems: "flex-end" },
    rowAmount: { fontSize: 15, fontWeight: "800" },

    // ── Empty state
    empty: { alignItems: "center", paddingTop: 80, gap: 10 },
    emptyIconWrap: {
      width: 72, height: 72,
      borderRadius: 36,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", maxWidth: 260 },

    // ── Calendar modal
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    calBox: {
      width: 320,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 18,
    },
    calTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textAlign: "center",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    calHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    navBtn: {
      width: 34, height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    calMonth: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },

    dayLabels: { flexDirection: "row", marginBottom: 4 },
    dayLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.3,
    },

    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    dayNum: { fontSize: 14, color: colors.textPrimary },
    todayDot: {
      width: 4, height: 4,
      borderRadius: 2,
      position: "absolute",
      bottom: 4,
    },

    calFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    clearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
    clearText: { fontSize: 13, fontWeight: "600" },
    todayBtn: {
      paddingHorizontal: 22,
      paddingVertical: 9,
      borderRadius: 20,
    },
    todayBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });