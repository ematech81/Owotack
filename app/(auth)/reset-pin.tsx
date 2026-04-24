import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Button } from "../../src/components/common/Button";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { PinInput } from "../../src/components/common/PinInput";
import { BackButton } from "../../src/components/common/BackButton";
import { useAuthStore } from "../../src/store/authStore";
import { authService } from "../../src/services/authService";
import { useTheme } from "../../src/hooks/useTheme";

const PIN_LENGTH = 4;

export default function ResetPinScreen() {
  const colors = useTheme();
  const { phone, otp } = useLocalSearchParams<{ phone: string; otp: string }>();
  const { login, isLoading } = useAuthStore();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = async () => {
    if (step === "create") {
      if (pin.length < PIN_LENGTH) {
        Alert.alert("", "Enter a 4-digit PIN");
        return;
      }
      setStep("confirm");
      setConfirmPin("");
      return;
    }

    if (confirmPin.length < PIN_LENGTH) {
      Alert.alert("", "Confirm your PIN");
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert("PIN no match", "The two PINs no be the same. Try again.");
      setConfirmPin("");
      return;
    }

    setIsSaving(true);
    try {
      // Reset the PIN on the server (verifies the OTP + sets the new PIN)
      await authService.resetPin(phone, otp, pin);
      // Auto-login with the new PIN so the user lands on Home
      await login(phone, pin);
      // _layout.tsx handles navigation to /(tabs) when isAuthenticated becomes true
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Reset failed";
      Alert.alert("Error", msg);
      setPin("");
      setConfirmPin("");
      setStep("create");
    } finally {
      setIsSaving(false);
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
            <Text style={styles.title}>
              {step === "create" ? "Set New PIN" : "Confirm New PIN"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "create"
                ? "Choose a new 4-digit PIN for your account"
                : "Enter the same PIN again to confirm"}
            </Text>
          </View>

          <View style={styles.pinWrap}>
            <PinInput
              length={PIN_LENGTH}
              value={step === "create" ? pin : confirmPin}
              onChange={step === "create" ? setPin : setConfirmPin}
              autoFocus
            />
          </View>

          <Text style={styles.tip}>
            {step === "create"
              ? "Choose something you fit remember easily."
              : "Make sure this matches the PIN you just entered."}
          </Text>

          <Button
            title={step === "create" ? "Continue" : "Set New PIN"}
            onPress={handleNext}
            loading={isSaving || isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: 24, paddingTop: 16 },
    header: { marginBottom: 48 },
    title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    pinWrap: { marginBottom: 32 },
    tip: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 32, lineHeight: 20 },
  });
