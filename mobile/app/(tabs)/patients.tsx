import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChevronRight, ListChecks } from "lucide-react-native";
import { FlatList, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { PressableScale, SyntheticBadge, T, formatDate } from "@/components/ui";
import { useSession } from "@/session";
import { colors, radius, shadow } from "@/theme";

function age(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export default function PatientsScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { serverUrl } = useSession();
  const patients = useQuery({ queryKey: ["patients", serverUrl], queryFn: api.patients });

  return (
    <FlatList
      data={patients.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 6 }}>
          <T weight="bold" size={28}>
            Patients
          </T>
          <T size={14} color={colors.textMuted}>
            Set your own alert rules for a patient: for example, potassium above a value you choose.
          </T>
          <SyntheticBadge />
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(16)}>
          <PressableScale onPress={() => router.push({ pathname: "/patient/[id]", params: { id: item.id } })} style={styles.row}>
            <View style={styles.avatar}>
              <T weight="semibold" size={15} color={colors.navy}>
                {item.name.split(" ").map((p) => p[0]).join("")}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T weight="semibold" size={16}>
                {item.name}
              </T>
              <T size={13} color={colors.textMuted}>
                {item.sex === "F" ? "Female" : "Male"}, {age(item.dateOfBirth)} · {item.practiceRef}
              </T>
              <T size={12} color={colors.textFaint}>
                {item.lastResultAt ? `Last result ${formatDate(item.lastResultAt)}` : "No results yet"}
                {item.usualGp ? ` · ${item.usualGp.name}` : ""}
              </T>
            </View>
            {item.activeRules > 0 ? (
              <View style={styles.rules}>
                <ListChecks size={13} color={colors.tealDeep} />
                <T weight="semibold" size={12} color={colors.tealDeep}>
                  {item.activeRules}
                </T>
              </View>
            ) : null}
            <ChevronRight size={18} color={colors.textFaint} />
          </PressableScale>
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.navySoft, alignItems: "center", justifyContent: "center" },
  rules: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tealSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
});
