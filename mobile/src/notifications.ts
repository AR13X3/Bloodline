// Local notifications (they work in Expo Go). The text never includes
// patient details; the GP opens the app to see the result.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
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
      await Notifications.setNotificationChannelAsync("alerts", {
        name: "Result alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 220, 120, 220],
        lightColor: "#12A19A",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  })();
  return prepared;
}

export async function notifyNewResults(count: number, alertId: string): Promise<void> {
  if (!(await prepareNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "BloodLine",
      body: count === 1 ? "You have 1 new result to review." : `You have ${count} new results to review.`,
      data: { alertId },
    },
    trigger: Platform.OS === "android" ? { channelId: "alerts" } : null,
  });
}
