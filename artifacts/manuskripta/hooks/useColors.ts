import colors from "@/constants/colors";

// Manuskripta is a dark-first app — always return dark palette
export function useColors() {
  const palette = (colors as Record<string, typeof colors.light>).dark ?? colors.light;
  return { ...palette, radius: colors.radius };
}
