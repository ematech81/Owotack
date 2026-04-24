import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { Button } from "../../src/components/common/Button";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { PinInput } from "../../src/components/common/PinInput";
import { useTheme } from "../../src/hooks/useTheme";

export default function UnlockScreen() {
  const colors = useTheme();
  const { user, unlockWithPin, autoLoginEnabled, setAutoLogin } = useAuthStore();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (pin.length < 4) {
      Alert.alert("", "Enter your 4-digit PIN");
      return;
    }

    setLoading(true);
    try {
      const success = await unlockWithPin(pin);
      if (!success) {
        router.replace("/(auth)/login");
      }
      // On success, _layout.tsx routes to /(tabs) automatically
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setPin("");
    }
  };

  const styles = makeStyles(colors);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const initials = (user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.name}>{firstName}!</Text>
          <Text style={styles.subtitle}>Enter your PIN to continue</Text>

          {/* Auto Login toggle — above PIN so keyboard never hides it */}
          <View style={styles.autoLoginRow}>
            <View>
              <Text style={styles.autoLoginLabel}>Allow Auto Login</Text>
              <Text style={styles.autoLoginSub}>Skip PIN on next launch</Text>
            </View>
            <Switch
              value={autoLoginEnabled}
              onValueChange={setAutoLogin}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.pinWrap}>
            <PinInput length={4} value={pin} onChange={setPin} autoFocus />
          </View>

          <Button title="Unlock" onPress={handleUnlock} loading={loading} style={styles.btn} />

          <TouchableOpacity onPress={() => router.push("/(auth)/forgot-pin")} style={styles.link}>
            <Text style={styles.linkText}>Forgot PIN?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.textMuted }]}>
              Login with a different account
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: {
      alignItems: "center", paddingHorizontal: 32,
      paddingTop: 60, paddingBottom: 40,
    },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      marginBottom: 20,
    },
    avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
    welcome: { fontSize: 16, color: colors.textSecondary, marginBottom: 4 },
    name: { fontSize: 28, fontWeight: "700", color: colors.primary, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
    autoLoginRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", backgroundColor: colors.surface,
      borderRadius: 12, padding: 16, marginBottom: 28,
      borderWidth: 1, borderColor: colors.border,
    },
    autoLoginLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    autoLoginSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    pinWrap: { marginBottom: 32, width: "100%" },
    btn: { width: "100%" },
    link: { marginTop: 16 },
    linkText: { color: colors.primary, fontSize: 14, textDecorationLine: "underline" },
  });
