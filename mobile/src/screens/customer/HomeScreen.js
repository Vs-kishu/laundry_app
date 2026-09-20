import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api";
import { useAuth } from "../../AuthContext";
import { Gradient } from "../../components/Gradient";
import { Button, Card, H2, Muted, StatusChip } from "../../components/ui";
import { ACTIVE_STATUSES, colors, itemsSummary, money } from "../../theme";

const ICON = { wash_fold: "water", wash_iron: "shirt", dry_clean: "sparkles", iron_only: "flame" };
const STEPS = [
  ["location", "Drop a pin", "Choose items and pin your address."],
  ["bicycle", "Partner arrives", "Track them live on the map."],
  ["key", "Share the OTP", "Hand over securely."],
  ["water", "Cleaned at our store", "Washed, pressed and packed."],
  ["home", "Delivered live", "Tracked back to your door."],
];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [active, setActive] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, o] = await Promise.allSettled([api.get("/services"), api.get("/orders/my")]);
    if (s.status === "fulfilled") setServices(s.value.data);
    if (o.status === "fulfilled") setActive(o.value.data.filter((x) => ACTIVE_STATUSES.includes(x.status)));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <Gradient style={{ flex: 0, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <SafeAreaView edges={["top"]}>
            <View style={{ padding: 20, paddingBottom: 28 }}>
              <Text style={{ color: "#BFD3FF", fontWeight: "600" }}>Hi, {user.name.split(" ")[0]} 👋</Text>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 6, letterSpacing: -0.6 }}>
                Laundry picked up in minutes. Tracked live.
              </Text>
              <View style={{ flexDirection: "row", marginTop: 18 }}>
                <Button title="Book a pickup" icon="flash" variant="secondary" onPress={() => navigation.navigate("Book")} />
              </View>
            </View>
          </SafeAreaView>
        </Gradient>

        <View style={{ padding: 16 }}>
          {active.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <H2 style={{ marginBottom: 10 }}>In progress</H2>
              {active.map((o) => (
                <Pressable key={o._id} onPress={() => navigation.navigate("Tracking", { id: o._id })}>
                  <Card style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Muted>{o.orderNumber}</Muted>
                        <Text numberOfLines={1} style={{ fontWeight: "700", color: colors.ink, marginTop: 2 }}>{itemsSummary(o.items)}</Text>
                      </View>
                      <StatusChip status={o.status} />
                    </View>
                    <Text style={{ color: colors.brandDark, fontWeight: "700", marginTop: 10 }}>Track live on map ›</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}

          <H2 style={{ marginBottom: 10 }}>How it works</H2>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {STEPS.map(([icon, t, d], i) => (
              <Card key={t} style={{ width: 150 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={icon} size={19} color="#fff" />
                </View>
                <Text style={{ fontWeight: "800", color: colors.ink, marginTop: 10 }}>{i + 1}. {t}</Text>
                <Muted>{d}</Muted>
              </Card>
            ))}
          </ScrollView>

          <H2 style={{ marginTop: 22, marginBottom: 10 }}>Services & pricing</H2>
          {services.map((s) => (
            <Card key={s._id} style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={ICON[s.category] || "shirt"} size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.ink }}>{s.name}</Text>
                <Muted>{s.description}</Muted>
              </View>
              <Text style={{ fontWeight: "800", color: colors.ink }}>{money(s.pricePerUnit)}<Text style={{ fontWeight: "500", color: colors.muted }}>/{s.unit}</Text></Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
