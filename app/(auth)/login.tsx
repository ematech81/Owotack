import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { Button } from "../../src/components/common/Button";
import { BackButton } from "../../src/components/common/BackButton";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { PinInput } from "../../src/components/common/PinInput";
import { useTheme } from "../../src/hooks/useTheme";

export default function LoginScreen() {
  const colors = useTheme();
  const { phone: prefillPhone } = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(prefillPhone || "");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"phone" | "pin">(prefillPhone ? "pin" : "phone");
  const { login, isLoading } = useAuthStore();

  useEffect(() => {
    if (prefillPhone) return;
    SecureStore.getItemAsync("last_phone").then((saved) => {
      if (saved) setPhone(saved);
    });
  }, []);

  const handleDevReset = () => {
    Alert.alert("Reset App Data", "Clear all data and restart from onboarding?", [
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
          useAuthStore.setState({
            hasOnboarded: false,
            isAuthenticated: false,
            pinLocked: false,
            user: null,
          });
        },
      },
    ]);
  };

  const handleContinue = async () => {
    if (step === "phone") {
      if (!phone.match(/^(\+234|0)[789][01]\d{8}$/)) {
        Alert.alert("", "Enter a valid Nigerian phone number");
        return;
      }
      const normalized = phone.startsWith("0") ? `+234${phone.slice(1)}` : phone;
      setPhone(normalized);
      setStep("pin");
      return;
    }

    if (pin.length < 4) {
      Alert.alert("", "Enter your 4-digit PIN");
      return;
    }

    try {
      await login(phone, pin);
      // _layout.tsx handles navigation to /(tabs) when isAuthenticated becomes true
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Login failed";
      Alert.alert("Login Failed", msg);
      setPin("");
    }
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <BackButton style={{ marginBottom: 16 }} />

          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              {step === "phone" ? "Enter your phone number" : "Enter your PIN to login"}
            </Text>
          </View>

          {step === "phone" ? (
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="0801 234 5678"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={14}
              autoFocus
            />
          ) : (
            <View style={styles.pinWrap}>
              <PinInput length={4} value={pin} onChange={setPin} autoFocus />
            </View>
          )}

          {step === "pin" && (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-pin")}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot your PIN?</Text>
            </TouchableOpacity>
          )}

          <Button
            title={step === "phone" ? "Continue" : "Login"}
            onPress={handleContinue}
            loading={isLoading}
            style={styles.btn}
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/phone")}
            style={styles.newUser}
          >
            <Text style={styles.newUserText}>No get account? Register here</Text>
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity style={styles.devBtn} onPress={handleDevReset}>
              <Text style={styles.devText}>🛠 Reset App Data</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: 24, paddingTop: 16 },
    header: { marginBottom: 40 },
    title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: colors.textSecondary },
    phoneInput: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, height: 52, paddingHorizontal: 16, fontSize: 18,
      color: colors.textPrimary, marginBottom: 24,
    },
    pinWrap: { marginBottom: 16 },
    forgot: { alignItems: "center", marginBottom: 32 },
    forgotText: { color: colors.primary, fontSize: 14 },
    btn: {},
    newUser: { alignItems: "center", marginTop: 20 },
    newUserText: { color: colors.textSecondary, fontSize: 14 },
    devBtn: { alignItems: "center", marginTop: 32, padding: 8 },
    devText: { color: colors.textMuted, fontSize: 11 },
  });
