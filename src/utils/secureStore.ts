import * as SecureStore from "expo-secure-store";

// On some Android phones (especially with aggressive battery management), the
// Android Keystore service can hang indefinitely, causing SecureStore calls to
// never resolve. This wrapper ensures every read completes within the timeout —
// used anywhere a hung read would otherwise freeze a screen or a request forever
// (authStore's init/unlock flow, and every outgoing API call's token read).
export const secureRead = (key: string, timeoutMs = 3000): Promise<string | null> =>
  Promise.race([
    SecureStore.getItemAsync(key),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
