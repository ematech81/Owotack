import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { authService } from "../../src/services/authService";
import { Button } from "../../src/components/common/Button";
import { BackButton } from "../../src/components/common/BackButton";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { colors } from "../../src/constants/colors";

const OTP_LENGTH = 6;

export default function OTPScreen() {
  const { phone, isNewUser, devOtp, mode } = useLocalSearchParams<{
    phone: string;
    isNewUser: string;
    devOtp?: string;
    mode?: string;
  }>();
  const [otp, setOtp] = useState(() =>
    devOtp ? devOtp.split("").slice(0, OTP_LENGTH) : Array(OTP_LENGTH).fill("")
  );
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      Alert.alert("Error", "Enter the complete 6-digit OTP");
      return;
    }

    // Forgot-PIN reset flow: skip server verification here — reset-pin screen
    // will call authService.resetPin(phone, otp, newPin) which verifies the OTP.
    if (mode === "reset") {
      router.push({ pathname: "/(auth)/reset-pin", params: { phone, otp: code } });
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyOtp(phone, code);
      if (isNewUser === "1" || result.isNewUser) {
        router.push({ pathname: "/(auth)/profile-setup", params: { phone, tempToken: result.tempToken } });
      } else {
        router.push({ pathname: "/(auth)/login", params: { phone } });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Invalid OTP";
      Alert.alert("Wrong OTP", msg);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await authService.sendOtp(phone);
      setResendCooldown(60);
      setOtp(Array(OTP_LENGTH).fill(""));
      Alert.alert("Sent!", "New OTP don land your phone");
    } catch {
      Alert.alert("Error", "No fit send OTP. Try again.");
    }
  };

  const maskedPhone = phone ? `${phone.slice(0, 6)}****${phone.slice(-3)}` : "";

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <AppStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <BackButton style={styles.backBtn} />
        <View style={styles.header}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We don send 6-digit code go {maskedPhone}
          </Text>
        </View>

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(val) => handleChange(val, index)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <Button title="Verify" onPress={handleVerify} loading={loading} style={styles.btn} />

        <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0} style={styles.resend}>
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
          </Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    paddingTop: 16,
  },
  header: { marginBottom: 48 },
  title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40 },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: "#F0FDF4" },
  btn: {},
  backBtn: { marginBottom: 16 },
  resend: { alignItems: "center", marginTop: 24 },
  resendText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  resendDisabled: { color: colors.textMuted },
});
