import { Text, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme";

// Laundry Point mark: a location pin whose window is a washing-machine drum half full of water.
export function LogoMark({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id="g" x1="8" y1="3" x2="40" y2="45" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#2F6BFF" />
          <Stop offset="1" stopColor="#12C2B5" />
        </LinearGradient>
        <ClipPath id="c"><Circle cx="24" cy="19.5" r="7.2" /></ClipPath>
      </Defs>
      <Path d="M24 2.5C14.4 2.5 6.5 10.2 6.5 19.7c0 11.9 14.7 24.1 16.7 25.7.5.4 1.1.4 1.6 0 2-1.6 16.7-13.8 16.7-25.7C41.5 10.2 33.6 2.5 24 2.5Z" fill="url(#g)" />
      <Circle cx="24" cy="19.5" r="10.6" fill="#fff" />
      <Circle cx="24" cy="19.5" r="7.2" fill="#EAF2FF" />
      <G clipPath="url(#c)"><Path d="M14 19.4c2.4-2.3 4.4-2.3 6.8 0s4.4 2.3 6.8 0 4.4-2.3 6.4 0V28H14Z" fill="url(#g)" /></G>
      <Circle cx="20.6" cy="16.6" r="1.1" fill="#fff" fillOpacity={0.9} />
      <Circle cx="27.4" cy="22.8" r="0.8" fill="#fff" fillOpacity={0.9} />
    </Svg>
  );
}

export default function Logo({ size = 40, light }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      <Text style={{ fontSize: size * 0.55, fontWeight: "800", color: light ? "#fff" : colors.ink, letterSpacing: -0.5 }}>
        Laundry<Text style={{ color: light ? "#9FE8E0" : colors.brand }}> Point</Text>
      </Text>
    </View>
  );
}
