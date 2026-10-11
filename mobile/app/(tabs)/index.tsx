import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { BellRing, Check, ShieldCheck } from "lucide-react-native";
import { useMemo, useState } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { ArrowCircle, Avatar, PressableScale, ReasonChip, STROKE, T, Title, timeAgo } from "@/components/ui";
import { useAlerts, useFreshAlerts } from "@/hooks";
import { RISE, rise, stagger, useShowFor } from "@/motion";
import { useSession } from "@/session";
import { colors, lift, radius } from "@/theme";
import type { AlertListItem } from "@/types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}

function SeenAction() {
  return (
    <View style={styles.swipeAction}>
      <Check size={22} color={colors.white} strokeWidth={STROKE} />
      <T weight="medium" size={13} color={colors.white}>
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
  const glowStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(glow.value, [0, 1], [colors.card, colors.accent]) }));

  const unseen = !alert.seenAt;
  const card = (
    <PressableScale onPress={() => router.push({ pathname: "/alert/[id]", params: { id: alert.id } })}>
      <Animated.View style={[styles.card, glowStyle]}>
        <View style={styles.row}>
          <T weight="medium" size={16} style={{ flex: 1 }} numberOfLines={1}>
            {alert.result.testName}
          </T>
          {unseen ? <View style={styles.dot} /> : null}
        </View>
        <View style={styles.value}>
          <T weight="light" size={34} color={unseen ? colors.ink : colors.textMuted}>
            {alert.result.value}
          </T>
          <T size={14} color={colors.textMuted}>
            {alert.result.unit ?? ""}
          </T>
        </View>
        <T size={13} color={colors.textMuted} numberOfLines={1}>
          {alert.patient.name} · {timeAgo(alert.createdAt)}
          {alert.handedOverFrom ? ` · covering for ${alert.handedOverFrom.name}` : ""}
        </T>
        <View style={styles.footer}>
          <View style={styles.chips}>
            {alert.reasons.map((r) => (
              <ReasonChip key={r} reason={r} />
            ))}
          </View>
          <ArrowCircle />
        </View>
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

function NewResultBanner({ count, top, repeat }: { count: number; top: number; repeat: boolean }) {
  const shown = useShowFor(true, FRESH_HOLD);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (shown.value - 1) * RISE }] }));
  return (
    <Animated.View style={[styles.banner, { top }, style]} pointerEvents="none">
      <BellRing size={18} color={colors.white} strokeWidth={STROKE} />
      <T weight="medium" size={14} color={colors.white}>
        {repeat
          ? `Reminder: ${count === 1 ? "1 result" : `${count} results`} still to review`
          : count === 1
            ? "New result to review"
            : `${count} new results to review`}
      </T>
    </Animated.View>
  );
}

/** One of the two summary tiles under the greeting. The dark one is the call to action. */
function Tile({ label, count, dark, onPress }: { label: string; count: number; dark?: boolean; onPress?: () => void }) {
  const fg = dark ? colors.white : colors.ink;
  const body = (
    <>
      <T size={16} color={fg}>
        {label}
      </T>
      <View style={styles.tileFoot}>
        <T weight="light" size={46} color={fg} style={{ lineHeight: 52 }}>
          {count}
        </T>
        {onPress ? <ArrowCircle tone={dark ? "sky" : "mist"} size={44} /> : null}
      </View>
    </>
  );
  // The wrapper takes the row's space; PressableScale's style only reaches its inner view.
  return (
    <View style={{ flex: 1 }}>
      {onPress ? (
        <PressableScale onPress={onPress} label={`${label}: ${count}`} style={[styles.tile, dark && styles.tileDark]}>
          {body}
        </PressableScale>
      ) : (
        <View style={[styles.tile, dark && styles.tileDark]}>{body}</View>
      )}
    </View>
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

  const { sections, toReview, seen } = useMemo(() => {
    const list = alerts.data ?? [];
    const toReview = list.filter((a) => !a.seenAt);
    const seen = list.filter((a) => a.seenAt);
    return {
      toReview,
      seen,
      sections: [
        // Stable keys, so cards don't remount (and fade in again) when a section appears or empties.
        ...(toReview.length ? [{ key: "review", title: "To review", data: toReview }] : []),
        ...(seen.length ? [{ key: "seen", title: "Seen", data: seen }] : []),
      ],
    };
  }, [alerts.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32, paddingTop: insets.top + 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            colors={[colors.accent]}
            onRefresh={async () => {
              setRefreshing(true);
              await alerts.refetch();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 22, marginBottom: 4 }}>
            <View style={styles.header}>
              <Title light={greeting()} strong={me ?? "Your alerts"} />
              {me ? (
                <PressableScale onPress={() => router.navigate("/settings")} label="Settings">
                  <Avatar name={me} size={48} />
                </PressableScale>
              ) : null}
            </View>
            <Animated.View entering={rise()} style={styles.tiles}>
              <Tile
                label="To review"
                count={toReview.length}
                dark={toReview.length > 0}
                onPress={toReview[0] ? () => router.push({ pathname: "/alert/[id]", params: { id: toReview[0].id } }) : undefined}
              />
              <Tile label="Seen" count={seen.length} />
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
          <T size={14} color={colors.textMuted} style={styles.sectionHeader}>
            {section.title}
          </T>
        )}
        renderItem={({ item, index }) => <AlertCard alert={item} index={index} isFresh={!item.seenAt && Boolean(fresh?.ids.includes(item.id))} onSeen={() => markSeen.mutate(item.id)} />}
        ListEmptyComponent={
          alerts.isLoading ? null : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <ShieldCheck size={28} color={colors.ink} strokeWidth={STROKE} />
              </View>
              <T weight="medium" size={16}>
                No alerts yet
              </T>
            </View>
          )
        }
      />
      {fresh ? <NewResultBanner key={fresh.at} count={fresh.ids.length} repeat={fresh.repeat} top={insets.top + 8} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { height: 150, borderRadius: radius.lg, padding: 18, backgroundColor: colors.card, justifyContent: "space-between" },
  tileDark: { backgroundColor: colors.ink },
  tileFoot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.card, padding: 18, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  value: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.amber },
  footer: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 12 },
  chips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sectionHeader: { marginTop: 8, marginLeft: 4 },
  swipeAction: { width: 96, borderRadius: radius.lg, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", gap: 4, marginRight: 10 },
  banner: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 13, borderRadius: radius.pill, ...lift },
  error: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 12 },
  empty: { alignItems: "center", gap: 10, padding: 36 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center" },
});
