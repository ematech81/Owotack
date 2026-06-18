import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import api from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

// Android 8+ requires a notification channel. This must be created before any
// notification can appear. The channel name shows in Android Settings → App notifications.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "OwoTrack",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1A6B3C",
    sound: "default",
    showBadge: true,
  });
}

export const notificationService = {
  async register(): Promise<void> {
    if (Platform.OS === "web") return;

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      const { status } = existing === "granted"
        ? { status: existing }
        : await Notifications.requestPermissionsAsync();

      if (status !== "granted") return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

      const tokenData = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      await api.post("/users/me/push-token", { pushToken: tokenData.data });
    } catch {
      // Best-effort — never crash the app over push token failure
    }
  },

  // Schedule an immediate local notification (works offline)
  async notify(title: string, body: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch { /* silently ignore */ }
  },
};
