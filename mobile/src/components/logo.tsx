import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

export function Logo({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="drop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={light ? "#FFFFFF" : "#18B3AA"} />
          <Stop offset="1" stopColor={light ? "#CFEFEA" : "#13294B"} />
        </LinearGradient>
      </Defs>
      <Path d="M16 2.5c5.6 6.8 10 12 10 17.2A10 10 0 0 1 6 19.7C6 14.5 10.4 9.3 16 2.5Z" fill="url(#drop)" />
      <Path d="M8.5 20h4l1.6-3.6 2.6 7 2-5 1.2 1.6h3.6" fill="none" stroke={light ? "#13294B" : "#FFFFFF"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
