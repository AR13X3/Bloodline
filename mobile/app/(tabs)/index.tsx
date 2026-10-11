import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BellRing, Check, ChevronRight, ShieldCheck } from "lucide-react-native";
import { useMemo, useState } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { PressableScale, ReasonChip, T, reasonAccent, timeAgo } from "@/components/ui";
import { useAlerts, useFreshAlerts } from "@/hooks";
import { RISE, rise, stagger, useShowFor } from "@/motion";
import { useSession } from "@/session";
import { colors, radius, shadow } from "@/theme";
import type { AlertListItem } from "@/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function SeenAction() {
  return (
    <View style={styles.swipeAction}>
      <Check size={22} color={colors.white} />
      <T weight="semibold" size={13} color={colors.white}>
        Seen
      </T>
    </View>
  );
}

// How long new results stay highlighted, matching the banner.
const FRESH_HOLD = 2500;

function AlertCard({ alert, index, isFresh, onSeen }: { alert: AlertListItem; index: number; isFresh: boolean; onSeen: () => void }) {
  // Only the border colour changes; its width stays fixed so nothing reflows.
  const glow = useShowFor(isFresh, FRESH_HOLD);
  const glowStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(glow.value, [0, 1], [colors.border, colors.amber]) }));

  const unseen = !alert.seenAt;
  const card = (
    <PressableScale onPress={() => router.push({ pathname: "/alert/[id]", params: { id: alert.id } })}>
      <Animated.View style={[styles.card, glowStyle, !unseen && { opacity: 0.72 }]}>
        <View style={[styles.accent, { backgroundColor: reasonAccent(alert.reasons) }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.row}>
            <T weight="semibold" size={16} style={{ flex: 1 }} numberOfLines={1}>
              {alert.result.testName}{" "}
              <T weight="bold" size={16} color={unseen ? colors.navy : colors.textMuted}>
                {alert.result.value}
              </T>{" "}
              <T size={13} color={colors.textMuted}>
                {alert.result.unit ?? ""}
              </T>
            </T>
            {unseen ? <View style={styles.dot} /> : null}
          </View>
          <T size={14} color={colors.textMuted}>
            {alert.patient.name} · {timeAgo(alert.createdAt)}
          </T>
          <View style={styles.chips}>
            {alert.reasons.map((r) => (
              <ReasonChip key={r} reason={r} />
            ))}
          </View>
          {alert.handedOverFrom ? (
            <T size={12} color={colors.amberText}>
              Covering for {alert.handedOverFrom.name}
            </T>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.textFaint} />
      </Animated.View>
    </PressableScale>
  );

  return (
    // No layout or exiting animation: this list re-renders on every poll.
    <Animated.View entering={rise(stagger(index))}>
      {unseen ? (
        <ReanimatedSwipeable friction={1.6} leftThreshold={70} renderLeftActions={() => <SeenAction />} onSwipeableOpen={onSeen}>
          {card}
        </ReanimatedSwipeable>
      ) : (
        card
      )}
    </Animated.View>
  );
}

function NewResultBanner({ count, top }: { count: number; top: number }) {
  const shown = useShowFor(true, FRESH_HOLD);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (shown.value - 1) * RISE }] }));
  return (
    <Animated.View style={[styles.banner, { top }, style]} pointerEvents="none">
      <BellRing size={18} color={colors.navy} />
      <T weight="semibold" size={14} color={colors.navy}>
        {count === 1 ? "New result to review" : `${count} new results to review`}
      </T>
    </Animated.View>
  );
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { clinicianId, serverUrl } = useSession();
  const api = useApi();
  const queryClient = useQueryClient();
  const alerts = useAlerts();
  const fresh = useFreshAlerts();
  const [refreshing, setRefreshing] = useState(false);
  const me = alerts.data?.[0]?.recipient.name;

  const markSeen = useMutation({
    mutationFn: (id: string) => api.markSeen(id, clinicianId!),
    onMutate: async (id) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const key = ["alerts", serverUrl, clinicianId];
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<AlertListItem[]>(key);
      queryClient.setQueryData<AlertListItem[]>(key, (list) => list?.map((a) => (a.id === id ? { ...a, seenAt: new Date().toISOString() } : a)));
      return { before, key };
    },
    onError: (_e, _id, ctx) => ctx && queryClient.setQueryData(ctx.key, ctx.before),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const sections = useMemo(() => {
    const list = alerts.data ?? [];
    const toReview = list.filter((a) => !a.seenAt);
    const seen = list.filter((a) => a.seenAt);
    return [
      // Stable keys, so cards don't remount (and fade in again) when a section appears or empties.
      ...(toReview.length ? [{ key: "review", title: "To review", data: toReview }] : []),
      ...(seen.length ? [{ key: "seen", title: "Seen", data: seen }] : []),
    ];
  }, [alerts.data]);
  const unseen = sections.find((s) => s.title === "To review")?.data.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: insets.top + 12, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.teal}
            colors={[colors.teal]}
            onRefresh={async () => {
              setRefreshing(true);
              await alerts.refetch();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <View style={{ gap: 4 }}>
              <T size={14} color={colors.textMuted}>
                {greeting()}
              </T>
              <T weight="bold" size={28}>
                {me ?? "Your alerts"}
              </T>
            </View>
            <Animated.View entering={rise()}>
              <LinearGradient colors={unseen ? ["#13294B", "#1C4E6B"] : ["#0E7F79", "#12A19A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
                <View style={styles.summaryIcon}>{unseen ? <BellRing size={22} color={colors.white} /> : <ShieldCheck size={22} color={colors.white} />}</View>
                <View style={{ flex: 1 }}>
                  <T weight="bold" size={20} color={colors.white}>
                    {unseen ? `${unseen} result${unseen === 1 ? "" : "s"} to review` : "Nothing waiting"}
                  </T>
                </View>
              </LinearGradient>
            </Animated.View>
            {alerts.isError ? (
              <View style={styles.error}>
                <T size={13} color={colors.amberText}>
                  Can&apos;t reach the server. Retrying…
                </T>
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <T weight="semibold" size={12} color={colors.textMuted} style={styles.sectionHeader}>
            {section.title}
          </T>
        )}
        renderItem={({ item, index }) => <AlertCard alert={item} index={index} isFresh={!item.seenAt && Boolean(fresh?.ids.includes(item.id))} onSeen={() => markSeen.mutate(item.id)} />}
        ListEmptyComponent={
          alerts.isLoading ? null : (
            <View style={styles.empty}>
              <ShieldCheck size={36} color={colors.teal} />
              <T weight="semibold" size={16}>
                No alerts yet
              </T>
            </View>
          )
        }
      />
      {fresh ? <NewResultBanner key={fresh.at} count={fresh.ids.length} top={insets.top + 8} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, paddingLeft: 18, overflow: "hidden", ...shadow },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.amber },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  summary: { borderRadius: radius.lg, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  summaryIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  sectionHeader: { textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8, marginBottom: 2 },
  swipeAction: { width: 96, borderRadius: radius.lg, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", gap: 4, marginRight: 8 },
  banner: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.amber, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, ...shadow },
  error: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 10 },
  empty: { alignItems: "center", gap: 8, padding: 32 },
});
