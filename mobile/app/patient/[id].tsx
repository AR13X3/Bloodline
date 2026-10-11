import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ListChecks, Plus } from "lucide-react-native";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Button, Card, SectionLabel, T, formatDate } from "@/components/ui";
import { rise } from "@/motion";
import { useSession } from "@/session";
import { colors, radius } from "@/theme";
import type { RuleView } from "@/types";

const STATUS: Record<RuleView["status"], { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: colors.tealSoft, fg: colors.tealDeep },
  expired: { label: "Expired", bg: colors.navySoft, fg: colors.textMuted },
  ended: { label: "Ended", bg: colors.navySoft, fg: colors.textMuted },
};

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
    return <View style={styles.center}>{patient.isError ? <T color={colors.textMuted}>Couldn&apos;t load this patient.</T> : <ActivityIndicator color={colors.teal} />}</View>;
  }
  const p = patient.data;
  const mine = p.rules.filter((r) => r.owner.id === clinicianId);
  const others = p.rules.filter((r) => r.owner.id !== clinicianId && r.status === "active");
  const recent = p.tests.filter((t) => t.latest).sort((a, b) => (a.latest!.collectedAt < b.latest!.collectedAt ? 1 : -1));

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
            <ListChecks size={16} color={colors.tealDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={15}>
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
          <View style={[styles.status, { backgroundColor: s.bg }]}>
            <T weight="semibold" size={11} color={s.fg}>
              {s.label}
            </T>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110, gap: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={22} color={colors.navy} />
        </Pressable>
        <View>
          <T weight="bold" size={28}>
            {p.name}
          </T>
          <T size={14} color={colors.textMuted}>
            {p.sex === "F" ? "Female" : "Male"} · born {formatDate(p.dateOfBirth)} · {p.practiceRef}
          </T>
        </View>

        <View>
          <SectionLabel>Your rules</SectionLabel>
          <Card style={{ gap: 10 }}>
            {mine.length ? mine.map((r) => ruleCard(r, true)) : <T size={14} color={colors.textMuted}>You haven&apos;t set any rules for {p.name.split(" ")[0]}.</T>}
          </Card>
        </View>

        {others.length ? (
          <View>
            <SectionLabel>Other GPs&apos; rules</SectionLabel>
            <Card style={{ gap: 10 }}>{others.map((r) => ruleCard(r, false))}</Card>
          </View>
        ) : null}

        {recent.length ? (
          <View>
            <SectionLabel>Latest results</SectionLabel>
            <Card style={{ gap: 2 }}>
              {recent.map((t) => (
                <View key={t.id} style={styles.result}>
                  <T size={14} style={{ flex: 1 }}>
                    {t.name}
                  </T>
                  <T weight="semibold" size={14} color={t.latest!.labFlagged ? colors.amberText : colors.text}>
                    {t.latest!.value} <T size={12} color={colors.textMuted}>{t.unit}</T>
                  </T>
                  <T size={12} color={colors.textFaint} style={{ width: 86, textAlign: "right" }}>
                    {formatDate(t.latest!.collectedAt)}
                  </T>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="New rule" icon={Plus} onPress={() => router.push({ pathname: "/rule/new", params: { patientId: p.id } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  rule: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  ruleIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  result: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: "rgba(245,247,251,0.96)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
