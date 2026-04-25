import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../src/store/authStore";
import { useTheme } from "../src/hooks/useTheme";
import { exportService } from "../src/services/exportService";
import { getPlanById } from "../src/config/plans";

type DatePreset = "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";

const PRESETS: { key: DatePreset; label: string; icon: string }[] = [
  { key: "this_month",    label: "This Month",    icon: "calendar-outline" },
  { key: "last_month",    label: "Last Month",    icon: "calendar-outline" },
  { key: "last_3_months", label: "Last 3 Months", icon: "time-outline" },
  { key: "this_year",     label: "This Year",     icon: "bar-chart-outline" },
];

function getDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (preset) {
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: ymd(start), endDate: ymd(now) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: ymd(start), endDate: ymd(end) };
    }
    case "last_3_months": {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return { startDate: ymd(start), endDate: ymd(now) };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: ymd(start), endDate: ymd(now) };
    }
    default:
      return { startDate: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: ymd(now) };
  }
}

export default function ExportScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("this_month");
  const [isGenerating, setIsGenerating] = useState(false);

  const planId = user?.subscription?.plan ?? "free";
  const plan = getPlanById(planId);
  const canExport = plan.limits.canExport;

  const handleExport = async () => {
    if (!canExport) {
      Alert.alert(
        "Upgrade Required",
        "Data export is available on the Business plan. Upgrade to export your full business data as a PDF report.",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Upgrade", onPress: () => { router.back(); router.push("/subscribe"); } },
        ]
      );
      return;
    }

    setIsGenerating(true);
    try {
      const range = getDateRange(selectedPreset);
      await exportService.generateAndShare(range.startDate, range.endDate);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Export failed. Please try again.";
      Alert.alert("Export Failed", msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const s = makeStyles(colors);
  const { startDate, endDate } = getDateRange(selectedPreset);

  const fmtDisplay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Export Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={["#1B4332", "#2D6A4F"]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.heroIcon}>
            <Ionicons name="document-text-outline" size={32} color="#fff" />
          </View>
          <Text style={s.heroTitle}>Business Report PDF</Text>
          <Text style={s.heroSub}>
            Export your sales, expenses, credits and stock as a clean PDF. Share via WhatsApp, email, or save to your device.
          </Text>
          {!canExport && (
            <View style={s.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color="#D97706" />
              <Text style={s.lockedBadgeText}>Business Plan required</Text>
            </View>
          )}
        </LinearGradient>

        {/* What's included */}
        <View style={s.card}>
          <Text style={s.cardTitle}>What's included in the report</Text>
          {[
            { icon: "bag-handle-outline",  color: "#16A34A", label: "All sales transactions" },
            { icon: "receipt-outline",     color: "#DC2626", label: "Expense breakdown by category" },
            { icon: "people-outline",      color: "#D97706", label: "Outstanding credit records" },
            { icon: "cube-outline",        color: "#7C3AED", label: "Stock inventory with values" },
            { icon: "wallet-outline",      color: "#2563EB", label: "Revenue, profit & margin summary" },
          ].map((item) => (
            <View key={item.label} style={s.includeRow}>
              <View style={[s.includeIcon, { backgroundColor: item.color + "18" }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={s.includeText}>{item.label}</Text>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            </View>
          ))}
        </View>

        {/* Date range */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Select date range</Text>
          <View style={s.presetGrid}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[s.presetChip, selectedPreset === p.key && s.presetChipActive]}
                onPress={() => setSelectedPreset(p.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={p.icon as any}
                  size={14}
                  color={selectedPreset === p.key ? "#fff" : colors.textSecondary}
                />
                <Text style={[s.presetText, selectedPreset === p.key && s.presetTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.dateRangePreview}>
            <Ionicons name="calendar" size={14} color={colors.primary} />
            <Text style={s.dateRangeText}>
              {fmtDisplay(startDate)} — {fmtDisplay(endDate)}
            </Text>
          </View>
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[s.exportBtn, (!canExport || isGenerating) && s.exportBtnDisabled]}
          onPress={handleExport}
          activeOpacity={0.85}
          disabled={isGenerating}
        >
          <LinearGradient
            colors={canExport ? ["#1B4332", "#2D6A4F"] : ["#9CA3AF", "#6B7280"]}
            style={s.exportBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={s.exportBtnText}>Generating PDF...</Text>
              </>
            ) : (
              <>
                <Ionicons name={canExport ? "download-outline" : "lock-closed-outline"} size={20} color="#fff" />
                <Text style={s.exportBtnText}>
                  {canExport ? "Generate & Share PDF" : "Upgrade to Export"}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {isGenerating && (
          <Text style={s.generatingHint}>
            Building your report... This may take a few seconds.
          </Text>
        )}

        <Text style={s.footerNote}>
          Reports are generated on your device and shared directly — your data never leaves your control.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },

    body: { padding: 16, paddingBottom: 48, gap: 16 },

    hero: {
      borderRadius: 20, padding: 24,
      alignItems: "center",
      overflow: "hidden",
    },
    heroIcon: {
      width: 64, height: 64, borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center", justifyContent: "center",
      marginBottom: 14,
    },
    heroTitle: { fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 8, textAlign: "center" },
    heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 20, maxWidth: 280 },
    lockedBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 20, marginTop: 14,
    },
    lockedBadgeText: { fontSize: 12, fontWeight: "700", color: "#D97706" },

    card: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    cardTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },

    includeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    includeIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    includeText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: "500" },

    presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    presetChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    presetText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
    presetTextActive: { color: "#fff" },

    dateRangePreview: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.primary + "10",
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    },
    dateRangeText: { fontSize: 12, fontWeight: "700", color: colors.primary },

    exportBtn: { borderRadius: 16, overflow: "hidden" },
    exportBtnDisabled: { opacity: 0.75 },
    exportBtnGrad: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, paddingVertical: 16,
    },
    exportBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

    generatingHint: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: -8 },

    footerNote: {
      fontSize: 11, color: colors.textMuted,
      textAlign: "center", lineHeight: 17, paddingHorizontal: 8,
    },
  });
