import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LogOut, Mail, MessageSquareText, PhoneCall, Plane, Plus, Radio, Repeat, Server, Smartphone, X, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi, type SettingsPatch } from "@/api";
import { Button, Card, PressableScale, SectionLabel, STROKE, T, Title, maskEmail, maskPhone } from "@/components/ui";
import { rise, stagger } from "@/motion";
import { useSession } from "@/session";
import { colors, fonts, radius } from "@/theme";
import type { ClinicianSettings } from "@/types";

// Delays a GP can pick for a repeat, in minutes after the first alert.
const REPEAT_CHOICES = [1, 5, 15, 30, 60, 120, 240];

function formatDelay(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

/** The repeat timings: one row of choices per repeat, up to two. */
function RepeatTimings({ minutes, onChange }: { minutes: number[]; onChange: (next: number[]) => void }) {
  const choose = (index: number, value: number) => {
    const next = [...minutes];
    next[index] = value;
    // The second repeat always comes after the first.
    if (index === 0 && next[1] !== undefined && next[1] <= value) {
      const later = REPEAT_CHOICES.find((c) => c > value);
      if (later) next[1] = later;
      else next.pop();
    }
    onChange(next);
  };
  const later = REPEAT_CHOICES.find((c) => c > minutes[0]);
  return (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      {minutes.map((current, index) => (
        <View key={index} style={{ gap: 10 }}>
          <View style={styles.repeatHead}>
            <T weight="medium" size={15}>
              {index === 0 ? "First repeat after" : "Second repeat after"}
            </T>
            {index === 1 ? (
              <Pressable onPress={() => onChange(minutes.slice(0, 1))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove the second repeat">
                <X size={18} color={colors.textMuted} strokeWidth={STROKE} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {REPEAT_CHOICES.map((choice) => {
              const active = choice === current;
              const disabled = index === 1 && choice <= minutes[0];
              return (
                <PressableScale key={choice} onPress={() => choose(index, choice)} disabled={disabled} label={`After ${formatDelay(choice)}`} style={[styles.choice, active && styles.choiceActive]}>
                  <T weight={active ? "semibold" : "regular"} size={14} color={active ? colors.ink : colors.textMuted}>
                    {formatDelay(choice)}
                  </T>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>
      ))}
      {minutes.length < 2 && later ? <Button label="Add a second repeat" variant="soft" icon={Plus} onPress={() => onChange([minutes[0], later])} /> : null}
    </View>
  );
}

function Row({ icon: Icon, title, detail, value, onChange, disabled }: { icon: LucideIcon; title: string; detail: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const on = value && !disabled;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, on && { backgroundColor: colors.sky }]}>
        <Icon size={19} color={on ? colors.ink : colors.textMuted} strokeWidth={STROKE} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="medium" size={16}>
          {title}
        </T>
        <T size={13} color={colors.textMuted}>
          {detail}
        </T>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled || !onChange} trackColor={{ true: colors.ink, false: colors.border }} thumbColor={colors.white} />
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
    mutationFn: (patch: SettingsPatch) => api.updateSettings(clinicianId!, patch),
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
  const repeatOn = Boolean(s?.repeatAlerts);
  const repeatMinutes = s?.repeatAfterMinutes.length ? s.repeatAfterMinutes : [15];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 22 }}>
      <Title strong="Settings" />

      <Animated.View entering={rise()}>
        <SectionLabel>How you&apos;re alerted</SectionLabel>
        <Card style={{ gap: 2, paddingVertical: 10 }}>
          <Row icon={Smartphone} title="In-app alert" detail="Always on while the app is open" value />
          <Row icon={Mail} title="Email" detail={`${maskEmail(s?.email ?? null)}${suffix(Boolean(s?.notifyEmail))}`} value={Boolean(s?.notifyEmail && s.email)} disabled={!s?.email} onChange={(v) => update.mutate({ notifyEmail: v })} />
          <Row icon={MessageSquareText} title="SMS" detail={`${maskPhone(s?.mobile ?? null)}${suffix(Boolean(s?.notifySms))}`} value={Boolean(s?.notifySms && s.mobile)} disabled={!s?.mobile} onChange={(v) => update.mutate({ notifySms: v })} />
          <Row icon={PhoneCall} title="Phone call" detail={`${maskPhone(s?.mobile ?? null)}${suffix(Boolean(s?.notifyVoice))}`} value={Boolean(s?.notifyVoice && s.mobile)} disabled={!s?.mobile} onChange={(v) => update.mutate({ notifyVoice: v })} />
        </Card>
        <View style={styles.liveNote}>
          <Radio size={15} color={live ? colors.amberText : colors.textMuted} strokeWidth={STROKE} />
          <T size={13} color={live ? colors.amberText : colors.textMuted} style={{ flex: 1, lineHeight: 18 }}>
            {live ? "Live messages are on: real email, SMS and calls are sent." : "Live messages are off on the presenter's console, so email, SMS and calls are simulated."} Messages never include
            patient details.
          </T>
        </View>
      </Animated.View>

      <Animated.View entering={rise(stagger(1))}>
        <SectionLabel>Repeat alerts</SectionLabel>
        <Card style={{ gap: 12, paddingVertical: 10 }}>
          <Row
            icon={Repeat}
            title="Repeat if unseen"
            detail={repeatOn ? `Again after ${repeatMinutes.map(formatDelay).join(" and ")}` : "Remind me again if I haven't seen an alert"}
            value={repeatOn}
            onChange={(on) => update.mutate(on ? { repeatAlerts: true, repeatAfterMinutes: repeatMinutes } : { repeatAlerts: false })}
          />
          {repeatOn ? <RepeatTimings minutes={repeatMinutes} onChange={(next) => update.mutate({ repeatAfterMinutes: next })} /> : null}
        </Card>
      </Animated.View>

      <Animated.View entering={rise(stagger(2))}>
        <SectionLabel>Away</SectionLabel>
        <Card style={{ gap: 12, paddingVertical: 10 }}>
          <Row
            icon={Plane}
            title="I'm away"
            detail={s?.away ? `Alerts go to ${s.colleagues.find((c) => c.id === s.coveringClinicianId)?.name ?? "a colleague"}` : "Hand your alerts to a colleague"}
            value={Boolean(s?.away)}
            onChange={(v) => update.mutate({ away: v, coveringClinicianId: v ? (s?.coveringClinicianId ?? s?.colleagues[0]?.id ?? null) : (s?.coveringClinicianId ?? null) })}
          />
          {s?.away ? (
            <View style={styles.colleagues}>
              {s.colleagues.map((c) => {
                const active = s.coveringClinicianId === c.id;
                return (
                  <PressableScale key={c.id} onPress={() => update.mutate({ coveringClinicianId: c.id })} style={[styles.colleague, active && styles.colleagueActive]}>
                    <T weight={active ? "semibold" : "regular"} size={14} color={active ? colors.ink : colors.textMuted}>
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

      <Animated.View entering={rise(stagger(3))}>
        <SectionLabel>Server</SectionLabel>
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.rowIcon}>
              <Server size={18} color={colors.textMuted} strokeWidth={STROKE} />
            </View>
            <T size={14} color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
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
            <Button label="Change server" variant="soft" onPress={() => setServer(serverUrl)} />
          )}
        </Card>
      </Animated.View>

      <Button
        label="Switch GP"
        variant="secondary"
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
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mist, alignItems: "center", justifyContent: "center" },
  liveNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 12, paddingHorizontal: 6 },
  colleagues: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  colleague: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.mist },
  colleagueActive: { backgroundColor: colors.sky },
  repeatHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  choice: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.mist },
  choiceActive: { backgroundColor: colors.sky },
  input: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.mist },
});
