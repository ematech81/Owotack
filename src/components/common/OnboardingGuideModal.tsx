import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

// ─── Guide Steps ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: "cube-outline" as const,
    color: "#16A34A",
    bg: "#DCFCE7",
    title: "Stock Entry (Start Here)",
    description:
      "Add all your products and their quantities to Stock first. This powers accurate tracking, AI insights, and profit calculations.\n\nExample: If you have 500 bags of rice, create a stock entry for it.",
    tip: "📌 This is the most important step — don't skip it!",
  },
  {
    icon: "cart-outline" as const,
    color: "#2563EB",
    bg: "#DBEAFE",
    title: "Record Sales",
    description:
      "Record every sale quickly — by voice or manual entry. Just say what you sold and OwoTrack handles the rest.\n\nExample: \"I sell 10 bags rice 45k each\"",
    tip: "🎙 Voice entry is the fastest — try it!",
  },
  {
    icon: "people-outline" as const,
    color: "#D97706",
    bg: "#FEF3C7",
    title: "Track Credits (Debtors)",
    description:
      "Record when a customer buys on credit. OwoTrack tracks who owes you, how much, and when it's due.\n\nYou can send reminders directly from the app.",
    tip: "💡 Never lose track of money owed to you again.",
  },
  {
    icon: "receipt-outline" as const,
    color: "#DC2626",
    bg: "#FEE2E2",
    title: "Log Expenses",
    description:
      "Record business costs like transport, rent, supplies, and more. This shows your true profit — not just revenue.\n\nExample: Transport ₦3,500 · Market dues ₦1,000",
    tip: "📊 Expenses help calculate your real profit.",
  },
  {
    icon: "sparkles-outline" as const,
    color: "#7C3AED",
    bg: "#EDE9FE",
    title: "AI Business Advisor",
    description:
      "OwoTrack's AI analyzes your sales, expenses, and trends to give you actionable business advice.\n\nThe more you record, the smarter the insights get.",
    tip: "🤖 Chat with your AI advisor in the Advisor tab.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingGuideModal({ visible, onClose }: Props) {
  const colors = useTheme();
  const s = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top"]} style={[s.safe, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <View style={s.headerLeft}>
            <View style={[s.headerIcon, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="map-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[s.headerTitle, { color: colors.textPrimary }]}>How to Use OwoTrack</Text>
              <Text style={[s.headerSub, { color: colors.textMuted }]}>Your quick-start guide</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Steps */}
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.intro, { color: colors.textSecondary }]}>
            Follow these steps to get the most out of OwoTrack. We recommend starting with Stock Entry.
          </Text>

          {STEPS.map((step, idx) => (
            <View
              key={idx}
              style={[s.card, { backgroundColor: colors.surface }]}
            >
              {/* Step number + icon */}
              <View style={s.cardTop}>
                <View style={[s.iconCircle, { backgroundColor: step.bg }]}>
                  <Ionicons name={step.icon} size={22} color={step.color} />
                </View>
                <View style={s.stepNumWrap}>
                  <Text style={[s.stepNum, { color: step.color }]}>Step {idx + 1}</Text>
                  <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{step.title}</Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[s.cardDesc, { color: colors.textSecondary }]}>{step.description}</Text>

              {/* Tip */}
              <View style={[s.tipBox, { backgroundColor: step.bg }]}>
                <Text style={[s.tipText, { color: step.color }]}>{step.tip}</Text>
              </View>
            </View>
          ))}

          {/* Footer CTA */}
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={s.doneBtnText}>Got it — Let's Go!</Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "700" },
    headerSub: { fontSize: 12, marginTop: 1 },
    closeBtn: {
      width: 32, height: 32, alignItems: "center", justifyContent: "center",
      borderRadius: 16, backgroundColor: "transparent",
    },

    body: { padding: 16, paddingBottom: 32 },

    intro: {
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 16,
      paddingHorizontal: 4,
    },

    card: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    iconCircle: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    },
    stepNumWrap: { flex: 1, paddingTop: 2 },
    stepNum: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
    cardTitle: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
    cardDesc: { fontSize: 13, lineHeight: 21, marginBottom: 12 },
    tipBox: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tipText: { fontSize: 12, fontWeight: "600", lineHeight: 18 },

    doneBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      borderRadius: 14,
      marginTop: 8,
    },
    doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });
