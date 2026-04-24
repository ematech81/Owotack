import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../src/store/authStore";
import { useSalesStore } from "../../src/store/salesStore";
import { useExpenseStore } from "../../src/store/expenseStore";
import { salesDb } from "../../src/database/salesDb";
import { expenseDb } from "../../src/database/expenseDb";
import { Sale, Expense } from "../../src/types";
import { OfflineBanner } from "../../src/components/common/OfflineBanner";
import { OnboardingGuideModal } from "../../src/components/common/OnboardingGuideModal";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira } from "../../src/utils/formatters";
import { aiService } from "../../src/services/aiService";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month";

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 Days" },
  { key: "month", label: "30 Days" },
];

const CARD_LABEL: Record<Period, string> = {
  today: "TODAY'S REVENUE",
  week: "7-DAY REVENUE",
  month: "30-DAY REVENUE",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function getDateRange(period: Period): { startYMD: string; endYMD: string } {
  const today = new Date();
  const endYMD = toYMD(today);
  if (period === "today") return { startYMD: endYMD, endYMD };
  const start = new Date(today);
  start.setDate(today.getDate() - (period === "week" ? 6 : 29));
  return { startYMD: toYMD(start), endYMD };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatPillProps {
  label: string;
  amount: string;
  ratio: number;
  fillColor: string;
  textColor: string;
  borderColor?: string;
}

function StatPill({
  label,
  amount,
  ratio,
  fillColor,
  textColor,
  borderColor,
}: StatPillProps) {
  return (
    <View
      style={[
        statPillStyles.container,
        borderColor ? { borderLeftWidth: 1, borderLeftColor: borderColor } : {},
      ]}
    >
      <Text style={statPillStyles.label}>{label}</Text>
      <Text style={[statPillStyles.amount, { color: textColor }]}>{amount}</Text>
      <View style={statPillStyles.track}>
        <View
          style={[
            statPillStyles.fill,
            { width: `${ratio * 100}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
    </View>
  );
}

const statPillStyles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  label: { fontSize: 10, color: "rgba(255,255,255,0.65)", marginBottom: 4, letterSpacing: 0.4 },
  amount: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  track: { height: 3, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  fill: { height: 3, borderRadius: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const {
    todaySales,
    loadToday: loadSales,
    isLoading: salesLoading,
  } = useSalesStore();
  const { todayExpenses, loadToday: loadExpenses } = useExpenseStore();

  const [period, setPeriod] = useState<Period>("today");
  const [periodSales, setPeriodSales] = useState<Sale[]>([]);
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);

  const activeSales = period === "today" ? todaySales : periodSales;
  const activeExpenses = period === "today" ? todayExpenses : periodExpenses;

  const totalSales = activeSales.reduce((s, x) => s + x.totalAmount, 0);
  const totalExpenses = activeExpenses.reduce((s, x) => s + x.amount, 0);
  const netProfit = totalSales - totalExpenses;
  const outstandingCredits = 0;

  const profitRatio =
    totalSales > 0 ? Math.min(Math.max(netProfit / totalSales, 0), 1) : 0;
  const expenseRatio =
    totalSales > 0 ? Math.min(totalExpenses / totalSales, 1) : 0;

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadToday = useCallback(() => {
    if (!user?._id) return;
    loadSales(user._id);
    loadExpenses(user._id);
  }, [user?._id, loadSales, loadExpenses]);

  const loadPeriod = useCallback(
    async (p: Period) => {
      if (!user?._id) return;
      if (p === "today") {
        loadToday();
        return;
      }
      setPeriodLoading(true);
      try {
        const { startYMD, endYMD } = getDateRange(p);
        const [sales, expenses] = await Promise.all([
          salesDb.getByDateRange(user._id, startYMD, endYMD),
          expenseDb.getByDateRange(user._id, startYMD, endYMD),
        ]);
        setPeriodSales(sales);
        setPeriodExpenses(expenses);
      } finally {
        setPeriodLoading(false);
      }
    },
    [user?._id, loadToday]
  );

  const loadTip = useCallback(async (forceRefresh = false) => {
    setAiTipLoading(true);
    try {
      const tip = await aiService.getTip(forceRefresh);
      setAiTip(tip);
    } catch {
      setAiTip(
        "Keep tracking your sales daily to spot trends and grow your profit."
      );
    } finally {
      setAiTipLoading(false);
    }
  }, []);

  const load = useCallback(() => {
    loadPeriod(period);
  }, [loadPeriod, period]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Auto-show the guide once for each user (keyed by userId)
  useEffect(() => {
    if (!user?._id) return;
    const key = `guide_seen:${user._id}`;
    AsyncStorage.getItem(key).then((seen) => {
      if (!seen) setGuideVisible(true);
    });
  }, [user?._id]);

  const handleCloseGuide = () => {
    setGuideVisible(false);
    if (user?._id) AsyncStorage.setItem(`guide_seen:${user._id}`, "true");
  };

  useFocusEffect(
    useCallback(() => {
      loadRef.current();
      // ── TO RE-ENABLE AI TIP: uncomment the line below ──
      // loadTip();
    }, [loadTip])
  );

  useEffect(() => {
    loadPeriod(period);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriod = (p: Period) => setPeriod(p);

  const initials = (user?.name ?? "T")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleRefresh = useCallback(() => {
    load();
    loadTip(true);
  }, [load, loadTip]);

  const isLoading = salesLoading || periodLoading;
  const styles = makeStyles(colors);

  // ── Greeting ───────────────────────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={[colors.primary, "#2D6A4F"]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
            <View>
              <Text style={styles.greetingText}>{greeting},</Text>
              <Text style={styles.nameText}>
                {user?.name?.split(" ")[0] ?? "Trader"} 👋
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={styles.helpBtn}
              onPress={() => setGuideVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifBtn} activeOpacity={0.75}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero Revenue Card ── */}
        <LinearGradient
          colors={["#1B4332", "#2D6A4F", "#40916C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Decorative circles */}
          <View style={styles.decCircle1} />
          <View style={styles.decCircle2} />

          {/* Period tabs */}
          <View style={styles.periodRow}>
            <Text style={styles.heroCardLabel}>{CARD_LABEL[period]}</Text>
            <View style={styles.periodTabs}>
              {PERIOD_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.periodTab,
                    period === tab.key && styles.periodTabActive,
                  ]}
                  onPress={() => handlePeriod(tab.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.periodTabText,
                      period === tab.key && styles.periodTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Amount */}
          <Text style={styles.heroAmount}>{formatNaira(totalSales)}</Text>

          {/* Transaction badge */}
          {activeSales.length > 0 && (
            <View style={styles.txnBadge}>
              <Ionicons name="trending-up" size={11} color="#fff" />
              <Text style={styles.txnBadgeText}>
                {activeSales.length} transaction
                {activeSales.length !== 1 ? "s" : ""}
                {period !== "today"
                  ? ` · ${period === "week" ? "7 days" : "30 days"}`
                  : ""}
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={styles.heroDivider} />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatPill
              label={period === "today" ? "TODAY'S PROFIT" : "NET PROFIT"}
              amount={formatNaira(netProfit)}
              ratio={profitRatio}
              fillColor="#52B788"
              textColor={netProfit >= 0 ? "#B7E4C7" : "#FF6B6B"}
            />
            <StatPill
              label="EXPENSES"
              amount={formatNaira(totalExpenses)}
              ratio={expenseRatio}
              fillColor="#FF6B6B"
              textColor="#FFC9C9"
              borderColor="rgba(255,255,255,0.15)"
            />
          </View>
        </LinearGradient>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            {
              label: "New Sale",
              icon: "cart-outline" as const,
              gradient: ["#1B4332", "#2D6A4F"] as [string, string],
              route: "/(tabs)/sales",
            },
            {
              label: "Expense",
              icon: "receipt-outline" as const,
              gradient: ["#7F3D17", "#A0522D"] as [string, string],
              route: "/(tabs)/expenses",
            },
            {
              label: "Credit",
              icon: "people-outline" as const,
              gradient: ["#92400E", "#D97706"] as [string, string],
              route: "/(tabs)/credits",
            },
            {
              label: "Ask AI",
              icon: "sparkles-outline" as const,
              gradient: ["#1A1A2E", "#16213E"] as [string, string],
              route: "/(tabs)/advisor",
            },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionBtn}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.82}
            >
              <LinearGradient
                colors={action.gradient}
                style={styles.actionIconWrap}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={action.icon} size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Payment Alert ── */}
        {outstandingCredits > 0 && (
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => router.push("/(tabs)/credits")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FEE2E2", "#FECACA"]}
              style={styles.alertIconWrap}
            >
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Outstanding Credits</Text>
              <Text style={styles.alertSub}>
                {formatNaira(outstandingCredits)} awaiting collection
              </Text>
            </View>
            <View style={styles.alertChevronWrap}>
              <Ionicons name="chevron-forward" size={16} color="#DC2626" />
            </View>
          </TouchableOpacity>
        )}

        {/* ── AI Business Tip ── */}
        {/* TO RE-ENABLE: remove the closing comment marker below and the opening one above,
            then also uncomment `loadTip()` in useFocusEffect (~line 196) */}
        {/* <TouchableOpacity
          style={styles.tipCard}
          activeOpacity={0.88}
          onPress={() => router.push("/(tabs)/advisor")}
        >
          <View style={styles.tipHeaderRow}>
            <View style={styles.tipIconWrap}>
              <Text style={{ fontSize: 15 }}>💡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>OwoTrack AI Tip</Text>
              <Text style={styles.tipSubtitle}>Powered by your data</Text>
            </View>
            <View style={styles.tipBadge}>
              <Ionicons name="sparkles" size={10} color={colors.primary} />
              <Text style={styles.tipBadgeText}>AI</Text>
            </View>
          </View>

          {aiTipLoading || aiTip === null ? (
            <>
              <View style={[styles.shimmerLine, { width: "100%" }]} />
              <View style={[styles.shimmerLine, { width: "75%", marginTop: 6 }]} />
            </>
          ) : (
            <Text style={styles.tipText}>{aiTip}</Text>
          )}

          <View style={styles.tipFooter}>
            <Text style={styles.tipCta}>Tap to chat with your AI coach</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </View>
        </TouchableOpacity> */}

        {/* ── Recent Ledger ── */}
        <View style={styles.ledgerHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {period === "today"
                ? "Recent Transactions"
                : `Transactions · ${period === "week" ? "7 Days" : "30 Days"}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.seeAllBtn}
            onPress={() => router.push("/(tabs)/ledger")}
          >
            <Text style={styles.seeAllText}>View All</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {activeSales.length === 0 && activeExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>
              {period === "today"
                ? "Record your first sale for today"
                : `No data for the last ${period === "week" ? "7" : "30"} days`}
            </Text>
          </View>
        ) : (
          <View style={styles.ledgerList}>
            {activeSales.slice(0, 3).map((sale) => (
              <View key={sale.localId || sale._id} style={styles.ledgerRow}>
                <View style={[styles.ledgerIconWrap, styles.ledgerIconSale]}>
                  <Ionicons name="bag-handle-outline" size={17} color="#1B4332" />
                </View>
                <View style={styles.ledgerInfo}>
                  <Text style={styles.ledgerName} numberOfLines={1}>
                    {sale.items[0]?.productName}
                    {sale.items.length > 1 ? ` +${sale.items.length - 1}` : ""}
                  </Text>
                  <View style={styles.ledgerMetaRow}>
                    <View
                      style={[
                        styles.ledgerStatusDot,
                        {
                          backgroundColor:
                            sale.syncStatus === "pending" ? "#F59E0B" : "#10B981",
                        },
                      ]}
                    />
                    <Text style={styles.ledgerMeta}>
                      {sale.paymentType} ·{" "}
                      {sale.syncStatus === "pending" ? "Pending" : "Synced"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.ledgerAmount, { color: "#1B4332" }]}>
                  +{formatNaira(sale.totalAmount)}
                </Text>
              </View>
            ))}

            {activeExpenses.slice(0, 2).map((exp) => (
              <View key={exp.localId || exp._id} style={styles.ledgerRow}>
                <View style={[styles.ledgerIconWrap, styles.ledgerIconExpense]}>
                  <Ionicons name="receipt-outline" size={17} color="#DC2626" />
                </View>
                <View style={styles.ledgerInfo}>
                  <Text style={styles.ledgerName} numberOfLines={1}>
                    {exp.description}
                  </Text>
                  <Text style={styles.ledgerMeta}>{exp.category}</Text>
                </View>
                <Text style={[styles.ledgerAmount, { color: "#DC2626" }]}>
                  -{formatNaira(exp.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.viewAllBtn}
          onPress={() => router.push("/(tabs)/ledger")}
          activeOpacity={0.8}
        >
          <Text style={styles.viewAllBtnText}>View All Transactions</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>

      <OnboardingGuideModal visible={guideVisible} onClose={handleCloseGuide} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 56 },

    // ── Header ──
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 22,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
    greetingText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.2 },
    nameText: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginTop: 1 },
    helpBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: "center", justifyContent: "center",
    },
    notifBtn: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    notifDot: {
      position: "absolute",
      top: 9,
      right: 9,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#EF4444",
      borderWidth: 1.5,
      borderColor: colors.surface,
    },

    // ── Hero Card ──
    heroCard: {
      borderRadius: 24,
      padding: 22,
      marginBottom: 28,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#1B4332",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    decCircle1: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(255,255,255,0.04)",
      top: -60,
      right: -40,
    },
    decCircle2: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "rgba(255,255,255,0.04)",
      bottom: -30,
      left: 20,
    },
    periodRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    heroCardLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: "rgba(255,255,255,0.6)",
      letterSpacing: 1.2,
    },
    periodTabs: {
      flexDirection: "row",
      backgroundColor: "rgba(0,0,0,0.25)",
      borderRadius: 10,
      padding: 3,
    },
    periodTab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    periodTabActive: { backgroundColor: "rgba(255,255,255,0.18)" },
    periodTabText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
    periodTabTextActive: { color: "#fff" },

    heroAmount: {
      fontSize: 38,
      fontWeight: "900",
      color: "#fff",
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    txnBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 20,
    },
    txnBadgeText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.9)" },

    heroDivider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.12)",
      marginBottom: 18,
    },
    statsRow: { flexDirection: "row" },

    // ── Quick Actions ──
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 14,
      letterSpacing: 0.1,
    },
    actionsGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 26,
    },
    actionBtn: { alignItems: "center", flex: 1 },
    actionIconWrap: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
      }),
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
      textAlign: "center",
      letterSpacing: 0.2,
    },

    // ── Alert ──
    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: "#FFF5F5",
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#FECACA",
      ...Platform.select({
        ios: {
          shadowColor: "#DC2626",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    alertIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    alertTitle: { fontSize: 13, fontWeight: "800", color: "#DC2626" },
    alertSub: { fontSize: 12, color: "#EF4444", marginTop: 2, opacity: 0.8 },
    alertChevronWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: "#FEE2E2",
      alignItems: "center",
      justifyContent: "center",
    },

    // ── AI Tip ──
    tipCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 28,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
        },
        android: { elevation: 3 },
      }),
    },
    tipHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    tipIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#F0FDF4",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#BBF7D0",
    },
    tipTitle: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
    tipSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    tipBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#F0FDF4",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#BBF7D0",
    },
    tipBadgeText: { fontSize: 10, fontWeight: "800", color: colors.primary },
    tipText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 14,
    },
    shimmerLine: {
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.border,
      marginBottom: 4,
    },
    tipFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    tipCta: { fontSize: 11, fontWeight: "700", color: colors.primary },

    // ── Ledger ──
    ledgerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
    seeAllText: { fontSize: 12, fontWeight: "700", color: colors.primary },

    emptyState: {
      alignItems: "center",
      paddingVertical: 36,
      gap: 8,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
    emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: "center" },

    viewAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 14,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    viewAllBtnText: { fontSize: 14, fontWeight: "700", color: colors.primary },

    ledgerList: { gap: 8 },
    ledgerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    ledgerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    ledgerIconSale: { backgroundColor: "#DCFCE7" },
    ledgerIconExpense: { backgroundColor: "#FEE2E2" },
    ledgerInfo: { flex: 1 },
    ledgerName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
    ledgerMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    ledgerStatusDot: { width: 6, height: 6, borderRadius: 3 },
    ledgerMeta: { fontSize: 11, color: colors.textMuted },
    ledgerAmount: { fontSize: 14, fontWeight: "800" },
  });







// import React, { useCallback, useEffect, useRef, useState } from "react";
// import {
//   View, Text, StyleSheet,
//   ScrollView, TouchableOpacity, RefreshControl,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { router } from "expo-router";
// import { useFocusEffect } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { useAuthStore } from "../../src/store/authStore";
// import { useSalesStore } from "../../src/store/salesStore";
// import { useExpenseStore } from "../../src/store/expenseStore";
// import { salesDb } from "../../src/database/salesDb";
// import { expenseDb } from "../../src/database/expenseDb";
// import { Sale, Expense } from "../../src/types";
// import { OfflineBanner } from "../../src/components/common/OfflineBanner";
// import { useTheme } from "../../src/hooks/useTheme";
// import { formatNaira } from "../../src/utils/formatters";
// import { aiService } from "../../src/services/aiService";

// // ─── Types ────────────────────────────────────────────────────────────────────

// type Period = "today" | "week" | "month";

// const PERIOD_TABS: { key: Period; label: string }[] = [
//   { key: "today", label: "Today" },
//   { key: "week", label: "7 Days" },
//   { key: "month", label: "30 Days" },
// ];

// const CARD_LABEL: Record<Period, string> = {
//   today: "TODAY'S SALES",
//   week:  "LAST 7 DAYS",
//   month: "LAST 30 DAYS",
// };


// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const toYMD = (d: Date) =>
//   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// function getDateRange(period: Period): { startYMD: string; endYMD: string } {
//   const today = new Date();
//   const endYMD = toYMD(today);
//   if (period === "today") return { startYMD: endYMD, endYMD };
//   const start = new Date(today);
//   start.setDate(today.getDate() - (period === "week" ? 6 : 29));
//   return { startYMD: toYMD(start), endYMD };
// }

// // ─── Main Screen ──────────────────────────────────────────────────────────────

// export default function DashboardScreen() {
//   const colors = useTheme();
//   const { user } = useAuthStore();
//   const { todaySales, loadToday: loadSales, isLoading: salesLoading } = useSalesStore();
//   const { todayExpenses, loadToday: loadExpenses } = useExpenseStore();

//   const [period, setPeriod] = useState<Period>("today");
//   const [periodSales, setPeriodSales] = useState<Sale[]>([]);
//   const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([]);
//   const [periodLoading, setPeriodLoading] = useState(false);
//   const [aiTip, setAiTip] = useState<string | null>(null);
//   const [aiTipLoading, setAiTipLoading] = useState(false);

//   // Active data: today uses the store (live-updated when a new sale is added);
//   // week/month pull directly from SQLite so they span multiple days.
//   const activeSales = period === "today" ? todaySales : periodSales;
//   const activeExpenses = period === "today" ? todayExpenses : periodExpenses;

//   const totalSales    = activeSales.reduce((s, x) => s + x.totalAmount, 0);
//   const totalExpenses = activeExpenses.reduce((s, x) => s + x.amount, 0);
//   const netProfit     = totalSales - totalExpenses;
//   const outstandingCredits = 0;

//   const profitRatio  = totalSales > 0 ? Math.min(Math.max(netProfit / totalSales, 0), 1) : 0;
//   const expenseRatio = totalSales > 0 ? Math.min(totalExpenses / totalSales, 1) : 0;

//   // ── Loaders ────────────────────────────────────────────────────────────────

//   const loadToday = useCallback(() => {
//     if (!user?._id) return;
//     loadSales(user._id);
//     loadExpenses(user._id);
//   }, [user?._id, loadSales, loadExpenses]);

//   const loadPeriod = useCallback(async (p: Period) => {
//     if (!user?._id) return;
//     if (p === "today") { loadToday(); return; }
//     setPeriodLoading(true);
//     try {
//       const { startYMD, endYMD } = getDateRange(p);
//       const [sales, expenses] = await Promise.all([
//         salesDb.getByDateRange(user._id, startYMD, endYMD),
//         expenseDb.getByDateRange(user._id, startYMD, endYMD),
//       ]);
//       setPeriodSales(sales);
//       setPeriodExpenses(expenses);
//     } finally {
//       setPeriodLoading(false);
//     }
//   }, [user?._id, loadToday]);

//   const loadTip = useCallback(async (forceRefresh = false) => {
//     setAiTipLoading(true);
//     try {
//       const tip = await aiService.getTip(forceRefresh);
//       setAiTip(tip);
//     } catch {
//       setAiTip("Keep tracking your sales daily to spot trends and grow your profit.");
//     } finally {
//       setAiTipLoading(false);
//     }
//   }, []);

//   const load = useCallback(() => { loadPeriod(period); }, [loadPeriod, period]);

//   const loadRef = useRef(load);
//   useEffect(() => { loadRef.current = load; }, [load]);

//   useFocusEffect(useCallback(() => {
//     loadRef.current();
//     loadTip();
//   }, [loadTip]));

//   // Reload when period changes
//   useEffect(() => { loadPeriod(period); }, [period]);  // eslint-disable-line react-hooks/exhaustive-deps

//   const handlePeriod = (p: Period) => {
//     setPeriod(p);
//     // loadPeriod is called via the effect above
//   };

//   // ── Avatar ─────────────────────────────────────────────────────────────────

//   const initials = (user?.name ?? "T")
//     .split(" ")
//     .map((w) => w[0])
//     .join("")
//     .toUpperCase()
//     .slice(0, 2);

//   const handleRefresh = useCallback(() => {
//     load();
//     loadTip(true);
//   }, [load, loadTip]);

//   const isLoading = salesLoading || periodLoading;
//   const styles = makeStyles(colors);

//   // ── Render ─────────────────────────────────────────────────────────────────

//   return (
//     <SafeAreaView style={styles.safe}>
//       <OfflineBanner />
//       <ScrollView
//         contentContainerStyle={styles.container}
//         showsVerticalScrollIndicator={false}
//         refreshControl={
//           <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
//         }
//       >
//         {/* Header */}
//         <View style={styles.header}>
//           <View style={styles.headerLeft}>
//             <View style={styles.avatar}>
//               <Text style={styles.avatarText}>{initials}</Text>
//             </View>
//             <View>
//               <Text style={styles.welcomeText}>Welcome back,</Text>
//               <Text style={styles.nameText}>
//                 {user?.name?.split(" ")[0] ?? "Trader"}! 👋
//               </Text>
//             </View>
//           </View>
//           <TouchableOpacity style={styles.notifBtn}>
//             <Ionicons name="notifications" size={22} color={colors.primary} />
//           </TouchableOpacity>
//         </View>

//         {/* Main Sales Card */}
//         <View style={styles.salesCard}>
//           {/* Card top row: label + period tabs */}
//           <View style={styles.salesCardTop}>
//             <Text style={styles.salesLabel}>{CARD_LABEL[period]}</Text>
//             <View style={styles.periodTabs}>
//               {PERIOD_TABS.map((tab) => (
//                 <TouchableOpacity
//                   key={tab.key}
//                   style={[styles.periodTab, period === tab.key && styles.periodTabActive]}
//                   onPress={() => handlePeriod(tab.key)}
//                 >
//                   <Text style={[styles.periodTabText, period === tab.key && styles.periodTabTextActive]}>
//                     {tab.label}
//                   </Text>
//                 </TouchableOpacity>
//               ))}
//             </View>
//           </View>

//           {/* Total amount */}
//           <Text style={styles.salesAmount}>{formatNaira(totalSales)}</Text>

//           {/* Txn count badge */}
//           {activeSales.length > 0 && (
//             <View style={styles.txnBadge}>
//               <Ionicons name="trending-up" size={12} color={colors.primary} />
//               <Text style={styles.txnBadgeText}>
//                 {activeSales.length} txn{activeSales.length !== 1 ? "s" : ""}
//                 {period !== "today" ? ` · ${period === "week" ? "7d" : "30d"}` : ""}
//               </Text>
//             </View>
//           )}

//           {/* Sub-cards: Profit + Expenses */}
//           <View style={styles.subCardsRow}>
//             <View style={styles.subCard}>
//               <Text style={styles.subCardLabel}>
//                 {period === "today" ? "Today's Profit" : "Net Profit"}
//               </Text>
//               <Text style={[styles.subCardAmount, { color: netProfit >= 0 ? colors.textPrimary : colors.danger }]}>
//                 {formatNaira(netProfit)}
//               </Text>
//               <View style={styles.progressBg}>
//                 <View style={[styles.progressFill, { width: `${profitRatio * 100}%`, backgroundColor: "#8B6914" }]} />
//               </View>
//             </View>
//             <View style={[styles.subCard, styles.subCardRight]}>
//               <Text style={styles.subCardLabel}>Expenses</Text>
//               <Text style={[styles.subCardAmount, { color: colors.danger }]}>
//                 {formatNaira(totalExpenses)}
//               </Text>
//               <View style={styles.progressBg}>
//                 <View style={[styles.progressFill, { width: `${expenseRatio * 100}%`, backgroundColor: colors.danger }]} />
//               </View>
//             </View>
//           </View>
//         </View>

//         {/* Quick Actions */}
//         <Text style={styles.sectionTitle}>Quick Actions</Text>
//         <View style={styles.actionsRow}>
//           <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/sales")}>
//             <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
//               <Ionicons name="cart" size={26} color="#fff" />
//             </View>
//             <Text style={styles.actionText}>+ Sales</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/expenses")}>
//             <View style={[styles.actionIcon, { backgroundColor: "#5C3D1E" }]}>
//               <Ionicons name="receipt" size={26} color="#fff" />
//             </View>
//             <Text style={styles.actionText}>+ Expense</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/credits")}>
//             <View style={[styles.actionIcon, { backgroundColor: "#D97706" }]}>
//               <Ionicons name="people" size={26} color="#fff" />
//             </View>
//             <Text style={styles.actionText}>+ Credit</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/advisor")}>
//             <View style={[styles.actionIcon, { backgroundColor: "#111" }]}>
//               <Ionicons name="sparkles" size={26} color="#fff" />
//             </View>
//             <Text style={styles.actionText}>Ask AI</Text>
//           </TouchableOpacity>
//         </View>

//         {/* Payment Alert */}
//         {outstandingCredits > 0 && (
//           <TouchableOpacity style={styles.alertCard} onPress={() => router.push("/(tabs)/credits")}>
//             <View style={styles.alertIconWrap}>
//               <Ionicons name="alert-circle" size={22} color={colors.danger} />
//             </View>
//             <View style={{ flex: 1 }}>
//               <Text style={styles.alertTitle}>Payment Alert</Text>
//               <Text style={styles.alertSub}>You have outstanding credits of {formatNaira(outstandingCredits)}</Text>
//             </View>
//             <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
//           </TouchableOpacity>
//         )}

//         {/* AI Business Tip */}
//         <TouchableOpacity
//           style={styles.tipCard}
//           activeOpacity={0.85}
//           onPress={() => router.push("/(tabs)/advisor")}
//         >
//           <View style={styles.tipHeader}>
//             <Text style={styles.tipBulb}>💡</Text>
//             <View style={{ flex: 1 }}>
//               <Text style={styles.tipTitle}>OwoTrack AI Tip</Text>
//             </View>
//             <Ionicons name="sparkles" size={14} color={colors.primary} />
//           </View>
//           {aiTipLoading || aiTip === null ? (
//             <View style={styles.tipShimmer} />
//           ) : (
//             <Text style={styles.tipText}>{aiTip}</Text>
//           )}
//           <Text style={styles.tipCta}>Tap to ask your AI coach →</Text>
//         </TouchableOpacity>

//         {/* Recent Ledger */}
//         <View style={styles.ledgerHeader}>
//           <Text style={styles.sectionTitle}>
//             {period === "today" ? "Recent Ledger" : `Recent Ledger (${period === "week" ? "7 Days" : "30 Days"})`}
//           </Text>
//           <TouchableOpacity onPress={() => router.push("/(tabs)/ledger")}>
//             <Text style={styles.seeAll}>See All</Text>
//           </TouchableOpacity>
//         </View>

//         {activeSales.length === 0 && activeExpenses.length === 0 ? (
//           <View style={styles.emptyLedger}>
//             <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
//             <Text style={styles.emptyText}>
//               {period === "today"
//                 ? "No transactions today yet"
//                 : `No transactions in the last ${period === "week" ? "7" : "30"} days`}
//             </Text>
//           </View>
//         ) : (
//           <>
//             {activeSales.slice(0, 3).map((sale) => (
//               <View key={sale.localId || sale._id} style={styles.ledgerRow}>
//                 <View style={[styles.ledgerIcon, { backgroundColor: "#E8F5E9" }]}>
//                   <Ionicons name="bag-handle" size={18} color={colors.primary} />
//                 </View>
//                 <View style={styles.ledgerInfo}>
//                   <Text style={styles.ledgerName}>
//                     {sale.items[0]?.productName}
//                     {sale.items.length > 1 ? ` +${sale.items.length - 1} more` : ""}
//                   </Text>
//                   <Text style={styles.ledgerMeta}>
//                     {sale.paymentType} • {sale.syncStatus === "pending" ? "⏳ Pending" : "✅ Synced"}
//                   </Text>
//                 </View>
//                 <Text style={[styles.ledgerAmount, { color: colors.primary }]}>
//                   +{formatNaira(sale.totalAmount)}
//                 </Text>
//               </View>
//             ))}
//             {activeExpenses.slice(0, 2).map((exp) => (
//               <View key={exp.localId || exp._id} style={styles.ledgerRow}>
//                 <View style={[styles.ledgerIcon, { backgroundColor: "#FEE2E2" }]}>
//                   <Ionicons name="receipt" size={18} color={colors.danger} />
//                 </View>
//                 <View style={styles.ledgerInfo}>
//                   <Text style={styles.ledgerName}>{exp.description}</Text>
//                   <Text style={styles.ledgerMeta}>{exp.category}</Text>
//                 </View>
//                 <Text style={[styles.ledgerAmount, { color: colors.danger }]}>
//                   -{formatNaira(exp.amount)}
//                 </Text>
//               </View>
//             ))}
//           </>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────

// const makeStyles = (colors: ReturnType<typeof useTheme>) =>
//   StyleSheet.create({
//     safe: { flex: 1, backgroundColor: colors.background },
//     container: { padding: 20, paddingBottom: 48 },

//     header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
//     headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
//     avatar: {
//       width: 44, height: 44, borderRadius: 22,
//       backgroundColor: colors.primary,
//       alignItems: "center", justifyContent: "center",
//     },
//     avatarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
//     welcomeText: { fontSize: 13, color: colors.textSecondary },
//     nameText: { fontSize: 17, fontWeight: "700", color: colors.primary },
//     notifBtn: {
//       width: 40, height: 40, borderRadius: 20,
//       backgroundColor: colors.surface,
//       alignItems: "center", justifyContent: "center",
//       borderWidth: 1, borderColor: colors.border,
//     },

//     salesCard: {
//       backgroundColor: colors.surface,
//       borderRadius: 20, padding: 20,
//       marginBottom: 24,
//       shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
//       shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
//     },
//     salesCardTop: {
//       flexDirection: "row", justifyContent: "space-between",
//       alignItems: "center", marginBottom: 12,
//     },
//     salesLabel: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.8 },

//     periodTabs: {
//       flexDirection: "row",
//       backgroundColor: colors.background,
//       borderRadius: 10, padding: 3,
//       borderWidth: 1, borderColor: colors.border,
//     },
//     periodTab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
//     periodTabActive: { backgroundColor: colors.primary },
//     periodTabText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
//     periodTabTextActive: { color: "#fff" },

//     salesAmount: { fontSize: 34, fontWeight: "800", color: colors.primary, marginBottom: 6 },
//     txnBadge: {
//       flexDirection: "row", alignItems: "center", gap: 4,
//       alignSelf: "flex-start",
//       backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 3,
//       borderRadius: 20, marginBottom: 16,
//     },
//     txnBadgeText: { fontSize: 11, fontWeight: "600", color: colors.primary },

//     subCardsRow: { flexDirection: "row" },
//     subCard: { flex: 1, paddingRight: 16 },
//     subCardRight: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 16, paddingRight: 0 },
//     subCardLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
//     subCardAmount: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
//     progressBg: { height: 4, backgroundColor: colors.border, borderRadius: 2 },
//     progressFill: { height: 4, borderRadius: 2 },

//     sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 14 },

//     actionsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
//     actionBtn: { alignItems: "center", flex: 1 },
//     actionIcon: {
//       width: 60, height: 60, borderRadius: 16,
//       alignItems: "center", justifyContent: "center", marginBottom: 8,
//     },
//     actionText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },

//     alertCard: {
//       flexDirection: "row", alignItems: "center", gap: 12,
//       backgroundColor: "#FFF5F5",
//       borderLeftWidth: 4, borderLeftColor: colors.danger,
//       borderRadius: 12, padding: 14, marginBottom: 16,
//     },
//     alertIconWrap: {
//       width: 36, height: 36, borderRadius: 18,
//       backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
//     },
//     alertTitle: { fontSize: 14, fontWeight: "700", color: colors.danger },
//     alertSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

//     tipCard: {
//       backgroundColor: "#F0FDF4",
//       borderRadius: 16, padding: 16, marginBottom: 24,
//       borderWidth: 1, borderColor: "#BBF7D0",
//     },
//     tipHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
//     tipBulb: { fontSize: 18 },
//     tipTitle: { fontSize: 14, fontWeight: "700", color: colors.primary },
//     tipText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 8 },
//     tipShimmer: {
//       height: 36, borderRadius: 6, backgroundColor: "#D1FAE5",
//       marginBottom: 8,
//     },
//     tipCta: { fontSize: 11, fontWeight: "600", color: colors.primary, marginTop: 2 },

//     ledgerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
//     seeAll: { fontSize: 13, fontWeight: "600", color: colors.primary },
//     emptyLedger: { alignItems: "center", paddingVertical: 24, gap: 8 },
//     emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
//     ledgerRow: {
//       flexDirection: "row", alignItems: "center", gap: 12,
//       backgroundColor: colors.surface, borderRadius: 12,
//       padding: 12, marginBottom: 8,
//     },
//     ledgerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
//     ledgerInfo: { flex: 1 },
//     ledgerName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
//     ledgerMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
//     ledgerAmount: { fontSize: 15, fontWeight: "700" },
//   });
