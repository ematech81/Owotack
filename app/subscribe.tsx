// import React, { useEffect, useState } from "react";
// import {
//   View, Text, StyleSheet, ScrollView, TouchableOpacity,
//   Alert, ActivityIndicator, Linking,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useRouter } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { useSubscriptionStore } from "../src/store/subscriptionStore";
// import { useAuthStore } from "../src/store/authStore";
// import { PLANS, PlanConfig, PlanId, formatLimit } from "../src/config/plans";
// import { colors } from "../src/constants/colors";
// import { formatNaira } from "../src/utils/formatters";

// const FEATURE_ROWS = [
//   { label: "Sales / month", key: "salesPerMonth", unit: "" },
//   { label: "Expenses / month", key: "expensesPerMonth", unit: "" },
//   { label: "Active credits", key: "activeCredits", unit: "" },
//   { label: "Stock items", key: "stockItems", unit: "" },
//   { label: "AI chats / day", key: "aiChatsPerDay", unit: "" },
//   { label: "Voice entries / month", key: "voicePerMonth", unit: "" },
//   { label: "WhatsApp reminders", key: "whatsappReminders", unit: "" },
//   { label: "Reports access", key: "reportsAccess", unit: "" },
//   { label: "Export data", key: "canExport", unit: "" },
// ] as const;

// function limitDisplay(plan: PlanConfig, key: typeof FEATURE_ROWS[number]["key"]): string {
//   const val = plan.limits[key as keyof typeof plan.limits];
//   if (typeof val === "boolean") return val ? "Yes" : "No";
//   if (val === "today") return "Today only";
//   if (val === "weekly") return "7 days";
//   if (val === "full") return "Full history";
//   return formatLimit(val as number);
// }

// export default function SubscribeScreen() {
//   const router = useRouter();
//   const { user } = useAuthStore();
//   const { status, isLoading, isVerifying, pendingReference, loadStatus, initializeCheckout, verifyPayment, cancelSubscription } =
//     useSubscriptionStore();

//   const [checkingOut, setCheckingOut] = useState<PlanId | null>(null);

//   useEffect(() => {
//     loadStatus();
//   }, []);

//   const currentPlan = user?.subscription?.plan ?? "free";

//   const handleUpgrade = async (planId: PlanId) => {
//     if (planId === currentPlan) return;
//     if (planId === "free") {
//       Alert.alert("Downgrade", "To downgrade to Starter, cancel your current subscription and it will revert at the end of the billing period.", [
//         { text: "Cancel subscription", style: "destructive", onPress: handleCancel },
//         { text: "Keep plan", style: "cancel" },
//       ]);
//       return;
//     }

//     setCheckingOut(planId);
//     try {
//       const url = await initializeCheckout(planId);
//       await Linking.openURL(url);
//     } catch {
//       Alert.alert("Error", "Could not start checkout. Please try again.");
//     } finally {
//       setCheckingOut(null);
//     }
//   };

//   const handleVerify = async () => {
//     const ref = pendingReference;
//     if (!ref) {
//       Alert.alert("", "Enter the payment reference or tap verify after returning from checkout.");
//       return;
//     }
//     try {
//       await verifyPayment(ref);
//       Alert.alert("Payment Confirmed!", "Your plan has been upgraded.");
//       router.back();
//     } catch {
//       Alert.alert("Verification Failed", "We could not confirm your payment. Try again or contact support.");
//     }
//   };

//   const handleCancel = () => {
//     Alert.alert("Cancel Subscription", "Your plan will revert to Starter at the end of this billing period.", [
//       { text: "Yes, cancel", style: "destructive", onPress: async () => {
//         try {
//           await cancelSubscription();
//           Alert.alert("Cancelled", "Your subscription has been cancelled.");
//         } catch {
//           Alert.alert("Error", "Could not cancel. Please try again.");
//         }
//       }},
//       { text: "Keep plan", style: "cancel" },
//     ]);
//   };

//   if (isLoading) {
//     return (
//       <SafeAreaView style={s.safe}>
//         <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={s.safe}>
//       <View style={s.header}>
//         <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
//           <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
//         </TouchableOpacity>
//         <Text style={s.headerTitle}>Upgrade Plan</Text>
//         <View style={{ width: 36 }} />
//       </View>

//       <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
//         <Text style={s.subtitle}>Choose the plan that fits your business</Text>

//         {PLANS.map((plan) => {
//           const isCurrent = plan.id === currentPlan;
//           const isActive = status?.status === "active" && isCurrent;

//           return (
//             <View
//               key={plan.id}
//               style={[s.planCard, isCurrent && s.planCardActive, plan.highlight && !isCurrent && s.planCardHighlight]}
//             >
//               {plan.badge && !isCurrent && (
//                 <View style={[s.badge, { backgroundColor: plan.color }]}>
//                   <Text style={s.badgeText}>{plan.badge}</Text>
//                 </View>
//               )}
//               {isCurrent && (
//                 <View style={[s.badge, { backgroundColor: colors.primary }]}>
//                   <Text style={s.badgeText}>{isActive ? "Current Plan" : "Your Plan"}</Text>
//                 </View>
//               )}

//               <View style={s.planTop}>
//                 <View>
//                   <Text style={[s.planName, { color: plan.color }]}>{plan.name}</Text>
//                   <Text style={s.planPrice}>
//                     {plan.priceNaira === 0 ? "Free" : `${formatNaira(plan.priceNaira)}/mo`}
//                   </Text>
//                 </View>
//                 {!isCurrent && (
//                   <TouchableOpacity
//                     style={[s.upgradeBtn, { backgroundColor: plan.color }, checkingOut === plan.id && s.upgradeBtnLoading]}
//                     onPress={() => handleUpgrade(plan.id)}
//                     disabled={checkingOut !== null}
//                   >
//                     {checkingOut === plan.id
//                       ? <ActivityIndicator size="small" color="#fff" />
//                       : <Text style={s.upgradeBtnText}>
//                           {currentPlan !== "free" && plan.id === "free" ? "Cancel" : "Select"}
//                         </Text>
//                     }
//                   </TouchableOpacity>
//                 )}
//               </View>

//               <View style={s.divider} />

//               {FEATURE_ROWS.map((row) => (
//                 <View key={row.key} style={s.featureRow}>
//                   <Text style={s.featureLabel}>{row.label}</Text>
//                   <Text style={[s.featureVal, limitDisplay(plan, row.key) === "Unlimited" && { color: plan.color, fontWeight: "700" }]}>
//                     {limitDisplay(plan, row.key)}
//                   </Text>
//                 </View>
//               ))}
//             </View>
//           );
//         })}

//         {pendingReference && (
//           <View style={s.verifyBox}>
//             <Text style={s.verifyTitle}>Payment in progress?</Text>
//             <Text style={s.verifySubtitle}>
//               After completing payment in your browser, tap below to confirm your upgrade.
//             </Text>
//             <TouchableOpacity style={s.verifyBtn} onPress={handleVerify} disabled={isVerifying}>
//               {isVerifying
//                 ? <ActivityIndicator size="small" color={colors.white} />
//                 : <Text style={s.verifyBtnText}>Confirm Payment</Text>
//               }
//             </TouchableOpacity>
//           </View>
//         )}

//         {currentPlan !== "free" && status?.status === "active" && (
//           <TouchableOpacity style={s.cancelLink} onPress={handleCancel}>
//             <Text style={s.cancelLinkText}>Cancel subscription</Text>
//           </TouchableOpacity>
//         )}

//         <View style={{ height: 40 }} />
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const s = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: colors.background },
//   header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
//   backBtn: { padding: 8 },
//   headerTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
//   body: { padding: 16, paddingTop: 8 },
//   subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 20 },

//   planCard: {
//     backgroundColor: colors.surface,
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 16,
//     borderWidth: 1.5,
//     borderColor: colors.border,
//     overflow: "hidden",
//   },
//   planCardActive: { borderColor: colors.primary, borderWidth: 2 },
//   planCardHighlight: { borderColor: "#16A34A", borderWidth: 2 },

//   badge: {
//     position: "absolute", top: 12, right: 12,
//     paddingHorizontal: 10, paddingVertical: 3,
//     borderRadius: 20,
//   },
//   badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

//   planTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
//   planName: { fontSize: 20, fontWeight: "800" },
//   planPrice: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

//   upgradeBtn: {
//     paddingHorizontal: 18, paddingVertical: 8,
//     borderRadius: 20, minWidth: 70, alignItems: "center",
//   },
//   upgradeBtnLoading: { opacity: 0.7 },
//   upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

//   divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

//   featureRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
//   featureLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
//   featureVal: { fontSize: 13, color: colors.textPrimary, fontWeight: "500", textAlign: "right" },

//   verifyBox: {
//     backgroundColor: "#EFF6FF",
//     borderRadius: 12,
//     padding: 16,
//     borderWidth: 1,
//     borderColor: "#93C5FD",
//     marginBottom: 16,
//     alignItems: "center",
//   },
//   verifyTitle: { fontSize: 15, fontWeight: "700", color: "#1D4ED8", marginBottom: 6 },
//   verifySubtitle: { fontSize: 13, color: "#3B82F6", textAlign: "center", lineHeight: 20, marginBottom: 12 },
//   verifyBtn: { backgroundColor: "#2563EB", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
//   verifyBtnText: { color: "#fff", fontWeight: "700" },

//   cancelLink: { alignItems: "center", padding: 12 },
//   cancelLinkText: { color: colors.danger, fontSize: 14 },
// });




import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Linking, Animated, Dimensions, AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscriptionStore } from "../src/store/subscriptionStore";
import { useAuthStore } from "../src/store/authStore";
import { PLANS, PlanConfig, PlanId, formatLimit } from "../src/config/plans";
import { colors } from "../src/constants/colors";
import { formatNaira } from "../src/utils/formatters";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────────────────────────

const D = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 3,
    },
    medium: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 6,
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

// ─── Feature Rows Config ──────────────────────────────────────────────────────

const FEATURE_ROWS = [
  { label: "Sales / month",        key: "salesPerMonth",     icon: "bag-handle-outline" },
  { label: "Expenses / month",     key: "expensesPerMonth",  icon: "receipt-outline" },
  { label: "Active credits",       key: "activeCredits",     icon: "time-outline" },
  { label: "Stock items",          key: "stockItems",        icon: "cube-outline" },
  { label: "AI chats / day",       key: "aiChatsPerDay",     icon: "sparkles-outline" },
  { label: "Voice entries / mo",   key: "voicePerMonth",     icon: "mic-outline" },
  { label: "WhatsApp reminders",   key: "whatsappReminders", icon: "logo-whatsapp" },
  { label: "Reports access",       key: "reportsAccess",     icon: "bar-chart-outline" },
  { label: "Export data",          key: "canExport",         icon: "download-outline" },
] as const;

function limitDisplay(plan: PlanConfig, key: typeof FEATURE_ROWS[number]["key"]): string {
  const val = plan.limits[key as keyof typeof plan.limits];
  if (typeof val === "boolean") return val ? "Included" : "Not included";
  if (val === "today") return "Today only";
  if (val === "weekly") return "7 days";
  if (val === "full") return "Full history";
  return formatLimit(val as number);
}

function isUnlimited(str: string) {
  return str === "Unlimited";
}

function isIncluded(str: string) {
  return str === "Included";
}

function isExcluded(str: string) {
  return str === "Not included";
}

// ─── Animated Press Wrapper ───────────────────────────────────────────────────

function PressScale({
  children, onPress, style, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

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

// ─── Hero Header ──────────────────────────────────────────────────────────────

function HeroHeader({ onBack, currentPlan }: { onBack: () => void; currentPlan: string }) {
  return (
    <LinearGradient
      colors={[colors.primary + "20", colors.primary + "05", colors.background]}
      style={heroS.gradient}
    >
      {/* Decorative circles */}
      <View style={heroS.circle1} />
      <View style={heroS.circle2} />

      {/* Nav row */}
      <View style={heroS.navRow}>
        <TouchableOpacity onPress={onBack} style={[heroS.backBtn, D.shadow.soft]}>
          <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={heroS.currentPlanChip}>
          <View style={[heroS.chipDot, { backgroundColor: colors.primary }]} />
          <Text style={[heroS.chipText, { color: colors.primary }]}>
            {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
          </Text>
        </View>
      </View>

      {/* Title block */}
      <View style={heroS.titleBlock}>
        <View style={[heroS.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="rocket-outline" size={28} color={colors.primary} />
        </View>
        <Text style={heroS.title}>Upgrade Your Plan</Text>
        <Text style={heroS.subtitle}>
          Unlock more power for your business.{"\n"}Cancel anytime.
        </Text>
      </View>
    </LinearGradient>
  );
}

const heroS = StyleSheet.create({
  gradient: {
    paddingBottom: 24,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.primary + "0A",
    top: -60, right: -60,
  },
  circle2: {
    position: "absolute",
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.primary + "08",
    top: 20, left: -40,
  },
  navRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 14, marginBottom: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: D.radius.full,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  currentPlanChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary + "15",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: D.radius.full,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: "700" },
  titleBlock: { alignItems: "center", paddingHorizontal: 24, gap: 10 },
  iconWrap: {
    width: 64, height: 64, borderRadius: D.radius.xl,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 26, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});

// ─── Plan Value Badge ─────────────────────────────────────────────────────────

function PlanValueBadge({ plan }: { plan: PlanConfig }) {
  if (!plan.badge) return null;
  return (
    <View style={[pvbS.wrap, { backgroundColor: plan.color }]}>
      <Ionicons name="star" size={10} color="#fff" />
      <Text style={pvbS.text}>{plan.badge}</Text>
    </View>
  );
}

const pvbS = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: D.radius.full,
  },
  text: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});

// ─── Feature Row ──────────────────────────────────────────────────────────────

function FeatureRow({
  icon, label, value, planColor,
}: {
  icon: string;
  label: string;
  value: string;
  planColor: string;
}) {
  const unlimited = isUnlimited(value);
  const included  = isIncluded(value);
  const excluded  = isExcluded(value);

  return (
    <View style={frS.row}>
      <View style={[frS.iconWrap, { backgroundColor: excluded ? "#F3F4F6" : planColor + "15" }]}>
        <Ionicons
          name={icon as any}
          size={13}
          color={excluded ? colors.textMuted : planColor}
        />
      </View>
      <Text style={frS.label}>{label}</Text>
      <View style={frS.valueWrap}>
        {included ? (
          <View style={[frS.checkBadge, { backgroundColor: planColor + "18" }]}>
            <Ionicons name="checkmark" size={12} color={planColor} />
            <Text style={[frS.checkText, { color: planColor }]}>Yes</Text>
          </View>
        ) : excluded ? (
          <View style={frS.crossBadge}>
            <Ionicons name="close" size={12} color={colors.textMuted} />
          </View>
        ) : (
          <Text style={[
            frS.value,
            { color: unlimited ? planColor : colors.textPrimary },
            unlimited && frS.unlimitedValue,
          ]}>
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

const frS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingVertical: 8,
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  label: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
  valueWrap: { alignItems: "flex-end" },
  value: { fontSize: 13, fontWeight: "700" },
  unlimitedValue: { fontWeight: "800" },
  checkBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: D.radius.full,
  },
  checkText: { fontSize: 11, fontWeight: "700" },
  crossBadge: {
    width: 22, height: 22, borderRadius: D.radius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
});

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan, isCurrent, isActive, checkingOut, onSelect,
}: {
  plan: PlanConfig;
  isCurrent: boolean;
  isActive: boolean;
  checkingOut: PlanId | null;
  onSelect: () => void;
}) {
  const isHighlighted = plan.highlight && !isCurrent;
  const isLoading = checkingOut === plan.id;

  return (
    <View style={[
      pcS.card,
      { borderColor: isCurrent ? colors.primary : isHighlighted ? plan.color : colors.border },
      (isCurrent || isHighlighted) && pcS.cardElevated,
    ]}>
      {/* Top gradient strip */}
      <LinearGradient
        colors={[plan.color + "25", plan.color + "08"]}
        style={pcS.topStrip}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        {/* Plan icon + name row */}
        <View style={pcS.topRow}>
          <View style={pcS.topLeft}>
            <View style={[pcS.planIcon, { backgroundColor: plan.color + "25" }]}>
              <Ionicons
                name={
                  plan.id === "free" ? "leaf-outline" :
                  plan.id === "pro" ? "flash-outline" : "diamond-outline"
                }
                size={20}
                color={plan.color}
              />
            </View>
            <View>
              <Text style={[pcS.planName, { color: plan.color }]}>{plan.name}</Text>
              <Text style={pcS.planPrice}>
                {plan.priceNaira === 0 ? "Always Free" : `${formatNaira(plan.priceNaira)} / month`}
              </Text>
            </View>
          </View>

          {/* Badge or current indicator */}
          {isCurrent ? (
            <View style={[pcS.currentBadge, { borderColor: colors.primary, backgroundColor: colors.primary + "15" }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              <Text style={[pcS.currentBadgeText, { color: colors.primary }]}>
                {isActive ? "Active" : "Current"}
              </Text>
            </View>
          ) : (
            <PlanValueBadge plan={plan} />
          )}
        </View>
      </LinearGradient>

      {/* Features */}
      <View style={pcS.featuresWrap}>
        {FEATURE_ROWS.map((row, i) => (
          <React.Fragment key={row.key}>
            <FeatureRow
              icon={row.icon}
              label={row.label}
              value={limitDisplay(plan, row.key)}
              planColor={plan.color}
            />
            {i < FEATURE_ROWS.length - 1 && (
              <View style={[pcS.featureDivider, { backgroundColor: colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* CTA */}
      {!isCurrent && (
        <View style={pcS.ctaWrap}>
          <PressScale onPress={onSelect} disabled={checkingOut !== null} style={{ borderRadius: D.radius.xl }}>
            <LinearGradient
              colors={isLoading ? [colors.textMuted, colors.textMuted] : [plan.color, plan.color + "CC"]}
              style={pcS.ctaBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={pcS.ctaBtnText}>
                    {plan.id === "free" ? "Downgrade" : "Get Started"}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </LinearGradient>
          </PressScale>
        </View>
      )}

      {isCurrent && (
        <View style={[pcS.activeFooter, { backgroundColor: colors.primary + "0C" }]}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
          <Text style={[pcS.activeFooterText, { color: colors.primary }]}>
            You're on this plan
          </Text>
        </View>
      )}
    </View>
  );
}

const pcS = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: D.radius.xl,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: "hidden",
    ...D.shadow.soft,
  },
  cardElevated: {
    ...D.shadow.medium,
  },
  topStrip: {
    padding: 16,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIcon: {
    width: 44, height: 44, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
  },
  planName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  planPrice: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", marginTop: 2 },
  currentBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: D.radius.full, borderWidth: 1.5,
  },
  currentBadgeText: { fontSize: 11, fontWeight: "700" },
  featuresWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  featureDivider: { height: 1, opacity: 0.5 },
  ctaWrap: { padding: 14, paddingTop: 10 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: D.radius.xl,
  },
  ctaBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  activeFooter: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    paddingVertical: 12,
  },
  activeFooterText: { fontSize: 13, fontWeight: "700" },
});

// ─── Verify Payment Card ──────────────────────────────────────────────────────

function VerifyPaymentCard({
  isVerifying, onVerify,
}: {
  isVerifying: boolean;
  onVerify: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={verifyS.card}>
      <LinearGradient colors={["#EFF6FF", "#DBEAFE"]} style={verifyS.gradient}>
        <View style={verifyS.row}>
          <Animated.View style={[verifyS.iconWrap, { transform: [{ scale: pulse }] }]}>
            <LinearGradient colors={["#3B82F6", "#2563EB"]} style={verifyS.iconGrad}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <View style={verifyS.textBlock}>
            <Text style={verifyS.title}>Payment in progress</Text>
            <Text style={verifyS.sub}>
              Return from your browser and tap below to confirm your upgrade.
            </Text>
          </View>
        </View>

        <PressScale onPress={onVerify} disabled={isVerifying} style={{ borderRadius: D.radius.xl }}>
          <LinearGradient colors={["#2563EB", "#1D4ED8"]} style={verifyS.btn}>
            {isVerifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={verifyS.btnText}>Confirm Payment</Text>
              </>
            )}
          </LinearGradient>
        </PressScale>
      </LinearGradient>
    </View>
  );
}

const verifyS = StyleSheet.create({
  card: {
    borderRadius: D.radius.xl, overflow: "hidden",
    marginBottom: 16, borderWidth: 1.5, borderColor: "#93C5FD",
    ...D.shadow.soft,
  },
  gradient: { padding: 16, gap: 14 },
  row: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  iconWrap: { flexShrink: 0 },
  iconGrad: {
    width: 48, height: 48, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
  },
  textBlock: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: "800", color: "#1D4ED8" },
  sub: { fontSize: 13, color: "#3B82F6", lineHeight: 18, fontWeight: "500" },
  btn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: D.radius.xl,
  },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});

// ─── Trust Badges ─────────────────────────────────────────────────────────────

function TrustBadges() {
  const items = [
    { icon: "lock-closed-outline", label: "Secure payments" },
    { icon: "refresh-outline",     label: "Cancel anytime" },
    { icon: "headset-outline",     label: "24/7 support" },
  ];

  return (
    <View style={trustS.row}>
      {items.map((item) => (
        <View key={item.label} style={trustS.item}>
          <Ionicons name={item.icon as any} size={16} color={colors.textMuted} />
          <Text style={trustS.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const trustS = StyleSheet.create({
  row: {
    flexDirection: "row", justifyContent: "center",
    gap: 0, marginBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: D.radius.lg, padding: 12,
    ...D.shadow.soft,
  },
  item: {
    flex: 1, alignItems: "center", gap: 4,
  },
  label: { fontSize: 10, color: colors.textMuted, fontWeight: "600", textAlign: "center" },
});

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={loadS.wrap}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <LinearGradient
            colors={[colors.primary, colors.primary + "66"]}
            style={loadS.spinner}
          >
            <Ionicons name="rocket-outline" size={28} color="#fff" />
          </LinearGradient>
        </Animated.View>
        <Text style={loadS.text}>Loading plans...</Text>
      </View>
    </SafeAreaView>
  );
}

const loadS = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  spinner: {
    width: 68, height: 68, borderRadius: D.radius.xl,
    alignItems: "center", justifyContent: "center",
  },
  text: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SubscribeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    status, isLoading, isVerifying, pendingReference,
    loadStatus, initializeCheckout, verifyPayment, cancelSubscription,
  } = useSubscriptionStore();

  const [checkingOut, setCheckingOut] = useState<PlanId | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => { loadStatus(); }, []);

  // When the user returns from the browser (having completed payment), remind them
  // to tap "Confirm Payment". The deep link handles this automatically in production,
  // but this is a fallback for cases where the deep link doesn't fire (browser blocks it).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        if (pendingReference) {
          // App came to foreground with a pending payment reference — refresh status
          loadStatus();
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [pendingReference]);

  const currentPlan = user?.subscription?.plan ?? "free";

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === currentPlan) return;
    if (planId === "free") {
      Alert.alert(
        "Downgrade to Starter",
        "Your plan will revert to Starter at the end of the current billing period.",
        [
          { text: "Cancel Subscription", style: "destructive", onPress: handleCancel },
          { text: "Keep My Plan", style: "cancel" },
        ]
      );
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
      Alert.alert("", "No pending payment found. Complete checkout first.");
      return;
    }
    try {
      await verifyPayment(ref);
      Alert.alert("🎉 Payment Confirmed!", "Your plan has been upgraded successfully.");
      router.back();
    } catch {
      Alert.alert("Verification Failed", "We could not confirm your payment. Try again or contact support.");
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Subscription",
      "Your plan will revert to Starter at the end of this billing period. Are you sure?",
      [
        {
          text: "Yes, cancel it",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelSubscription();
              Alert.alert("Cancelled", "Your subscription has been cancelled.");
            } catch {
              Alert.alert("Error", "Could not cancel. Please try again.");
            }
          },
        },
        { text: "Keep My Plan", style: "cancel" },
      ]
    );
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={mainS.scroll}
      >
        {/* Hero */}
        <HeroHeader onBack={() => router.back()} currentPlan={currentPlan} />

        <View style={mainS.body}>
          {/* Trust badges */}
          <TrustBadges />

          {/* Plan cards */}
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isActive = status?.status === "active" && isCurrent;

            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={isCurrent}
                isActive={isActive}
                checkingOut={checkingOut}
                onSelect={() => handleUpgrade(plan.id)}
              />
            );
          })}

          {/* Verify payment */}
          {pendingReference && (
            <VerifyPaymentCard isVerifying={isVerifying} onVerify={handleVerify} />
          )}

          {/* Cancel link */}
          {currentPlan !== "free" && status?.status === "active" && (
            <TouchableOpacity style={mainS.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
              <Text style={mainS.cancelBtnText}>Cancel my subscription</Text>
            </TouchableOpacity>
          )}

          {/* Legal note */}
          <Text style={mainS.legal}>
            Payments are processed securely via Paystack.{"\n"}
            Subscriptions renew monthly. Cancel anytime.
          </Text>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const mainS = StyleSheet.create({
  scroll: { flexGrow: 1 },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  cancelBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    paddingVertical: 14,
    borderRadius: D.radius.xl,
    borderWidth: 1.5,
    borderColor: colors.danger + "40",
    backgroundColor: colors.danger + "08",
    marginBottom: 16,
  },
  cancelBtnText: {
    color: colors.danger, fontSize: 14, fontWeight: "700",
  },
  legal: {
    fontSize: 11, color: colors.textMuted,
    textAlign: "center", lineHeight: 17,
    marginBottom: 8,
  },
})