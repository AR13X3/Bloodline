import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Info, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Button, Card, SectionLabel, Segmented, T, formatDate } from "@/components/ui";
import { useSession } from "@/session";
import { colors, fonts, radius } from "@/theme";
import type { TestForRules } from "@/types";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default function NewRuleScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { clinicianId } = useSession();
  const queryClient = useQueryClient();
  const patient = useQuery({ queryKey: ["patient", patientId], queryFn: () => api.patient(patientId!), enabled: Boolean(patientId) });

  const [search, setSearch] = useState("");
  const [test, setTest] = useState<TestForRules | null>(null);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [value, setValue] = useState("");
  const [months, setMonths] = useState<1 | 3 | 6>(3);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const tests = useMemo(() => {
    const list = patient.data?.tests ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list;
    // Tests this patient already has results for come first.
    return [...filtered].sort((a, b) => Number(Boolean(b.latest)) - Number(Boolean(a.latest)));
  }, [patient.data, search]);

  const threshold = /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null;
  const valueError = value.trim() && threshold === null ? "Enter a number, like 5.5" : null;
  const endsAt = new Date(Date.now() + months * MONTH_MS).toISOString();

  const save = useMutation({
    mutationFn: () => api.createRule({ clinicianId: clinicianId!, patientId: patientId!, testTypeId: test!.id, direction, threshold: threshold!, months, note: note.trim() || null }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setTimeout(() => router.back(), 900);
    },
    onError: (e: Error) => Alert.alert("Couldn't save the rule", e.message),
  });

  if (!patient.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  const first = patient.data.name.split(" ")[0];

  if (save.isSuccess) {
    return (
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.done}>
          <Check size={44} color={colors.white} strokeWidth={3} />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(200)}>
          <T weight="semibold" size={18} style={{ marginTop: 18 }}>
            Rule saved
          </T>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120, gap: 18 }}>
        <Pressable onPress={() => (reviewing ? setReviewing(false) : router.back())} hitSlop={12} style={styles.back}>
          <ArrowLeft size={22} color={colors.navy} />
        </Pressable>
        <View>
          <T weight="bold" size={26}>
            {reviewing ? "Check your rule" : "New rule"}
          </T>
        </View>

        {reviewing && test && threshold !== null ? (
          <Animated.View entering={FadeInDown.springify().damping(16)} style={{ gap: 14 }}>
            <Card style={{ gap: 10, borderColor: colors.teal, borderWidth: 1 }}>
              <T size={13} color={colors.textMuted}>
                BloodLine will alert you if
              </T>
              <T weight="bold" size={22} style={{ lineHeight: 30 }}>
                {first}&apos;s {test.name} is {direction} {threshold} {test.unit}
              </T>
              <T size={14} color={colors.textMuted}>
                until {formatDate(endsAt)}, then it expires unless you renew it.
              </T>
              {note.trim() ? (
                <T size={13} color={colors.textMuted}>
                  Note: {note.trim()}
                </T>
              ) : null}
            </Card>
            <View style={styles.info}>
              <Info size={15} color={colors.textMuted} />
              <T size={12} color={colors.textMuted} style={{ flex: 1, lineHeight: 17 }}>
                &ldquo;{direction === "above" ? "Above" : "Below"} {threshold}&rdquo; means strictly {direction === "above" ? "greater" : "less"} than {threshold}. Results in other units can&apos;t
                be compared, so BloodLine will tell you instead of guessing.
              </T>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ gap: 18 }}>
            <View>
              <SectionLabel>Test</SectionLabel>
              <View style={styles.search}>
                <Search size={16} color={colors.textFaint} />
                <TextInput value={search} onChangeText={setSearch} placeholder="Search tests" placeholderTextColor={colors.textFaint} style={styles.searchInput} />
              </View>
              <View style={styles.testGrid}>
                {tests.slice(0, search ? 40 : 12).map((t) => {
                  const active = test?.id === t.id;
                  return (
                    <Pressable key={t.id} onPress={() => setTest(t)} style={[styles.testChip, active && styles.testChipActive]}>
                      <T weight={active ? "semibold" : "medium"} size={13} color={active ? colors.white : colors.text}>
                        {t.name}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {test ? (
              <Animated.View entering={FadeInDown.springify().damping(16)} style={{ gap: 18 }}>
                <View>
                  <SectionLabel>Alert me when it&apos;s</SectionLabel>
                  <Segmented options={[{ label: "Above", value: "above" }, { label: "Below", value: "below" }]} value={direction} onChange={setDirection} />
                </View>

                <View>
                  <SectionLabel>Value</SectionLabel>
                  <View style={[styles.valueBox, valueError && { borderColor: colors.red }]}>
                    <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.textFaint} style={styles.valueInput} />
                    <T weight="semibold" size={16} color={colors.textMuted}>
                      {test.unit}
                    </T>
                  </View>
                  {valueError ? (
                    <T size={12} color={colors.red} style={{ marginTop: 6 }}>
                      {valueError}
                    </T>
                  ) : null}
                  <View style={[styles.info, { marginTop: 10 }]}>
                    <Info size={15} color={colors.textMuted} />
                    <T size={12} color={colors.textMuted} style={{ flex: 1, lineHeight: 17 }}>
                      {test.latestRange
                        ? `Range printed on ${first}'s latest report: ${test.latestRange} ${test.unit}. Unit is fixed to ${test.unit}.`
                        : `Illustrative range only (no report for ${first} yet): ${test.illustrativeRange} ${test.unit}. Unit is fixed to ${test.unit}.`}
                    </T>
                  </View>
                </View>

                <View>
                  <SectionLabel>For how long</SectionLabel>
                  <Segmented options={[{ label: "1 month", value: 1 }, { label: "3 months", value: 3 }, { label: "6 months", value: 6 }]} value={months} onChange={setMonths} />
                </View>

                <View>
                  <SectionLabel>Note (optional)</SectionLabel>
                  <TextInput value={note} onChangeText={setNote} placeholder="Why you're watching this" placeholderTextColor={colors.textFaint} maxLength={200} style={styles.note} />
                </View>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {reviewing ? (
          <Button label="Save rule" loading={save.isPending} onPress={() => save.mutate()} />
        ) : (
          <Button label="Review rule" disabled={!test || threshold === null} onPress={() => setReviewing(true)} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  testGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  testChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  testChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  valueBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  valueInput: { flex: 1, paddingVertical: 14, fontFamily: fonts.bold, fontSize: 28, color: colors.text },
  info: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.navySoft, borderRadius: radius.md, padding: 12 },
  note: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  done: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: "rgba(245,247,251,0.96)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
