import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { Button, Card, H1, Muted } from "../components/ui";
import { API_URL } from "../config";
import { colors } from "../theme";

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const rows = [
    ["Name", user.name],
    ["Email", user.email],
    ["Mobile", user.phone],
    ...(user.role === "partner" ? [["Vehicle", `${user.partner?.vehicleType || ""} ${user.partner?.vehicleNumber || ""}`]] : []),
  ];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <H1 style={{ marginBottom: 16 }}>Account</H1>
      <Card style={{ marginBottom: 16 }}>
        <View style={{ alignItems: "center", marginBottom: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{user.name[0]}</Text>
          </View>
          <Text style={{ fontWeight: "800", fontSize: 18, color: colors.ink, marginTop: 8 }}>{user.name}</Text>
          <Muted style={{ textTransform: "capitalize" }}>{user.role}</Muted>
        </View>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Muted>{k}</Muted>
            <Text style={{ color: colors.ink, fontWeight: "600", textTransform: k === "Vehicle" ? "capitalize" : "none" }}>{v}</Text>
          </View>
        ))}
      </Card>
      <Button title="Log out" variant="danger" icon="log-out" onPress={logout} />
      <Muted style={{ textAlign: "center", marginTop: 20 }}>Server: {API_URL}</Muted>
    </SafeAreaView>
  );
}
