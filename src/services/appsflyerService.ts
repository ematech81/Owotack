import { Platform } from "react-native";
import appsFlyer from "react-native-appsflyer";

export function initAppsFlyer() {
  try {
    appsFlyer.initSdk(
      {
        devKey: "HxWmRE9H3kAnvvKeuwL7kh",
        isDebug: __DEV__,
        // appId is the iOS App Store numeric ID — must be omitted on Android
        // passing any value (even empty string) causes 404 errors on logEvent for Android
        appId: Platform.select({ ios: "", android: undefined }) as string,
        onInstallConversionDataListener: false,
        onDeepLinkListener: false,
        timeToWaitForATTUserAuthorization: 10,
      },
      () => {},
      () => {}
    );
  } catch {
    // Native module unavailable in Expo Go — skip silently
  }
}

// Use Promise-based logEvent (no callbacks). In v6.18.0, the callback variant
// silently drops callbacks on Android because CallbackGuard wraps them in
// WeakReference and GC collects them before the async HTTP response returns.
function logAFEvent(eventName: string, params: Record<string, unknown> = {}) {
  try {
    appsFlyer.logEvent(eventName, params).catch(() => {});
  } catch {
    // Native module unavailable in Expo Go — skip silently
  }
}

export const afEvents = {
  login: () =>
    logAFEvent("af_login", {}),

  completeRegistration: () =>
    logAFEvent("af_complete_registration", { af_registration_method: "phone" }),

  initiatedCheckout: (price: number) =>
    logAFEvent("af_initiated_checkout", { af_currency: "NGN", af_price: price }),

  transferCompleted: (revenue: number, transactionId: string) =>
    logAFEvent("af_transfer_completed", {
      af_revenue: revenue,
      af_currency: "NGN",
      transaction_id: transactionId,
    }),
};
