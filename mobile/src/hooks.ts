import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useApi } from "./api";
import { notifyNewResults, notifyRepeat } from "./notifications";
import { useSession } from "./session";
import type { AlertListItem } from "./types";

/** The signed-in GP's alerts, checked every few seconds while the app is open. */
export function useAlerts() {
  const { clinicianId, serverUrl } = useSession();
  const api = useApi();
  return useQuery({
    queryKey: ["alerts", serverUrl, clinicianId],
    queryFn: () => api.alerts(clinicianId!),
    enabled: Boolean(clinicianId),
    refetchInterval: 4_000,
  });
}

/**
 * Fires a local notification and a haptic buzz when new unseen alerts appear,
 * or when the server sends a repeat about alerts still unseen.
 * Returns the latest batch so the screen can show an in-app banner.
 */
export function useNewAlertNotifier(alerts: AlertListItem[] | undefined) {
  // Alert id → the last repeat we've already told the GP about.
  const known = useRef<Map<string, string | null> | null>(null);
  const [fresh, setFresh] = useState<FreshAlerts>(null);

  useEffect(() => {
    if (!alerts) return;
    if (known.current === null) {
      known.current = new Map(alerts.map((a) => [a.id, a.lastRepeatAt]));
      return;
    }
    const seenBefore = known.current;
    const added = alerts.filter((a) => !seenBefore.has(a.id) && !a.seenAt);
    const repeated = alerts.filter((a) => seenBefore.has(a.id) && !a.seenAt && a.lastRepeatAt && seenBefore.get(a.id) !== a.lastRepeatAt);
    alerts.forEach((a) => seenBefore.set(a.id, a.lastRepeatAt));

    if (added.length > 0) {
      setFresh({ ids: added.map((a) => a.id), at: Date.now(), repeat: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      notifyNewResults(added.length, added[0].id).catch(() => {});
    } else if (repeated.length > 0) {
      setFresh({ ids: repeated.map((a) => a.id), at: Date.now(), repeat: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      notifyRepeat(repeated.length, repeated[0].id).catch(() => {});
    }
  }, [alerts]);

  return fresh;
}

export type FreshAlerts = { ids: string[]; at: number; repeat: boolean } | null;
export const FreshAlertsContext = createContext<FreshAlerts>(null);
export const useFreshAlerts = () => useContext(FreshAlertsContext);
