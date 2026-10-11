import Svg, { Rect } from "react-native-svg";
import { colors } from "@/theme";

// The BloodLine heart: nine flat bars on a 4-unit pitch; the seventh is the green accent.
const BARS: [x: number, y: number, h: number][] = [
  [0, 10.5, 10.5], [4, 7, 18.5], [8, 4, 27], [12, 5.5, 30], [16, 9, 29.5],
  [20, 5.5, 30], [24, 4, 27], [28, 7, 18.5], [32, 10.5, 10.5],
];
const ACCENT = 6;

export function Logo({ size = 40, light = false }: { size?: number; light?: boolean }) {
  const bar = light ? colors.white : colors.ink;
  const accent = light ? "#56DB8B" : "#1E9E5E";
  return (
    <Svg width={size} height={size} viewBox="0 4 35 34.5">
      {BARS.map(([x, y, h], i) => (
        <Rect key={x} x={x} y={y} width={3} height={h} fill={i === ACCENT ? accent : bar} />
      ))}
    </Svg>
  );
}
