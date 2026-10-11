import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CalendarDays, ListChecks, Plus, UserRound } from "lucide-react-native";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Button, Card, Chip, IconButton, SectionLabel, StatRow, STROKE, T, Title, formatDate } from "@/components/ui";
import { rise, stagger } from "@/motion";
import { useSession } from "@/session";
import { colors, radius } from "@/theme";
import type { RuleView } from "@/types";

const STATUS: Record<RuleView["status"], { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: colors.sky, fg: colors.ink },
  expired: { label: "Expired", bg: colors.mist, fg: colors.textMuted },
  ended: { label: "Ended", bg: colors.mist, fg: colors.textMuted },
};

function age(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export default function PatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { clinicianId } = useSession();
  const queryClient = useQueryClient();
  const patient = useQuery({ queryKey: ["patient", id], queryFn: () => api.patient(id!), enabled: Boolean(id) });

  const update = useMutation({
    mutationFn: ({ ruleId, action, months }: { ruleId: string; action: "renew" | "end"; months?: 1 | 3 | 6 }) =>
      action === "renew" ? api.updateRule(ruleId, { action, clinicianId: clinicianId!, months: months ?? 3 }) : api.updateRule(ruleId, { action, clinicianId: clinicianId! }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => Alert.alert("Couldn't update the rule", e.message),
  });

  if (!patient.data) {
    return <View style={styles.center}>{patient.isError ? <T color={colors.textMuted}>Couldn&apos;t load this patient.</T> : <ActivityIndicator color={colors.accent} />}</View>;
  }
  const p = patient.data;
  const mine = p.rules.filter((r) => r.owner.id === clinicianId);
  const others = p.rules.filter((r) => r.owner.id !== clinicianId && r.status === "active");
  const recent = p.tests.filter((t) => t.latest).sort((a, b) => (a.latest!.collectedAt < b.latest!.collectedAt ? 1 : -1));
  const names = p.name.split(" ");

  const manage = (rule: RuleView) =>
    Alert.alert(`${rule.testName} ${rule.direction} ${rule.threshold} ${rule.unit}`, `Active until ${formatDate(rule.endsAt)}`, [
      { text: "Renew 3 months", onPress: () => update.mutate({ ruleId: rule.id, action: "renew", months: 3 }) },
      { text: "End rule", style: "destructive", onPress: () => update.mutate({ ruleId: rule.id, action: "end" }) },
      { text: "Cancel", style: "cancel" },
    ]);

  const ruleCard = (rule: RuleView, editable: boolean) => {
    const s = STATUS[rule.status];
    return (
      <Animated.View key={rule.id} entering={rise()}>
        <Pressable disabled={!editable || rule.status !== "active"} onPress={() => manage(rule)} style={styles.rule}>
          <View style={styles.ruleIcon}>
            <ListChecks size={18} color={colors.ink} strokeWidth={STROKE} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="medium" size={15}>
              {rule.testName} {rule.direction} {rule.threshold} {rule.unit}
            </T>
            <T size={12} color={colors.textMuted}>
              {rule.status === "active" ? `Until ${formatDate(rule.endsAt)}` : rule.status === "ended" ? `Ended ${formatDate(rule.endedAt!)}` : `Expired ${formatDate(rule.endsAt)}`}
              {editable ? "" : ` · ${rule.owner.name}`}
            </T>
            {rule.note ? (
              <T size={12} color={colors.textFaint} numberOfLines={1}>
                {rule.note}
              </T>
            ) : null}
          </View>
          <Chip label={s.label} bg={s.bg} fg={s.fg} />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
          <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
          <Animated.View entering={rise()} style={{ marginTop: 22, gap: 12, alignItems: "flex-start" }}>
            <Chip label={`${p.practiceRef} · born ${formatDate(p.dateOfBirth)}`} bg={colors.white} />
            <Title light={names.slice(0, -1).join(" ") || undefined} strong={names[names.length - 1]} size={34} />
          </Animated.View>
        </View>

        <Animated.View entering={rise(stagger(1))} style={styles.body}>
          <StatRow
            items={[
              { icon: CalendarDays, value: String(age(p.dateOfBirth)), label: "Years old" },
              { icon: UserRound, value: p.sex === "F" ? "Female" : "Male", label: "Sex" },
              { icon: ListChecks, value: String(p.rules.filter((r) => r.status === "active").length), label: "Active rules" },
            ]}
          />

          <View>
            <SectionLabel>Your rules</SectionLabel>
            <Card style={{ gap: 10, padding: 12 }}>
              {mine.length ? (
                mine.map((r) => ruleCard(r, true))
              ) : (
                <T size={14} color={colors.textMuted} style={{ padding: 6 }}>
                  You haven&apos;t set any rules for {names[0]}.
                </T>
              )}
            </Card>
          </View>

          {others.length ? (
            <View>
              <SectionLabel>Other GPs&apos; rules</SectionLabel>
              <Card style={{ gap: 10, padding: 12 }}>{others.map((r) => ruleCard(r, false))}</Card>
            </View>
          ) : null}

          {recent.length ? (
            <View>
              <SectionLabel>Latest results</SectionLabel>
              <Card style={{ paddingVertical: 6 }}>
                {recent.map((t, i) => (
                  <View key={t.id} style={[styles.result, i > 0 && styles.resultDivider]}>
                    <T size={15} style={{ flex: 1 }}>
                      {t.name}
                    </T>
                    <T weight="semibold" size={15} color={t.latest!.labFlagged ? colors.amberText : colors.ink}>
                      {t.latest!.value}{" "}
                      <T size={12} color={colors.textMuted}>
                        {t.unit}
                      </T>
                    </T>
                    <T size={12} color={colors.textFaint} style={{ width: 86, textAlign: "right" }}>
                      {formatDate(t.latest!.collectedAt)}
                    </T>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <Button label="New rule" icon={Plus} onPress={() => router.push({ pathname: "/rule/new", params: { patientId: p.id } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  hero: { backgroundColor: colors.panel, paddingHorizontal: 20, paddingBottom: 56, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  body: { paddingHorizontal: 18, marginTop: -30, gap: 20 },
  rule: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  ruleIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center" },
  result: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  resultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, backgroundColor: "rgba(241,244,246,0.96)" },
});
