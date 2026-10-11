import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useApi } from "./api";
import { notifyNewResults } from "./notifications";
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
 * Fires a local notification and a haptic buzz when new unseen alerts appear.
 * Returns the latest batch so the screen can show an in-app banner.
 */
export function useNewAlertNotifier(alerts: AlertListItem[] | undefined) {
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<{ ids: string[]; at: number } | null>(null);

  useEffect(() => {
    if (!alerts) return;
    if (known.current === null) {
      known.current = new Set(alerts.map((a) => a.id));
      return;
    }
    const added = alerts.filter((a) => !known.current!.has(a.id) && !a.seenAt);
    alerts.forEach((a) => known.current!.add(a.id));
    if (added.length === 0) return;
    setFresh({ ids: added.map((a) => a.id), at: Date.now() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    notifyNewResults(added.length, added[0].id).catch(() => {});
  }, [alerts]);

  return fresh;
}

export type FreshAlerts = { ids: string[]; at: number } | null;
export const FreshAlertsContext = createContext<FreshAlerts>(null);
export const useFreshAlerts = () => useContext(FreshAlertsContext);
