import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscriptionStore } from "../../src/store/subscriptionStore";
import { colors } from "../../src/constants/colors";

type VerifyStatus = "verifying" | "success" | "error";

export default function SubscriptionVerifyScreen() {
  // Paystack appends ?reference=xxx&trxref=xxx to the callback URL
  const { reference, trxref } = useLocalSearchParams<{ reference?: string; trxref?: string }>();
  const ref = (reference || trxref) as string | undefined;

  const { verifyPayment, setPendingReference } = useSubscriptionStore();
  const [status, setStatus] = useState<VerifyStatus>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, useNativeDriver: true })
    ).start();
  }, []);

  useEffect(() => {
    if (!ref) {
      setStatus("error");
      setErrorMsg("No payment reference found. Please return to the app and tap 'Confirm Payment'.");
      return;
    }

    // Store so the subscribe screen shows the verify card as fallback
    setPendingReference(ref);

    const doVerify = async () => {
      try {
        await verifyPayment(ref);
        setStatus("success");
        // Give user a moment to see the success state, then go home
        setTimeout(() => router.replace("/(tabs)/"), 2200);
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(
          err?.message?.includes("not successful")
            ? "Payment was not completed. Please try again."
            : "We couldn't confirm your payment. Go back and tap 'Confirm Payment' on the subscription screen."
        );
      }
    };

    doVerify();
  }, [ref]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        {status === "verifying" && (
          <>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <LinearGradient colors={[colors.primary, colors.primary + "88"]} style={s.iconCircle}>
                <Ionicons name="sync-outline" size={32} color="#fff" />
              </LinearGradient>
            </Animated.View>
            <Text style={s.title}>Verifying Payment</Text>
            <Text style={s.sub}>Please wait while we confirm your subscription...</Text>
          </>
        )}

        {status === "success" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
            </View>
            <Text style={[s.title, { color: "#16A34A" }]}>Payment Confirmed!</Text>
            <Text style={s.sub}>
              Your plan has been upgraded successfully.{"\n"}Taking you back to the app...
            </Text>
          </>
        )}

        {status === "error" && (
          <>
            <View style={[s.iconCircle, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
            </View>
            <Text style={[s.title, { color: "#DC2626" }]}>Verification Failed</Text>
            <Text style={s.sub}>{errorMsg}</Text>

            <View style={s.btnRow}>
              <Text style={s.retryBtn} onPress={() => router.replace("/subscribe")}>
                Go to Subscription Screen
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontSize: 22, fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  sub: {
    fontSize: 14, color: colors.textSecondary,
    textAlign: "center", lineHeight: 22,
    maxWidth: 280,
  },
  btnRow: { marginTop: 8 },
  retryBtn: {
    fontSize: 15, fontWeight: "700",
    color: colors.primary,
    paddingVertical: 10,
  },
});
