import { Stack } from "expo-router";
import { colors } from "../../src/constants/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="set-pin" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-pin" />
      <Stack.Screen name="reset-pin" />
      <Stack.Screen name="unlock" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
