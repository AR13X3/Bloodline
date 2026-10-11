import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ListChecks } from "lucide-react-native";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { ArrowCircle, Avatar, Chip, PressableScale, T, Title, formatDate } from "@/components/ui";
import { rise, stagger } from "@/motion";
import { useSession } from "@/session";
import { colors, radius } from "@/theme";

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
      style={{ backgroundColor: colors.background }}
      data={patients.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 18, paddingTop: insets.top + 16, gap: 12 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 10 }}>
          <Title strong="Patients" />
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={rise(stagger(index))}>
          <PressableScale onPress={() => router.push({ pathname: "/patient/[id]", params: { id: item.id } })} style={styles.row}>
            <Avatar name={item.name} size={50} />
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="medium" size={17} numberOfLines={1}>
                {item.name}
              </T>
              <T size={13} color={colors.textMuted} numberOfLines={1}>
                {item.sex === "F" ? "Female" : "Male"}, {age(item.dateOfBirth)} · {item.practiceRef}
              </T>
              <T size={12} color={colors.textFaint} numberOfLines={1}>
                {item.lastResultAt ? `Last result ${formatDate(item.lastResultAt)}` : "No results yet"}
                {item.usualGp ? ` · ${item.usualGp.name}` : ""}
              </T>
              {item.activeRules > 0 ? (
                <View style={{ flexDirection: "row", marginTop: 6 }}>
                  <Chip label={`${item.activeRules} rule${item.activeRules === 1 ? "" : "s"}`} icon={ListChecks} bg={colors.sky} />
                </View>
              ) : null}
            </View>
            <ArrowCircle />
          </PressableScale>
        </Animated.View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16 },
});
