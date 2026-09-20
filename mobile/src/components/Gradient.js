import { LinearGradient } from "expo-linear-gradient";

// Brand gradients: navy->blue->aqua (customer), navy (admin), teal (driver).
const PRESETS = {
  brand: ["#0B1B3A", "#1E4FD8", "#12C2B5"],
  driver: ["#062F33", "#0B6E6A", "#12A594"],
};

export function Gradient({ children, preset = "brand", style }) {
  return (
    <LinearGradient colors={PRESETS[preset]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ flex: 1 }, style]}>
      {children}
    </LinearGradient>
  );
}
