import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LogOut, Mail, MessageSquareText, PhoneCall, Plane, Radio, Server, Smartphone, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Button, Card, PressableScale, SectionLabel, T, maskEmail, maskPhone } from "@/components/ui";
import { useSession } from "@/session";
import { colors, fonts, radius } from "@/theme";
import type { ClinicianSettings } from "@/types";

function Row({ icon: Icon, title, detail, value, onChange, disabled }: { icon: LucideIcon; title: string; detail: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, value && !disabled && { backgroundColor: colors.tealSoft }]}>
        <Icon size={17} color={value && !disabled ? colors.tealDeep : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="semibold" size={15}>
          {title}
        </T>
        <T size={12} color={colors.textMuted}>
          {detail}
        </T>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled || !onChange} trackColor={{ true: colors.teal, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { clinicianId, serverUrl, setServerUrl, signOut } = useSession();
  const queryClient = useQueryClient();
  const key = ["settings", serverUrl, clinicianId];
  const settings = useQuery({ queryKey: key, queryFn: () => api.settings(clinicianId!), enabled: Boolean(clinicianId) });
  const [server, setServer] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (patch: Partial<Pick<ClinicianSettings, "notifyEmail" | "notifySms" | "notifyVoice" | "away" | "coveringClinicianId">>) => api.updateSettings(clinicianId!, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<ClinicianSettings>(key);
      if (before) queryClient.setQueryData(key, { ...before, ...patch });
      return { before };
    },
    onError: (e: Error, _p, ctx) => {
      if (ctx?.before) queryClient.setQueryData(key, ctx.before);
      Alert.alert("Couldn't save", e.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const s = settings.data;
  const live = s?.liveMessages ?? false;
  const suffix = (on: boolean) => (on ? (live ? " · live" : " · simulated") : "");

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 18 }}>
      <View style={{ gap: 6 }}>
        <T weight="bold" size={28}>
          Settings
        </T>
      </View>

      <Animated.View entering={FadeInDown.springify().damping(16)}>
        <SectionLabel>How you&apos;re alerted</SectionLabel>
        <Card style={{ gap: 4 }}>
          <Row icon={Smartphone} title="In-app alert" detail="Always on while the app is open" value />
          <Row icon={Mail} title="Email" detail={`${maskEmail(s?.email ?? null)}${suffix(Boolean(s?.notifyEmail))}`} value={Boolean(s?.notifyEmail && s.email)} disabled={!s?.email} onChange={(v) => update.mutate({ notifyEmail: v })} />
          <Row icon={MessageSquareText} title="SMS" detail={`${maskPhone(s?.mobile ?? null)}${suffix(Boolean(s?.notifySms))}`} value={Boolean(s?.notifySms && s.mobile)} disabled={!s?.mobile} onChange={(v) => update.mutate({ notifySms: v })} />
          <Row icon={PhoneCall} title="Phone call" detail={`${maskPhone(s?.mobile ?? null)}${suffix(Boolean(s?.notifyVoice))}`} value={Boolean(s?.notifyVoice && s.mobile)} disabled={!s?.mobile} onChange={(v) => update.mutate({ notifyVoice: v })} />
        </Card>
        <View style={styles.liveNote}>
          <Radio size={14} color={live ? colors.amberText : colors.textMuted} />
          <T size={12} color={live ? colors.amberText : colors.textMuted} style={{ flex: 1 }}>
            {live ? "Live messages are on: real email, SMS and calls are sent." : "Live messages are off on the presenter's console, so email, SMS and calls are simulated."} Messages never include
            patient details.
          </T>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).springify().damping(16)}>
        <SectionLabel>Away</SectionLabel>
        <Card style={{ gap: 10 }}>
          <Row
            icon={Plane}
            title="I'm away"
            detail={s?.away ? `Alerts go to ${s.colleagues.find((c) => c.id === s.coveringClinicianId)?.name ?? "a colleague"}` : "Hand your alerts to a colleague"}
            value={Boolean(s?.away)}
            onChange={(v) => update.mutate({ away: v, coveringClinicianId: v ? (s?.coveringClinicianId ?? s?.colleagues[0]?.id ?? null) : (s?.coveringClinicianId ?? null) })}
          />
          {s?.away ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {s.colleagues.map((c) => {
                const active = s.coveringClinicianId === c.id;
                return (
                  <PressableScale key={c.id} onPress={() => update.mutate({ coveringClinicianId: c.id })} style={[styles.colleague, active && styles.colleagueActive]}>
                    <T weight="medium" size={13} color={active ? colors.white : colors.text}>
                      {c.name}
                      {c.away ? " (away)" : ""}
                    </T>
                  </PressableScale>
                );
              })}
            </View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).springify().damping(16)}>
        <SectionLabel>Server</SectionLabel>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Server size={16} color={colors.textMuted} />
            <T size={13} color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
              {serverUrl}
            </T>
          </View>
          {server !== null ? (
            <>
              <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} placeholder="https://your-tunnel.trycloudflare.com" placeholderTextColor={colors.textFaint} />
              <Button
                label="Save and test"
                onPress={async () => {
                  await setServerUrl(server);
                  setServer(null);
                  queryClient.invalidateQueries();
                }}
              />
            </>
          ) : (
            <Button label="Change server" variant="secondary" onPress={() => setServer(serverUrl)} />
          )}
        </Card>
      </Animated.View>

      <Button
        label="Switch GP"
        variant="danger"
        icon={LogOut}
        onPress={async () => {
          await signOut();
          queryClient.clear();
          router.replace("/sign-in");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.navySoft, alignItems: "center", justifyContent: "center" },
  liveNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10, paddingHorizontal: 4 },
  colleague: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  colleagueActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: colors.text, backgroundColor: colors.background },
});
