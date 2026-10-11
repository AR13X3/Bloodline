import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Server, WifiOff } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApi } from "@/api";
import { Logo } from "@/components/logo";
import { ArrowCircle, Avatar, Button, Card, PressableScale, STROKE, T, Title } from "@/components/ui";
import { fade, rise, stagger } from "@/motion";
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24, gap: 28 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={rise()} style={styles.brand}>
          <Logo size={34} />
          <T weight="semibold" size={22} color={colors.ink}>
            BloodLine
          </T>
        </Animated.View>

        <Animated.View entering={rise(stagger(1))}>
          <Title light="Who's" strong="signing in?" size={34} />
        </Animated.View>

        <Animated.View entering={rise(stagger(2))} style={{ gap: 12 }}>
          {clinicians.isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: 24 }} />
          ) : clinicians.isError ? (
            <View style={styles.error}>
              <View style={styles.errorIcon}>
                <WifiOff size={20} color={colors.amberText} strokeWidth={STROKE} />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="medium" size={15} color={colors.amberText}>
                  Can&apos;t reach the BloodLine server
                </T>
                <T size={13} color={colors.amberText} style={{ marginTop: 2 }}>
                  Check the server address below. With the tunnel running, paste its https address.
                </T>
              </View>
            </View>
          ) : (
            clinicians.data?.map((c) => (
              <Animated.View key={c.id} entering={fade()}>
                <PressableScale onPress={() => choose(c.id)} style={styles.gpRow}>
                  <Avatar name={c.name} size={52} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="medium" size={17}>
                      {c.name}
                    </T>
                    <T size={13} color={colors.textMuted}>
                      {c.unseen ? `${c.unseen} result${c.unseen === 1 ? "" : "s"} to review` : "No results waiting"}
                      {c.away ? " · away" : ""}
                    </T>
                  </View>
                  <ArrowCircle />
                </PressableScale>
              </Animated.View>
            ))
          )}
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={rise(stagger(3))}>
          <Card style={{ gap: 14 }}>
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
                style={styles.server}
              >
                <View style={styles.serverIcon}>
                  <Server size={18} color={colors.textMuted} strokeWidth={STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <T weight="medium" size={15}>
                    Server
                  </T>
                  <T size={13} color={colors.textMuted} numberOfLines={1}>
                    {serverUrl}
                  </T>
                </View>
                <T weight="medium" size={14} color={colors.accent}>
                  Change
                </T>
              </PressableScale>
            )}
          </Card>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  gpRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.card },
  error: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.amberSoft, borderRadius: radius.lg, padding: 16 },
  errorIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  server: { flexDirection: "row", alignItems: "center", gap: 12 },
  serverIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mist, alignItems: "center", justifyContent: "center" },
  input: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text, backgroundColor: colors.mist },
});
