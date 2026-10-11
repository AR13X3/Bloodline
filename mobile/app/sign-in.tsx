import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ChevronRight, Server, Stethoscope, WifiOff } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Logo } from "@/components/logo";
import { Button, Card, PressableScale, T } from "@/components/ui";
import { prepareNotifications } from "@/notifications";
import { useSession } from "@/session";
import { colors, fonts, radius } from "@/theme";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { serverUrl, setServerUrl, signIn } = useSession();
  const api = useApi();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(serverUrl);
  const clinicians = useQuery({ queryKey: ["clinicians", serverUrl], queryFn: api.clinicians, retry: false });

  const choose = async (id: string) => {
    await signIn(id);
    prepareNotifications().catch(() => {});
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={["#13294B", "#145A6E", "#12A19A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 36 }]}>
          <Animated.View entering={FadeInDown.duration(600)} style={styles.logoWrap}>
            <Logo size={56} light />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(600)}>
            <T weight="bold" size={34} color={colors.white}>
              BloodLine
            </T>
            <T size={16} color="rgba(255,255,255,0.82)" style={{ marginTop: 6, lineHeight: 23 }}>
              The lab makes sure the result arrives.{"\n"}BloodLine makes sure you know.
            </T>
          </Animated.View>
        </LinearGradient>

        <View style={styles.body}>
          <Animated.View entering={FadeInUp.delay(200).springify().damping(18)}>
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Stethoscope size={18} color={colors.tealDeep} />
                <T weight="semibold" size={16}>
                  Sign in as
                </T>
              </View>
              <T size={13} color={colors.textMuted}>
                Demo sign-in: choose a synthetic GP. A real build would use secure sign-in with MFA.
              </T>

              {clinicians.isLoading ? (
                <ActivityIndicator color={colors.teal} style={{ paddingVertical: 20 }} />
              ) : clinicians.isError ? (
                <View style={styles.error}>
                  <WifiOff size={18} color={colors.amberText} />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold" size={14} color={colors.amberText}>
                      Can&apos;t reach the BloodLine server
                    </T>
                    <T size={12} color={colors.amberText} style={{ marginTop: 2 }}>
                      Check the server address below. With the tunnel running, paste its https address.
                    </T>
                  </View>
                </View>
              ) : (
                clinicians.data?.map((c, i) => (
                  <Animated.View key={c.id} entering={FadeInUp.delay(260 + i * 70).springify().damping(18)}>
                    <PressableScale onPress={() => choose(c.id)} style={styles.gpRow}>
                      <View style={styles.avatar}>
                        <T weight="semibold" size={15} color={colors.tealDeep}>
                          {c.name.replace("Dr ", "").split(" ").map((p) => p[0]).join("")}
                        </T>
                      </View>
                      <View style={{ flex: 1 }}>
                        <T weight="semibold" size={16}>
                          {c.name}
                        </T>
                        <T size={13} color={colors.textMuted}>
                          {c.unseen ? `${c.unseen} result${c.unseen === 1 ? "" : "s"} to review` : "No results waiting"}
                          {c.away ? " · away" : ""}
                        </T>
                      </View>
                      <ChevronRight size={20} color={colors.textFaint} />
                    </PressableScale>
                  </Animated.View>
                ))
              )}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(360).springify().damping(18)}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Server size={16} color={colors.textMuted} />
                <T weight="semibold" size={14}>
                  Server
                </T>
              </View>
              {editing ? (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://your-tunnel.trycloudflare.com"
                    placeholderTextColor={colors.textFaint}
                    style={styles.input}
                  />
                  <Button
                    label="Save and connect"
                    onPress={async () => {
                      await setServerUrl(draft);
                      setEditing(false);
                    }}
                  />
                </>
              ) : (
                <PressableScale
                  onPress={() => {
                    setDraft(serverUrl);
                    setEditing(true);
                  }}
                >
                  <T size={13} color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
                    {serverUrl} · tap to change
                  </T>
                </PressableScale>
              )}
            </Card>
          </Animated.View>

          <T size={12} color={colors.textFaint} style={{ textAlign: "center", marginTop: 4, marginBottom: insets.bottom + 16 }}>
            Synthetic data · not for clinical use
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingBottom: 64, gap: 20 },
  logoWrap: { width: 76, height: 76, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: 16, marginTop: -40, gap: 14 },
  gpRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  error: { flexDirection: "row", gap: 10, backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14, color: colors.text, backgroundColor: colors.background },
});
