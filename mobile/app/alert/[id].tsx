import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleHelp, FileText, Flag, ListChecks, MoveVertical, Ruler, UserX } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Button, Card, IconButton, RangeBar, ReasonChip, SectionLabel, Sparkline, StatRow, STROKE, T, formatDate } from "@/components/ui";
import { fade, rise, stagger } from "@/motion";
import { useSession } from "@/session";
import { colors, radius } from "@/theme";
import type { AlertDetail } from "@/types";

function Why({ icon, tone, title, detail }: { icon: ReactNode; tone: string; title: string; detail: string }) {
  return (
    <View style={styles.why}>
      <View style={[styles.whyIcon, { backgroundColor: tone }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <T weight="medium" size={16}>
          {title}
        </T>
        <T size={13} color={colors.textMuted} style={{ marginTop: 3, lineHeight: 19 }}>
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
    items.push({ key: "lab", node: <Why icon={<Flag size={18} color={colors.ink} strokeWidth={STROKE} />} tone={colors.mist} title="The lab flagged this result" detail={`Flag printed on the report: ${r.labFlag ?? "—"}.`} /> });
  }
  if (a.reasons.includes("outside_range")) {
    items.push({
      key: "range",
      node: <Why icon={<MoveVertical size={18} color={colors.amberText} strokeWidth={STROKE} />} tone={colors.amberSoft} title="Outside the reported range, may need review" detail={`${r.value} ${r.unit ?? ""} is ${a.rangePosition} the range printed on this report (${r.range}).`} />,
    });
  }
  for (const rule of a.matchedRules) {
    items.push({
      key: rule.id,
      node: <Why icon={<ListChecks size={18} color={colors.ink} strokeWidth={STROKE} />} tone={colors.sky} title="Matches a rule you set" detail={`Alert if ${r.testName} is ${rule.direction} ${rule.threshold} ${rule.unit} (${rule.ownerName}).`} />,
    });
  }
  if (a.reasons.includes("couldnt_check")) {
    items.push({
      key: "unclear",
      node: <Why icon={<CircleHelp size={18} color={colors.amberText} strokeWidth={STROKE} />} tone={colors.amberSoft} title="BloodLine couldn't check this result" detail={`${r.couldntCheckLabel ?? r.ruleLimitationLabel ?? "Something on the report couldn't be read"}. Please open the report.`} />,
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
        {alert.isError ? <T color={colors.textMuted}>Couldn&apos;t load this alert.</T> : <ActivityIndicator color={colors.accent} />}
      </View>
    );
  }

  const a = alert.data;
  const r = a.result;
  const outside = a.rangePosition === "below" || a.rangePosition === "above";
  const isRecipient = a.recipient.id === clinicianId;
  const seenAt = a.seenAt;
  const openReport = a.report.fileUrl ? () => WebBrowser.openBrowserAsync(api.reportUrl(a.report.fileUrl!)) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 10 }]}>
          <View style={styles.heroTop}>
            <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
            {openReport ? <IconButton icon={FileText} label="View original report" onPress={openReport} /> : null}
          </View>
          <Animated.View entering={rise()} style={{ marginTop: 22, gap: 4 }}>
            <View style={styles.chips}>
              {a.reasons.map((reason) => (
                <ReasonChip key={reason} reason={reason} />
              ))}
            </View>
            <T size={15} color={colors.textMuted} style={{ marginTop: 10 }}>
              {a.patient.name}
            </T>
            <T weight="regular" size={30} color={colors.ink} style={{ lineHeight: 36 }}>
              {r.testName}
            </T>
            <View style={styles.valueRow}>
              <T weight="light" size={64} color={outside ? colors.amberText : colors.ink} style={{ letterSpacing: -2, lineHeight: 70 }}>
                {r.value}
              </T>
              <T size={18} color={colors.textMuted} style={{ marginBottom: 12 }}>
                {r.unit ?? ""}
              </T>
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={rise(stagger(1))} style={styles.body}>
          <StatRow
            items={[
              { icon: Ruler, value: r.range ?? "—", label: "Printed range", color: outside ? colors.amberText : colors.accent },
              { icon: Flag, value: r.labFlag ?? "None", label: "Lab flag" },
              { icon: CalendarDays, value: new Date(r.collectedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" }), label: "Collected" },
            ]}
          />

          {r.valueNumber !== null && r.range ? (
            <View>
              <SectionLabel>Where it sits</SectionLabel>
              <Card style={{ paddingTop: 14 }}>
                <RangeBar value={r.valueNumber} low={rangeLow(r.range)} high={rangeHigh(r.range)} position={a.rangePosition} />
              </Card>
            </View>
          ) : null}

          <View>
            <SectionLabel>Why you&apos;re seeing this</SectionLabel>
            <Card style={{ gap: 16 }}>{reasonsExplained(a).map((i) => <View key={i.key}>{i.node}</View>)}</Card>
          </View>

          {r.labComment ? (
            <View style={styles.comment}>
              <T weight="medium" size={14} color={colors.ink}>
                Lab comment
              </T>
              <T size={15} style={{ marginTop: 6, lineHeight: 21 }}>
                {r.labComment}
              </T>
            </View>
          ) : null}

          {a.report.nameMatches === false ? (
            <View style={styles.warn}>
              <UserX size={20} color={colors.amberText} strokeWidth={STROKE} />
              <T size={14} color={colors.amberText} style={{ flex: 1, lineHeight: 19 }}>
                The name on the report (&ldquo;{a.report.nameOnReport}&rdquo;) doesn&apos;t match {a.patient.name}. Check the report.
              </T>
            </View>
          ) : null}

          {a.history.length > 1 ? (
            <View>
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
            </View>
          ) : null}

          {openReport ? <Button label="View original report" variant="secondary" icon={FileText} onPress={openReport} /> : null}
        </Animated.View>
      </ScrollView>

      {isRecipient ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
          {seenAt ? (
            <Animated.View entering={fade()} style={styles.seen}>
              <CheckCircle2 size={22} color={colors.green} strokeWidth={STROKE} />
              <T weight="medium" size={16} color={colors.green}>
                Seen at {new Date(seenAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
              </T>
            </Animated.View>
          ) : (
            <Animated.View entering={fade()}>
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
  hero: { backgroundColor: colors.panel, paddingHorizontal: 20, paddingBottom: 56, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  body: { paddingHorizontal: 18, marginTop: -30, gap: 20 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  why: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  whyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  comment: { backgroundColor: colors.sky, borderRadius: radius.lg, padding: 18 },
  warn: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.amberSoft, borderRadius: radius.lg, padding: 16 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, backgroundColor: "rgba(241,244,246,0.96)" },
  seen: { height: 58, borderRadius: radius.pill, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenSoft },
});
