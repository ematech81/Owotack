
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Alert, ActivityIndicator, Animated,
  Dimensions, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../src/store/authStore";
import { salesDb } from "../src/database/salesDb";
import { receiptService } from "../src/services/receiptService";
import { useTheme } from "../src/hooks/useTheme";
import { formatNaira } from "../src/utils/formatters";
import { Sale } from "../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────────────────────────

const D = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    receipt: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.18,
      shadowRadius: 40,
      elevation: 16,
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

// ─── Payment Config ───────────────────────────────────────────────────────────

const PAYMENT_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  cash:     { color: "#059669", bg: "#D1FAE5", icon: "cash-outline",            label: "Cash" },
  transfer: { color: "#2563EB", bg: "#DBEAFE", icon: "swap-horizontal-outline", label: "Transfer" },
  pos:      { color: "#7C3AED", bg: "#EDE9FE", icon: "card-outline",            label: "POS" },
  credit:   { color: "#D97706", bg: "#FEF3C7", icon: "time-outline",            label: "Credit" },
  mixed:    { color: "#6B7280", bg: "#F3F4F6", icon: "ellipsis-horizontal",     label: "Mixed" },
};

function fmtDateTime(iso: string): { date: string; time: string; dayOfWeek: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }),
    dayOfWeek: d.toLocaleDateString("en-NG", { weekday: "long" }),
  };
}

// ─── Animated Press ───────────────────────────────────────────────────────────

function PressScale({
  children, onPress, style, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress} onPressIn={onIn} onPressOut={onOut}
        activeOpacity={1} disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Scalloped Edge ───────────────────────────────────────────────────────────

function ScallopedEdge({ bg }: { bg: string }) {
  const count = Math.floor((SCREEN_WIDTH - 32) / 22);
  return (
    <View style={scallopS.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[scallopS.hole, { backgroundColor: bg }]} />
      ))}
    </View>
  );
}

const scallopS = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: -11,
    overflow: "hidden",
  },
  hole: {
    width: 20, height: 20, borderRadius: 10,
  },
});

// ─── Dashed Divider ───────────────────────────────────────────────────────────

function DashedDivider({ color }: { color: string }) {
  const segments = Math.floor((SCREEN_WIDTH - 80) / 12);
  return (
    <View style={dashS.row}>
      {Array.from({ length: segments }).map((_, i) => (
        <View key={i} style={[dashS.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const dashS = StyleSheet.create({
  row: { flexDirection: "row", gap: 4, paddingHorizontal: 20, marginVertical: 2 },
  dash: { flex: 1, height: 1.5, borderRadius: 1, opacity: 0.5 },
});

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ syncStatus }: { syncStatus?: string }) {
  const synced = syncStatus !== "pending";
  return (
    <View style={[statusS.pill, { backgroundColor: synced ? "#D1FAE5" : "#EEF2FF" }]}>
      <Ionicons
        name={synced ? "cloud-done-outline" : "time-outline"}
        size={11}
        color={synced ? "#059669" : "#6366F1"}
      />
      <Text style={[statusS.text, { color: synced ? "#059669" : "#6366F1" }]}>
        {synced ? "Synced" : "Pending sync"}
      </Text>
    </View>
  );
}

const statusS = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: D.radius.full,
  },
  text: { fontSize: 10, fontWeight: "700" },
});

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ colors }: { colors: ReturnType<typeof useTheme> }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={loadS.wrap}>
      <Animated.View style={{ opacity: pulse }}>
        <LinearGradient
          colors={["#1A6B3C", "#2A8B50"]}
          style={loadS.iconWrap}
        >
          <Ionicons name="receipt-outline" size={32} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={[loadS.text, { color: colors.textMuted }]}>Loading receipt...</Text>
    </View>
  );
}

const loadS = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  iconWrap: {
    width: 72, height: 72, borderRadius: D.radius.xl,
    alignItems: "center", justifyContent: "center",
  },
  text: { fontSize: 15, fontWeight: "600" },
});

// ─── Not Found Screen ─────────────────────────────────────────────────────────

function NotFoundScreen({ colors }: { colors: ReturnType<typeof useTheme> }) {
  return (
    <View style={nfS.wrap}>
      <LinearGradient colors={[colors.primary + "20", colors.primary + "05"]} style={nfS.iconWrap}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.primary} />
      </LinearGradient>
      <Text style={[nfS.title, { color: colors.textPrimary }]}>Receipt not found</Text>
      <Text style={[nfS.sub, { color: colors.textMuted }]}>
        This receipt may have been deleted or doesn't exist.
      </Text>
      <PressScale onPress={() => router.back()} style={{ borderRadius: D.radius.full }}>
        <LinearGradient colors={[colors.primary, colors.primary + "CC"]} style={nfS.btn}>
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={nfS.btnText}>Go Back</Text>
        </LinearGradient>
      </PressScale>
    </View>
  );
}

const nfS = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: "800" },
  sub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: D.radius.full,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

// ─── Receipt Header ───────────────────────────────────────────────────────────

function ReceiptHeader({
  businessName, sale, colors,
}: {
  businessName: string;
  sale: Sale;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <LinearGradient
      colors={["#0D4728", "#1A6B3C", "#2E9E58"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={rhS.gradient}
    >
      {/* Background decorations */}
      <View style={rhS.decor1} />
      <View style={rhS.decor2} />
      <View style={rhS.decor3} />

      {/* Pattern dots */}
      <View style={rhS.dotGrid}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View key={i} style={rhS.dot} />
        ))}
      </View>

      {/* Logo */}
      <View style={rhS.logoContainer}>
        <View style={rhS.logoRing}>
          <View style={rhS.logoInner}>
            <Image
              source={require("../assets/images/icon.png")}
              style={rhS.logoImg}
              resizeMode="cover"
            />
          </View>
        </View>
      </View>

      {/* Business info */}
      <Text style={rhS.businessName} numberOfLines={1}>{businessName}</Text>

      {/* Receipt label pill */}
      <View style={rhS.receiptPill}>
        <View style={rhS.receiptPillDot} />
        <Text style={rhS.receiptPillText}>SALES RECEIPT</Text>
        <View style={rhS.receiptPillDot} />
      </View>

      {/* Sync status */}
      <View style={rhS.syncRow}>
        <StatusPill syncStatus={sale.syncStatus} />
      </View>
    </LinearGradient>
  );
}

const rhS = StyleSheet.create({
  gradient: {
    paddingTop: 28, paddingBottom: 32,
    alignItems: "center", overflow: "hidden",
    position: "relative",
  },
  decor1: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -50,
  },
  decor2: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -30, left: -20,
  },
  decor3: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.06)", top: 20, left: 30,
  },
  dotGrid: {
    position: "absolute", top: 16, right: 16,
    flexDirection: "row", flexWrap: "wrap",
    width: 60, gap: 4,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.2)" },
  logoContainer: { marginBottom: 14, zIndex: 1 },
  logoRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  logoInner: {
    width: 64, height: 64, borderRadius: 32,
    overflow: "hidden",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
  },
  logoImg: { width: 64, height: 64 },
  businessName: {
    fontSize: 22, fontWeight: "900", color: "#fff",
    letterSpacing: -0.3, textAlign: "center",
    paddingHorizontal: 24, marginBottom: 10, zIndex: 1,
  },
  receiptPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: D.radius.full, marginBottom: 10,
  },
  receiptPillDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" },
  receiptPillText: {
    fontSize: 10, color: "rgba(255,255,255,0.9)",
    letterSpacing: 2.5, fontWeight: "800",
  },
  syncRow: { marginTop: 4 },
});

// ─── Invoice Meta Bar ─────────────────────────────────────────────────────────

function InvoiceMetaBar({ sale, dt, colors }: {
  sale: Sale;
  dt: ReturnType<typeof fmtDateTime>;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[metaS.container, { backgroundColor: colors.surface }]}>
      <View style={metaS.cell}>
        <Text style={[metaS.label, { color: colors.textMuted }]}>INVOICE</Text>
        <Text style={[metaS.primaryValue, { color: colors.primary }]}>
          {sale.invoiceNumber ?? "—"}
        </Text>
      </View>

      <View style={[metaS.sep, { backgroundColor: colors.border }]} />

      <View style={[metaS.cell, metaS.cellCenter]}>
        <Text style={[metaS.label, { color: colors.textMuted }]}>DATE</Text>
        <Text style={[metaS.value, { color: colors.textPrimary }]}>{dt.date}</Text>
        <Text style={[metaS.subValue, { color: colors.textMuted }]}>{dt.dayOfWeek}</Text>
      </View>

      <View style={[metaS.sep, { backgroundColor: colors.border }]} />

      <View style={[metaS.cell, metaS.cellRight]}>
        <Text style={[metaS.label, { color: colors.textMuted }]}>TIME</Text>
        <Text style={[metaS.value, { color: colors.textPrimary }]}>{dt.time}</Text>
        <Text style={[metaS.subValue, { color: colors.textMuted }]}>
          {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
        </Text>
      </View>
    </View>
  );
}

const metaS = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 20,
  },
  cell: { flex: 1, gap: 3 },
  cellCenter: { alignItems: "center" },
  cellRight: { alignItems: "flex-end" },
  sep: { width: 1, height: 36, marginHorizontal: 12 },
  label: {
    fontSize: 9, fontWeight: "800", letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  primaryValue: { fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  value: { fontSize: 13, fontWeight: "700" },
  subValue: { fontSize: 10, fontWeight: "600" },
});

// ─── Customer Banner ──────────────────────────────────────────────────────────

function CustomerBanner({ sale, colors }: { sale: Sale; colors: ReturnType<typeof useTheme> }) {
  const initials = (sale.customerName ?? "W")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View style={[custS.container, { backgroundColor: colors.primary + "0A" }]}>
      <View style={[custS.avatar, { backgroundColor: colors.primary }]}>
        <Text style={custS.avatarText}>{initials}</Text>
      </View>
      <View style={custS.info}>
        <Text style={[custS.label, { color: colors.textMuted }]}>SOLD TO</Text>
        <Text style={[custS.name, { color: colors.textPrimary }]}>
          {sale.customerName || "Walk-in Customer"}
        </Text>
      </View>
      <Ionicons name="person-circle-outline" size={22} color={colors.primary + "60"} />
    </View>
  );
}

const custS = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12, gap: 12,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  info: { flex: 1 },
  label: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "800" },
});

// ─── Items Table ──────────────────────────────────────────────────────────────

function ItemsTable({ sale, colors }: { sale: Sale; colors: ReturnType<typeof useTheme> }) {
  return (
    <View>
      {/* Table header */}
      <View style={[tableS.header, { backgroundColor: colors.background }]}>
        <Text style={[tableS.headerCell, { flex: 1, color: colors.textMuted }]}>ITEM</Text>
        <Text style={[tableS.headerCell, { width: 40, textAlign: "center", color: colors.textMuted }]}>QTY</Text>
        <Text style={[tableS.headerCell, { width: 84, textAlign: "right", color: colors.textMuted }]}>PRICE</Text>
        <Text style={[tableS.headerCell, { width: 90, textAlign: "right", color: colors.textMuted }]}>TOTAL</Text>
      </View>

      {/* Rows */}
      {sale.items.map((item, i) => {
        const isLast = i === sale.items.length - 1;
        return (
          <View
            key={i}
            style={[
              tableS.row,
              !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border + "80" },
              i % 2 === 0 && { backgroundColor: colors.primary + "03" },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[tableS.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.productName}
              </Text>
              <Text style={[tableS.itemUnit, { color: colors.textMuted }]}>
                {item.unit}
              </Text>
            </View>

            <View style={[tableS.qtyBadge, { backgroundColor: colors.primary + "12" }]}>
              <Text style={[tableS.qtyText, { color: colors.primary }]}>{item.quantity}</Text>
            </View>

            <Text style={[tableS.priceText, { color: colors.textSecondary }]}>
              {formatNaira(item.unitPrice)}
            </Text>

            <Text style={[tableS.totalText, { color: colors.textPrimary }]}>
              {formatNaira(item.totalAmount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const tableS = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 8,
    borderBottomWidth: 1.5,
  },
  headerCell: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  itemName: { fontSize: 13, fontWeight: "700" },
  itemUnit: { fontSize: 10, marginTop: 2, fontWeight: "500" },
  qtyBadge: {
    width: 40, height: 26, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  qtyText: { fontSize: 13, fontWeight: "800" },
  priceText: { width: 84, textAlign: "right", fontSize: 12, fontWeight: "500" },
  totalText: { width: 90, textAlign: "right", fontSize: 14, fontWeight: "900", letterSpacing: -0.2 },
});

// ─── Adjustments Section ──────────────────────────────────────────────────────

function AdjustmentsSection({ sale, subtotal, discountAmount, taxAmount, colors }: {
  sale: Sale;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[adjS.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={adjS.row}>
        <Text style={[adjS.label, { color: colors.textMuted }]}>Subtotal</Text>
        <Text style={[adjS.value, { color: colors.textPrimary }]}>{formatNaira(subtotal)}</Text>
      </View>

      {discountAmount > 0 && (
        <View style={adjS.row}>
          <View style={adjS.labelRow}>
            <View style={[adjS.indicator, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="pricetag-outline" size={10} color="#D97706" />
            </View>
            <Text style={[adjS.label, { color: "#D97706" }]}>
              Discount{(sale as any).discountType === "percent" ? ` (${(sale as any).discount}%)` : ""}
            </Text>
          </View>
          <Text style={[adjS.value, { color: "#D97706" }]}>-{formatNaira(discountAmount)}</Text>
        </View>
      )}

      {taxAmount > 0 && (
        <View style={adjS.row}>
          <View style={adjS.labelRow}>
            <View style={[adjS.indicator, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="calculator-outline" size={10} color="#2563EB" />
            </View>
            <Text style={[adjS.label, { color: "#2563EB" }]}>
              Tax ({(sale as any).tax}%)
            </Text>
          </View>
          <Text style={[adjS.value, { color: "#2563EB" }]}>+{formatNaira(taxAmount)}</Text>
        </View>
      )}
    </View>
  );
}

const adjS = StyleSheet.create({
  container: {
    marginHorizontal: 20, marginVertical: 8,
    borderWidth: 1, borderRadius: D.radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)",
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  indicator: {
    width: 22, height: 22, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: 13, fontWeight: "600" },
  value: { fontSize: 13, fontWeight: "800" },
});

// ─── Grand Total Section ──────────────────────────────────────────────────────

function GrandTotalSection({ sale, payConfig, colors }: {
  sale: Sale;
  payConfig: typeof PAYMENT_CONFIG[string];
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={totalS.container}>
      {/* Payment method */}
      <View style={totalS.payRow}>
        <Text style={[totalS.payLabel, { color: colors.textMuted }]}>Payment Method</Text>
        <View style={[totalS.payBadge, { backgroundColor: payConfig.bg }]}>
          <Ionicons name={payConfig.icon as any} size={13} color={payConfig.color} />
          <Text style={[totalS.payBadgeText, { color: payConfig.color }]}>
            {payConfig.label.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Grand total */}
      <LinearGradient
        colors={[colors.primary + "10", colors.primary + "06"]}
        style={totalS.grandWrap}
      >
        <View style={[totalS.grandAccent, { backgroundColor: colors.primary }]} />
        <View style={totalS.grandLeft}>
          <Text style={[totalS.grandLabel, { color: colors.textMuted }]}>GRAND TOTAL</Text>
          <Text style={[totalS.itemCount, { color: colors.textMuted }]}>
            {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <Text style={[totalS.grandAmount, { color: colors.primary }]}>
          {formatNaira(sale.totalAmount)}
        </Text>
      </LinearGradient>
    </View>
  );
}

const totalS = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  payRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  payLabel: { fontSize: 13, fontWeight: "600" },
  payBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: D.radius.full,
  },
  payBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  grandWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: D.radius.lg, overflow: "hidden", padding: 16,
  },
  grandAccent: { width: 4, height: "100%", borderRadius: 2, marginRight: 14, alignSelf: "stretch" },
  grandLeft: { flex: 1 },
  grandLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  itemCount: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  grandAmount: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
});

// ─── Receipt Footer ───────────────────────────────────────────────────────────

function ReceiptFooter({ colors }: { colors: ReturnType<typeof useTheme> }) {
  return (
    <View style={[footerS.container, { borderTopColor: colors.border, backgroundColor: colors.primary + "06" }]}>
      {/* QR-style decorative element */}
      <View style={footerS.qrDecor}>
        {Array.from({ length: 16 }).map((_, i) => (
          <View
            key={i}
            style={[
              footerS.qrCell,
              { backgroundColor: i % 3 === 0 ? colors.primary + "40" : colors.primary + "15" },
            ]}
          />
        ))}
      </View>

      <View style={footerS.textBlock}>
        <Text style={[footerS.thanks, { color: colors.textPrimary }]}>
          Thank you for your business! 🙏
        </Text>
        <Text style={[footerS.sub, { color: colors.textMuted }]}>
          We appreciate your trust and look forward{"\n"}to serving you again.
        </Text>
        <View style={footerS.brandRow}>
          <Text style={[footerS.brandLabel, { color: colors.textMuted }]}>Powered by</Text>
          <Text style={[footerS.brandName, { color: colors.primary }]}>OwoTrack</Text>
        </View>
      </View>

      <View style={footerS.qrDecor}>
        {Array.from({ length: 16 }).map((_, i) => (
          <View
            key={i}
            style={[
              footerS.qrCell,
              { backgroundColor: i % 3 === 0 ? colors.primary + "40" : colors.primary + "15" },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const footerS = StyleSheet.create({
  container: {
    borderTopWidth: 1, paddingVertical: 20,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, gap: 10,
  },
  textBlock: { flex: 1, alignItems: "center", gap: 5 },
  thanks: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  sub: { fontSize: 10, textAlign: "center", lineHeight: 14, fontWeight: "500" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  brandLabel: { fontSize: 10, fontWeight: "600" },
  brandName: { fontSize: 12, fontWeight: "900", letterSpacing: -0.2 },
  qrDecor: {
    flexDirection: "row", flexWrap: "wrap",
    width: 36, gap: 2,
  },
  qrCell: { width: 7, height: 7, borderRadius: 1 },
});

// ─── Action Buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  onShare, onDownload, onDone,
  isSharing, isDownloading,
  colors,
}: {
  onShare: () => void;
  onDownload: () => void;
  onDone: () => void;
  isSharing: boolean;
  isDownloading: boolean;
  colors: ReturnType<typeof useTheme>;
}) {
  const busy = isSharing || isDownloading;

  return (
    <View style={actionS.wrap}>
      {/* Primary row */}
      <View style={actionS.row}>
        <PressScale
          onPress={onShare}
          disabled={busy}
          style={[actionS.primaryBtn, D.shadow.colored(colors.primary)]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primary + "CC"]}
            style={actionS.primaryGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <View style={actionS.btnIconWrap}>
                  <Ionicons name="share-social-outline" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={actionS.primaryBtnLabel}>Share</Text>
                  <Text style={actionS.primaryBtnSub}>as PDF</Text>
                </View>
              </>
            )}
          </LinearGradient>
        </PressScale>

        <PressScale
          onPress={onDownload}
          disabled={busy}
          style={[actionS.secondaryBtn, { borderColor: colors.primary, backgroundColor: colors.surface }, D.shadow.soft]}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <View style={[actionS.btnIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[actionS.secondaryBtnLabel, { color: colors.primary }]}>Save</Text>
                <Text style={[actionS.secondaryBtnSub, { color: colors.textMuted }]}>to Files</Text>
              </View>
            </>
          )}
        </PressScale>
      </View>

      {/* Done button */}
      <PressScale
        onPress={onDone}
        style={[actionS.doneBtn, { backgroundColor: colors.surface, borderColor: colors.border }, D.shadow.soft]}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.textSecondary} />
        <Text style={[actionS.doneBtnText, { color: colors.textSecondary }]}>Done — Back to Home</Text>
      </PressScale>
    </View>
  );
}

const actionS = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, borderRadius: D.radius.xl, overflow: "hidden" },
  primaryGrad: {
    flexDirection: "row", alignItems: "center",
    gap: 12, paddingVertical: 16, paddingHorizontal: 18,
  },
  secondaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 12, paddingVertical: 16, paddingHorizontal: 18,
    borderRadius: D.radius.xl, borderWidth: 1.5,
  },
  btnIconWrap: {
    width: 34, height: 34, borderRadius: D.radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  primaryBtnLabel: { color: "#fff", fontSize: 14, fontWeight: "800" },
  primaryBtnSub: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "600" },
  secondaryBtnLabel: { fontSize: 14, fontWeight: "800" },
  secondaryBtnSub: { fontSize: 10, fontWeight: "600" },
  doneBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: D.radius.xl, borderWidth: 1.5,
  },
  doneBtnText: { fontSize: 14, fontWeight: "700" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReceiptScreen() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  const { user } = useAuthStore();
  const colors = useTheme();
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Entrance animation
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (saleId) {
      salesDb.getById(saleId as string)
        .then((data) => {
          setSale(data);
          // Animate receipt in
          Animated.spring(cardAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 6,
            bounciness: 5,
          }).start();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [saleId]);

  const handleShare = async () => {
    if (!sale || !user) return;
    setIsSharing(true);
    try {
      await receiptService.shareAsPDF(sale, user);
    } catch {
      Alert.alert("Error", "Could not generate PDF. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    if (!sale || !user) return;
    setIsDownloading(true);
    try {
      await receiptService.downloadPDF(sale, user);
      // Share sheet opens automatically — no separate alert needed
    } catch {
      Alert.alert("Error", "Could not save PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const businessName = user?.businessName || user?.name || "My Business";
  const payConfig = PAYMENT_CONFIG[(sale?.paymentType ?? "cash").toLowerCase()] ?? PAYMENT_CONFIG.cash;
  const dt = sale ? fmtDateTime(sale.createdAt || sale.date) : null;

  const subtotal = (sale as any)?.subtotal ?? sale?.totalAmount ?? 0;
  const discountAmount = (sale as any)?.discountAmount ?? 0;
  const taxAmount = (sale as any)?.taxAmount ?? 0;
  const hasAdjustment = discountAmount > 0 || taxAmount > 0;

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <LoadingScreen colors={colors} />
      </SafeAreaView>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────

  if (!sale) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <NotFoundScreen colors={colors} />
      </SafeAreaView>
    );
  }

  // ── Card translate / fade in ─────────────────────────────────────────────────

  const cardTranslate = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>

      {/* ── Floating Header ────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.primary + "12", colors.background]}
        style={screenS.headerGrad}
      >
        <View style={screenS.headerRow}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/")}
            style={[screenS.headerBtn, { backgroundColor: colors.surface }, D.shadow.soft]}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={screenS.headerCenter}>
            <Text style={[screenS.headerTitle, { color: colors.textPrimary }]}>Receipt</Text>
            <Text style={[screenS.headerSub, { color: colors.textMuted }]}>
              {sale.invoiceNumber ?? ""}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleShare}
            style={[screenS.headerBtn, { backgroundColor: colors.primary + "15" }, D.shadow.soft]}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="share-outline" size={18} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Scroll ────────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={screenS.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Animated Receipt Card ──────────────────────────────────────── */}
        <Animated.View
          style={[
            screenS.receiptCard,
            { backgroundColor: colors.surface },
            D.shadow.receipt,
            {
              opacity: cardAnim,
              transform: [{ translateY: cardTranslate }],
            },
          ]}
        >
          {/* Green gradient header */}
          <ReceiptHeader businessName={businessName} sale={sale} colors={colors} />

          {/* Scalloped tear edge */}
          <ScallopedEdge bg={colors.background} />

          {/* Invoice meta */}
          <InvoiceMetaBar sale={sale} dt={dt!} colors={colors} />

          <DashedDivider color={colors.border} />

          {/* Customer */}
          <CustomerBanner sale={sale} colors={colors} />

          <DashedDivider color={colors.border} />

          {/* Items table */}
          <ItemsTable sale={sale} colors={colors} />

          {/* Adjustment rows */}
          {hasAdjustment && (
            <AdjustmentsSection
              sale={sale}
              subtotal={subtotal}
              discountAmount={discountAmount}
              taxAmount={taxAmount}
              colors={colors}
            />
          )}

          <DashedDivider color={colors.border} />

          {/* Grand total */}
          <GrandTotalSection sale={sale} payConfig={payConfig} colors={colors} />

          {/* Bottom scallop */}
          <ScallopedEdge bg={colors.background} />

          {/* Footer */}
          <ReceiptFooter colors={colors} />
        </Animated.View>

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <ActionButtons
          onShare={handleShare}
          onDownload={handleDownload}
          onDone={() => router.replace("/(tabs)/")}
          isSharing={isSharing}
          isDownloading={isDownloading}
          colors={colors}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const screenS = StyleSheet.create({
  headerGrad: { paddingBottom: 12 },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12,
    gap: 12,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  headerSub: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 12 },
  receiptCard: {
    borderRadius: D.radius.xxl,
    overflow: "hidden",
  },
});
// import React, { useEffect, useState } from "react";
// import {
//   View, Text, StyleSheet, ScrollView,
//   TouchableOpacity, Alert, ActivityIndicator,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useLocalSearchParams, router } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { LinearGradient } from "expo-linear-gradient";
// import { useAuthStore } from "../src/store/authStore";
// import { salesDb } from "../src/database/salesDb";
// import { receiptService } from "../src/services/receiptService";
// import { useTheme } from "../src/hooks/useTheme";
// import { formatNaira } from "../src/utils/formatters";
// import { Sale } from "../src/types";

// const PAYMENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
//   cash:     { color: "#059669", bg: "#D1FAE5", icon: "cash-outline" },
//   transfer: { color: "#2563EB", bg: "#DBEAFE", icon: "swap-horizontal-outline" },
//   pos:      { color: "#7C3AED", bg: "#EDE9FE", icon: "card-outline" },
//   credit:   { color: "#D97706", bg: "#FEF3C7", icon: "time-outline" },
//   mixed:    { color: "#6B7280", bg: "#F3F4F6", icon: "ellipsis-horizontal" },
// };

// function fmtDateTime(iso: string): { date: string; time: string } {
//   const d = new Date(iso);
//   return {
//     date: d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }),
//     time: d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true }),
//   };
// }

// export default function ReceiptScreen() {
//   const { saleId } = useLocalSearchParams<{ saleId: string }>();
//   const { user } = useAuthStore();
//   const colors = useTheme();
//   const [sale, setSale] = useState<Sale | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [isSharing, setIsSharing] = useState(false);
//   const [isDownloading, setIsDownloading] = useState(false);

//   useEffect(() => {
//     if (saleId) {
//       salesDb.getById(saleId as string)
//         .then(setSale)
//         .finally(() => setIsLoading(false));
//     } else {
//       setIsLoading(false);
//     }
//   }, [saleId]);

//   const handleShare = async () => {
//     if (!sale || !user) return;
//     setIsSharing(true);
//     try {
//       await receiptService.shareAsPDF(sale, user);
//     } catch {
//       Alert.alert("Error", "Could not generate PDF. Please try again.");
//     } finally {
//       setIsSharing(false);
//     }
//   };

//   const handleDownload = async () => {
//     if (!sale || !user) return;
//     setIsDownloading(true);
//     try {
//       const fileName = await receiptService.downloadPDF(sale, user);
//       Alert.alert("Downloaded", `Saved as ${fileName}\n\nFind it in your Files app.`);
//     } catch {
//       Alert.alert("Error", "Could not save PDF. Please try again.");
//     } finally {
//       setIsDownloading(false);
//     }
//   };

//   const businessName = user?.businessName || user?.name || "My Business";
//   const payConfig = PAYMENT_CONFIG[sale?.paymentType ?? "cash"];
//   const dt = sale ? fmtDateTime(sale.createdAt || sale.date) : null;

//   const subtotal = sale?.subtotal ?? sale?.totalAmount ?? 0;
//   const discountAmount = sale?.discountAmount ?? 0;
//   const taxAmount = sale?.taxAmount ?? 0;
//   const hasAdjustment = discountAmount > 0 || taxAmount > 0;

//   if (isLoading) {
//     return (
//       <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
//         <View style={s.centered}>
//           <ActivityIndicator size="large" color={colors.primary} />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (!sale) {
//     return (
//       <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
//         <View style={s.centered}>
//           <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
//           <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Receipt not found</Text>
//           <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.primary }]}>
//             <Text style={s.backBtnText}>Go Back</Text>
//           </TouchableOpacity>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>

//       {/* ── Header ──────────────────────────────────────────────────────── */}
//       <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
//         <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
//           <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
//         </TouchableOpacity>
//         <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Receipt</Text>
//         <TouchableOpacity
//           onPress={handleShare}
//           style={[s.shareHeaderBtn, { backgroundColor: colors.primary + "15" }]}
//           disabled={isSharing}
//         >
//           {isSharing
//             ? <ActivityIndicator size="small" color={colors.primary} />
//             : <Ionicons name="share-outline" size={20} color={colors.primary} />}
//         </TouchableOpacity>
//       </View>

//       <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

//         {/* ── Receipt Card ─────────────────────────────────────────────── */}
//         <View style={[s.card, { backgroundColor: colors.surface }]}>

//           {/* Green header */}
//           <LinearGradient colors={["#1A6B3C", "#2A8B50"]} style={s.cardHeader}>
//             <View style={s.cardHeaderDecor1} />
//             <View style={s.cardHeaderDecor2} />
//             <Text style={s.cardBusiness} numberOfLines={1}>{businessName}</Text>
//             <Text style={s.cardReceiptLabel}>SALES RECEIPT</Text>
//           </LinearGradient>

//           {/* Scalloped edge */}
//           <View style={s.scallop}>
//             {Array.from({ length: 14 }).map((_, i) => (
//               <View key={i} style={[s.scallop_hole, { backgroundColor: colors.background }]} />
//             ))}
//           </View>

//           {/* Invoice # + Date */}
//           <View style={s.metaRow}>
//             <View>
//               <Text style={[s.metaLabel, { color: colors.textMuted }]}>INVOICE NO.</Text>
//               <Text style={[s.invoiceNum, { color: colors.primary }]}>{sale.invoiceNumber ?? "—"}</Text>
//             </View>
//             <View style={s.metaRight}>
//               <Text style={[s.metaLabel, { color: colors.textMuted }]}>DATE</Text>
//               <Text style={[s.metaValue, { color: colors.textPrimary }]}>{dt?.date}</Text>
//               <Text style={[s.metaSub, { color: colors.textMuted }]}>{dt?.time}</Text>
//             </View>
//           </View>

//           <View style={[s.dashed, { borderColor: colors.border }]} />

//           {/* Customer */}
//           <View style={[s.customerSection, { backgroundColor: colors.primary + "08" }]}>
//             <Text style={[s.customerLabel, { color: colors.textMuted }]}>SOLD TO</Text>
//             <Text style={[s.customerName, { color: colors.textPrimary }]}>
//               {sale.customerName || "Walk-in Customer"}
//             </Text>
//           </View>

//           {/* Items header */}
//           <View style={[s.itemsHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
//             <Text style={[s.itemsHeaderText, { color: colors.textMuted, flex: 1 }]}>ITEM</Text>
//             <Text style={[s.itemsHeaderText, { color: colors.textMuted, width: 36, textAlign: "center" }]}>QTY</Text>
//             <Text style={[s.itemsHeaderText, { color: colors.textMuted, width: 80, textAlign: "right" }]}>PRICE</Text>
//             <Text style={[s.itemsHeaderText, { color: colors.textMuted, width: 90, textAlign: "right" }]}>TOTAL</Text>
//           </View>

//           {/* Items */}
//           {sale.items.map((item, i) => (
//             <View
//               key={i}
//               style={[s.itemRow, i < sale.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
//             >
//               <View style={{ flex: 1 }}>
//                 <Text style={[s.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.productName}</Text>
//                 <Text style={[s.itemUnit, { color: colors.textMuted }]}>{item.unit}</Text>
//               </View>
//               <Text style={[s.itemQty, { color: colors.textSecondary }]}>{item.quantity}</Text>
//               <Text style={[s.itemPrice, { color: colors.textSecondary }]}>{formatNaira(item.unitPrice)}</Text>
//               <Text style={[s.itemTotal, { color: colors.textPrimary }]}>{formatNaira(item.totalAmount)}</Text>
//             </View>
//           ))}

//           {/* Discount / Tax breakdown */}
//           {hasAdjustment && (
//             <View style={[s.adjSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
//               <View style={s.adjRow}>
//                 <Text style={[s.adjLabel, { color: colors.textMuted }]}>Subtotal</Text>
//                 <Text style={[s.adjValue, { color: colors.textPrimary }]}>{formatNaira(subtotal)}</Text>
//               </View>
//               {discountAmount > 0 && (
//                 <View style={s.adjRow}>
//                   <Text style={[s.adjLabel, { color: "#D97706" }]}>
//                     Discount{sale.discountType === "percent" ? ` (${sale.discount}%)` : ""}
//                   </Text>
//                   <Text style={[s.adjValue, { color: "#D97706" }]}>-{formatNaira(discountAmount)}</Text>
//                 </View>
//               )}
//               {taxAmount > 0 && (
//                 <View style={s.adjRow}>
//                   <Text style={[s.adjLabel, { color: "#2563EB" }]}>Tax ({sale.tax}%)</Text>
//                   <Text style={[s.adjValue, { color: "#2563EB" }]}>+{formatNaira(taxAmount)}</Text>
//                 </View>
//               )}
//             </View>
//           )}

//           <View style={[s.dashed, { borderColor: colors.border }]} />

//           {/* Totals */}
//           <View style={s.totalsSection}>
//             <View style={s.paymentRow}>
//               <Text style={[s.payLabel, { color: colors.textMuted }]}>Payment Method</Text>
//               <View style={[s.payBadge, { backgroundColor: payConfig.bg }]}>
//                 <Ionicons name={payConfig.icon as any} size={12} color={payConfig.color} />
//                 <Text style={[s.payBadgeText, { color: payConfig.color }]}>{sale.paymentType.toUpperCase()}</Text>
//               </View>
//             </View>
//             <View style={[s.grandTotal, { borderTopColor: colors.primary }]}>
//               <Text style={[s.grandLabel, { color: colors.textPrimary }]}>TOTAL</Text>
//               <Text style={[s.grandValue, { color: colors.primary }]}>{formatNaira(sale.totalAmount)}</Text>
//             </View>
//           </View>

//           {/* Footer */}
//           <View style={[s.cardFooter, { backgroundColor: colors.primary + "08", borderTopColor: colors.border }]}>
//             <Text style={[s.footerThanks, { color: colors.textPrimary }]}>Thank you for your business!</Text>
//             <Text style={[s.footerBrand, { color: colors.textMuted }]}>
//               Powered by <Text style={{ color: colors.primary, fontWeight: "700" }}>OwoTrack</Text>
//             </Text>
//           </View>

//         </View>

//         {/* ── Actions ──────────────────────────────────────────────────── */}
//         <View style={s.actionRow}>
//           <TouchableOpacity
//             style={[s.shareBtn, { backgroundColor: colors.primary }]}
//             onPress={handleShare}
//             disabled={isSharing || isDownloading}
//             activeOpacity={0.82}
//           >
//             {isSharing
//               ? <ActivityIndicator color="#fff" size="small" />
//               : <><Ionicons name="share-social-outline" size={19} color="#fff" /><Text style={s.shareBtnText}>Share PDF</Text></>}
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[s.downloadBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}
//             onPress={handleDownload}
//             disabled={isSharing || isDownloading}
//             activeOpacity={0.82}
//           >
//             {isDownloading
//               ? <ActivityIndicator color={colors.primary} size="small" />
//               : <><Ionicons name="download-outline" size={19} color={colors.primary} /><Text style={[s.downloadBtnText, { color: colors.primary }]}>Download</Text></>}
//           </TouchableOpacity>
//         </View>

//         <TouchableOpacity
//           style={[s.doneBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
//           onPress={() => router.replace("/(tabs)")}
//           activeOpacity={0.82}
//         >
//           <Text style={[s.doneBtnText, { color: colors.textSecondary }]}>Done</Text>
//         </TouchableOpacity>

//         <View style={{ height: 32 }} />
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const s = StyleSheet.create({
//   flex: { flex: 1 },
//   centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
//   emptyTitle: { fontSize: 16, fontWeight: "700" },
//   backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, marginTop: 8 },
//   backBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

//   header: {
//     flexDirection: "row", alignItems: "center",
//     paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
//   },
//   headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
//   headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
//   shareHeaderBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

//   scroll: { padding: 16, paddingTop: 20 },

//   card: {
//     borderRadius: 20, overflow: "hidden", marginBottom: 16,
//     shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
//     shadowOpacity: 0.10, shadowRadius: 24, elevation: 8,
//   },

//   cardHeader: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28, alignItems: "center", overflow: "hidden" },
//   cardHeaderDecor1: {
//     position: "absolute", width: 140, height: 140, borderRadius: 70,
//     backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30,
//   },
//   cardHeaderDecor2: {
//     position: "absolute", width: 80, height: 80, borderRadius: 40,
//     backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: 10,
//   },
//   logoWrap: {
//     width: 56, height: 56, borderRadius: 14,
//     backgroundColor: "rgba(255,255,255,0.2)",
//     overflow: "hidden", marginBottom: 10,
//     borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
//   },
//   logoImg: { width: 56, height: 56 },
//   cardBusiness: { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.3, marginBottom: 4 },
//   cardReceiptLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", letterSpacing: 2, fontWeight: "700" },

//   scallop: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: -14 },
//   scallop_hole: { width: 18, height: 18, borderRadius: 9 },

//   metaRow: {
//     flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
//     paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
//   },
//   metaRight: { alignItems: "flex-end" },
//   metaLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
//   invoiceNum: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
//   metaValue: { fontSize: 13, fontWeight: "700" },
//   metaSub: { fontSize: 11, marginTop: 2 },

//   dashed: { borderTopWidth: 1, borderStyle: "dashed", marginHorizontal: 20 },

//   customerSection: { paddingHorizontal: 20, paddingVertical: 12, marginVertical: 2 },
//   customerLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
//   customerName: { fontSize: 15, fontWeight: "700" },

//   itemsHeader: {
//     flexDirection: "row", alignItems: "center",
//     paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1,
//   },
//   itemsHeaderText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },

//   itemRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 11 },
//   itemName: { fontSize: 13, fontWeight: "700" },
//   itemUnit: { fontSize: 11, marginTop: 1 },
//   itemQty: { width: 36, textAlign: "center", fontSize: 13, fontWeight: "500" },
//   itemPrice: { width: 80, textAlign: "right", fontSize: 12 },
//   itemTotal: { width: 90, textAlign: "right", fontSize: 14, fontWeight: "800" },

//   adjSection: {
//     marginHorizontal: 20, marginVertical: 8,
//     borderWidth: 1, borderRadius: 10, padding: 10, gap: 5,
//   },
//   adjRow: { flexDirection: "row", justifyContent: "space-between" },
//   adjLabel: { fontSize: 12, fontWeight: "500" },
//   adjValue: { fontSize: 12, fontWeight: "700" },

//   totalsSection: { paddingHorizontal: 20, paddingVertical: 14 },
//   paymentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
//   payLabel: { fontSize: 12, fontWeight: "600" },
//   payBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
//   payBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
//   grandTotal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 2 },
//   grandLabel: { fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
//   grandValue: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },

//   cardFooter: { paddingVertical: 16, alignItems: "center", gap: 4, borderTopWidth: 1 },
//   footerThanks: { fontSize: 13, fontWeight: "700" },
//   footerBrand: { fontSize: 11 },

//   actionRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
//   shareBtn: {
//     flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
//     borderRadius: 16, paddingVertical: 15,
//     shadowColor: "#1A6B3C", shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
//   },
//   shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
//   downloadBtn: {
//     flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
//     borderRadius: 16, paddingVertical: 15, borderWidth: 2,
//   },
//   downloadBtnText: { fontSize: 14, fontWeight: "800" },
//   doneBtn: {
//     alignItems: "center", justifyContent: "center",
//     borderRadius: 16, paddingVertical: 14, borderWidth: 1.5,
//   },
//   doneBtnText: { fontSize: 14, fontWeight: "700" },
// });
