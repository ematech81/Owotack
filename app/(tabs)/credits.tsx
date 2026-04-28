import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Linking, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { draftStorage } from "../../src/utils/draft";
import { DraftBanner } from "../../src/components/common/DraftBanner";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCreditStore } from "../../src/store/creditStore";
import { useAuthStore } from "../../src/store/authStore";
import { ICredit } from "../../src/services/creditService";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira, formatDate } from "../../src/utils/formatters";
import { ProductPickerInput } from "../../src/components/common/ProductPickerInput";
import { CustomerPickerInput } from "../../src/components/common/CustomerPickerInput";
import { UpgradePromptModal } from "../../src/components/common/UpgradePromptModal";
import { checkWhatsAppLimit, recordWhatsAppUsage } from "../../src/utils/usageLimits";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due Soon" },
  { key: "paid", label: "Paid" },
] as const;

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ["#2D6A4F", "#D97706", "#3B82F6", "#8B5CF6", "#EF4444", "#059669"];
function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const MONTH_NAMES_CAL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function statusConfig(status: ICredit["status"]) {
  switch (status) {
    case "overdue":  return { label: "Overdue",  color: "#EF4444", icon: "alert-circle" as const,      bg: "#FEF2F2" };
    case "due_soon": return { label: "Due Soon", color: "#D97706", icon: "time-outline" as const,       bg: "#FFFBEB" };
    case "paid":     return { label: "Paid",     color: "#059669", icon: "checkmark-circle" as const,   bg: "#F0FDF4" };
    default:         return { label: "Active",   color: "#3B82F6", icon: "ellipse-outline" as const,    bg: "#EFF6FF" };
  }
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CreditsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const { credits, stats, isLoading, activeFilter, loadCredits, loadStats, setFilter } = useCreditStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<ICredit | null>(null);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeUsed, setUpgradeUsed] = useState(0);
  const [upgradeLimit, setUpgradeLimit] = useState(0);
  const [phonePromptCredit, setPhonePromptCredit] = useState<ICredit | null>(null);

  const planId = user?.subscription?.plan ?? "free";

  const initials2 = (user?.name ?? "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    loadCredits();
    loadStats();
  }, []);

  const sendWhatsApp = async (credit: ICredit, phone: string) => {
    if (!user) return;
    const check = await checkWhatsAppLimit(user._id, planId);
    if (!check.allowed) {
      setUpgradeUsed(check.used);
      setUpgradeLimit(check.limit);
      setUpgradeVisible(true);
      return;
    }
    const digits = phone.replace(/\D/g, "");
    const wa = digits.startsWith("234") ? digits : digits.startsWith("0") ? "234" + digits.slice(1) : "234" + digits;
    const businessName = user.businessName || user.name;
    const message =
      `Hello ${credit.customerName}! 👋\n\n` +
      `This is ${businessName}. You still owe ₦${credit.balance.toLocaleString()} for "${credit.description}".\n\n` +
      `Please kindly make payment as soon as possible.\n\nThank you! 🙏`;
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) { Alert.alert("WhatsApp Not Found", "WhatsApp is not installed on this device."); return; }
      await Linking.openURL(url);
      await recordWhatsAppUsage(user._id);
    } catch {
      Alert.alert("Error", "Could not open WhatsApp. Please try again.");
    }
  };

  const handleWhatsAppReminder = async (credit: ICredit) => {
    if (!user) return;
    if (!credit.customerPhone) {
      setPhonePromptCredit(credit);
      return;
    }
    await sendWhatsApp(credit, credit.customerPhone!);
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials2}</Text></View>
          <Text style={styles.headerTitle}>OwoTrack</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { loadCredits(); loadStats(); }} />}
      >
        {/* Total Outstanding Card */}
        <View style={styles.outstandingCard}>
          <Text style={styles.outstandingLabel}>Total Outstanding</Text>
          <Text style={styles.outstandingAmount}>{formatNaira(stats?.totalOutstanding ?? 0)}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${stats?.percentCollected ?? 0}%` }]} />
            </View>
            <Text style={styles.progressText}>{stats?.percentCollected ?? 0}% Collected</Text>
          </View>
        </View>

        {/* Overdue Card */}
        <View style={[styles.statusCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
          <Text style={[styles.statusCardTag, { color: "#EF4444" }]}>OVERDUE</Text>
          <Text style={[styles.statusCardAmount, { color: "#EF4444" }]}>
            {formatNaira(stats?.overdueAmount ?? 0)}
          </Text>
          <View style={styles.statusCardFooter}>
            <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
            <Text style={[styles.statusCardCount, { color: "#EF4444" }]}>
              {stats?.overdueCount ?? 0} CUSTOMERS
            </Text>
          </View>
        </View>

        {/* Due Soon Card */}
        <View style={[styles.statusCard, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Text style={[styles.statusCardTag, { color: "#D97706" }]}>DUE SOON</Text>
          <Text style={[styles.statusCardAmount, { color: "#1C1917" }]}>
            {formatNaira(stats?.dueSoonAmount ?? 0)}
          </Text>
          <View style={styles.statusCardFooter}>
            <Ionicons name="time-outline" size={14} color="#D97706" />
            <Text style={[styles.statusCardCount, { color: "#D97706" }]}>
              {stats?.dueSoonCount ?? 0} CUSTOMERS
            </Text>
          </View>
        </View>

        {/* Collections Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statusCardTag, { color: colors.textSecondary }]}>COLLECTIONS</Text>
          <Text style={[styles.statusCardAmount, { color: "#1C1917" }]}>
            {formatNaira(stats?.collectedThisWeek ?? 0)}
          </Text>
          <View style={styles.statusCardFooter}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            <Text style={[styles.statusCardCount, { color: colors.primary }]}>THIS WEEK</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, activeFilter === f.key && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterPillText, activeFilter === f.key && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Active Credits List */}
        <Text style={styles.sectionTitle}>
          <Ionicons name="people" size={16} color={colors.textPrimary} />  Active Credits
        </Text>

        {credits.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Add new sales on credit to track here</Text>
          </View>
        ) : (
          credits.map((credit) => {
            const s = statusConfig(credit.status);
            const bg = avatarColor(credit.customerName);
            return (
              <TouchableOpacity
                key={credit._id}
                style={styles.creditRow}
                onPress={() => setSelectedCredit(credit)}
                activeOpacity={0.7}
              >
                <View style={[styles.creditAvatar, { backgroundColor: bg }]}>
                  <Text style={styles.creditAvatarText}>{initials(credit.customerName)}</Text>
                </View>
                <View style={styles.creditInfo}>
                  <Text style={styles.creditName}>{credit.customerName}</Text>
                  <View style={styles.creditStatusRow}>
                    <Ionicons name={s.icon} size={13} color={s.color} />
                    <Text style={[styles.creditStatusText, { color: s.color }]}>
                      {s.label}{credit.status === "overdue"
                        ? ` · ${Math.ceil((Date.now() - new Date(credit.dueDate).getTime()) / 86400000)}d ago`
                        : credit.status === "due_soon"
                        ? ` · ${Math.ceil((new Date(credit.dueDate).getTime() - Date.now()) / 86400000)}d left`
                        : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.creditRight}>
                  {(credit.status === "overdue" || credit.status === "due_soon") && (
                    <TouchableOpacity
                      style={styles.waBtn}
                      onPress={() => handleWhatsAppReminder(credit)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.creditAmount, credit.status === "paid" && styles.creditAmountPaid]}>
                    {formatNaira(credit.balance)}
                  </Text>
                  <Ionicons
                    name={credit.status === "paid" ? "receipt-outline" : "chevron-forward"}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Credit Modal */}
      <AddCreditModal visible={showAdd} onClose={() => setShowAdd(false)} colors={colors} styles={styles} />

      {/* Credit Detail Modal */}
      {selectedCredit && (
        <CreditDetailModal
          credit={selectedCredit}
          onClose={() => setSelectedCredit(null)}
          colors={colors}
          styles={styles}
        />
      )}

      <UpgradePromptModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        feature="whatsapp"
        used={upgradeUsed}
        limit={upgradeLimit}
      />

      <AddPhoneModal
        visible={phonePromptCredit !== null}
        credit={phonePromptCredit}
        onSaved={async (updatedCredit) => {
          setPhonePromptCredit(null);
          await sendWhatsApp(updatedCredit, updatedCredit.customerPhone!);
        }}
        onCancel={() => setPhonePromptCredit(null)}
        colors={colors}
        styles={styles}
      />
    </SafeAreaView>
  );
}

// ─── Add Phone Modal ──────────────────────────────────────────────────────────
function AddPhoneModal({ visible, credit, onSaved, onCancel, colors, styles }: {
  visible: boolean;
  credit: ICredit | null;
  onSaved: (updated: ICredit) => void;
  onCancel: () => void;
  colors: ReturnType<typeof useTheme>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { updatePhone } = useCreditStore();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!visible) setPhone(""); }, [visible]);

  const isValid = phone.replace(/\D/g, "").length >= 10;

  const handleSave = async () => {
    if (!credit || !isValid) return;
    setLoading(true);
    try {
      const updated = await updatePhone(credit._id, phone.trim());
      onSaved(updated);
    } catch {
      Alert.alert("Error", "Could not save phone number. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ width: "100%", backgroundColor: colors.background, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Ionicons name="logo-whatsapp" size={22} color="#16A34A" />
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Add Phone Number</Text>
          </View>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 }}>
            To send a WhatsApp reminder to{credit ? ` ${credit.customerName}` : " this customer"}, you need their phone number.
          </Text>

          <Text style={styles.formLabel}>Phone Number</Text>
          <TextInput
            style={[styles.formInput, { marginBottom: 20 }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="080XXXXXXXX"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            autoFocus
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
              onPress={onCancel}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: isValid ? "#16A34A" : colors.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
              onPress={handleSave}
              disabled={!isValid || loading}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#fff" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                {loading ? "Saving..." : "Save & Send"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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

  const handleDay = (d: number | null) => {
    if (!d) return;
    const date = new Date(viewYear, viewMonth, d);
    setSelected(date);
    onConfirm(date);
  };

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
                onPress={() => handleDay(d)}
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

// ─── Add Credit Modal ─────────────────────────────────────────────────────────
interface CreditLineItem {
  productName: string;
  quantity: string;
  unitPrice: string;
}

const emptyCreditLine = (): CreditLineItem => ({ productName: "", quantity: "1", unitPrice: "" });

interface CreditDraft {
  name: string; phone: string;
  creditLines: CreditLineItem[];
  dueDateStr: string | null;
}

function AddCreditModal({ visible, onClose, colors, styles }: {
  visible: boolean; onClose: () => void;
  colors: ReturnType<typeof useTheme>; styles: ReturnType<typeof makeStyles>;
}) {
  const { addCredit } = useCreditStore();
  const { user } = useAuthStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditLines, setCreditLines] = useState<CreditLineItem[]>([emptyCreditLine()]);
  const [dueDateObj, setDueDateObj] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const draftKey = user ? `draft:credits:${user._id}` : null;

  useEffect(() => {
    if (!visible || !draftKey) return;
    draftStorage.load<CreditDraft>(draftKey).then((stored) => {
      if (!stored) return;
      const { data } = stored;
      setName(data.name);
      setPhone(data.phone);
      setCreditLines(data.creditLines.length ? data.creditLines : [emptyCreditLine()]);
      setDueDateObj(data.dueDateStr ? new Date(data.dueDateStr) : null);
      setDraftSavedAt(stored.savedAt);
    });
  }, [visible, draftKey]);

  const reset = () => {
    setName(""); setPhone(""); setCreditLines([emptyCreditLine()]); setDueDateObj(null);
    setDraftSavedAt(null);
  };

  const handleSaveDraft = async () => {
    if (!draftKey) return;
    const at = await draftStorage.save<CreditDraft>(draftKey, {
      name, phone, creditLines, dueDateStr: dueDateObj?.toISOString() ?? null,
    });
    setDraftSavedAt(at);
  };

  const handleDiscard = async () => {
    if (draftKey) await draftStorage.clear(draftKey);
    reset();
  };

  const updateLine = (index: number, field: keyof CreditLineItem, value: string) => {
    setCreditLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  };

  const addLine = () => setCreditLines((prev) => [...prev, emptyCreditLine()]);

  const removeLine = (index: number) => {
    setCreditLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = creditLines.reduce(
    (sum, line) => sum + (parseInt(line.quantity) || 1) * (Number(line.unitPrice) || 0),
    0,
  );

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert("", "Enter customer name"); return; }
    if (!dueDateObj) { Alert.alert("", "Select a due date"); return; }

    const validLines = creditLines.filter(
      (l) => l.productName.trim() && Number(l.unitPrice) > 0,
    );
    if (!validLines.length) {
      Alert.alert("", "Add at least one item with product name and price");
      return;
    }

    const finalDesc = validLines
      .map((l) => `${parseInt(l.quantity) || 1}x ${l.productName.trim()}`)
      .join(", ");
    const finalAmount = validLines.reduce(
      (sum, l) => sum + (parseInt(l.quantity) || 1) * Number(l.unitPrice),
      0,
    );

    setLoading(true);
    try {
      await addCredit({
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        description: finalDesc,
        amount: finalAmount,
        dueDate: dueDateObj.toISOString(),
      });
      if (draftKey) await draftStorage.clear(draftKey);
      Alert.alert("Saved!", `Credit of ${formatNaira(finalAmount)} recorded for ${name}`);
      reset();
      onClose();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const dueDateDisplay = dueDateObj
    ? dueDateObj.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : "Select due date";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Credit</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {draftSavedAt && (
              <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />
            )}
            {/* Customer Info */}
            <View style={[styles.formGroup, { zIndex: 40 }]}>
              <Text style={styles.formLabel}>Customer Name *</Text>
              {user ? (
                <CustomerPickerInput
                  value={name}
                  onChange={setName}
                  userId={user._id}
                  placeholder="e.g. Alhaji Musa"
                  inputStyle={styles.formInput}
                  colors={colors}
                />
              ) : (
                <TextInput
                  style={styles.formInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Alhaji Musa"
                  placeholderTextColor={colors.textMuted}
                />
              )}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone Number</Text>
              <TextInput
                style={styles.formInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="080XXXXXXXX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            {/* Credit Line Items */}
            <Text style={[styles.formLabel, { fontSize: 14, marginBottom: 10 }]}>
              Items Bought on Credit
            </Text>

            {creditLines.map((line, index) => (
              <View
                key={index}
                style={[styles.creditLineCard, { backgroundColor: colors.surface, borderColor: colors.border, zIndex: creditLines.length - index }]}
              >
                <View style={styles.creditLineHeader}>
                  <Text style={[styles.formLabel, { marginBottom: 0 }]}>
                    Item {index + 1}
                  </Text>
                  {creditLines.length > 1 && (
                    <TouchableOpacity onPress={() => removeLine(index)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Product picker */}
                <ProductPickerInput
                  value={line.productName}
                  onChange={(name, stockItem) => {
                    updateLine(index, "productName", name);
                    if (stockItem && (!line.unitPrice || line.unitPrice === "0" || line.unitPrice === "")) {
                      updateLine(index, "unitPrice", String(stockItem.sellingPrice || stockItem.costPrice || ""));
                    }
                  }}
                  placeholder="e.g., HP Laptop"
                  inputStyle={styles.formInput}
                  containerStyle={{ marginBottom: 8 }}
                  colors={colors}
                />

                {/* Qty + Unit price row */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ width: 72 }}>
                    <Text style={[styles.formLabel, { marginBottom: 4 }]}>Qty</Text>
                    <TextInput
                      style={styles.formInput}
                      value={line.quantity}
                      onChangeText={(v) => updateLine(index, "quantity", v)}
                      placeholder="1"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formLabel, { marginBottom: 4 }]}>Unit Price (₦) *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={line.unitPrice}
                      onChangeText={(v) => updateLine(index, "unitPrice", v)}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Line subtotal */}
                {Number(line.unitPrice) > 0 && (
                  <Text style={[styles.formLabel, { color: colors.primary, textAlign: "right", marginTop: 6, marginBottom: 0 }]}>
                    = {formatNaira((parseInt(line.quantity) || 1) * Number(line.unitPrice))}
                  </Text>
                )}
              </View>
            ))}

            {/* Add more items */}
            <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.formLabel, { color: colors.primary, marginBottom: 0 }]}>
                Add Another Item
              </Text>
            </TouchableOpacity>

            {/* Total */}
            {totalAmount > 0 && (
              <View style={[styles.totalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.formLabel, { marginBottom: 0 }]}>Total Amount Owed</Text>
                <Text style={styles.totalAmount}>{formatNaira(totalAmount)}</Text>
              </View>
            )}

            {/* Due Date */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Due Date *</Text>
              <TouchableOpacity
                style={[styles.formInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: dueDateObj ? colors.textPrimary : colors.textMuted, fontSize: 15 }}>
                  {dueDateDisplay}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {draftSavedAt ? (
              <TouchableOpacity
                style={[styles.saveBtn, loading && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.saveBtnText}>
                  {loading ? "Saving..." : totalAmount > 0 ? `Submit · ${formatNaira(totalAmount)}` : "Submit"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDraft}>
                <Text style={styles.saveBtnText}>Save Draft</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={dueDateObj}
        onConfirm={(date) => { setDueDateObj(date); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        colors={colors}
      />
    </Modal>
  );
}

// ─── Credit Detail Modal ──────────────────────────────────────────────────────
function CreditDetailModal({ credit, onClose, colors, styles }: {
  credit: ICredit; onClose: () => void;
  colors: ReturnType<typeof useTheme>; styles: ReturnType<typeof makeStyles>;
}) {
  const { recordPayment, deleteCredit } = useCreditStore();
  const { user } = useAuthStore();
  const [payAmount, setPayAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [localCredit, setLocalCredit] = useState(credit);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const s = statusConfig(localCredit.status);

  const planId = user?.subscription?.plan ?? "free";

  const handlePayment = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { Alert.alert("", "Enter a valid payment amount"); return; }
    setLoading(true);
    try {
      await recordPayment(localCredit._id, amt);
      Alert.alert("Recorded!", `Payment of ₦${amt.toLocaleString()} recorded`);
      setPayAmount("");
      onClose();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  const handleWhatsApp = async () => {
    if (!localCredit.customerPhone) {
      setShowPhonePrompt(true);
      return;
    }
    if (!user) return;
    const check = await checkWhatsAppLimit(user._id, planId);
    if (!check.allowed) { Alert.alert("Limit Reached", "Upgrade your plan to send more WhatsApp reminders."); return; }
    const digits = localCredit.customerPhone.replace(/\D/g, "");
    const wa = digits.startsWith("234") ? digits : digits.startsWith("0") ? "234" + digits.slice(1) : "234" + digits;
    const businessName = user.businessName || user.name;
    const message = `Hello ${localCredit.customerName}! 👋\n\nThis is ${businessName}. You still owe ₦${localCredit.balance.toLocaleString()} for "${localCredit.description}".\n\nPlease kindly make payment as soon as possible.\n\nThank you! 🙏`;
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) { Alert.alert("WhatsApp Not Found", "WhatsApp is not installed on this device."); return; }
      await Linking.openURL(url);
      await recordWhatsAppUsage(user._id);
    } catch {
      Alert.alert("Error", "Could not open WhatsApp.");
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Credit", "Remove this credit record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteCredit(credit._id); onClose(); } },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{localCredit.customerName}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Status badge */}
          <View style={[styles.detailStatusBadge, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={16} color={s.color} />
            <Text style={[styles.detailStatusText, { color: s.color }]}>{s.label}</Text>
          </View>

          {/* Amounts */}
          <View style={styles.detailAmountCard}>
            <View style={styles.detailAmountRow}>
              <Text style={styles.detailAmountLabel}>Original Amount</Text>
              <Text style={styles.detailAmountValue}>{formatNaira(localCredit.amount)}</Text>
            </View>
            <View style={styles.detailAmountRow}>
              <Text style={styles.detailAmountLabel}>Amount Paid</Text>
              <Text style={[styles.detailAmountValue, { color: colors.primary }]}>{formatNaira(localCredit.amountPaid)}</Text>
            </View>
            <View style={[styles.detailAmountRow, styles.detailAmountRowLast]}>
              <Text style={[styles.detailAmountLabel, { fontWeight: "700" }]}>Balance</Text>
              <Text style={[styles.detailAmountValue, { color: "#EF4444", fontWeight: "800" }]}>{formatNaira(localCredit.balance)}</Text>
            </View>
          </View>

          <View style={styles.detailInfoRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
            <Text style={styles.detailInfoText}>Due: {formatDate(localCredit.dueDate)}</Text>
          </View>
          <View style={styles.detailInfoRow}>
            <Ionicons name="cart-outline" size={15} color={colors.textMuted} />
            <Text style={styles.detailInfoText}>{localCredit.description}</Text>
          </View>
          {localCredit.customerPhone && (
            <View style={styles.detailInfoRow}>
              <Ionicons name="call-outline" size={15} color={colors.textMuted} />
              <Text style={styles.detailInfoText}>{localCredit.customerPhone}</Text>
            </View>
          )}

          {/* Record Payment */}
          {localCredit.status !== "paid" && (
            <>
              <Text style={[styles.formLabel, { marginTop: 24 }]}>Record Payment</Text>
              <View style={styles.paymentRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="Amount paid (₦)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.payBtn, loading && { opacity: 0.6 }]}
                  onPress={handlePayment}
                  disabled={loading}
                >
                  <Text style={styles.payBtnText}>Record</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* WhatsApp Reminder */}
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.whatsappBtnText}>Send WhatsApp Reminder</Text>
          </TouchableOpacity>

          {/* Payment history */}
          {localCredit.payments.length > 0 && (
            <>
              <Text style={[styles.formLabel, { marginTop: 20 }]}>Payment History</Text>
              {localCredit.payments.map((p, i) => (
                <View key={i} style={styles.paymentHistoryRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={styles.paymentHistoryText}>
                    {formatNaira(p.amount)} · {formatDate(p.date)} {p.note ? `· ${p.note}` : ""}
                  </Text>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Delete Credit</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <AddPhoneModal
        visible={showPhonePrompt}
        credit={localCredit}
        onSaved={async (updatedCredit) => {
          setLocalCredit(updatedCredit);
          setShowPhonePrompt(false);
          await handleWhatsApp();
        }}
        onCancel={() => setShowPhonePrompt(false)}
        colors={colors}
        styles={styles}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.primary },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

    outstandingCard: {
      backgroundColor: colors.surface, borderRadius: 20, padding: 20,
      marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    outstandingLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
    outstandingAmount: { fontSize: 34, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    progressBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
    progressFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
    progressText: { fontSize: 13, fontWeight: "600", color: colors.primary },

    statusCard: {
      borderRadius: 16, padding: 16, marginBottom: 12,
      borderWidth: 1,
    },
    statusCardTag: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
    statusCardAmount: { fontSize: 26, fontWeight: "800", marginBottom: 10 },
    statusCardFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
    statusCardCount: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

    filterScroll: { marginBottom: 4 },
    filterRow: { flexDirection: "row", gap: 8, paddingVertical: 12 },
    filterPill: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterPillText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    filterPillTextActive: { color: "#fff" },

    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 12 },

    creditRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    },
    creditAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
    creditAvatarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    creditInfo: { flex: 1 },
    creditName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 },
    creditStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    creditStatusText: { fontSize: 12, fontWeight: "600" },
    creditRight: { alignItems: "flex-end", gap: 6 },
    waBtn: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: "#DCFCE7",
      alignItems: "center", justifyContent: "center",
    },
    creditAmount: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    creditAmountPaid: { color: colors.textMuted, textDecorationLine: "line-through" },

    empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },

    fab: {
      position: "absolute", bottom: 24, right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },

    // Modal
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
    formGroup: { marginBottom: 16 },
    formLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
    formInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, height: 48, paddingHorizontal: 14, fontSize: 15, color: colors.textPrimary },
    saveBtn: { backgroundColor: colors.primary, borderRadius: 12, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    // Credit line items
    creditLineCard: {
      borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10,
    },
    creditLineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    addLineBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 10, marginBottom: 12 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16 },
    totalAmount: { fontSize: 18, fontWeight: "800", color: colors.primary },

    // Detail modal
    detailStatusBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
    detailStatusText: { fontSize: 13, fontWeight: "700" },
    detailAmountCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    detailAmountRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    detailAmountRowLast: { borderBottomWidth: 0 },
    detailAmountLabel: { fontSize: 14, color: colors.textSecondary },
    detailAmountValue: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    detailInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    detailInfoText: { fontSize: 14, color: colors.textSecondary },
    paymentRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    payBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" },
    payBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    whatsappBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", borderRadius: 12, height: 50, marginTop: 8 },
    whatsappBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    paymentHistoryRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
    paymentHistoryText: { fontSize: 13, color: colors.textSecondary },
    deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 28, padding: 12 },
    deleteBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
  });
