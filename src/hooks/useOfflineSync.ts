import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { syncService } from "../services/syncService";
import { registerReconnectHandler } from "../services/api";

export function useOfflineSync() {
  const userId = useAuthStore((s) => s.user?._id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setSyncing, setPendingCount } = useUIStore();
  const running = useRef(false);
  const userIdRef = useRef(userId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const run = async () => {
    if (!userIdRef.current || !isAuthenticated || running.current) return;
    running.current = true;
    try {
      const pending = await syncService.getPendingCount();
      setPendingCount(pending);
      if (pending === 0) return;

      setSyncing(true);
      await syncService.syncPending();
      const remaining = await syncService.getPendingCount();
      setPendingCount(remaining);
    } catch {
      // Network down — will retry next foreground
    } finally {
      setSyncing(false);
      running.current = false;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Run once on auth + screen mount
    run();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") run();
    });

    // A sale/expense's initial save-time sync can fail on a brief network blip
    // (common on Nigerian mobile networks) and would otherwise sit "pending" until
    // the user backgrounds and reopens the app. Retry the moment we're back online.
    registerReconnectHandler(() => run());

    return () => sub.remove();
  }, [isAuthenticated]);
}
