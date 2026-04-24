import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSubscriptionStore } from "../src/store/subscriptionStore";
import { useAuthStore } from "../src/store/authStore";
import { PLANS, PlanConfig, PlanId, formatLimit } from "../src/config/plans";
import { colors } from "../src/constants/colors";
import { formatNaira } from "../src/utils/formatters";

const FEATURE_ROWS = [
  { label: "Sales / month", key: "salesPerMonth", unit: "" },
  { label: "Expenses / month", key: "expensesPerMonth", unit: "" },
  { label: "Active credits", key: "activeCredits", unit: "" },
  { label: "Stock items", key: "stockItems", unit: "" },
  { label: "AI chats / day", key: "aiChatsPerDay", unit: "" },
  { label: "Voice entries / month", key: "voicePerMonth", unit: "" },
  { label: "WhatsApp reminders", key: "whatsappReminders", unit: "" },
  { label: "Reports access", key: "reportsAccess", unit: "" },
  { label: "Export data", key: "canExport", unit: "" },
] as const;

function limitDisplay(plan: PlanConfig, key: typeof FEATURE_ROWS[number]["key"]): string {
  const val = plan.limits[key as keyof typeof plan.limits];
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (val === "today") return "Today only";
  if (val === "weekly") return "7 days";
  if (val === "full") return "Full history";
  return formatLimit(val as number);
}

export default function SubscribeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { status, isLoading, isVerifying, pendingReference, loadStatus, initializeCheckout, verifyPayment, cancelSubscription } =
    useSubscriptionStore();

  const [checkingOut, setCheckingOut] = useState<PlanId | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const currentPlan = user?.subscription?.plan ?? "free";

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === currentPlan) return;
    if (planId === "free") {
      Alert.alert("Downgrade", "To downgrade to Starter, cancel your current subscription and it will revert at the end of the billing period.", [
        { text: "Cancel subscription", style: "destructive", onPress: handleCancel },
        { text: "Keep plan", style: "cancel" },
      ]);
      return;
    }

    setCheckingOut(planId);
    try {
      const url = await initializeCheckout(planId);
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not start checkout. Please try again.");
    } finally {
      setCheckingOut(null);
    }
  };

  const handleVerify = async () => {
    const ref = pendingReference;
    if (!ref) {
      Alert.alert("", "Enter the payment reference or tap verify after returning from checkout.");
      return;
    }
    try {
      await verifyPayment(ref);
      Alert.alert("Payment Confirmed!", "Your plan has been upgraded.");
      router.back();
    } catch {
      Alert.alert("Verification Failed", "We could not confirm your payment. Try again or contact support.");
    }
  };

  const handleCancel = () => {
    Alert.alert("Cancel Subscription", "Your plan will revert to Starter at the end of this billing period.", [
      { text: "Yes, cancel", style: "destructive", onPress: async () => {
        try {
          await cancelSubscription();
          Alert.alert("Cancelled", "Your subscription has been cancelled.");
        } catch {
          Alert.alert("Error", "Could not cancel. Please try again.");
        }
      }},
      { text: "Keep plan", style: "cancel" },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Upgrade Plan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.subtitle}>Choose the plan that fits your business</Text>

        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isActive = status?.status === "active" && isCurrent;

          return (
            <View
              key={plan.id}
              style={[s.planCard, isCurrent && s.planCardActive, plan.highlight && !isCurrent && s.planCardHighlight]}
            >
              {plan.badge && !isCurrent && (
                <View style={[s.badge, { backgroundColor: plan.color }]}>
                  <Text style={s.badgeText}>{plan.badge}</Text>
                </View>
              )}
              {isCurrent && (
                <View style={[s.badge, { backgroundColor: colors.primary }]}>
                  <Text style={s.badgeText}>{isActive ? "Current Plan" : "Your Plan"}</Text>
                </View>
              )}

              <View style={s.planTop}>
                <View>
                  <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
                  <Text style={s.planPrice}>
                    {plan.priceNaira === 0 ? "Free" : `${formatNaira(plan.priceNaira)}/mo`}
                  </Text>
                </View>
                {!isCurrent && (
                  <TouchableOpacity
                    style={[s.upgradeBtn, { backgroundColor: plan.color }, checkingOut === plan.id && s.upgradeBtnLoading]}
                    onPress={() => handleUpgrade(plan.id)}
                    disabled={checkingOut !== null}
                  >
                    {checkingOut === plan.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.upgradeBtnText}>
                          {currentPlan !== "free" && plan.id === "free" ? "Cancel" : "Select"}
                        </Text>
                    }
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.divider} />

              {FEATURE_ROWS.map((row) => (
                <View key={row.key} style={s.featureRow}>
                  <Text style={s.featureLabel}>{row.label}</Text>
                  <Text style={[s.featureVal, limitDisplay(plan, row.key) === "Unlimited" && { color: plan.color, fontWeight: "700" }]}>
                    {limitDisplay(plan, row.key)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {pendingReference && (
          <View style={s.verifyBox}>
            <Text style={s.verifyTitle}>Payment in progress?</Text>
            <Text style={s.verifySubtitle}>
              After completing payment in your browser, tap below to confirm your upgrade.
            </Text>
            <TouchableOpacity style={s.verifyBtn} onPress={handleVerify} disabled={isVerifying}>
              {isVerifying
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={s.verifyBtnText}>Confirm Payment</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {currentPlan !== "free" && status?.status === "active" && (
          <TouchableOpacity style={s.cancelLink} onPress={handleCancel}>
            <Text style={s.cancelLinkText}>Cancel subscription</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  body: { padding: 16, paddingTop: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 20 },

  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  planCardActive: { borderColor: colors.primary, borderWidth: 2 },
  planCardHighlight: { borderColor: "#16A34A", borderWidth: 2 },

  badge: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  planName: { fontSize: 20, fontWeight: "800" },
  planPrice: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

  upgradeBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 70, alignItems: "center",
  },
  upgradeBtnLoading: { opacity: 0.7 },
  upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  featureRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  featureLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  featureVal: { fontSize: 13, color: colors.textPrimary, fontWeight: "500", textAlign: "right" },

  verifyBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#93C5FD",
    marginBottom: 16,
    alignItems: "center",
  },
  verifyTitle: { fontSize: 15, fontWeight: "700", color: "#1D4ED8", marginBottom: 6 },
  verifySubtitle: { fontSize: 13, color: "#3B82F6", textAlign: "center", lineHeight: 20, marginBottom: 12 },
  verifyBtn: { backgroundColor: "#2563EB", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  verifyBtnText: { color: "#fff", fontWeight: "700" },

  cancelLink: { alignItems: "center", padding: 12 },
  cancelLinkText: { color: colors.danger, fontSize: 14 },
});
