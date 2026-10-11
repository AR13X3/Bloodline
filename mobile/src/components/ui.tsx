import { CircleHelp, Flag, ListChecks, MoveVertical, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { DURATION, timing } from "@/motion";
import { colors, fonts, radius, shadow } from "@/theme";
import type { AlertReason } from "@/types";

type Weight = "regular" | "medium" | "semibold" | "bold";

export function T({ weight = "regular", size = 15, color = colors.text, style, ...props }: TextProps & { weight?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[{ fontFamily: fonts[weight], fontSize: size, color, letterSpacing: size >= 22 ? -0.4 : 0 }, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PressableScale({ children, onPress, disabled, style }: { children: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  // With reduced motion on, dim instead of shrinking.
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => (reduced ? { opacity: 1 - 0.15 * pressed.value } : { transform: [{ scale: 1 - 0.02 * pressed.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={disabled && { opacity: 0.5 }}
      onPressIn={() => (pressed.value = withTiming(1, timing(DURATION.press)))}
      onPressOut={() => (pressed.value = withTiming(0, timing(DURATION.press)))}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.navy, fg: colors.white, border: colors.navy },
    secondary: { bg: colors.white, fg: colors.navy, border: colors.border },
    ghost: { bg: "transparent", fg: colors.tealDeep, border: "transparent" },
    danger: { bg: colors.redSoft, fg: colors.red, border: colors.redSoft },
  }[variant];
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} style={[styles.button, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      {loading ? <ActivityIndicator color={palette.fg} /> : Icon ? <Icon size={18} color={palette.fg} /> : null}
      <T weight="semibold" size={15} color={palette.fg}>
        {label}
      </T>
    </PressableScale>
  );
}

const REASONS: Record<AlertReason, { label: string; icon: LucideIcon; bg: string; fg: string }> = {
  lab_flag: { label: "Lab flag", icon: Flag, bg: colors.navySoft, fg: colors.navy },
  outside_range: { label: "Outside range", icon: MoveVertical, bg: colors.amberSoft, fg: colors.amberText },
  gp_rule: { label: "Your rule", icon: ListChecks, bg: colors.tealSoft, fg: colors.tealDeep },
  couldnt_check: { label: "Couldn't check", icon: CircleHelp, bg: colors.amberSoft, fg: colors.amberText },
};

export function reasonAccent(reasons: AlertReason[]): string {
  if (reasons.includes("couldnt_check") || reasons.includes("outside_range")) return colors.amber;
  if (reasons.includes("gp_rule")) return colors.teal;
  return colors.navy;
}

export function ReasonChip({ reason }: { reason: AlertReason }) {
  const r = REASONS[reason];
  const Icon = r.icon;
  return (
    <View style={[styles.chip, { backgroundColor: r.bg }]}>
      <Icon size={12} color={r.fg} />
      <T weight="medium" size={12} color={r.fg}>
        {r.label}
      </T>
    </View>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <T weight={active ? "semibold" : "medium"} size={14} color={active ? colors.navy : colors.textMuted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <T weight="semibold" size={12} color={colors.textMuted} style={{ textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
      {children}
    </T>
  );
}

/** Where the value sits relative to the range printed on the report. */
export function RangeBar({ value, low, high, position }: { value: number; low: number | null; high: number | null; position: "below" | "inside" | "above" | null }) {
  const lo = low ?? (high !== null ? Math.min(value, high) * 0.5 : value * 0.5);
  const hi = high ?? (low !== null ? Math.max(value, low) * 1.6 : value * 1.5);
  const min = Math.min(lo, value) - (hi - lo) * 0.35;
  const max = Math.max(hi, value) + (hi - lo) * 0.35;
  const x = (v: number) => 12 + ((v - min) / (max - min)) * 276;
  const outside = position === "below" || position === "above";
  return (
    <Svg width="100%" height={46} viewBox="0 0 300 46">
      <Rect x={12} y={20} width={276} height={8} rx={4} fill={colors.border} />
      <Rect x={x(lo)} y={20} width={Math.max(4, x(hi) - x(lo))} height={8} rx={4} fill={colors.tealSoft} stroke={colors.teal} strokeWidth={1} />
      <Line x1={x(value)} y1={10} x2={x(value)} y2={38} stroke={outside ? colors.amber : colors.teal} strokeWidth={2} />
      <Circle cx={x(value)} cy={24} r={8} fill={outside ? colors.amber : colors.teal} stroke={colors.white} strokeWidth={3} />
    </Svg>
  );
}

export function Sparkline({ points, width = 300, height = 70 }: { points: { value: number; labFlagged: boolean; isThis: boolean }[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const px = (i: number) => 14 + (i / (points.length - 1)) * (width - 28);
  const py = (v: number) => 12 + (1 - (v - min) / span) * (height - 24);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(" ");
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={d} stroke={colors.teal} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={px(i)} cy={py(p.value)} r={p.isThis ? 6 : 4} fill={p.isThis ? (p.labFlagged ? colors.amber : colors.navy) : colors.white} stroke={p.labFlagged ? colors.amber : colors.teal} strokeWidth={2} />
      ))}
    </Svg>
  );
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function maskEmail(email: string | null): string {
  if (!email) return "Not set";
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}•••@${domain}` : "•••";
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "Not set";
  return phone.length > 6 ? `${phone.slice(0, 3)} ••• ••• ${phone.slice(-3)}` : "•••";
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow },
  button: { height: 52, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, paddingHorizontal: 18 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  segmented: { flexDirection: "row", backgroundColor: colors.navySoft, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.white, ...shadow, elevation: 1 },
});
