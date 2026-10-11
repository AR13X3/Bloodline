// Local notifications (they work in Expo Go). The text never includes
// patient details; the GP opens the app to see the result.
//
// Imported from expo-notifications' individual modules on purpose: the
// package's main entry registers a push-token listener on import, which
// throws inside Expo Go on Android (remote push isn't supported there).
// The local-notification modules below don't touch push at all.
import type { EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import { addNotificationResponseReceivedListener } from "expo-notifications/build/NotificationsEmitter";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
import { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let prepared: Promise<boolean> | null = null;

export function prepareNotifications(): Promise<boolean> {
  prepared ??= (async () => {
    if (Platform.OS === "android") {
      // Android 13+ only shows the permission prompt once a channel exists.
      await setNotificationChannelAsync("alerts", {
        name: "Result alerts",
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 220, 120, 220],
        lightColor: "#12A19A",
      });
    }
    const current = await getPermissionsAsync();
    if (current.granted) return true;
    const asked = await requestPermissionsAsync();
    return asked.granted;
  })().catch(() => {
    prepared = null;
    return false;
  });
  return prepared;
}

export async function notifyNewResults(count: number, alertId: string): Promise<void> {
  if (!(await prepareNotifications())) return;
  await scheduleNotificationAsync({
    content: {
      title: "BloodLine",
      body: count === 1 ? "You have 1 new result to review." : `You have ${count} new results to review.`,
      data: { alertId },
    },
    trigger: Platform.OS === "android" ? { channelId: "alerts" } : null,
  });
}

/** A repeat the GP asked for: these results are still unseen. */
export async function notifyRepeat(count: number, alertId: string): Promise<void> {
  if (!(await prepareNotifications())) return;
  await scheduleNotificationAsync({
    content: {
      title: "BloodLine reminder",
      body: count === 1 ? "You still have 1 result to review." : `You still have ${count} results to review.`,
      data: { alertId },
    },
    trigger: Platform.OS === "android" ? { channelId: "alerts" } : null,
  });
}

/** Calls back with the alert id when the GP taps one of our notifications. */
export function onNotificationTap(callback: (alertId: string) => void): EventSubscription {
  return addNotificationResponseReceivedListener((response) => {
    const alertId = response.notification.request.content.data?.alertId;
    if (typeof alertId === "string") callback(alertId);
  });
}
