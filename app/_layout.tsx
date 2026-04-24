import "react-native-get-random-values";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import { initDatabase } from "../src/database/schema";
import { AppStatusBar } from "../src/components/common/AppStatusBar";
import { lightColors, darkColors } from "../src/constants/colors";
import { registerAuthFailHandler } from "../src/services/api";
import { notificationService } from "../src/services/notificationService";
import { useOfflineSync } from "../src/hooks/useOfflineSync";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isInitialized, isAuthenticated, hasOnboarded, hasEverLoggedIn, pinLocked, lastPhone } = useAuthStore();
  const segments = useSegments();
  // Stable string so the routing effect re-fires on any screen change
  const segmentPath = segments.slice(0, 2).join("/");
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;

  useOfflineSync();

  useEffect(() => {
    // When both access + refresh tokens expire, force re-auth from anywhere in the app
    registerAuthFailHandler(() => {
      useAuthStore.getState().logout();
    });
    Promise.all([initDatabase(), initialize()]).finally(() => SplashScreen.hideAsync());
  }, []);

  // Register for push notifications once authenticated
  useEffect(() => {
    if (isAuthenticated) notificationService.register();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isInitialized) return;

    const inTabs = segments[0] === "(tabs)";
    const inAuth = segments[0] === "(auth)";
    const currentScreen = segments[1] as string | undefined;

    if (pinLocked) {
      if (currentScreen !== "unlock") router.replace("/(auth)/unlock");
      return;
    }

    if (isAuthenticated) {
      const allowedOutsideTabs = ["subscribe", "subscription"];
      if (!inTabs && !allowedOutsideTabs.includes(segments[0] as string)) router.replace("/(tabs)");
      return;
    }

    // ── Not authenticated, not pin-locked ────────────────────────────────────

    if (hasEverLoggedIn) {
      // Returning user who logged out — send to login, skipping phone entry if we know their number.
      // Also allow the forgot-PIN sub-flow screens.
      const allowedScreens = ["login", "forgot-pin", "otp", "reset-pin"];
      if (!inAuth || !allowedScreens.includes(currentScreen ?? "")) {
        if (lastPhone) {
          // Start login at PIN step directly — user doesn't need to re-enter phone
          router.replace({ pathname: "/(auth)/login", params: { phone: lastPhone } });
        } else {
          router.replace("/(auth)/login");
        }
      }
      return;
    }

    // First-time user (hasEverLoggedIn = false)
    if (!hasOnboarded) {
      // Has not seen onboarding yet — send there unless already on it
      if (!inAuth || currentScreen === "login" || currentScreen === "unlock") {
        router.replace("/(auth)/onboarding");
      }
      // If inAuth and currentScreen is onboarding/phone/otp/etc → let them flow through
    }
    // hasOnboarded = true but hasEverLoggedIn = false → mid-registration, no redirect
  }, [isInitialized, isAuthenticated, hasOnboarded, hasEverLoggedIn, pinLocked, lastPhone, segmentPath]);

  if (!isInitialized) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AppStatusBar />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="subscribe" />
          <Stack.Screen name="subscription/verify" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
