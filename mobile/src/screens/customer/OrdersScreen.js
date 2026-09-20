import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api, { errMsg } from "../../api";
import { useAuth } from "../../AuthContext";
import { getSocket } from "../../socket";
import { Alert, Button, Card, H1, Muted, StatusChip } from "../../components/ui";
import { colors, itemsSummary, LIVE_STATUSES, money, shortDate } from "../../theme";

export default function OrdersScreen({ navigation }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/orders/my");
      setOrders(data);
      setError("");
    } catch (e) {
      setError(errMsg(e, "Couldn't load your orders."));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // pushed status changes
  useEffect(() => {
    const s = getSocket(token);
    s?.on("order:update", load);
    return () => s?.off("order:update", load);
  }, [token, load]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={orders || []}
        keyExtractor={(o) => o._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <H1>My orders</H1>
            {error ? <View style={{ marginTop: 12 }}><Alert>{error}</Alert></View> : null}
          </View>
        }
        ListEmptyComponent={
          orders ? (
            <Card style={{ alignItems: "center", padding: 28 }}>
              <Ionicons name="bag-handle-outline" size={40} color={colors.brand} />
              <Text style={{ fontWeight: "800", fontSize: 17, color: colors.ink, marginTop: 10 }}>No orders yet</Text>
              <Muted style={{ textAlign: "center", marginVertical: 8 }}>Book a pickup and watch your partner arrive live.</Muted>
              <Button title="Book a pickup" onPress={() => navigation.navigate("Book")} />
            </Card>
          ) : null
        }
        renderItem={({ item: o }) => (
          <Pressable onPress={() => navigation.navigate("Tracking", { id: o._id })}>
            <Card style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Muted>{o.orderNumber}</Muted>
                  <Text numberOfLines={1} style={{ fontWeight: "700", color: colors.ink, marginTop: 2 }}>{itemsSummary(o.items)}</Text>
                  <Muted style={{ marginTop: 2 }}>{o.pickupType === "express" ? `Express · ${shortDate(o.createdAt)}` : `${shortDate(o.pickupDate)} · ${o.pickupSlot}`}</Muted>
                </View>
                <StatusChip status={o.status} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
                <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 13, paddingRight: 10 }}>{o.pickupAddress}</Text>
                <Text style={{ fontWeight: "800", color: colors.ink }}>{money(o.totalAmount)}</Text>
              </View>
              {LIVE_STATUSES.includes(o.status) && <Text style={{ color: colors.brandDark, fontWeight: "700", marginTop: 8 }}>● Track live on map ›</Text>}
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
