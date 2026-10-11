// BloodLine design tokens: soft cool greys, one deep teal ink and a pale sky accent.
const palette = {
  background: "#F1F4F6",
  card: "#FFFFFF",
  // Brand ink: primary actions, featured tiles and headings.
  ink: "#0F3B4B",
  // Quiet fills: icon circles, chips and tracks.
  mist: "#E8EEF1",
  // The soft panel behind a screen's hero area.
  panel: "#DCE9EE",
  // Selected states and soft highlights.
  sky: "#D4E8EF",
  skyDeep: "#8EC4D4",
  // Numbers and icons that need a touch of colour.
  accent: "#2E869E",
  // Amber means "needs review" and nothing else.
  amber: "#E0A23F",
  amberSoft: "#FBF1DF",
  amberText: "#7D5414",
  // Red is for system failures only.
  red: "#C24E46",
  redSoft: "#F8E6E4",
  green: "#2C8A68",
  greenSoft: "#E2F2EB",
  text: "#123441",
  textMuted: "#6D818B",
  textFaint: "#A2B1B8",
  border: "#E2E9ED",
  white: "#FFFFFF",
};

export const colors = palette;

export const fonts = {
  light: "Urbanist_300Light",
  regular: "Urbanist_400Regular",
  medium: "Urbanist_500Medium",
  semibold: "Urbanist_600SemiBold",
  bold: "Urbanist_700Bold",
};

export const radius = { sm: 14, md: 20, lg: 26, xl: 34, pill: 999 };

// Cards sit flat on the grey background; only floating things get a soft lift.
export const shadow = {
  shadowColor: "#0F3B4B",
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 0,
};

export const lift = { ...shadow, shadowOpacity: 0.12, elevation: 6 };
