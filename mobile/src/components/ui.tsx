import { ArrowUpRight, CircleHelp, Flag, ListChecks, MoveVertical, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { DURATION, timing } from "@/motion";
import { colors, fonts, radius } from "@/theme";
import type { AlertReason } from "@/types";

type Weight = "light" | "regular" | "medium" | "semibold" | "bold";

/** Icons are drawn with a thin line throughout. */
export const STROKE = 1.75;

export function T({ weight = "regular", size = 15, color = colors.text, style, ...props }: TextProps & { weight?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[{ fontFamily: fonts[weight], fontSize: size, color, letterSpacing: size >= 26 ? -0.6 : size >= 18 ? -0.2 : 0 }, style]} />;
}

/** A large title, optionally split over two weights: a light first line and a strong second line. */
export function Title({ light, strong, size = 32 }: { light?: string; strong: string; size?: number }) {
  const lineHeight = Math.round(size * 1.15);
  return (
    <View>
      {light ? (
        <T weight="light" size={size} style={{ lineHeight }}>
          {light}
        </T>
      ) : null}
      <T weight="semibold" size={size} style={{ lineHeight }}>
        {strong}
      </T>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PressableScale({ children, onPress, disabled, style, label }: { children: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; label?: string }) {
  // With reduced motion on, dim instead of shrinking.
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => (reduced ? { opacity: 1 - 0.15 * pressed.value } : { transform: [{ scale: 1 - 0.02 * pressed.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      style={disabled && { opacity: 0.45 }}
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
  variant?: "primary" | "secondary" | "soft" | "ghost";
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.ink, fg: colors.white },
    secondary: { bg: colors.white, fg: colors.ink },
    soft: { bg: colors.sky, fg: colors.ink },
    ghost: { bg: "transparent", fg: colors.ink },
  }[variant];
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} style={[styles.button, { backgroundColor: palette.bg }, style]}>
      {loading ? <ActivityIndicator color={palette.fg} /> : Icon ? <Icon size={19} color={palette.fg} strokeWidth={STROKE} /> : null}
      <T weight="medium" size={16} color={palette.fg}>
        {label}
      </T>
    </PressableScale>
  );
}

/** A round icon button, like the back and action buttons at the top of a screen. */
export function IconButton({ icon: Icon, onPress, label, tone = "white", size = 46 }: { icon: LucideIcon; onPress?: () => void; label: string; tone?: "white" | "mist"; size?: number }) {
  return (
    <PressableScale onPress={onPress} label={label} style={[styles.round, { width: size, height: size, backgroundColor: tone === "white" ? colors.white : colors.mist }]}>
      <Icon size={20} color={colors.ink} strokeWidth={STROKE} />
    </PressableScale>
  );
}

/** The round arrow in the corner of a tappable card. Decorative: the card itself is the button. */
export function ArrowCircle({ tone = "mist", size = 40 }: { tone?: "mist" | "sky" | "ink"; size?: number }) {
  const [bg, fg] = { mist: [colors.mist, colors.ink], sky: [colors.sky, colors.ink], ink: [colors.ink, colors.white] }[tone];
  return (
    <View style={[styles.round, { width: size, height: size, backgroundColor: bg }]}>
      <ArrowUpRight size={18} color={fg} strokeWidth={STROKE} />
    </View>
  );
}

export function Avatar({ name, size = 46, tone = "sky" }: { name: string; size?: number; tone?: "sky" | "mist" }) {
  const initials = name
    .replace(/^Dr\.?\s+/, "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <View style={[styles.round, { width: size, height: size, backgroundColor: tone === "sky" ? colors.sky : colors.mist }]}>
      <T weight="semibold" size={Math.round(size * 0.34)} color={colors.ink}>
        {initials}
      </T>
    </View>
  );
}

export function Chip({ label, icon: Icon, bg = colors.mist, fg = colors.ink }: { label: string; icon?: LucideIcon; bg?: string; fg?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {Icon ? <Icon size={13} color={fg} strokeWidth={STROKE} /> : null}
      <T weight="medium" size={12} color={fg}>
        {label}
      </T>
    </View>
  );
}

const REASONS: Record<AlertReason, { label: string; icon: LucideIcon; bg: string; fg: string }> = {
  lab_flag: { label: "Lab flag", icon: Flag, bg: colors.mist, fg: colors.ink },
  outside_range: { label: "Outside range", icon: MoveVertical, bg: colors.amberSoft, fg: colors.amberText },
  gp_rule: { label: "Your rule", icon: ListChecks, bg: colors.sky, fg: colors.ink },
  couldnt_check: { label: "Couldn't check", icon: CircleHelp, bg: colors.amberSoft, fg: colors.amberText },
};

export function ReasonChip({ reason }: { reason: AlertReason }) {
  const r = REASONS[reason];
  return <Chip label={r.label} icon={r.icon} bg={r.bg} fg={r.fg} />;
}

/** A row of option tiles; the chosen one is filled with the sky accent. */
export function Segmented<V extends string | number>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <T weight={active ? "semibold" : "regular"} size={15} color={active ? colors.ink : colors.textMuted}>
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
    <T size={14} color={colors.textMuted} style={{ marginBottom: 10, marginLeft: 4 }}>
      {children}
    </T>
  );
}

/** Three key figures side by side, each an icon over a coloured value and a muted label. */
export function StatRow({ items }: { items: { icon: LucideIcon; value: string; label: string; color?: string }[] }) {
  return (
    <View style={styles.statRow}>
      {items.map((it) => (
        <View key={it.label} style={styles.stat}>
          <it.icon size={22} color={colors.ink} strokeWidth={1.5} />
          <View style={{ flexShrink: 1 }}>
            <T weight="semibold" size={16} color={it.color ?? colors.accent} numberOfLines={1}>
              {it.value}
            </T>
            <T size={12} color={colors.textMuted} numberOfLines={1}>
              {it.label}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

const RULER_W = 300;
const RULER_PAD = 10;
const TICKS = 33;

/** Where the value sits relative to the range printed on the report, drawn as a ruler of ticks. */
export function RangeBar({ value, low, high, position }: { value: number; low: number | null; high: number | null; position: "below" | "inside" | "above" | null }) {
  const lo = low ?? (high !== null ? Math.min(value, high) * 0.5 : value * 0.5);
  const hi = high ?? (low !== null ? Math.max(value, low) * 1.6 : value * 1.5);
  const min = Math.min(lo, value) - (hi - lo) * 0.35;
  const max = Math.max(hi, value) + (hi - lo) * 0.35;
  const x = (v: number) => RULER_PAD + ((v - min) / (max - min)) * (RULER_W - RULER_PAD * 2);
  const outside = position === "below" || position === "above";
  const marker = outside ? colors.amber : colors.ink;
  return (
    <View>
      <Svg width="100%" height={50} viewBox={`0 0 ${RULER_W} 50`}>
        <Rect x={x(lo)} y={2} width={Math.max(6, x(hi) - x(lo))} height={5} rx={2.5} fill={colors.skyDeep} />
        {Array.from({ length: TICKS }, (_, i) => {
          const tx = RULER_PAD + (i / (TICKS - 1)) * (RULER_W - RULER_PAD * 2);
          const inRange = tx >= x(lo) && tx <= x(hi);
          return <Line key={i} x1={tx} x2={tx} y1={i % 4 === 0 ? 20 : 27} y2={42} stroke={inRange ? colors.accent : colors.textFaint} strokeWidth={1.5} strokeLinecap="round" />;
        })}
        <Line x1={x(value)} x2={x(value)} y1={16} y2={47} stroke={marker} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={x(value)} cy={16} r={5.5} fill={marker} stroke={colors.white} strokeWidth={2} />
      </Svg>
      <View style={{ height: 18 }}>
        {low !== null ? <RulerLabel at={x(lo) / RULER_W} text={String(low)} /> : null}
        {high !== null ? <RulerLabel at={x(hi) / RULER_W} text={String(high)} /> : null}
      </View>
    </View>
  );
}

function RulerLabel({ at, text }: { at: number; text: string }) {
  return (
    <T size={12} color={colors.textMuted} style={[styles.rulerLabel, { left: `${at * 100}%` }]}>
      {text}
    </T>
  );
}

export function Sparkline({ points, width = 300, height = 76 }: { points: { value: number; labFlagged: boolean; isThis: boolean }[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const px = (i: number) => 14 + (i / (points.length - 1)) * (width - 28);
  const py = (v: number) => 12 + (1 - (v - min) / span) * (height - 24);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${px(points.length - 1).toFixed(1)},${height} L${px(0).toFixed(1)},${height} Z`;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={area} fill={colors.sky} opacity={0.55} />
      <Path d={d} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={px(i)}
          cy={py(p.value)}
          r={p.isThis ? 6 : 4}
          fill={p.isThis ? (p.labFlagged ? colors.amber : colors.ink) : colors.white}
          stroke={p.isThis ? colors.white : p.labFlagged ? colors.amber : colors.accent}
          strokeWidth={2}
        />
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
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18 },
  button: { height: 58, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 22 },
  round: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  segmented: { flexDirection: "row", gap: 10 },
  segment: { flex: 1, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  segmentActive: { backgroundColor: colors.sky, borderColor: colors.sky },
  statRow: { flexDirection: "row", gap: 8, backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 14 },
  // Columns start at their content's width and share what's left, so a long range isn't cut off.
  stat: { flexGrow: 1, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  rulerLabel: { position: "absolute", width: 56, marginLeft: -28, textAlign: "center" },
});
