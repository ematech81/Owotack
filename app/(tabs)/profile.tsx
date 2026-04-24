// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   ScrollView,
//   Switch,
//   Modal,
//   TextInput,
//   Pressable,
//   ActivityIndicator,
//   Share,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import * as SecureStore from "expo-secure-store";
// import { useRouter } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { useAuthStore } from "../../src/store/authStore";
// import { useTheme } from "../../src/hooks/useTheme";
// import { AppStatusBar } from "../../src/components/common/AppStatusBar";
// import { getPlanById } from "../../src/config/plans";
// import { formatNaira } from "../../src/utils/formatters";
// import { authService } from "../../src/services/authService";
// import api from "../../src/services/api";
// import { ApiResponse, User } from "../../src/types";

// const IS_DEV = process.env.NODE_ENV === "development" || __DEV__;
// const USER_CACHE_KEY = "cached_user";

// const PLAN_COLORS: Record<string, string> = {
//   free: "#64748B",
//   growth: "#16A34A",
//   pro: "#7C3AED",
//   business: "#B45309",
// };

// const LANGUAGES: { key: User["preferredLanguage"]; label: string }[] = [
//   { key: "english", label: "English" },
//   { key: "pidgin", label: "Pidgin" },
//   { key: "yoruba", label: "Yoruba" },
//   { key: "igbo", label: "Igbo" },
//   { key: "hausa", label: "Hausa" },
// ];

// // ─── Settings Row ─────────────────────────────────────────────────────────────

// function SettingsRow({
//   icon,
//   label,
//   subtitle,
//   onPress,
//   showArrow,
//   rightElement,
//   colors,
// }: {
//   icon: string;
//   label: string;
//   subtitle?: string;
//   onPress?: () => void;
//   showArrow?: boolean;
//   rightElement?: React.ReactNode;
//   colors: ReturnType<typeof useTheme>;
// }) {
//   const Wrap: any = onPress ? TouchableOpacity : View;
//   return (
//     <Wrap
//       style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}
//       onPress={onPress}
//       activeOpacity={0.7}
//     >
//       <View style={{
//         width: 36, height: 36, borderRadius: 10,
//         backgroundColor: colors.background,
//         alignItems: "center", justifyContent: "center",
//       }}>
//         <Ionicons name={icon as any} size={18} color={colors.primary} />
//       </View>
//       <View style={{ flex: 1 }}>
//         <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{label}</Text>
//         {subtitle ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{subtitle}</Text> : null}
//       </View>
//       {rightElement}
//       {showArrow ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
//     </Wrap>
//   );
// }

// // ─── Main Screen ──────────────────────────────────────────────────────────────

// export default function ProfileScreen() {
//   const router = useRouter();
//   const colors = useTheme();
//   const { user, logout, setUser, autoLoginEnabled, setAutoLogin } = useAuthStore();

//   const planId = user?.subscription?.plan ?? "free";
//   const plan = getPlanById(planId);
//   const planColor = PLAN_COLORS[planId] ?? colors.primary;
//   const isOnPaidPlan = planId !== "free";
//   const subStatus = user?.subscription?.status;

//   // ── Modal visibility
//   const [editVisible, setEditVisible] = useState(false);
//   const [pinVisible, setPinVisible] = useState(false);
//   const [langVisible, setLangVisible] = useState(false);

//   // ── Edit profile form
//   const [editForm, setEditForm] = useState({
//     name: user?.name ?? "",
//     businessName: user?.businessName ?? "",
//     locationState: user?.location?.state ?? "",
//     locationCity: user?.location?.city ?? "",
//   });
//   const [isSaving, setIsSaving] = useState(false);

//   // ── Change PIN form
//   const [pinForm, setPinForm] = useState({ current: "", newPin: "", confirm: "" });
//   const [pinSaving, setPinSaving] = useState(false);

//   // ── Notification toggles (local state for optimistic UI)
//   const [notifs, setNotifs] = useState({
//     dailyReminder: user?.notifications?.dailyReminder ?? false,
//     weeklyReport: user?.notifications?.weeklyReport ?? false,
//     creditReminders: user?.notifications?.creditReminders ?? false,
//   });

//   const saveToCache = async (u: User) => {
//     await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(u));
//   };

//   const handleEditOpen = () => {
//     setEditForm({
//       name: user?.name ?? "",
//       businessName: user?.businessName ?? "",
//       locationState: user?.location?.state ?? "",
//       locationCity: user?.location?.city ?? "",
//     });
//     setEditVisible(true);
//   };

//   const handleEditSave = async () => {
//     if (!user) return;
//     if (!editForm.name.trim()) {
//       Alert.alert("", "Name is required.");
//       return;
//     }
//     setIsSaving(true);
//     try {
//       const res = await api.patch<ApiResponse<User>>("/users/me", {
//         name: editForm.name.trim(),
//         businessName: editForm.businessName.trim() || undefined,
//         location: {
//           ...user.location,
//           state: editForm.locationState.trim() || undefined,
//           city: editForm.locationCity.trim() || undefined,
//         },
//       });
//       setUser(res.data.data);
//       await saveToCache(res.data.data);
//       setEditVisible(false);
//     } catch {
//       Alert.alert("Error", "Could not update profile. Try again.");
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   const handlePinOpen = () => {
//     setPinForm({ current: "", newPin: "", confirm: "" });
//     setPinVisible(true);
//   };

//   const handlePinSave = async () => {
//     if (!pinForm.current || !pinForm.newPin || !pinForm.confirm) {
//       Alert.alert("", "Fill in all PIN fields.");
//       return;
//     }
//     if (!/^\d{4}$/.test(pinForm.newPin)) {
//       Alert.alert("", "New PIN must be exactly 4 digits.");
//       return;
//     }
//     if (pinForm.newPin !== pinForm.confirm) {
//       Alert.alert("", "New PIN and confirm PIN don't match.");
//       return;
//     }
//     setPinSaving(true);
//     try {
//       await authService.changePin(pinForm.current, pinForm.newPin);
//       await SecureStore.setItemAsync("stored_pin", pinForm.newPin);
//       setPinVisible(false);
//       Alert.alert("✅ Done", "Your PIN has been changed.");
//     } catch {
//       Alert.alert("Error", "Wrong current PIN or network error. Try again.");
//     } finally {
//       setPinSaving(false);
//     }
//   };

//   const handleLangChange = async (lang: User["preferredLanguage"]) => {
//     if (!user) return;
//     setLangVisible(false);
//     try {
//       const res = await api.patch<ApiResponse<User>>("/users/me", { preferredLanguage: lang });
//       setUser(res.data.data);
//       await saveToCache(res.data.data);
//     } catch {
//       Alert.alert("Error", "Could not update language.");
//     }
//   };

//   const handleNotifToggle = async (key: keyof typeof notifs, value: boolean) => {
//     if (!user) return;
//     const prev = { ...notifs };
//     const updated = { ...notifs, [key]: value };
//     setNotifs(updated);
//     try {
//       const res = await api.patch<ApiResponse<User>>("/users/me", {
//         notifications: { ...user.notifications, ...updated },
//       });
//       setUser(res.data.data);
//       await saveToCache(res.data.data);
//     } catch {
//       setNotifs(prev);
//     }
//   };

//   const handleLogout = () => {
//     Alert.alert("Logout", "You sure say you want logout?", [
//       { text: "Cancel", style: "cancel" },
//       { text: "Logout", style: "destructive", onPress: async () => { await logout(); } },
//     ]);
//   };

//   const handleShareReferral = async () => {
//     if (!user?.referralCode) return;
//     try {
//       await Share.share({
//         message: `Join me on OwoTrack — the easiest way to track your business money! 🧾\nUse my referral code: ${user.referralCode}\nDownload the app now.`,
//       });
//     } catch { /* ignore */ }
//   };

//   const handleDevReset = () => {
//     Alert.alert("Reset App Data", "This go clear everything and show onboarding again.", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Reset",
//         style: "destructive",
//         onPress: async () => {
//           await Promise.all([
//             SecureStore.deleteItemAsync("has_onboarded"),
//             SecureStore.deleteItemAsync("has_ever_logged_in"),
//             SecureStore.deleteItemAsync("stored_pin"),
//             SecureStore.deleteItemAsync("cached_user"),
//             SecureStore.deleteItemAsync("accessToken"),
//             SecureStore.deleteItemAsync("refreshToken"),
//           ]);
//           await logout();
//           useAuthStore.setState({ hasOnboarded: false, isAuthenticated: false, pinLocked: false, user: null });
//         },
//       },
//     ]);
//   };

//   const s = makeStyles(colors);

//   const avatarLetters = (user?.name ?? "?")
//     .split(" ")
//     .map((w) => w[0])
//     .join("")
//     .toUpperCase()
//     .slice(0, 2);

//   const langLabel = LANGUAGES.find((l) => l.key === user?.preferredLanguage)?.label ?? "English";

//   return (
//     <SafeAreaView style={s.safe}>
//       <AppStatusBar />

//       <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

//         {/* ── Profile Header ── */}
//         <View style={s.header}>
//           <View style={[s.avatar, { backgroundColor: planColor }]}>
//             <Text style={s.avatarText}>{avatarLetters}</Text>
//           </View>
//           <Text style={s.name}>{user?.name}</Text>
//           <Text style={s.phone}>{user?.phone}</Text>
//           {user?.businessName ? <Text style={s.bizName}>{user.businessName}</Text> : null}
//           <View style={[s.planBadge, { backgroundColor: planColor + "20", borderColor: planColor + "60" }]}>
//             <View style={[s.planDot, { backgroundColor: planColor }]} />
//             <Text style={[s.planBadgeText, { color: planColor }]}>
//               {plan.name} Plan
//               {isOnPaidPlan && subStatus === "active" ? " · Active" : ""}
//               {isOnPaidPlan && subStatus === "cancelled" ? " · Cancelled" : ""}
//               {isOnPaidPlan && subStatus === "expired" ? " · Expired" : ""}
//             </Text>
//           </View>
//         </View>

//         {/* ── Stats Strip ── */}
//         <View style={s.statsStrip}>
//           <View style={s.statCard}>
//             <Text style={s.statIcon}>🔥</Text>
//             <Text style={s.statValue}>{user?.streakDays ?? 0}</Text>
//             <Text style={s.statLabel}>Day Streak</Text>
//           </View>
//           <View style={[s.statDivider, { backgroundColor: colors.border }]} />
//           <View style={s.statCard}>
//             <Text style={s.statIcon}>❤️</Text>
//             <Text style={s.statValue}>{user?.healthScore ?? 0}</Text>
//             <Text style={s.statLabel}>Health Score</Text>
//           </View>
//           <View style={[s.statDivider, { backgroundColor: colors.border }]} />
//           <View style={s.statCard}>
//             <Text style={s.statIcon}>{user?.loanEligible ? "✅" : "⏳"}</Text>
//             <Text style={[s.statValue, { fontSize: 13 }]}>{user?.loanEligible ? "Eligible" : "Not Yet"}</Text>
//             <Text style={s.statLabel}>Loan Ready</Text>
//           </View>
//         </View>

//         {/* ── Subscription ── */}
//         <View style={s.sectionCard}>
//           <Text style={s.sectionLabel}>Subscription</Text>
//           <View style={s.planRow}>
//             <View>
//               <Text style={[s.planName, { color: planColor }]}>{plan.name}</Text>
//               <Text style={s.planPrice}>
//                 {plan.priceNaira === 0 ? "Free forever" : `${formatNaira(plan.priceNaira)}/month`}
//               </Text>
//             </View>
//             <TouchableOpacity
//               style={[s.upgradeBtn, { backgroundColor: planColor }]}
//               onPress={() => router.push("/subscribe")}
//               activeOpacity={0.8}
//             >
//               <Ionicons name={isOnPaidPlan ? "settings-outline" : "rocket-outline"} size={14} color="#fff" />
//               <Text style={s.upgradeBtnText}>{isOnPaidPlan ? "Manage" : "Upgrade Plan"}</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         {/* ── Account ── */}
//         <View style={s.sectionCard}>
//           <Text style={s.sectionLabel}>Account</Text>
//           <SettingsRow
//             icon="person-outline"
//             label="Edit Profile"
//             subtitle={user?.businessName || "Update your name & business info"}
//             showArrow
//             onPress={handleEditOpen}
//             colors={colors}
//           />
//           <View style={[s.rowDivider, { backgroundColor: colors.border }]} />
//           <SettingsRow
//             icon="lock-closed-outline"
//             label="Change PIN"
//             subtitle="Update your 4-digit security PIN"
//             showArrow
//             onPress={handlePinOpen}
//             colors={colors}
//           />
//           <View style={[s.rowDivider, { backgroundColor: colors.border }]} />
//           <SettingsRow
//             icon="language-outline"
//             label="Language"
//             subtitle={langLabel}
//             showArrow
//             onPress={() => setLangVisible(true)}
//             colors={colors}
//           />
//           <View style={[s.rowDivider, { backgroundColor: colors.border }]} />
//           <SettingsRow
//             icon="people-outline"
//             label="Customers"
//             subtitle="Manage your customer list"
//             showArrow
//             onPress={() => router.push("/(tabs)/customers" as any)}
//             colors={colors}
//           />
//         </View>

//         {/* ── Notifications ── */}
//         <View style={s.sectionCard}>
//           <Text style={s.sectionLabel}>Notifications</Text>
//           <SettingsRow
//             icon="alarm-outline"
//             label="Daily Reminder"
//             subtitle="Remind you to record your daily sales"
//             rightElement={
//               <Switch
//                 value={notifs.dailyReminder}
//                 onValueChange={(v) => handleNotifToggle("dailyReminder", v)}
//                 trackColor={{ false: colors.border, true: colors.primary + "80" }}
//                 thumbColor={notifs.dailyReminder ? colors.primary : colors.textMuted}
//               />
//             }
//             colors={colors}
//           />
//           <View style={[s.rowDivider, { backgroundColor: colors.border }]} />
//           <SettingsRow
//             icon="bar-chart-outline"
//             label="Weekly Report"
//             subtitle="Get your weekly business summary"
//             rightElement={
//               <Switch
//                 value={notifs.weeklyReport}
//                 onValueChange={(v) => handleNotifToggle("weeklyReport", v)}
//                 trackColor={{ false: colors.border, true: colors.primary + "80" }}
//                 thumbColor={notifs.weeklyReport ? colors.primary : colors.textMuted}
//               />
//             }
//             colors={colors}
//           />
//           <View style={[s.rowDivider, { backgroundColor: colors.border }]} />
//           <SettingsRow
//             icon="call-outline"
//             label="Credit Reminders"
//             subtitle="Get notified when credit is overdue"
//             rightElement={
//               <Switch
//                 value={notifs.creditReminders}
//                 onValueChange={(v) => handleNotifToggle("creditReminders", v)}
//                 trackColor={{ false: colors.border, true: colors.primary + "80" }}
//                 thumbColor={notifs.creditReminders ? colors.primary : colors.textMuted}
//               />
//             }
//             colors={colors}
//           />
//         </View>

//         {/* ── Security ── */}
//         <View style={s.sectionCard}>
//           <Text style={s.sectionLabel}>Security</Text>
//           <SettingsRow
//             icon="finger-print-outline"
//             label="Auto-login"
//             subtitle="Skip PIN screen when you open the app"
//             rightElement={
//               <Switch
//                 value={autoLoginEnabled}
//                 onValueChange={(v) => setAutoLogin(v)}
//                 trackColor={{ false: colors.border, true: colors.primary + "80" }}
//                 thumbColor={autoLoginEnabled ? colors.primary : colors.textMuted}
//               />
//             }
//             colors={colors}
//           />
//         </View>

//         {/* ── Referral ── */}
//         {user?.referralCode ? (
//           <View style={s.sectionCard}>
//             <Text style={s.sectionLabel}>Refer a Friend</Text>
//             <View style={s.referralRow}>
//               <View>
//                 <Text style={s.referralCodeLabel}>Your referral code</Text>
//                 <Text style={[s.referralCode, { color: colors.primary }]}>{user.referralCode}</Text>
//               </View>
//               <TouchableOpacity
//                 style={[s.shareBtn, { backgroundColor: colors.primary }]}
//                 onPress={handleShareReferral}
//                 activeOpacity={0.8}
//               >
//                 <Ionicons name="share-social-outline" size={16} color="#fff" />
//                 <Text style={s.shareBtnText}>Share</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         ) : null}

//         {/* ── Logout ── */}
//         <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
//           <Ionicons name="log-out-outline" size={18} color={colors.danger} />
//           <Text style={s.logoutText}>Logout</Text>
//         </TouchableOpacity>

//         {IS_DEV && (
//           <TouchableOpacity style={s.devBtn} onPress={handleDevReset}>
//             <Text style={s.devText}>⚙️ Reset App Data (Dev Only)</Text>
//           </TouchableOpacity>
//         )}

//         <View style={{ height: 48 }} />
//       </ScrollView>

//       {/* ── Edit Profile Modal ── */}
//       <Modal
//         visible={editVisible}
//         animationType="slide"
//         presentationStyle="pageSheet"
//         onRequestClose={() => setEditVisible(false)}
//       >
//         <SafeAreaView style={[s.modalSafe, { backgroundColor: colors.background }]}>
//           <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
//             <TouchableOpacity onPress={() => setEditVisible(false)}>
//               <Text style={[s.modalAction, { color: colors.textSecondary }]}>Cancel</Text>
//             </TouchableOpacity>
//             <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
//             <TouchableOpacity onPress={handleEditSave} disabled={isSaving}>
//               {isSaving
//                 ? <ActivityIndicator size="small" color={colors.primary} />
//                 : <Text style={[s.modalAction, { color: colors.primary, fontWeight: "700" }]}>Save</Text>
//               }
//             </TouchableOpacity>
//           </View>
//           <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Full Name *</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={editForm.name}
//               onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
//               placeholder="Your full name"
//               placeholderTextColor={colors.textMuted}
//             />
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Business Name</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={editForm.businessName}
//               onChangeText={(v) => setEditForm((f) => ({ ...f, businessName: v }))}
//               placeholder="e.g. Mama Chioma Store"
//               placeholderTextColor={colors.textMuted}
//             />
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>State</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={editForm.locationState}
//               onChangeText={(v) => setEditForm((f) => ({ ...f, locationState: v }))}
//               placeholder="e.g. Lagos"
//               placeholderTextColor={colors.textMuted}
//             />
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>City / Area</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={editForm.locationCity}
//               onChangeText={(v) => setEditForm((f) => ({ ...f, locationCity: v }))}
//               placeholder="e.g. Ikeja"
//               placeholderTextColor={colors.textMuted}
//             />
//           </ScrollView>
//         </SafeAreaView>
//       </Modal>

//       {/* ── Change PIN Modal ── */}
//       <Modal
//         visible={pinVisible}
//         animationType="slide"
//         presentationStyle="pageSheet"
//         onRequestClose={() => setPinVisible(false)}
//       >
//         <SafeAreaView style={[s.modalSafe, { backgroundColor: colors.background }]}>
//           <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
//             <TouchableOpacity onPress={() => setPinVisible(false)}>
//               <Text style={[s.modalAction, { color: colors.textSecondary }]}>Cancel</Text>
//             </TouchableOpacity>
//             <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Change PIN</Text>
//             <TouchableOpacity onPress={handlePinSave} disabled={pinSaving}>
//               {pinSaving
//                 ? <ActivityIndicator size="small" color={colors.primary} />
//                 : <Text style={[s.modalAction, { color: colors.primary, fontWeight: "700" }]}>Save</Text>
//               }
//             </TouchableOpacity>
//           </View>
//           <View style={s.modalBody}>
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Current PIN</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={pinForm.current}
//               onChangeText={(v) => setPinForm((f) => ({ ...f, current: v.replace(/\D/g, "").slice(0, 4) }))}
//               placeholder="Enter current 4-digit PIN"
//               placeholderTextColor={colors.textMuted}
//               secureTextEntry
//               keyboardType="numeric"
//               maxLength={4}
//             />
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>New PIN</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={pinForm.newPin}
//               onChangeText={(v) => setPinForm((f) => ({ ...f, newPin: v.replace(/\D/g, "").slice(0, 4) }))}
//               placeholder="Enter new 4-digit PIN"
//               placeholderTextColor={colors.textMuted}
//               secureTextEntry
//               keyboardType="numeric"
//               maxLength={4}
//             />
//             <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Confirm New PIN</Text>
//             <TextInput
//               style={[s.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
//               value={pinForm.confirm}
//               onChangeText={(v) => setPinForm((f) => ({ ...f, confirm: v.replace(/\D/g, "").slice(0, 4) }))}
//               placeholder="Re-enter new PIN"
//               placeholderTextColor={colors.textMuted}
//               secureTextEntry
//               keyboardType="numeric"
//               maxLength={4}
//             />
//           </View>
//         </SafeAreaView>
//       </Modal>

//       {/* ── Language Picker Modal ── */}
//       <Modal
//         visible={langVisible}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setLangVisible(false)}
//       >
//         <Pressable style={s.overlay} onPress={() => setLangVisible(false)}>
//           <Pressable style={[s.langBox, { backgroundColor: colors.surface }]} onPress={() => {}}>
//             <Text style={[s.langTitle, { color: colors.textPrimary }]}>Select Language</Text>
//             {LANGUAGES.map((lang, idx) => {
//               const isActive = user?.preferredLanguage === lang.key;
//               return (
//                 <TouchableOpacity
//                   key={lang.key}
//                   style={[
//                     s.langOption,
//                     { borderBottomColor: colors.border },
//                     idx === LANGUAGES.length - 1 && { borderBottomWidth: 0 },
//                   ]}
//                   onPress={() => handleLangChange(lang.key)}
//                   activeOpacity={0.7}
//                 >
//                   <Text style={[
//                     s.langOptionText,
//                     { color: isActive ? colors.primary : colors.textPrimary },
//                     isActive && { fontWeight: "700" },
//                   ]}>
//                     {lang.label}
//                   </Text>
//                   {isActive ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
//                 </TouchableOpacity>
//               );
//             })}
//           </Pressable>
//         </Pressable>
//       </Modal>

//     </SafeAreaView>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────

// const makeStyles = (colors: ReturnType<typeof useTheme>) =>
//   StyleSheet.create({
//     safe: { flex: 1, backgroundColor: colors.background },
//     scroll: { paddingBottom: 24 },

//     // ── Header
//     header: {
//       alignItems: "center",
//       paddingTop: 32,
//       paddingBottom: 24,
//       paddingHorizontal: 20,
//       backgroundColor: colors.surface,
//       borderBottomWidth: 1,
//       borderBottomColor: colors.border,
//     },
//     avatar: {
//       width: 84, height: 84, borderRadius: 42,
//       alignItems: "center", justifyContent: "center",
//       marginBottom: 14,
//       shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
//       shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
//     },
//     avatarText: { color: "#fff", fontSize: 30, fontWeight: "800" },
//     name: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
//     phone: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
//     bizName: { fontSize: 13, color: colors.textMuted, marginBottom: 6 },
//     planBadge: {
//       flexDirection: "row", alignItems: "center", gap: 6,
//       paddingHorizontal: 14, paddingVertical: 5,
//       borderRadius: 20, borderWidth: 1, marginTop: 10,
//     },
//     planDot: { width: 7, height: 7, borderRadius: 4 },
//     planBadgeText: { fontSize: 12, fontWeight: "700" },

//     // ── Stats strip
//     statsStrip: {
//       flexDirection: "row",
//       marginHorizontal: 16,
//       marginTop: 16,
//       marginBottom: 4,
//       backgroundColor: colors.surface,
//       borderRadius: 16,
//       padding: 16,
//       shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
//       shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
//     },
//     statCard: { flex: 1, alignItems: "center", gap: 3 },
//     statIcon: { fontSize: 20 },
//     statValue: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
//     statLabel: { fontSize: 11, color: colors.textMuted },
//     statDivider: { width: 1, marginVertical: 4 },

//     // ── Section card
//     sectionCard: {
//       backgroundColor: colors.surface,
//       marginHorizontal: 16,
//       marginTop: 12,
//       borderRadius: 16,
//       overflow: "hidden",
//       shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
//       shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
//     },
//     sectionLabel: {
//       fontSize: 11, fontWeight: "700", color: colors.textMuted,
//       textTransform: "uppercase", letterSpacing: 0.8,
//       paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
//     },

//     // ── Plan row
//     planRow: {
//       flexDirection: "row", alignItems: "center", justifyContent: "space-between",
//       paddingHorizontal: 16, paddingVertical: 12,
//     },
//     planName: { fontSize: 16, fontWeight: "800" },
//     planPrice: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
//     upgradeBtn: {
//       flexDirection: "row", alignItems: "center", gap: 6,
//       paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
//     },
//     upgradeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

//     // ── Row divider
//     rowDivider: { height: 1, marginLeft: 64 },

//     // ── Referral
//     referralRow: {
//       flexDirection: "row", alignItems: "center", justifyContent: "space-between",
//       paddingHorizontal: 16, paddingVertical: 14,
//     },
//     referralCodeLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 3 },
//     referralCode: { fontSize: 22, fontWeight: "800", letterSpacing: 3 },
//     shareBtn: {
//       flexDirection: "row", alignItems: "center", gap: 6,
//       paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
//     },
//     shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

//     // ── Logout
//     logoutBtn: {
//       flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
//       marginHorizontal: 16, marginTop: 20,
//       borderWidth: 1.5, borderColor: colors.danger,
//       borderRadius: 14, paddingVertical: 14,
//     },
//     logoutText: { color: colors.danger, fontWeight: "700", fontSize: 15 },

//     // ── Dev
//     devBtn: { alignSelf: "center", marginTop: 16, padding: 8 },
//     devText: { color: colors.textMuted, fontSize: 12 },

//     // ── Modals shared
//     modalSafe: { flex: 1 },
//     modalHeader: {
//       flexDirection: "row", alignItems: "center", justifyContent: "space-between",
//       paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
//     },
//     modalTitle: { fontSize: 16, fontWeight: "700" },
//     modalAction: { fontSize: 15 },
//     modalBody: { padding: 20 },
//     fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 16 },
//     fieldInput: {
//       borderWidth: 1, borderRadius: 10,
//       paddingHorizontal: 14, paddingVertical: 12,
//       fontSize: 15,
//     },

//     // ── Language picker
//     overlay: {
//       flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
//       justifyContent: "center", alignItems: "center",
//     },
//     langBox: {
//       width: 280, borderRadius: 20, overflow: "hidden",
//       shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
//       shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
//     },
//     langTitle: {
//       fontSize: 13, fontWeight: "700", textAlign: "center",
//       paddingTop: 18, paddingBottom: 8,
//       textTransform: "uppercase", letterSpacing: 0.6,
//     },
//     langOption: {
//       flexDirection: "row", alignItems: "center", justifyContent: "space-between",
//       paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
//     },
//     langOptionText: { fontSize: 15 },
//   });


import React, { useState } from "react";
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
  { key: "english", label: "English", flag: "🇬🇧" },
  { key: "pidgin", label: "Pidgin", flag: "🇳🇬" },
  { key: "yoruba", label: "Yoruba", flag: "🇳🇬" },
  { key: "igbo", label: "Igbo", flag: "🇳🇬" },
  { key: "hausa", label: "Hausa", flag: "🇳🇬" },
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
  const { user, logout, setUser, autoLoginEnabled, setAutoLogin } = useAuthStore();

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
    try {
      await Share.share({
        message: `Join me on OwoTrack — the easiest way to track your business money! 🧾\nUse my referral code: ${user.referralCode}\nDownload the app now.`,
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
          onPress: async () => {
            await Promise.all([
              SecureStore.deleteItemAsync("has_onboarded"),
              SecureStore.deleteItemAsync("has_ever_logged_in"),
              SecureStore.deleteItemAsync("stored_pin"),
              SecureStore.deleteItemAsync("cached_user"),
              SecureStore.deleteItemAsync("accessToken"),
              SecureStore.deleteItemAsync("refreshToken"),
            ]);
            await logout();
            useAuthStore.setState({
              hasOnboarded: false,
              isAuthenticated: false,
              pinLocked: false,
              user: null,
            });
          },
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
            <View style={s.referralInner}>
              <View style={s.referralLeft}>
                <Text style={s.referralCodeLabel}>Your referral code</Text>
                <Text style={[s.referralCode, { color: planColor }]}>
                  {user.referralCode}
                </Text>
                <Text style={s.referralHint}>
                  Share & earn rewards when friends join
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
          </SectionCard>
        ) : null}

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