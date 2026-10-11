import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, CheckCircle2, CircleHelp, FileText, Flag, ListChecks, MoveVertical, UserX } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Button, Card, RangeBar, ReasonChip, SectionLabel, Sparkline, T, formatDate } from "@/components/ui";
import { useSession } from "@/session";
import { colors, radius } from "@/theme";
import type { AlertDetail } from "@/types";

function Why({ icon, tone, title, detail }: { icon: ReactNode; tone: string; title: string; detail: string }) {
  return (
    <View style={styles.why}>
      <View style={[styles.whyIcon, { backgroundColor: tone }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <T weight="semibold" size={15}>
          {title}
        </T>
        <T size={13} color={colors.textMuted} style={{ marginTop: 2, lineHeight: 19 }}>
          {detail}
        </T>
      </View>
    </View>
  );
}

function reasonsExplained(a: AlertDetail) {
  const r = a.result;
  const items: { key: string; node: ReactNode }[] = [];
  if (a.reasons.includes("lab_flag")) {
    items.push({ key: "lab", node: <Why icon={<Flag size={16} color={colors.navy} />} tone={colors.navySoft} title="The lab flagged this result" detail={`Flag printed on the report: ${r.labFlag ?? "—"}.`} /> });
  }
  if (a.reasons.includes("outside_range")) {
    items.push({
      key: "range",
      node: <Why icon={<MoveVertical size={16} color={colors.amberText} />} tone={colors.amberSoft} title="Outside the reported range, may need review" detail={`${r.value} ${r.unit ?? ""} is ${a.rangePosition} the range printed on this report (${r.range}).`} />,
    });
  }
  for (const rule of a.matchedRules) {
    items.push({
      key: rule.id,
      node: <Why icon={<ListChecks size={16} color={colors.tealDeep} />} tone={colors.tealSoft} title="Matches a rule you set" detail={`Alert if ${r.testName} is ${rule.direction} ${rule.threshold} ${rule.unit} (${rule.ownerName}).`} />,
    });
  }
  if (a.reasons.includes("couldnt_check")) {
    items.push({
      key: "unclear",
      node: <Why icon={<CircleHelp size={16} color={colors.amberText} />} tone={colors.amberSoft} title="BloodLine couldn't check this result" detail={`${r.couldntCheckLabel ?? r.ruleLimitationLabel ?? "Something on the report couldn't be read"}. Please open the report.`} />,
    });
  }
  return items;
}

export default function AlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { clinicianId } = useSession();
  const queryClient = useQueryClient();
  const alert = useQuery({ queryKey: ["alert", id], queryFn: () => api.alert(id!), enabled: Boolean(id) });

  const seen = useMutation({
    mutationFn: () => api.markSeen(id!, clinicianId!),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["alert", id] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  if (!alert.data) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        {alert.isError ? <T color={colors.textMuted}>Couldn&apos;t load this alert.</T> : <ActivityIndicator color={colors.teal} />}
      </View>
    );
  }

  const a = alert.data;
  const r = a.result;
  const outside = a.rangePosition === "below" || a.rangePosition === "above";
  const isRecipient = a.recipient.id === clinicianId;
  const seenAt = a.seenAt;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <LinearGradient colors={["#13294B", "#174866", "#0F8B85"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <ArrowLeft size={22} color={colors.white} />
          </Pressable>
          <Animated.View entering={FadeInDown.duration(450)}>
            <T size={14} color="rgba(255,255,255,0.75)">
              {a.patient.name} · {formatDate(r.collectedAt)}
            </T>
            <T weight="semibold" size={20} color={colors.white} style={{ marginTop: 8 }}>
              {r.testName}
            </T>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2 }}>
              <T weight="bold" size={52} color={colors.white} style={{ letterSpacing: -1.5 }}>
                {r.value}
              </T>
              <T weight="medium" size={18} color="rgba(255,255,255,0.8)" style={{ marginBottom: 12 }}>
                {r.unit ?? ""}
              </T>
            </View>
            <View style={styles.chips}>
              {a.reasons.map((reason) => (
                <ReasonChip key={reason} reason={reason} />
              ))}
            </View>
          </Animated.View>
        </LinearGradient>

        <View style={styles.body}>
          {r.valueNumber !== null && r.range ? (
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Card>
                <View style={styles.rowBetween}>
                  <T weight="semibold" size={14}>
                    Printed range
                  </T>
                  <T weight="semibold" size={14} color={outside ? colors.amberText : colors.tealDeep}>
                    {r.range} {r.unit ?? ""}
                  </T>
                </View>
                <RangeBar value={r.valueNumber} low={rangeLow(r.range)} high={rangeHigh(r.range)} position={a.rangePosition} />
              </Card>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(140).springify().damping(18)}>
            <SectionLabel>Why you&apos;re seeing this</SectionLabel>
            <Card style={{ gap: 14 }}>{reasonsExplained(a).map((i) => <View key={i.key}>{i.node}</View>)}</Card>
          </Animated.View>

          {r.labComment ? (
            <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} style={styles.comment}>
              <T weight="semibold" size={13} color={colors.tealDeep}>
                Lab comment
              </T>
              <T size={14} style={{ marginTop: 4, lineHeight: 20 }}>
                {r.labComment}
              </T>
            </Animated.View>
          ) : null}

          {a.report.nameMatches === false ? (
            <View style={styles.warn}>
              <UserX size={18} color={colors.amberText} />
              <T size={13} color={colors.amberText} style={{ flex: 1 }}>
                The name on the report (&ldquo;{a.report.nameOnReport}&rdquo;) doesn&apos;t match {a.patient.name}. Check the report.
              </T>
            </View>
          ) : null}

          {a.history.length > 1 ? (
            <Animated.View entering={FadeInDown.delay(220).springify().damping(18)}>
              <SectionLabel>Trend</SectionLabel>
              <Card>
                <Sparkline points={a.history} />
                <View style={styles.rowBetween}>
                  <T size={12} color={colors.textMuted}>
                    {formatDate(a.history[0].collectedAt)}
                  </T>
                  <T size={12} color={colors.textMuted}>
                    {formatDate(a.history[a.history.length - 1].collectedAt)}
                  </T>
                </View>
              </Card>
            </Animated.View>
          ) : null}

          {a.report.fileUrl ? (
            <Button label="View original report" variant="secondary" icon={FileText} onPress={() => WebBrowser.openBrowserAsync(api.reportUrl(a.report.fileUrl!))} />
          ) : null}
        </View>
      </ScrollView>

      {isRecipient ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          {seenAt ? (
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.seen}>
              <CheckCircle2 size={22} color={colors.green} />
              <T weight="semibold" size={15} color={colors.green}>
                Seen at {new Date(seenAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
              </T>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn}>
              <Button label="Mark as seen" icon={CheckCircle2} loading={seen.isPending} onPress={() => seen.mutate()} />
            </Animated.View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// The range text is shown as printed; these just place it on the bar.
function rangeLow(range: string): number | null {
  const two = /^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)$/.exec(range.trim());
  if (two) return Number(two[1]);
  const gt = /^(?:>|>=|≥)\s*(\d+(?:\.\d+)?)$/.exec(range.trim());
  return gt ? Number(gt[1]) : null;
}

function rangeHigh(range: string): number | null {
  const two = /^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)$/.exec(range.trim());
  if (two) return Number(two[2]);
  const lt = /^(?:<|<=|≤)\s*(\d+(?:\.\d+)?)$/.exec(range.trim());
  return lt ? Number(lt[1]) : null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  hero: { paddingHorizontal: 20, paddingBottom: 48 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  body: { paddingHorizontal: 16, marginTop: -28, gap: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  why: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  whyIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  comment: { backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: 14, borderLeftWidth: 4, borderLeftColor: colors.teal },
  warn: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 12 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: "rgba(245,247,251,0.96)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  seen: { height: 52, borderRadius: radius.md, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenSoft },
});
