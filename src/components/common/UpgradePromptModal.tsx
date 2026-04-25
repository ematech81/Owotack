import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { formatNaira } from "../../utils/formatters";
import { PLANS } from "../../config/plans";

// ─── Feature config ───────────────────────────────────────────────────────────

export type UpgradeFeature = "sales" | "expenses" | "stock" | "ai" | "voice" | "whatsapp" | "reports";

interface FeatureConfig {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: (used: number, limit: number) => string;
}

const FEATURE_CONFIG: Record<UpgradeFeature, FeatureConfig> = {
  sales: {
    icon: "bag-handle-outline",
    iconColor: "#16A34A",
    iconBg: "#DCFCE7",
    title: "Sales Limit Reached",
    description: (used, limit) =>
      `You've used all ${limit} sales for this month on the free plan. Upgrade to record unlimited sales and keep growing your business.`,
  },
  expenses: {
    icon: "receipt-outline",
    iconColor: "#DC2626",
    iconBg: "#FEE2E2",
    title: "Expenses Limit Reached",
    description: (used, limit) =>
      `You've used all ${limit} expense entries for this month. Upgrade to track all your costs and see your real profit.`,
  },
  stock: {
    icon: "cube-outline",
    iconColor: "#D97706",
    iconBg: "#FEF3C7",
    title: "Stock Limit Reached",
    description: (used, limit) =>
      `You've added ${used} of ${limit} stock items allowed on the free plan. Upgrade to manage your full inventory.`,
  },
  ai: {
    icon: "sparkles-outline",
    iconColor: "#7C3AED",
    iconBg: "#EDE9FE",
    title: "AI Advisor is a Paid Feature",
    description: () =>
      "Get AI-powered business insights, profit analysis, and actionable advice tailored to your business. Available on Growth and above.",
  },
  voice: {
    icon: "mic-outline",
    iconColor: "#2563EB",
    iconBg: "#DBEAFE",
    title: "Voice Input is a Paid Feature",
    description: () =>
      "Record sales by simply speaking. OwoTrack's AI will parse your voice and log the sale instantly. Available on Growth and above.",
  },
  whatsapp: {
    icon: "logo-whatsapp",
    iconColor: "#16A34A",
    iconBg: "#DCFCE7",
    title: "WhatsApp Reminders Limit Reached",
    description: (used, limit) =>
      `You've sent ${used} of ${limit} WhatsApp reminders this month. Upgrade to send more and keep your customers paying on time.`,
  },
  reports: {
    icon: "bar-chart-outline",
    iconColor: "#7C3AED",
    iconBg: "#EDE9FE",
    title: "Unlock Full Reports",
    description: () =>
      "Get 7-day trends, monthly breakdowns, top product rankings, and payment method analysis. Available on Growth and above.",
  },
};

const GROWTH_BENEFITS = [
  { icon: "bag-handle-outline",      text: "300 sales per month" },
  { icon: "receipt-outline",         text: "150 expense entries per month" },
  { icon: "cube-outline",            text: "Up to 100 stock items" },
  { icon: "sparkles-outline",        text: "10 AI chats per day" },
  { icon: "mic-outline",             text: "20 voice entries per month" },
  { icon: "logo-whatsapp",           text: "30 WhatsApp credit reminders" },
  { icon: "bar-chart-outline",       text: "Weekly business reports" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  feature: UpgradeFeature;
  used?: number;
  limit?: number;
}

export function UpgradePromptModal({ visible, onClose, feature, used = 0, limit = 0 }: Props) {
  const colors = useTheme();
  const config = FEATURE_CONFIG[feature];
  const growthPlan = PLANS.find((p) => p.id === "growth")!;
  const s = makeStyles(colors);

  const handleUpgrade = () => {
    onClose();
    router.push("/subscribe");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>

          {/* Drag handle */}
          <View style={s.handle} />

          {/* Feature icon */}
          <View style={[s.iconCircle, { backgroundColor: config.iconBg }]}>
            <Ionicons name={config.icon as any} size={28} color={config.iconColor} />
          </View>

          {/* Title */}
          <Text style={s.title}>{config.title}</Text>

          {/* Description */}
          <Text style={s.description}>
            {config.description(used, limit)}
          </Text>

          {/* Usage bar (only for countable limits) */}
          {limit > 0 && (feature === "sales" || feature === "expenses" || feature === "stock" || feature === "whatsapp") && (
            <View style={s.usageWrap}>
              <View style={s.usageBar}>
                <View style={[s.usageFill, { backgroundColor: config.iconColor, width: "100%" }]} />
              </View>
              <Text style={s.usageText}>{used}/{limit} used</Text>
            </View>
          )}

          {/* Growth plan benefits */}
          <View style={[s.benefitsBox, { backgroundColor: colors.background }]}>
            <Text style={s.benefitsTitle}>
              Upgrade to Growth — {formatNaira(growthPlan.priceNaira)}/month
            </Text>
            {GROWTH_BENEFITS.map((b) => (
              <View key={b.text} style={s.benefitRow}>
                <View style={[s.benefitIcon, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name={b.icon as any} size={13} color="#16A34A" />
                </View>
                <Text style={s.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.upgradeBtn, { backgroundColor: growthPlan.color }]}
            onPress={handleUpgrade}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket-outline" size={18} color="#fff" />
            <Text style={s.upgradeBtnText}>
              Upgrade to Growth — {formatNaira(growthPlan.priceNaira)}/mo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.laterBtn} onPress={onClose}>
            <Text style={s.laterText}>Maybe Later</Text>
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingBottom: 40,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 16,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 12, marginBottom: 24,
    },

    iconCircle: {
      width: 64, height: 64, borderRadius: 32,
      alignItems: "center", justifyContent: "center",
      marginBottom: 16,
    },

    title: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 16,
      maxWidth: 300,
    },

    usageWrap: { width: "100%", marginBottom: 16 },
    usageBar: {
      height: 6, backgroundColor: colors.border,
      borderRadius: 3, overflow: "hidden", marginBottom: 4,
    },
    usageFill: { height: 6, borderRadius: 3 },
    usageText: { fontSize: 12, color: colors.textMuted, textAlign: "right" },

    benefitsBox: {
      width: "100%", borderRadius: 16,
      padding: 16, marginBottom: 20, gap: 8,
    },
    benefitsTitle: {
      fontSize: 13, fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    benefitIcon: {
      width: 24, height: 24, borderRadius: 8,
      alignItems: "center", justifyContent: "center",
    },
    benefitText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },

    upgradeBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      width: "100%", justifyContent: "center",
      paddingVertical: 16, borderRadius: 16,
      marginBottom: 12,
    },
    upgradeBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

    laterBtn: { paddingVertical: 8 },
    laterText: { fontSize: 14, color: colors.textMuted },
  });
