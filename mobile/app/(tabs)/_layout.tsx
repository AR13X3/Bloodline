import * as Notifications from "expo-notifications";
import { Redirect, router, Tabs } from "expo-router";
import { Bell, Settings, Users } from "lucide-react-native";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FreshAlertsContext, useAlerts, useNewAlertNotifier } from "@/hooks";
import { prepareNotifications } from "@/notifications";
import { useSession } from "@/session";
import { colors, fonts } from "@/theme";

export default function TabsLayout() {
  const { ready, clinicianId } = useSession();
  const insets = useSafeAreaInsets();
  const alerts = useAlerts();
  const unseen = alerts.data?.filter((a) => !a.seenAt).length ?? 0;
  const fresh = useNewAlertNotifier(alerts.data);

  useEffect(() => {
    if (!clinicianId) return;
    prepareNotifications().catch(() => {});
    // Tapping a notification opens the alert it was about.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const alertId = response.notification.request.content.data?.alertId;
      if (typeof alertId === "string") router.push({ pathname: "/alert/[id]", params: { id: alertId } });
    });
    return () => sub.remove();
  }, [clinicianId]);

  if (!ready) return null;
  if (!clinicianId) return <Redirect href="/sign-in" />;

  return (
    <FreshAlertsContext.Provider value={fresh}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white, height: 70 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
        tabBarBadgeStyle: { backgroundColor: colors.amber, color: colors.navy, fontFamily: fonts.bold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Alerts", tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />, tabBarBadge: unseen > 0 ? unseen : undefined }}
      />
      <Tabs.Screen name="patients" options={{ title: "Patients", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
    </FreshAlertsContext.Provider>
  );
}
