

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Share,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/authStore";
import { useTheme } from "../../src/hooks/useTheme";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { getPlanById } from "../../src/config/plans";
import { formatNaira } from "../../src/utils/formatters";
import { authService } from "../../src/services/authService";
import api from "../../src/services/api";
import { ApiResponse, User } from "../../src/types";

const IS_DEV = process.env.NODE_ENV === "development" || __DEV__;
const USER_CACHE_KEY = "cached_user";

const PLAN_COLORS: Record<string, string> = {
  free: "#64748B",
  growth: "#16A34A",
  pro: "#7C3AED",
  business: "#B45309",
};

const PLAN_GRADIENTS: Record<string, [string, string]> = {
  free: ["#64748B", "#94A3B8"],
  growth: ["#16A34A", "#22C55E"],
  pro: ["#7C3AED", "#A855F7"],
  business: ["#B45309", "#F59E0B"],
};

const LANGUAGES: { key: User["preferredLanguage"]; label: string; flag: string }[] = [
  { key: "pidgin", label: "Nigerian Pidgin", flag: "🇳🇬" },
  { key: "english", label: "English", flag: "🇬🇧" },
];

// ─── Settings Row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  iconBg,
  iconColor,
  label,
  subtitle,
  onPress,
  showArrow,
  rightElement,
  colors,
  isDestructive,
}: {
  icon: string;
  iconBg?: string;
  iconColor?: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
  colors: ReturnType<typeof useTheme>;
  isDestructive?: boolean;
}) {
  const Wrap: any = onPress ? TouchableOpacity : View;
  const resolvedIconColor = isDestructive ? colors.danger : (iconColor ?? colors.primary);
  const resolvedIconBg = isDestructive ? colors.danger + "15" : (iconBg ?? colors.primary + "15");

  return (
    <Wrap
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
      }}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: resolvedIconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon as any} size={18} color={resolvedIconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: isDestructive ? colors.danger : colors.textPrimary,
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement}
      {showArrow ? (
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
      ) : null}
    </Wrap>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  colors,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>;
  style?: object;
}) {
  return (
    <View style={[sectionStyles(colors).card, style]}>
      {title ? (
        <Text style={sectionStyles(colors).label}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

const sectionStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    label: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 4,
    },
  });

// ─── Divider ──────────────────────────────────────────────────────────────────

function RowDivider({ colors }: { colors: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 68,
        marginRight: 0,
      }}
    />
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatPill({
  emoji,
  value,
  label,
  colors,
}: {
  emoji: string;
  value: string | number;
  label: string;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "800",
          color: colors.textPrimary,
          letterSpacing: -0.3,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Modal Field ──────────────────────────────────────────────────────────────

function ModalField({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { user, logout, resetApp, setUser, autoLoginEnabled, setAutoLogin } = useAuthStore();

  const planId = user?.subscription?.plan ?? "free";
  const plan = getPlanById(planId);
  const planColor = PLAN_COLORS[planId] ?? colors.primary;
  const isOnPaidPlan = planId !== "free";
  const subStatus = user?.subscription?.status;

  // ── Modal visibility
  const [editVisible, setEditVisible] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [langVisible, setLangVisible] = useState(false);

  // ── Edit profile form
  const [editForm, setEditForm] = useState({
    name: user?.name ?? "",
    businessName: user?.businessName ?? "",
    locationState: user?.location?.state ?? "",
    locationCity: user?.location?.city ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // ── Change PIN form
  const [pinForm, setPinForm] = useState({ current: "", newPin: "", confirm: "" });
  const [pinSaving, setPinSaving] = useState(false);

  // ── Referral data from API
  const [referralData, setReferralData] = useState<{
    totalReferrals: number;
    referrals: { firstName: string; joinedAt: string; isActive: boolean; plan: string }[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<ApiResponse<{
      referralCode: string;
      totalReferrals: number;
      referrals: { firstName: string; joinedAt: string; isActive: boolean; plan: string }[];
    }>>("/users/me/referral")
      .then((res) => setReferralData(res.data.data))
      .catch(() => {});
  }, [user?._id]);

  // ── Notification toggles (local state for optimistic UI)
  const [notifs, setNotifs] = useState({
    dailyReminder: user?.notifications?.dailyReminder ?? false,
    weeklyReport: user?.notifications?.weeklyReport ?? false,
    creditReminders: user?.notifications?.creditReminders ?? false,
  });

  const saveToCache = async (u: User) => {
    await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(u));
  };

  const handleEditOpen = () => {
    setEditForm({
      name: user?.name ?? "",
      businessName: user?.businessName ?? "",
      locationState: user?.location?.state ?? "",
      locationCity: user?.location?.city ?? "",
    });
    setEditVisible(true);
  };

  const handleEditSave = async () => {
    if (!user) return;
    if (!editForm.name.trim()) {
      Alert.alert("", "Name is required.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.patch<ApiResponse<User>>("/users/me", {
        name: editForm.name.trim(),
        businessName: editForm.businessName.trim() || undefined,
        location: {
          ...user.location,
          state: editForm.locationState.trim() || undefined,
          city: editForm.locationCity.trim() || undefined,
        },
      });
      setUser(res.data.data);
      await saveToCache(res.data.data);
      setEditVisible(false);
    } catch {
      Alert.alert("Error", "Could not update profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePinOpen = () => {
    setPinForm({ current: "", newPin: "", confirm: "" });
    setPinVisible(true);
  };

  const handlePinSave = async () => {
    if (!pinForm.current || !pinForm.newPin || !pinForm.confirm) {
      Alert.alert("", "Fill in all PIN fields.");
      return;
    }
    if (!/^\d{4}$/.test(pinForm.newPin)) {
      Alert.alert("", "New PIN must be exactly 4 digits.");
      return;
    }
    if (pinForm.newPin !== pinForm.confirm) {
      Alert.alert("", "New PIN and confirm PIN don't match.");
      return;
    }
    setPinSaving(true);
    try {
      await authService.changePin(pinForm.current, pinForm.newPin);
      await SecureStore.setItemAsync("stored_pin", pinForm.newPin);
      setPinVisible(false);
      Alert.alert("✅ Done", "Your PIN has been changed.");
    } catch {
      Alert.alert("Error", "Wrong current PIN or network error. Try again.");
    } finally {
      setPinSaving(false);
    }
  };

  const handleLangChange = async (lang: User["preferredLanguage"]) => {
    if (!user) return;
    setLangVisible(false);
    try {
      const res = await api.patch<ApiResponse<User>>("/users/me", { preferredLanguage: lang });
      setUser(res.data.data);
      await saveToCache(res.data.data);
    } catch {
      Alert.alert("Error", "Could not update language.");
    }
  };

  const handleNotifToggle = async (key: keyof typeof notifs, value: boolean) => {
    if (!user) return;
    const prev = { ...notifs };
    const updated = { ...notifs, [key]: value };
    setNotifs(updated);
    try {
      const res = await api.patch<ApiResponse<User>>("/users/me", {
        notifications: { ...user.notifications, ...updated },
      });
      setUser(res.data.data);
      await saveToCache(res.data.data);
    } catch {
      setNotifs(prev);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "You sure say you want logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleShareReferral = async () => {
    if (!user?.referralCode) return;
    const code = user.referralCode;
    const iosLink = "https://apps.apple.com/app/owotrack/id0000000000"; // replace with real App Store ID
    const androidLink = "https://play.google.com/store/apps/details?id=com.owotrack.app";
    try {
      await Share.share({
        message:
          `Hey! 👋 I use OwoTrack to track my business sales, expenses, and credits.\n\n` +
          `Download the app 👇\n` +
          `Android: ${androidLink}\n` +
          `iPhone: ${iosLink}\n\n` +
          `When you sign up, enter my referral code: *${code}*\n\n` +
          `OwoTrack — Track your money the easy way! 🧾`,
        url: androidLink, // iOS Share sheet uses this as the primary URL
      });
    } catch {
      /* ignore */
    }
  };

  const handleDevReset = () => {
    Alert.alert(
      "Reset App Data",
      "This go clear everything and show onboarding again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => resetApp(),
        },
      ]
    );
  };

  const s = makeStyles(colors);

  const avatarLetters = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const langLabel =
    LANGUAGES.find((l) => l.key === user?.preferredLanguage)?.label ?? "English";
  const langFlag =
    LANGUAGES.find((l) => l.key === user?.preferredLanguage)?.flag ?? "🇬🇧";

  // Subscription status label
  const subStatusLabel = isOnPaidPlan
    ? subStatus === "active"
      ? "Active"
      : subStatus === "cancelled"
      ? "Cancelled"
      : subStatus === "expired"
      ? "Expired"
      : ""
    : "";

  return (
    <SafeAreaView style={s.safe}>
      <AppStatusBar />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Header ── */}
        <View style={s.heroSection}>
          {/* Background accent */}
          <View style={[s.heroBg, { backgroundColor: planColor }]} />

          <View style={s.heroContent}>
            {/* Avatar */}
            <View style={s.avatarWrapper}>
              <View style={[s.avatarRing, { borderColor: planColor }]}>
                <View style={[s.avatar, { backgroundColor: planColor }]}>
                  <Text style={s.avatarText}>{avatarLetters}</Text>
                </View>
              </View>
              {/* Online dot */}
              <View style={[s.onlineDot, { borderColor: colors.surface }]} />
            </View>

            <Text style={s.heroName}>{user?.name}</Text>

            {user?.businessName ? (
              <View style={s.bizRow}>
                <Ionicons name="storefront-outline" size={13} color={colors.textMuted} />
                <Text style={s.heroSubtitle}>{user.businessName}</Text>
              </View>
            ) : null}

            <View style={s.metaRow}>
              <Ionicons name="call-outline" size={12} color={colors.textMuted} />
              <Text style={s.metaText}>{user?.phone}</Text>
              {user?.location?.city || user?.location?.state ? (
                <>
                  <View style={s.metaDot} />
                  <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                  <Text style={s.metaText}>
                    {[user?.location?.city, user?.location?.state]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </>
              ) : null}
            </View>

            {/* Plan badge */}
            <TouchableOpacity
              style={[
                s.planBadge,
                { backgroundColor: planColor + "20", borderColor: planColor + "50" },
              ]}
              onPress={() => router.push("/subscribe")}
              activeOpacity={0.8}
            >
              <View style={[s.planDot, { backgroundColor: planColor }]} />
              <Text style={[s.planBadgeText, { color: planColor }]}>
                {plan.name} Plan
                {subStatusLabel ? ` · ${subStatusLabel}` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={11} color={planColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stats Strip ── */}
        <View style={s.statsStrip}>
          <StatPill
            emoji="🔥"
            value={user?.streakDays ?? 0}
            label="Day Streak"
            colors={colors}
          />
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <StatPill
            emoji="❤️"
            value={user?.healthScore ?? 0}
            label="Health Score"
            colors={colors}
          />
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <StatPill
            emoji={user?.loanEligible ? "✅" : "⏳"}
            value={user?.loanEligible ? "Eligible" : "Not Yet"}
            label="Loan Ready"
            colors={colors}
          />
        </View>

        {/* ── Subscription Card ── */}
        <SectionCard title="Subscription" colors={colors}>
          <View style={s.planRow}>
            <View style={s.planMeta}>
              <View
                style={[
                  s.planIconWrap,
                  { backgroundColor: planColor + "20" },
                ]}
              >
                <Ionicons
                  name={
                    planId === "pro"
                      ? "diamond-outline"
                      : planId === "business"
                      ? "briefcase-outline"
                      : planId === "growth"
                      ? "trending-up-outline"
                      : "gift-outline"
                  }
                  size={18}
                  color={planColor}
                />
              </View>
              <View>
                <Text style={[s.planName, { color: planColor }]}>
                  {plan.name}
                </Text>
                <Text style={s.planPrice}>
                  {plan.priceNaira === 0
                    ? "Free forever"
                    : `${formatNaira(plan.priceNaira)}/month`}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.upgradeBtn, { backgroundColor: planColor }]}
              onPress={() => router.push("/subscribe")}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isOnPaidPlan ? "settings-outline" : "rocket-outline"}
                size={13}
                color="#fff"
              />
              <Text style={s.upgradeBtnText}>
                {isOnPaidPlan ? "Manage" : "Upgrade"}
              </Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Account ── */}
        <SectionCard title="Account" colors={colors}>
          <SettingsRow
            icon="person-outline"
            label="Edit Profile"
            subtitle={user?.businessName || "Name, business & location"}
            showArrow
            onPress={handleEditOpen}
            colors={colors}
          />
          <RowDivider colors={colors} />
          <SettingsRow
            icon="lock-closed-outline"
            label="Change PIN"
            subtitle="Update your 4-digit security PIN"
            showArrow
            onPress={handlePinOpen}
            colors={colors}
          />
          <RowDivider colors={colors} />
          <SettingsRow
            icon="language-outline"
            label="Language"
            subtitle={`${langFlag}  ${langLabel}`}
            showArrow
            onPress={() => setLangVisible(true)}
            colors={colors}
          />
          <RowDivider colors={colors} />
          <SettingsRow
            icon="people-outline"
            label="Customers"
            subtitle="Manage your customer list"
            showArrow
            onPress={() => router.push("/(tabs)/customers" as any)}
            colors={colors}
          />
        </SectionCard>

        {/* ── Notifications ── */}
        <SectionCard title="Notifications" colors={colors}>
          <SettingsRow
            icon="alarm-outline"
            iconBg="#FFF7ED"
            iconColor="#EA580C"
            label="Daily Reminder"
            subtitle="Record your sales every day"
            rightElement={
              <Switch
                value={notifs.dailyReminder}
                onValueChange={(v) => handleNotifToggle("dailyReminder", v)}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={notifs.dailyReminder ? colors.primary : colors.textMuted}
              />
            }
            colors={colors}
          />
          <RowDivider colors={colors} />
          <SettingsRow
            icon="bar-chart-outline"
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="Weekly Report"
            subtitle="Your weekly business summary"
            rightElement={
              <Switch
                value={notifs.weeklyReport}
                onValueChange={(v) => handleNotifToggle("weeklyReport", v)}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={notifs.weeklyReport ? colors.primary : colors.textMuted}
              />
            }
            colors={colors}
          />
          <RowDivider colors={colors} />
          <SettingsRow
            icon="call-outline"
            iconBg="#FFF1F2"
            iconColor="#E11D48"
            label="Credit Reminders"
            subtitle="Alerts for overdue credit"
            rightElement={
              <Switch
                value={notifs.creditReminders}
                onValueChange={(v) => handleNotifToggle("creditReminders", v)}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={notifs.creditReminders ? colors.primary : colors.textMuted}
              />
            }
            colors={colors}
          />
        </SectionCard>

        {/* ── Security ── */}
        <SectionCard title="Security" colors={colors}>
          <SettingsRow
            icon="finger-print-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            label="Auto-login"
            subtitle="Skip PIN when opening the app"
            rightElement={
              <Switch
                value={autoLoginEnabled}
                onValueChange={(v) => setAutoLogin(v)}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={autoLoginEnabled ? colors.primary : colors.textMuted}
              />
            }
            colors={colors}
          />
        </SectionCard>

        {/* ── Referral ── */}
        {user?.referralCode ? (
          <SectionCard title="Refer a Friend" colors={colors}>
            {/* Code + Share row */}
            <View style={s.referralInner}>
              <View style={s.referralLeft}>
                <Text style={s.referralCodeLabel}>Your referral code</Text>
                <Text style={[s.referralCode, { color: planColor }]}>
                  {user.referralCode}
                </Text>
                <Text style={s.referralHint}>
                  Friends enter this code when signing up
                </Text>
              </View>
              <TouchableOpacity
                style={[s.shareBtn, { backgroundColor: planColor }]}
                onPress={handleShareReferral}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={s.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Count + milestone progress */}
            {(() => {
              const count = referralData?.totalReferrals ?? 0;
              const rewardUsed = (user as any)?.hasUsedReferralReward ?? false;
              const rewardExpiry = (user as any)?.referralRewardExpiresAt;
              const MILESTONE = 10;
              const progress = Math.min(count / MILESTONE, 1);
              const remaining = Math.max(MILESTONE - count, 0);

              return (
                <View style={s.referralCountRow}>
                  {/* Current count */}
                  <View style={[s.referralCountPill, { backgroundColor: planColor + "15" }]}>
                    <Ionicons name="people-outline" size={14} color={planColor} />
                    <Text style={[s.referralCountText, { color: planColor }]}>
                      {count} friend{count !== 1 ? "s" : ""} joined using your code
                    </Text>
                  </View>

                  {/* Reward milestone */}
                  {!rewardUsed && (
                    <View style={s.milestoneBox}>
                      <View style={s.milestoneHeader}>
                        <Ionicons name="trophy-outline" size={14} color="#D97706" />
                        <Text style={s.milestoneTitle}>
                          {remaining > 0
                            ? `${remaining} more to unlock free Growth plan!`
                            : "🎉 Growth plan reward unlocked!"}
                        </Text>
                      </View>
                      <View style={s.milestoneBar}>
                        <View style={[s.milestoneFill, { width: `${progress * 100}%` }]} />
                      </View>
                      <Text style={s.milestoneCount}>{count}/{MILESTONE} referrals</Text>
                    </View>
                  )}

                  {/* Reward active banner */}
                  {rewardUsed && rewardExpiry && new Date(rewardExpiry) > new Date() && (
                    <View style={s.rewardActiveBanner}>
                      <Ionicons name="star" size={14} color="#16A34A" />
                      <Text style={s.rewardActiveText}>
                        Free Growth reward active · expires{" "}
                        {new Date(rewardExpiry).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Referral list */}
            {referralData && referralData.referrals.length > 0 && (
              <View style={s.referralList}>
                {referralData.referrals.map((r, i) => (
                  <View key={i} style={s.referralListRow}>
                    <View style={[s.referralAvatar, { backgroundColor: planColor + "20" }]}>
                      <Text style={[s.referralAvatarText, { color: planColor }]}>
                        {r.firstName[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.referralListName}>{r.firstName}</Text>
                      <Text style={s.referralListDate}>
                        Joined {new Date(r.joinedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    {r.plan !== "free" && (
                      <View style={[s.referralPaidBadge, { backgroundColor: "#DCFCE7" }]}>
                        <Text style={s.referralPaidBadgeText}>Paid</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* How it works note */}
            <View style={s.referralNote}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={s.referralNoteText}>
                A friend is only counted after they complete registration with your code.
                Link clicks are never counted.
              </Text>
            </View>
          </SectionCard>
        ) : null}

        {/* ── Export Data ── */}
        <SectionCard title="Data" colors={colors}>
          <SettingsRow
            icon="download-outline"
            label="Export Data"
            subtitle={
              getPlanById(planId).limits.canExport
                ? "Download your business report as PDF"
                : "Available on Business plan"
            }
            showArrow
            onPress={() => router.push("/export" as any)}
            colors={colors}
          />
        </SectionCard>

        {/* ── Legal ── */}
        <SectionCard title="Legal" colors={colors}>
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            subtitle="Read our terms and conditions"
            showArrow
            onPress={() => Linking.openURL("https://ematech81.github.io/owoTrackTerms/")}
            colors={colors}
          />
          <RowDivider colors={colors} />
          <SettingsRow
            icon="mail-outline"
            label="Contact Support"
            subtitle="support@owotrack.com"
            showArrow
            onPress={() => Linking.openURL("mailto:support@owotrack.com")}
            colors={colors}
          />
        </SectionCard>

        {/* ── Logout ── */}
        <SectionCard colors={colors} style={{ marginTop: 20 }}>
          <SettingsRow
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout}
            colors={colors}
            isDestructive
          />
        </SectionCard>

        {IS_DEV && (
          <TouchableOpacity style={s.devBtn} onPress={handleDevReset}>
            <Ionicons name="construct-outline" size={13} color={colors.textMuted} />
            <Text style={s.devText}>Reset App Data (Dev Only)</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 56 }} />
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <SafeAreaView style={[s.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={s.modalCancelBtn}
              onPress={() => setEditVisible(false)}
            >
              <Text style={[s.modalCancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>
              Edit Profile
            </Text>
            <TouchableOpacity
              onPress={handleEditSave}
              disabled={isSaving}
              style={[s.modalSaveBtn, { backgroundColor: colors.primary }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <ModalField label="Full Name *" colors={colors}>
              <TextInput
                style={[
                  s.fieldInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={editForm.name}
                onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
              />
            </ModalField>

            <ModalField label="Business Name" colors={colors}>
              <TextInput
                style={[
                  s.fieldInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                value={editForm.businessName}
                onChangeText={(v) =>
                  setEditForm((f) => ({ ...f, businessName: v }))
                }
                placeholder="e.g. Mama Chioma Store"
                placeholderTextColor={colors.textMuted}
              />
            </ModalField>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <ModalField label="State" colors={colors}>
                  <TextInput
                    style={[
                      s.fieldInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={editForm.locationState}
                    onChangeText={(v) =>
                      setEditForm((f) => ({ ...f, locationState: v }))
                    }
                    placeholder="e.g. Lagos"
                    placeholderTextColor={colors.textMuted}
                  />
                </ModalField>
              </View>
              <View style={{ flex: 1 }}>
                <ModalField label="City / Area" colors={colors}>
                  <TextInput
                    style={[
                      s.fieldInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={editForm.locationCity}
                    onChangeText={(v) =>
                      setEditForm((f) => ({ ...f, locationCity: v }))
                    }
                    placeholder="e.g. Ikeja"
                    placeholderTextColor={colors.textMuted}
                  />
                </ModalField>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Change PIN Modal ── */}
      <Modal
        visible={pinVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPinVisible(false)}
      >
        <SafeAreaView style={[s.modalSafe, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={s.modalCancelBtn}
              onPress={() => setPinVisible(false)}
            >
              <Text style={[s.modalCancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>
              Change PIN
            </Text>
            <TouchableOpacity
              onPress={handlePinSave}
              disabled={pinSaving}
              style={[s.modalSaveBtn, { backgroundColor: colors.primary }]}
            >
              {pinSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.modalBody}>
            {/* PIN hint banner */}
            <View
              style={[
                s.pinHintBanner,
                { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={[s.pinHintText, { color: colors.primary }]}>
                Your PIN must be exactly 4 digits
              </Text>
            </View>

            <ModalField label="Current PIN" colors={colors}>
              <TextInput
                style={[
                  s.fieldInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    letterSpacing: 8,
                    textAlign: "center",
                    fontSize: 20,
                  },
                ]}
                value={pinForm.current}
                onChangeText={(v) =>
                  setPinForm((f) => ({
                    ...f,
                    current: v.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="● ● ● ●"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
              />
            </ModalField>

            <ModalField label="New PIN" colors={colors}>
              <TextInput
                style={[
                  s.fieldInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    letterSpacing: 8,
                    textAlign: "center",
                    fontSize: 20,
                  },
                ]}
                value={pinForm.newPin}
                onChangeText={(v) =>
                  setPinForm((f) => ({
                    ...f,
                    newPin: v.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="● ● ● ●"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
              />
            </ModalField>

            <ModalField label="Confirm New PIN" colors={colors}>
              <TextInput
                style={[
                  s.fieldInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    letterSpacing: 8,
                    textAlign: "center",
                    fontSize: 20,
                  },
                ]}
                value={pinForm.confirm}
                onChangeText={(v) =>
                  setPinForm((f) => ({
                    ...f,
                    confirm: v.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="● ● ● ●"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
              />
            </ModalField>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Language Picker Modal ── */}
      <Modal
        visible={langVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setLangVisible(false)}>
          <Pressable
            style={[s.langBox, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <View style={s.langHeader}>
              <Text style={[s.langTitle, { color: colors.textPrimary }]}>
                Select Language
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Choose your preferred language
              </Text>
            </View>

            {LANGUAGES.map((lang, idx) => {
              const isActive = user?.preferredLanguage === lang.key;
              return (
                <TouchableOpacity
                  key={lang.key}
                  style={[
                    s.langOption,
                    {
                      borderTopColor: colors.border,
                      backgroundColor: isActive
                        ? colors.primary + "08"
                        : "transparent",
                    },
                  ]}
                  onPress={() => handleLangChange(lang.key)}
                  activeOpacity={0.7}
                >
                  <Text style={s.langFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      s.langOptionText,
                      {
                        color: isActive ? colors.primary : colors.textPrimary,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {isActive ? (
                    <View
                      style={[
                        s.langCheckWrap,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  ) : (
                    <View style={{ width: 22 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingBottom: 24 },

    // ── Hero
    heroSection: {
      marginBottom: 4,
      overflow: "hidden",
    },
    heroBg: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 120,
      opacity: 0.12,
    },
    heroContent: {
      alignItems: "center",
      paddingTop: 36,
      paddingBottom: 24,
      paddingHorizontal: 20,
    },
    avatarWrapper: {
      marginBottom: 14,
      position: "relative",
    },
    avatarRing: {
      padding: 3,
      borderRadius: 50,
      borderWidth: 2.5,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
    onlineDot: {
      position: "absolute",
      bottom: 3,
      right: 3,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#22C55E",
      borderWidth: 2.5,
    },
    heroName: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    bizRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: "500",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 12,
    },
    metaText: { fontSize: 12, color: colors.textMuted },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginHorizontal: 2,
    },
    planBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    planDot: { width: 6, height: 6, borderRadius: 3 },
    planBadgeText: { fontSize: 12, fontWeight: "700" },

    // ── Stats
    statsStrip: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 6 },

    // ── Plan row inside subscription card
    planRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    planMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    planIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    planName: { fontSize: 15, fontWeight: "800" },
    planPrice: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    upgradeBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

    // ── Referral
    referralInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    referralLeft: { flex: 1 },
    referralCodeLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
    referralCode: {
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: 4,
      marginBottom: 4,
    },
    referralHint: { fontSize: 11, color: colors.textMuted },
    referralCountRow: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    referralCountPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    referralCountText: { fontSize: 12, fontWeight: "700" },
    referralList: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 10,
    },
    referralListRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    referralAvatar: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: "center", justifyContent: "center",
    },
    referralAvatarText: { fontSize: 14, fontWeight: "800" },
    referralListName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
    referralListDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    referralPaidBadge: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 10,
    },
    referralPaidBadgeText: { fontSize: 10, fontWeight: "700", color: "#16A34A" },
    referralNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: 4,
    },
    referralNoteText: {
      flex: 1,
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16,
    },
    milestoneBox: {
      backgroundColor: "#FFFBEB",
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: "#FDE68A",
      gap: 8,
    },
    milestoneHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    milestoneTitle: { fontSize: 12, fontWeight: "700", color: "#92400E", flex: 1 },
    milestoneBar: {
      height: 6, backgroundColor: "#FDE68A",
      borderRadius: 3, overflow: "hidden",
    },
    milestoneFill: { height: 6, backgroundColor: "#D97706", borderRadius: 3 },
    milestoneCount: { fontSize: 11, color: "#92400E", fontWeight: "600" },
    rewardActiveBanner: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: "#DCFCE7", borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: "#BBF7D0",
    },
    rewardActiveText: { fontSize: 12, fontWeight: "600", color: "#15803D", flex: 1 },
    shareBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
    },
    shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

    // ── Dev
    devBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "center",
      marginTop: 16,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    devText: { color: colors.textMuted, fontSize: 12 },

    // ── Modals shared
    modalSafe: { flex: 1 },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modalTitle: { fontSize: 16, fontWeight: "700" },
    modalCancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
    modalCancelText: { fontSize: 15 },
    modalSaveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      minWidth: 60,
      alignItems: "center",
    },
    modalSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    modalBody: { padding: 20 },

    fieldInput: {
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
    },

    // ── PIN hint
    pinHintBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
    },
    pinHintText: { fontSize: 13, fontWeight: "600", flex: 1 },

    // ── Language picker
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    langBox: {
      width: 300,
      borderRadius: 22,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 18,
    },
    langHeader: {
      alignItems: "center",
      paddingTop: 20,
      paddingBottom: 12,
      paddingHorizontal: 20,
    },
    langTitle: {
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 2,
    },
    langFlag: { fontSize: 20 },
    langOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    langOptionText: { flex: 1, fontSize: 15 },
    langCheckWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
  });