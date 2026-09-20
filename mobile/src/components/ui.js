import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, STATUS_META } from "../theme";

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, style, small }) {
  const v = {
    primary: { bg: colors.brand, fg: "#fff", border: colors.brand },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
    danger: { bg: "transparent", fg: colors.danger, border: "#F2B7BD" },
    dark: { bg: colors.navy, fg: "#fff", border: colors.navy },
    ghost: { bg: "transparent", fg: colors.brandDark, border: "transparent" },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, opacity: off ? 0.55 : pressed ? 0.85 : 1, minHeight: small ? 38 : 50, paddingHorizontal: small ? 16 : 22 },
        variant === "primary" && !off && shadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} />}
          <Text style={{ color: v.fg, fontWeight: "700", fontSize: small ? 13 : 15 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export const Card = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

export function Field({ label, style, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor="#9AA6C3" {...props} style={[styles.input, props.multiline && { minHeight: 70, textAlignVertical: "top" }, style]} />
    </View>
  );
}

export function StatusChip({ status }) {
  const m = STATUS_META[status] || { short: status, bg: colors.soft, fg: colors.ink };
  return (
    <View style={{ backgroundColor: m.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Text style={{ color: m.fg, fontSize: 12, fontWeight: "700" }}>{m.short}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.line,
        backgroundColor: active ? colors.brand : colors.surface,
        opacity: disabled ? 0.4 : 1,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? "#fff" : colors.ink, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Alert({ children, tone = "danger" }) {
  const t = {
    danger: { bg: "#FBE0E3", fg: colors.danger, icon: "alert-circle" },
    warn: { bg: "#FFF1CC", fg: colors.ink, icon: "warning" },
    success: { bg: "#D6F2E6", fg: colors.success, icon: "checkmark-circle" },
    info: { bg: "#DCE8FF", fg: colors.brandDark, icon: "information-circle" },
  }[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.md, padding: 12, flexDirection: "row", gap: 10, marginBottom: 12 }}>
      <Ionicons name={t.icon} size={18} color={t.fg} style={{ marginTop: 1 }} />
      <Text style={{ color: t.fg, flex: 1, fontSize: 13, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

export const H1 = ({ children, style }) => <Text style={[{ fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 }, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[{ fontSize: 17, fontWeight: "800", color: colors.ink }, style]}>{children}</Text>;
export const Muted = ({ children, style }) => <Text style={[{ color: colors.muted, fontSize: 13, lineHeight: 19 }, style]}>{children}</Text>;

export function Loader() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, ...shadow },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
});
