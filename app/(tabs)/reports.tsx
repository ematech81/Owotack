
import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useReportStore } from "../../src/store/reportStore";
import { useTheme } from "../../src/hooks/useTheme";
import { formatNaira } from "../../src/utils/formatters";
import { ExpenseBreakdown, DayPoint, WeekPoint, PaymentBreakdown } from "../../src/services/reportService";

type Period = "today" | "week" | "month";

const todayStr = () => new Date().toISOString().split("T")[0];
const nowYear = () => new Date().getFullYear();
const nowMonth = () => new Date().getMonth() + 1;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function GrowthBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: up ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, marginTop: 6,
      borderWidth: 1,
      borderColor: up ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
    }}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={10} color={up ? "#059669" : "#DC2626"} />
      <Text style={{ fontSize: 10, fontWeight: "800", color: up ? "#059669" : "#DC2626" }}>
        {Math.abs(pct)}%
      </Text>
    </View>
  );
}

const PAYMENT_LABELS: { key: keyof PaymentBreakdown; label: string; color: string }[] = [
  { key: "cash",     label: "Cash",     color: "#10B981" },
  { key: "transfer", label: "Transfer", color: "#3B82F6" },
  { key: "pos",      label: "POS",      color: "#8B5CF6" },
  { key: "credit",   label: "Credit",   color: "#F59E0B" },
  { key: "mixed",    label: "Mixed",    color: "#6B7280" },
];

// ── Chart helpers ────────────────────────────────────────────────────────────

const CHART_H = 150;
const CHART_PAD = 48;

function formatShort(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
  return `₦${Math.round(n)}`;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

function ChartGrid({ max, borderColor }: { max: number; borderColor: string }) {
  return (
    <>
      {[1, 0.75, 0.5, 0.25, 0].map((r) => (
        <View
          key={r}
          style={{
            position: "absolute",
            top: CHART_H * (1 - r),
            left: 0, right: 0, height: 1,
            backgroundColor: r === 0 ? borderColor : borderColor + "60",
          }}
        />
      ))}
    </>
  );
}

function YAxis({ max, textColor }: { max: number; textColor: string }) {
  return (
    <View style={{ width: CHART_PAD, height: CHART_H, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 8 }}>
      {[1, 0.75, 0.5, 0.25, 0].map((r) => (
        <Text key={r} style={{ fontSize: 9, color: textColor, fontWeight: "600" }}>{formatShort(max * r)}</Text>
      ))}
    </View>
  );
}

// ── 7-day grouped bar chart ──────────────────────────────────────────────────

type WeekSeries = "all" | "sales";

function WeekChart({ days, colors }: { days: DayPoint[]; colors: ReturnType<typeof useTheme> }) {
  const [series, setSeries] = useState<WeekSeries>("all");
  const hasData = days.some((d) => d.totalSales > 0 || d.totalExpenses > 0);

  if (!hasData) {
    return <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 24 }}>No data for this period</Text>;
  }

  const max = Math.max(
    ...days.flatMap((d) => [d.totalSales, series === "all" ? d.totalExpenses : 0, series === "all" ? Math.max(d.netProfit, 0) : 0]),
    1
  );

  return (
    <View>
      {/* Series toggle */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
        {(["all", "sales"] as WeekSeries[]).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSeries(s)}
            activeOpacity={0.85}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 22,
              backgroundColor: series === s ? colors.primary : "transparent",
              borderWidth: 1, borderColor: series === s ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: series === s ? "#fff" : colors.textMuted, letterSpacing: 0.2 }}>
              {s === "all" ? "All Metrics" : "Sales Only"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={{ flexDirection: "row" }}>
        <YAxis max={max} textColor={colors.textMuted} />
        <View style={{ flex: 1, height: CHART_H + 22 }}>
          <View style={{ height: CHART_H, position: "relative" }}>
            <ChartGrid max={max} borderColor={colors.border} />
            <View style={{ flexDirection: "row", height: CHART_H, alignItems: "flex-end" }}>
              {days.map((day, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center", height: CHART_H, justifyContent: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                    {series === "all" && (
                      <View style={{
                        width: 7,
                        height: Math.max(day.totalExpenses > 0 ? (day.totalExpenses / max) * CHART_H : 0, day.totalExpenses > 0 ? 3 : 0),
                        backgroundColor: "#EF4444",
                        borderRadius: 3,
                      }} />
                    )}
                    <View style={{
                      width: series === "all" ? 9 : 18,
                      height: Math.max(day.totalSales > 0 ? (day.totalSales / max) * CHART_H : 0, day.totalSales > 0 ? 3 : 0),
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                    }} />
                    {series === "all" && day.netProfit > 0 && (
                      <View style={{
                        width: 7,
                        height: Math.max((day.netProfit / max) * CHART_H, 3),
                        backgroundColor: "#3B82F6",
                        borderRadius: 3,
                      }} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
          {/* X-axis labels */}
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {days.map((day, i) => (
              <Text key={i} style={{ flex: 1, fontSize: 10, color: colors.textMuted, textAlign: "center", fontWeight: "600" }}>{day.label}</Text>
            ))}
          </View>
        </View>
      </View>

      {/* Legend */}
      {series === "all" && (
        <View style={{ flexDirection: "row", gap: 18, marginTop: 16, justifyContent: "center" }}>
          <LegendDot color={colors.primary} label="Sales" />
          <LegendDot color="#3B82F6" label="Profit" />
          <LegendDot color="#EF4444" label="Expenses" />
        </View>
      )}
    </View>
  );
}

// ── Monthly bar chart (week buckets) ─────────────────────────────────────────

function MonthChart({ weeks, colors }: { weeks: WeekPoint[]; colors: ReturnType<typeof useTheme> }) {
  const hasData = weeks.some((w) => w.totalSales > 0);
  if (!hasData) {
    return <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 24 }}>No data for this month</Text>;
  }

  const max = Math.max(...weeks.flatMap((w) => [w.totalSales, Math.max(w.netProfit, 0)]), 1);

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        <YAxis max={max} textColor={colors.textMuted} />
        <View style={{ flex: 1, height: CHART_H + 22 }}>
          <View style={{ height: CHART_H, position: "relative" }}>
            <ChartGrid max={max} borderColor={colors.border} />
            <View style={{ flexDirection: "row", height: CHART_H, alignItems: "flex-end" }}>
              {weeks.map((week, i) => (
                <View key={i} style={{ flex: 1, alignItems: "center", height: CHART_H, justifyContent: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                    <View style={{
                      width: 20,
                      height: Math.max(week.totalSales > 0 ? (week.totalSales / max) * CHART_H : 0, week.totalSales > 0 ? 4 : 0),
                      backgroundColor: colors.primary,
                      borderRadius: 5,
                    }} />
                    {week.netProfit > 0 && (
                      <View style={{
                        width: 13,
                        height: Math.max((week.netProfit / max) * CHART_H, 4),
                        backgroundColor: "#3B82F6",
                        borderRadius: 4,
                      }} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {weeks.map((week, i) => (
              <Text key={i} style={{ flex: 1, fontSize: 10, color: colors.textMuted, textAlign: "center", fontWeight: "600" }}>{week.label}</Text>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 18, marginTop: 16, justifyContent: "center" }}>
        <LegendDot color={colors.primary} label="Sales" />
        <LegendDot color="#3B82F6" label="Net Profit" />
      </View>
    </View>
  );
}

// ── Today horizontal bar snapshot ────────────────────────────────────────────

function TodayChart({ sales, expenses, profit, colors }: {
  sales: number; expenses: number; profit: number; colors: ReturnType<typeof useTheme>;
}) {
  if (sales === 0 && expenses === 0) {
    return <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 24 }}>No transactions today</Text>;
  }

  const maxVal = Math.max(sales, expenses, Math.abs(profit), 1);
  const rows = [
    { label: "Revenue",   value: sales,    color: colors.primary, icon: "cash-outline" as const },
    { label: "Expenses",  value: expenses, color: "#EF4444",      icon: "trending-down-outline" as const },
    { label: "Net Profit", value: profit,  color: profit >= 0 ? "#3B82F6" : "#EF4444", icon: "wallet-outline" as const },
  ];

  return (
    <View style={{ gap: 16 }}>
      {rows.map(({ label, value, color, icon }) => (
        <View key={label}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 8,
                backgroundColor: color + "18",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name={icon} size={13} color={color} />
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>{label}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "800", color }}>{formatNaira(value)}</Text>
          </View>
          <View style={{ height: 10, backgroundColor: colors.border + "60", borderRadius: 5, overflow: "hidden" }}>
            <View style={{
              height: 10, borderRadius: 5,
              width: `${Math.max(Math.abs(value) / maxVal * 100, value !== 0 ? 2 : 0)}%`,
              backgroundColor: color,
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Expense breakdown horizontal bars ───────────────────────────────────────
const EXPENSE_LABELS: Record<string, string> = {
  stock_purchase: "Stock Purchase",
  transportation: "Transport",
  market_levy: "Market Levy",
  labor: "Labour",
  utilities: "Utilities",
  other: "Other",
};

const EXPENSE_COLORS = ["#EF4444", "#F97316", "#F59E0B", "#EC4899", "#8B5CF6", "#6B7280"];

function ExpenseBreakdownSection({ breakdown, colors }: {
  breakdown: ExpenseBreakdown;
  colors: ReturnType<typeof useTheme>;
}) {
  const entries = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (entries.length === 0) {
    return <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 }}>No expenses recorded</Text>;
  }

  return (
    <View style={{ gap: 14 }}>
      {entries.map(([key, amount], i) => {
        const pct = total > 0 ? (amount / total) * 100 : 0;
        const color = EXPENSE_COLORS[i % EXPENSE_COLORS.length];
        return (
          <View key={key}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
                  {EXPENSE_LABELS[key] ?? key}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>{pct.toFixed(0)}%</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                  {formatNaira(amount)}
                </Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: colors.border + "60", borderRadius: 4, overflow: "hidden" }}>
              <View
                style={{
                  height: 6, borderRadius: 4,
                  width: `${pct}%`,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const colors = useTheme();
  const {
    period, setPeriod,
    daily, weekly, monthly,
    isLoading,
    loadDaily, loadWeekly, loadMonthly,
  } = useReportStore();

  const [reportYear, setReportYear] = useState(nowYear);
  const [reportMonth, setReportMonth] = useState(nowMonth);

  const load = useCallback((p: Period = period, year = reportYear, month = reportMonth) => {
    if (p === "today") loadDaily(todayStr());
    else if (p === "week") loadWeekly(todayStr());
    else loadMonthly(year, month);
  }, [period, reportYear, reportMonth, loadDaily, loadWeekly, loadMonthly]);

  const navigateMonth = (dir: -1 | 1) => {
    let m = reportMonth + dir;
    let y = reportYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) return;
    setReportYear(y);
    setReportMonth(m);
    load("month", y, m);
  };

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useFocusEffect(useCallback(() => { loadRef.current(); }, []));

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const styles = makeStyles(colors);

  const metrics = period === "today" ? daily
    : period === "week" ? weekly
    : monthly;

  const chartTitle =
    period === "today" ? "Today's Overview"
    : period === "week" ? "7-Day Trend"
    : "Monthly Trend";

  const chartSubtitle =
    period === "today" ? "Snapshot of revenue, expenses and profit"
    : period === "week" ? "Daily breakdown across last 7 days"
    : "Weekly breakdown for the month";

  const topProducts =
    period === "week" ? weekly?.topProducts
    : period === "month" ? monthly?.topProducts
    : daily?.bestProduct ? [daily.bestProduct]
    : [];

  const maxProduct = topProducts?.reduce((m, p) => Math.max(m, p.amount), 1) ?? 1;
  const isAtCurrentMonth = reportYear === nowYear() && reportMonth === nowMonth();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titleLabel}>ANALYTICS</Text>
          <Text style={styles.title}>Reports</Text>
        </View>
        <TouchableOpacity onPress={() => load()} style={styles.refreshBtn} activeOpacity={0.8}>
          <Ionicons name="refresh" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Period tabs */}
      <View style={styles.tabs}>
        {(["today", "week", "month"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.tab, period === p && styles.tabActive]}
            onPress={() => handlePeriod(p)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === "today" ? "Today" : p === "week" ? "7 Days" : "Monthly"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Month navigation */}
      {period === "month" && (
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={() => navigateMonth(-1)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.monthLabelWrap}>
            <Text style={styles.monthNavLabel}>
              {MONTH_NAMES[reportMonth - 1]}
            </Text>
            <Text style={styles.monthNavYear}>{reportYear}</Text>
          </View>
          <TouchableOpacity
            style={[styles.monthNavBtn, isAtCurrentMonth && { opacity: 0.3 }]}
            onPress={() => navigateMonth(1)}
            disabled={isAtCurrentMonth}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isAtCurrentMonth ? colors.textMuted : colors.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {isLoading && !metrics ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading report…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => load()} tintColor={colors.primary} />
          }
        >
          {/* ── Hero Revenue Card ── */}
          <LinearGradient
            colors={["#1B4332", "#2D6A4F", "#40916C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.decCircle1} />
            <View style={styles.decCircle2} />

            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>TOTAL REVENUE</Text>
              <GrowthBadgeHero pct={metrics?.salesGrowthPercent ?? 0} />
            </View>

            <Text style={styles.heroAmount}>{formatNaira(metrics?.totalSales ?? 0)}</Text>

            {(metrics?.totalSales ?? 0) > 0 && (
              <View style={styles.heroMarginPill}>
                <Ionicons
                  name={(metrics?.profitMargin ?? 0) >= 0 ? "trending-up" : "trending-down"}
                  size={11}
                  color="#fff"
                />
                <Text style={styles.heroMarginText}>
                  {metrics?.profitMargin ?? 0}% profit margin
                </Text>
              </View>
            )}

            <View style={styles.heroDivider} />

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>NET PROFIT</Text>
                <Text style={[styles.heroStatValue, {
                  color: (metrics?.netProfit ?? 0) >= 0 ? "#B7E4C7" : "#FCA5A5"
                }]}>
                  {formatNaira(metrics?.netProfit ?? 0)}
                </Text>
                <GrowthBadgeHero pct={metrics?.profitGrowthPercent ?? 0} small />
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>EXPENSES</Text>
                <Text style={[styles.heroStatValue, { color: "#FCA5A5" }]}>
                  {formatNaira(metrics?.totalExpenses ?? 0)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Stats strip — transaction count + avg sale */}
          {(metrics?.salesCount ?? 0) > 0 && (
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="receipt-outline" size={15} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.statValue}>{metrics!.salesCount}</Text>
                  <Text style={styles.statLabel}>
                    {metrics!.salesCount === 1 ? "Transaction" : "Transactions"}
                  </Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="trending-up-outline" size={15} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.statValue}>{formatNaira(metrics!.avgSaleValue)}</Text>
                  <Text style={styles.statLabel}>Avg per sale</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Chart Card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{chartTitle}</Text>
                <Text style={styles.cardSubtitle}>{chartSubtitle}</Text>
              </View>
              <View style={styles.cardIconWrap}>
                <Ionicons name="bar-chart" size={16} color={colors.primary} />
              </View>
            </View>
            {period === "today" && (
              <TodayChart
                sales={daily?.totalSales ?? 0}
                expenses={daily?.totalExpenses ?? 0}
                profit={daily?.netProfit ?? 0}
                colors={colors}
              />
            )}
            {period === "week" && weekly?.days && (
              <WeekChart days={weekly.days} colors={colors} />
            )}
            {period === "month" && monthly?.weeks && (
              <MonthChart weeks={monthly.weeks} colors={colors} />
            )}
          </View>

          {/* ── Expense Breakdown ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Expense Breakdown</Text>
                <Text style={styles.cardSubtitle}>Where your money is going</Text>
              </View>
              <View style={[styles.cardIconWrap, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="pie-chart" size={16} color="#DC2626" />
              </View>
            </View>
            {metrics?.expenseBreakdown ? (
              <ExpenseBreakdownSection breakdown={metrics.expenseBreakdown} colors={colors} />
            ) : (
              <Text style={styles.empty}>No expenses recorded</Text>
            )}
          </View>

          {/* ── Payment Methods ── */}
          {metrics?.paymentBreakdown && metrics.totalSales > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Payment Methods</Text>
                  <Text style={styles.cardSubtitle}>How customers paid</Text>
                </View>
                <View style={[styles.cardIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="card" size={16} color="#3B82F6" />
                </View>
              </View>
              <View style={{ gap: 14 }}>
                {PAYMENT_LABELS.filter(({ key }) => (metrics.paymentBreakdown[key] ?? 0) > 0).map(({ key, label, color }) => {
                  const amount = metrics.paymentBreakdown[key];
                  const pct = metrics.totalSales > 0 ? (amount / metrics.totalSales) * 100 : 0;
                  return (
                    <View key={key}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                          <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>{label}</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{
                            paddingHorizontal: 6, paddingVertical: 2,
                            borderRadius: 6, backgroundColor: color + "18",
                          }}>
                            <Text style={{ fontSize: 10, color, fontWeight: "700" }}>{pct.toFixed(0)}%</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>
                            {formatNaira(amount)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ height: 6, backgroundColor: colors.border + "60", borderRadius: 4, overflow: "hidden" }}>
                        <View style={{ height: 6, borderRadius: 4, width: `${pct}%`, backgroundColor: color }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Top Products ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {period === "today" ? "Best Product Today" : "Top Products"}
                </Text>
                <Text style={styles.cardSubtitle}>Your best sellers</Text>
              </View>
              <View style={[styles.cardIconWrap, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="trophy" size={16} color="#D97706" />
              </View>
            </View>
            {topProducts && topProducts.length > 0 ? (
              <View style={{ gap: 14 }}>
                {topProducts.map((p, i) => (
                  <View key={i}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View style={[
                          styles.rankBadge,
                          i === 0 && styles.rankBadgeGold,
                          i === 1 && styles.rankBadgeSilver,
                          i === 2 && styles.rankBadgeBronze,
                        ]}>
                          <Text style={[
                            styles.rankText,
                            { color: i < 3 ? "#fff" : colors.textMuted },
                          ]}>
                            {i + 1}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                          {p.name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                        {formatNaira(p.amount)}
                      </Text>
                    </View>
                    <View style={{ height: 5, backgroundColor: colors.border + "60", borderRadius: 3, overflow: "hidden", marginLeft: 36 }}>
                      <View
                        style={{
                          height: 5, borderRadius: 3,
                          width: `${(p.amount / maxProduct) * 100}%`,
                          backgroundColor: i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#A16207" : colors.primary,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No sales recorded</Text>
            )}
          </View>

          {/* ── Summary Row ── */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconWrap, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="wallet-outline" size={16} color="#3B82F6" />
              </View>
              <Text style={styles.summaryLabel}>Gross Profit</Text>
              <Text style={styles.summaryValue}>{formatNaira(metrics?.grossProfit ?? 0)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconWrap, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="cube-outline" size={16} color="#8B5CF6" />
              </View>
              <Text style={styles.summaryLabel}>Cost of Goods</Text>
              <Text style={styles.summaryValue}>{formatNaira(metrics?.totalCostOfGoods ?? 0)}</Text>
            </View>
          </View>

          {/* ── Credit Summary ── */}
          <View style={[styles.card, { marginTop: 16, marginBottom: 0 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Credit Summary</Text>
                <Text style={styles.cardSubtitle}>Track receivables and collections</Text>
              </View>
              <View style={[styles.cardIconWrap, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="people" size={16} color="#D97706" />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
              <View style={[styles.creditBox, { backgroundColor: "#FEF3C7" }]}>
                <Text style={styles.creditLabel}>
                  {period === "today" ? "Given Today" : period === "week" ? "Given (7d)" : "Given (Month)"}
                </Text>
                <Text style={[styles.creditValue, { color: "#92400E" }]}>
                  {formatNaira(metrics?.creditGiven ?? 0)}
                </Text>
              </View>
              <View style={[styles.creditBox, { backgroundColor: "#DCFCE7" }]}>
                <Text style={styles.creditLabel}>
                  {period === "today" ? "Collected Today" : period === "week" ? "Collected (7d)" : "Collected (Month)"}
                </Text>
                <Text style={[styles.creditValue, { color: "#15803D" }]}>
                  {formatNaira(metrics?.creditCollected ?? 0)}
                </Text>
              </View>
            </View>

            <View style={styles.outstandingBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.outstandingIcon}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                </View>
                <Text style={styles.outstandingLabel}>Total Outstanding</Text>
              </View>
              <Text style={styles.outstandingValue}>
                {formatNaira(metrics?.totalOutstandingCredits ?? 0)}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Hero Growth Badge ────────────────────────────────────────────────────────

function GrowthBadgeHero({ pct, small = false }: { pct: number; small?: boolean }) {
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(255,255,255,0.18)",
      paddingHorizontal: small ? 6 : 8,
      paddingVertical: small ? 2 : 4,
      borderRadius: 10,
      marginTop: small ? 4 : 0,
      alignSelf: small ? "flex-start" : "auto",
    }}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={small ? 9 : 11} color="#fff" />
      <Text style={{ fontSize: small ? 9 : 11, fontWeight: "800", color: "#fff" }}>
        {Math.abs(pct)}%
      </Text>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    // ── Header ──
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    },
    titleLabel: {
      fontSize: 10, fontWeight: "700", color: colors.textMuted,
      letterSpacing: 1.4, marginBottom: 2,
    },
    title: { fontSize: 26, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.5 },
    refreshBtn: {
      width: 40, height: 40, borderRadius: 13,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },

    // ── Tabs ──
    tabs: {
      flexDirection: "row", marginHorizontal: 20, marginBottom: 14,
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 4, borderWidth: 1, borderColor: colors.border,
    },
    tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 11 },
    tabActive: {
      backgroundColor: colors.primary,
      ...Platform.select({
        ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
        android: { elevation: 3 },
      }),
    },
    tabText: { fontSize: 12, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.2 },
    tabTextActive: { color: "#fff" },

    // ── Month Nav ──
    monthNav: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, marginHorizontal: 20, marginBottom: 14,
      paddingVertical: 10, paddingHorizontal: 8,
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    monthNavBtn: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.background,
    },
    monthLabelWrap: { alignItems: "center", minWidth: 130 },
    monthNavLabel: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
    monthNavYear: { fontSize: 11, fontWeight: "600", color: colors.textMuted, marginTop: 1 },

    loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    loadingText: { color: colors.textMuted, fontSize: 14 },

    container: { padding: 20, paddingTop: 6, paddingBottom: 56 },

    // ── Hero Card ──
    heroCard: {
      borderRadius: 24, padding: 22, marginBottom: 14, overflow: "hidden",
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
      width: 180, height: 180, borderRadius: 90,
      backgroundColor: "rgba(255,255,255,0.04)",
      top: -60, right: -40,
    },
    decCircle2: {
      position: "absolute",
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: "rgba(255,255,255,0.04)",
      bottom: -30, left: 20,
    },
    heroTop: {
      flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", marginBottom: 8,
    },
    heroLabel: {
      fontSize: 10, fontWeight: "700",
      color: "rgba(255,255,255,0.6)", letterSpacing: 1.4,
    },
    heroAmount: {
      fontSize: 36, fontWeight: "900", color: "#fff",
      letterSpacing: -0.5, marginBottom: 10,
    },
    heroMarginPill: {
      flexDirection: "row", alignItems: "center", gap: 5,
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 20, marginBottom: 18,
    },
    heroMarginText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginBottom: 16 },
    heroStatsRow: { flexDirection: "row" },
    heroStatItem: { flex: 1 },
    heroStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 16 },
    heroStatLabel: {
      fontSize: 10, fontWeight: "700",
      color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 4,
    },
    heroStatValue: { fontSize: 18, fontWeight: "800" },

    // ── Stats Strip ──
    statsStrip: {
      flexDirection: "row", borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: 18, padding: 4,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },
    statItem: {
      flex: 1, paddingVertical: 12, paddingHorizontal: 12,
      flexDirection: "row", alignItems: "center", gap: 10,
    },
    statIconWrap: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: "#F0FDF4",
      alignItems: "center", justifyContent: "center",
    },
    statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 8 },
    statValue: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
    statLabel: { fontSize: 10, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.2, marginTop: 2 },

    // ── Cards ──
    card: {
      backgroundColor: colors.surface, borderRadius: 20,
      padding: 18, marginBottom: 14,
      borderWidth: 1, borderColor: colors.border,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
        android: { elevation: 1 },
      }),
    },
    cardHeader: {
      flexDirection: "row", alignItems: "center",
      gap: 12, marginBottom: 16,
    },
    cardTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, letterSpacing: 0.1 },
    cardSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "500" },
    cardIconWrap: {
      width: 36, height: 36, borderRadius: 11,
      backgroundColor: "#F0FDF4",
      alignItems: "center", justifyContent: "center",
    },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 12 },

    // ── Rank Badges ──
    rankBadge: {
      width: 26, height: 26, borderRadius: 9,
      backgroundColor: colors.background,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    rankBadgeGold: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
    rankBadgeSilver: { backgroundColor: "#94A3B8", borderColor: "#94A3B8" },
    rankBadgeBronze: { backgroundColor: "#A16207", borderColor: "#A16207" },
    rankText: { fontSize: 11, fontWeight: "800" },

    // ── Summary ──
    summaryRow: {
      flexDirection: "row",
      backgroundColor: colors.surface, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden",
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
        android: { elevation: 1 },
      }),
    },
    summaryItem: { flex: 1, alignItems: "center", paddingVertical: 18, gap: 8 },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 16 },
    summaryIconWrap: {
      width: 36, height: 36, borderRadius: 11,
      alignItems: "center", justifyContent: "center",
    },
    summaryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.3 },
    summaryValue: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },

    // ── Credit ──
    creditBox: {
      flex: 1, padding: 14, borderRadius: 14,
      alignItems: "flex-start",
    },
    creditLabel: { fontSize: 10, fontWeight: "700", color: "#6B7280", letterSpacing: 0.4, marginBottom: 6 },
    creditValue: { fontSize: 16, fontWeight: "800" },
    outstandingBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: "#FEF2F2",
      paddingVertical: 12, paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1, borderColor: "#FECACA",
    },
    outstandingIcon: {
      width: 24, height: 24, borderRadius: 8,
      backgroundColor: "#FEE2E2",
      alignItems: "center", justifyContent: "center",
    },
    outstandingLabel: { fontSize: 12, fontWeight: "700", color: "#991B1B" },
    outstandingValue: { fontSize: 17, fontWeight: "900", color: "#DC2626" },
  });



