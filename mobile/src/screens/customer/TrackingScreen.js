import { useMemo, useState } from "react";
import { Alert as NativeAlert, Linking, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api, { errMsg } from "../../api";
import { useOrderTracking, useRoute, useStoreConfig } from "../../hooks";
import LeafletMap from "../../components/LeafletMap";
import { Gradient } from "../../components/Gradient";
import { Alert, Button, Card, H2, Loader, Muted } from "../../components/ui";
import { colors, headlineFor, LIVE_STATUSES, money, STATUS_META, TIMELINE_STEPS, timeOnly } from "../../theme";

function OtpCard({ label, code, who }) {
  return (
    <Card style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: "#FFF1CC", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="key" size={20} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" }}>{label}</Text>
        <Muted>Tell it to {who} in person only.</Muted>
      </View>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {code.split("").map((d, i) => (
          <View key={i} style={{ width: 30, height: 40, borderRadius: 10, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>{d}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Timeline({ order }) {
  const reached = new Map((order.timeline || []).map((t) => [t.status, t.at]));
  const idx = TIMELINE_STEPS.indexOf(order.status);
  return (
    <View>
      {TIMELINE_STEPS.map((step, i) => {
        const done = reached.has(step) && (i < idx || order.status === "delivered");
        const current = i === idx && order.status !== "delivered";
        return (
          <View key={step} style={{ flexDirection: "row", gap: 12, minHeight: 44 }}>
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: done || current ? colors.brand : colors.line, backgroundColor: done ? colors.brand : colors.surface, alignItems: "center", justifyContent: "center" }}>
                {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : current ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
              </View>
              {i < TIMELINE_STEPS.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: done ? colors.brand : colors.line }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 10 }}>
              <Text style={{ fontWeight: "700", color: done || current ? colors.ink : colors.muted }}>{STATUS_META[step].label}</Text>
              {reached.has(step) && <Muted>{timeOnly(reached.get(step))}</Muted>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function TrackingScreen({ route: nav }) {
  const id = nav.params.id;
  const { order, live, error, connected, reload } = useOrderTracking(id);
  const config = useStoreConfig();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const isLive = order && LIVE_STATUSES.includes(order.status);
  const customerPt = order?.pickupLocation;
  const storePt = config?.store?.location;
  const destination = order?.destination === "store" ? storePt : order?.destination === "customer" ? customerPt : null;
  const partnerPt = isLive && live?.lat != null ? { lat: live.lat, lng: live.lng } : null;
  const road = useRoute(partnerPt, destination);

  const markers = useMemo(() => {
    if (!order) return [];
    const m = [];
    if (customerPt) m.push({ id: "home", kind: "home", lat: customerPt.lat, lng: customerPt.lng });
    if (storePt) m.push({ id: "store", kind: "store", lat: storePt.lat, lng: storePt.lng });
    if (partnerPt) m.push({ id: "rider", kind: "rider", lat: partnerPt.lat, lng: partnerPt.lng });
    return m;
  }, [order?._id, customerPt?.lat, storePt?.lat, partnerPt?.lat, partnerPt?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () =>
    NativeAlert.alert("Cancel this order?", "This can't be undone.", [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setActionError("");
          try {
            await api.put(`/orders/${id}/cancel`);
            await reload();
          } catch (e) {
            setActionError(errMsg(e));
          }
          setBusy(false);
        },
      },
    ]);

  if (error && !order) return <View style={{ padding: 20 }}><Alert>{error}</Alert></View>;
  if (!order) return <Loader />;

  const h = headlineFor(order, live);
  const eta = isLive && live?.etaMinutes;
  const canCancel = ["placed", "pickup_assigned"].includes(order.status);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Gradient style={{ flex: 0, borderRadius: 28, padding: 20, marginBottom: 14, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#BFD3FF", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>{order.orderNumber}</Text>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 6 }}>{h.title}</Text>
            <Text style={{ color: "#D5E2FF", marginTop: 6 }}>{h.sub}</Text>
          </View>
          {eta ? (
            <View style={{ backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", alignSelf: "flex-start" }}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.navy }}>{eta}</Text>
              <Text style={{ fontSize: 10, fontWeight: "800", color: colors.navy }}>MIN</Text>
            </View>
          ) : null}
        </View>
        {isLive && (
          <Text style={{ color: "#D5E2FF", fontSize: 12, marginTop: 14 }}>
            {connected ? "● Live updates on" : "○ Reconnecting…"}
            {live?.distanceKm != null ? `  ·  ${live.distanceKm} km away` : ""}
          </Text>
        )}
      </Gradient>

      {order.status !== "cancelled" && (
        <LeafletMap style={{ height: 300, marginBottom: 14 }} markers={markers} route={partnerPt ? road : null} fitKey={`${order.status}|${partnerPt ? "live" : "wait"}|${road ? "r" : ""}`} />
      )}

      {order.otp?.pickup ? <OtpCard label="Pickup OTP" code={order.otp.pickup} who="your pickup partner" /> : null}
      {order.otp?.delivery ? <OtpCard label="Delivery OTP" code={order.otp.delivery} who="your delivery partner" /> : null}

      {order.partner && (
        <Card style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{order.partner.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: colors.ink }}>{order.partner.name}</Text>
            <Muted>{order.leg === "pickup" ? "Pickup" : "Delivery"} partner · {order.partner.vehicleType} {order.partner.vehicleNumber || ""}</Muted>
          </View>
          <Button title="Call" icon="call" small variant="secondary" onPress={() => Linking.openURL(`tel:${order.partner.phone}`)} />
        </Card>
      )}

      <Card style={{ marginBottom: 12 }}>
        <H2 style={{ marginBottom: 12 }}>Progress</H2>
        {order.status === "cancelled" ? <Alert tone="warn">This order was cancelled.</Alert> : <Timeline order={order} />}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <H2 style={{ marginBottom: 10 }}>Order details</H2>
        {order.items.map((i) => (
          <View key={i.service} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Muted>{i.serviceName} × {i.quantity} {i.unit}</Muted>
            <Text style={{ fontWeight: "600", color: colors.ink }}>{money(i.subtotal)}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
          <Muted>Delivery</Muted><Text style={{ color: colors.ink }}>{order.deliveryFee ? money(order.deliveryFee) : "FREE"}</Text>
        </View>
        {order.expressFee > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}><Muted>Express pickup</Muted><Text style={{ color: colors.ink }}>{money(order.expressFee)}</Text></View>}
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 8 }}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>Total</Text>
          <Text style={{ fontWeight: "800", color: colors.ink }}>{money(order.totalAmount)}</Text>
        </View>
        <Muted style={{ marginTop: 4 }}>{order.paymentStatus === "paid" ? "Paid on delivery" : "Pay on delivery"}</Muted>
        <Muted style={{ marginTop: 12 }}>📍 {order.pickupAddress}</Muted>
        {order.notes ? <Muted style={{ marginTop: 6 }}>“{order.notes}”</Muted> : null}
      </Card>

      {canCancel && (
        <>
          {actionError ? <Alert>{actionError}</Alert> : null}
          <Button title="Cancel order" variant="danger" onPress={cancel} loading={busy} />
        </>
      )}
    </ScrollView>
  );
}
