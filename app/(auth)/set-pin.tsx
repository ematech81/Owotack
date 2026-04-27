import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Button } from "../../src/components/common/Button";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { PinInput } from "../../src/components/common/PinInput";
import { useAuthStore } from "../../src/store/authStore";
import { useTheme } from "../../src/hooks/useTheme";

const PIN_LENGTH = 4;

export default function SetPinScreen() {
  const colors = useTheme();
  const params = useLocalSearchParams<{
    phone: string; tempToken: string; name: string; businessName: string;
    businessType: string; state: string; preferredLanguage: string; referralCode: string;
  }>();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"create" | "confirm">("create");
  const { register, isLoading } = useAuthStore();

  const handleNext = async () => {
    if (step === "create") {
      if (pin.length < PIN_LENGTH) {
        Alert.alert("", "Enter your 4-digit PIN");
        return;
      }
      setStep("confirm");
      setConfirmPin("");
      return;
    }

    if (confirmPin.length < PIN_LENGTH) {
      Alert.alert("", "Confirm your 4-digit PIN");
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert("PIN no match", "The two PINs no be the same. Try again.");
      setConfirmPin("");
      return;
    }

    try {
      await register({
        tempToken: params.tempToken,
        name: params.name,
        phone: params.phone,
        businessName: params.businessName || undefined,
        businessType: params.businessType || undefined,
        location: params.state ? { state: params.state } : undefined,
        preferredLanguage: params.preferredLanguage as "pidgin" | "english",
        pin,
        referralCode: params.referralCode || undefined,
      });
      // _layout.tsx handles navigation to /(tabs) when isAuthenticated becomes true
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Registration failed";
      Alert.alert("Error", msg);
    }
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === "create" ? "Create Your PIN" : "Confirm Your PIN"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "create"
                ? "This 4-digit PIN go protect your account"
                : "Enter your PIN one more time to confirm"}
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
              ? "Choose a PIN you fit remember easily. No use your birthday."
              : "Make sure you remember this PIN — you go need am every time."}
          </Text>

          {step === "confirm" && (
            <Text style={styles.termsText}>
              By creating an account, you agree to our{" "}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL("https://ematech81.github.io/owoTrackTerms/ ")}
              >
                Terms of Service.
              </Text>

            </Text>
          )}

          <Button
            title={step === "create" ? "Continue" : "Create Account"}
            onPress={handleNext}
            loading={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: 24, paddingTop: 40 },
    header: { marginBottom: 48 },
    title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    pinWrap: { marginBottom: 32 },
    tip: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginBottom: 32, lineHeight: 20 },
    termsText: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: 16, lineHeight: 18 },
    termsLink: { color: colors.primary, fontWeight: "600", textDecorationLine: "underline" },
  });
