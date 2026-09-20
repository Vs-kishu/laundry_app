import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import api, { errMsg } from "../../api";
import { useAuth } from "../../AuthContext";
import { getSocket } from "../../socket";
import { useRoute, useStoreConfig } from "../../hooks";
import LeafletMap from "../../components/LeafletMap";
import { Gradient } from "../../components/Gradient";
import { Alert, Button, Card, H2, Muted, StatusChip } from "../../components/ui";
import { colors, money, radius, timeOnly } from "../../theme";

const NEXT = {
  pickup_assigned: { dest: "customer", label: "Picked up", needsOtp: true, hint: "Ask the customer for their 4-digit pickup OTP", go: "Navigate to customer" },
  picked_up: { dest: "store", label: "Reached store - handed over", needsOtp: false, hint: "Hand the clothes to store staff", go: "Navigate to store" },
  delivery_assigned: { dest: "store", label: "Collected - start delivery", needsOtp: false, hint: "Collect the clean clothes at the store", go: "Navigate to store" },
  out_for_delivery: { dest: "customer", label: "Delivered", needsOtp: true, hint: "Ask for the 4-digit delivery OTP and collect cash", go: "Navigate to customer" },
};

export default function DriverScreen() {
  const { user, token, refreshUser } = useAuth();
  const config = useStoreConfig();
  const approved = user.partner?.verificationStatus === "approved";

  const [online, setOnline] = useState(!!user.partner?.isOnline);
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState({ active: [], history: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [myPos, setMyPos] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [otp, setOtp] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!approved) return;
    try {
      const [a, m] = await Promise.all([api.get("/partner/tasks/available"), api.get("/partner/tasks/mine")]);
      setAvailable(a.data);
      setMine(m.data);
    } catch (e) {
      setError(errMsg(e, "Couldn't refresh tasks."));
    }
  }, [approved]);

  // tasks + live pushes
  useEffect(() => {
    if (!approved) return;
    loadTasks();
    const s = getSocket(token);
    s?.on("tasks:changed", loadTasks);
    s?.on("order:update", loadTasks);
    const poll = setInterval(loadTasks, 30000);
    return () => {
      clearInterval(poll);
      s?.off("tasks:changed", loadTasks);
      s?.off("order:update", loadTasks);
    };
  }, [approved, token, loadTasks]);

  // pending partners: poll for approval
  useEffect(() => {
    if (approved) return;
    const t = setInterval(() => refreshUser().catch(() => {}), 20000);
    return () => clearInterval(t);
  }, [approved, refreshUser]);

  useEffect(() => {
    if (!mine.active.find((t) => t._id === selectedId)) setSelectedId(mine.active[0]?._id || null);
  }, [mine.active, selectedId]);

  // GPS -> socket while online (foreground). Screen stays awake so the stream doesn't stop.
  useEffect(() => {
    if (!approved || !online) return;
    let sub;
    let cancelled = false;
    activateKeepAwakeAsync("driver-online").catch(() => {});
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return setGpsError("Location permission denied - allow it so customers can track you.");
      setGpsError("");
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading };
          setMyPos(p);
          getSocket(token)?.emit("partner:location", p);
        }
      );
      if (cancelled) sub.remove();
    })().catch(() => setGpsError("Can't get a GPS fix yet…"));
    return () => {
      cancelled = true;
      sub?.remove();
      deactivateKeepAwake("driver-online").catch(() => {});
    };
  }, [approved, online, token]);

  const selected = mine.active.find((t) => t._id === selectedId) || null;
  const action = selected ? NEXT[selected.status] : null;
  const storePt = config?.store?.location;
  const destination = selected && action ? (action.dest === "store" ? storePt : selected.pickupLocation) || null : null;
  const road = useRoute(myPos, destination);

  const markers = useMemo(() => {
    const m = [];
    if (storePt) m.push({ id: "store", kind: "store", lat: storePt.lat, lng: storePt.lng });
    if (selected?.pickupLocation) m.push({ id: "home", kind: "home", lat: selected.pickupLocation.lat, lng: selected.pickupLocation.lng });
    if (myPos) m.push({ id: "me", kind: "rider", lat: myPos.lat, lng: myPos.lng });
    return m;
  }, [storePt?.lat, storePt?.lng, selected?._id, myPos?.lat, myPos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (value) => {
    setError("");
    try {
      const { data } = await api.put("/partner/status", { online: value });
      setOnline(data.isOnline);
      if (!data.isOnline) setMyPos(null);
      await refreshUser();
      loadTasks();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const accept = async (t) => {
    setBusyId(t.orderId);
    setError("");
    try {
      const { data } = await api.post(`/partner/tasks/${t.orderId}/accept`, { leg: t.leg });
      setSelectedId(data._id);
    } catch (e) {
      setError(errMsg(e));
    }
    await loadTasks();
    setBusyId(null);
  };

  const advance = async () => {
    if (!selected || !action) return;
    if (action.needsOtp && !/^\d{4}$/.test(otp)) return setError("Enter the customer's 4-digit OTP.");
    setBusyId(selected._id);
    setError("");
    try {
      await api.post(`/partner/tasks/${selected._id}/advance`, action.needsOtp ? { otp } : {});
      setOtp("");
      await Promise.all([loadTasks(), refreshUser()]);
    } catch (e) {
      setError(errMsg(e));
    }
    setBusyId(null);
  };

  const status = user.partner?.verificationStatus;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadTasks(); await refreshUser().catch(() => {}); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Gradient preset="driver" style={{ flex: 0, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <SafeAreaView edges={["top"]}>
            <View style={{ padding: 20, paddingBottom: 24 }}>
              <Text style={{ color: "#BFF1EA", fontWeight: "700", fontSize: 12, letterSpacing: 1 }}>DRIVER APP</Text>
              <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 }}>Hi, {user.name.split(" ")[0]}</Text>
              <Text style={{ color: "#BFF1EA", textTransform: "capitalize" }}>{user.partner?.vehicleType} · {user.partner?.vehicleNumber}</Text>
              {approved && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,.15)", borderRadius: radius.pill, paddingVertical: 8, paddingLeft: 18, paddingRight: 10, marginTop: 16 }}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>{online ? "You're online" : "You're offline"}</Text>
                  <Switch value={online} onValueChange={toggle} trackColor={{ true: "#34D399", false: "#94A3B8" }} thumbColor="#fff" />
                </View>
              )}
            </View>
          </SafeAreaView>
        </Gradient>

        <View style={{ padding: 16 }}>
          {!approved && (
            <Card style={{ alignItems: "center", padding: 24 }}>
              <Ionicons name={status === "rejected" ? "alert-circle" : "shield-checkmark"} size={40} color={colors.teal} />
              <Text style={{ fontWeight: "800", fontSize: 18, color: colors.ink, marginTop: 10, textAlign: "center" }}>
                {status === "rejected" ? "Application not approved" : "Your application is under review"}
              </Text>
              <Muted style={{ textAlign: "center", marginVertical: 8 }}>
                {status === "rejected" ? "Please contact support to update your details." : "You can go online as soon as an admin approves you. Pull down to refresh."}
              </Muted>
              <Button title="Check status" variant="secondary" icon="refresh" onPress={() => refreshUser()} />
            </Card>
          )}

          {approved && (
            <>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                {[["Tasks done", user.partner.completedTasks], ["Earnings", money(user.partner.earnings)], ["Active", mine.active.length]].map(([k, v]) => (
                  <Card key={k} style={{ flex: 1, alignItems: "center", padding: 12 }}>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{v}</Text>
                    <Muted>{k}</Muted>
                  </Card>
                ))}
              </View>

              {error ? <Alert>{error}</Alert> : null}
              {online && gpsError ? <Alert tone="warn">{gpsError}</Alert> : null}

              {!online ? (
                <Card style={{ alignItems: "center", padding: 24 }}>
                  <Ionicons name="bicycle" size={40} color={colors.teal} />
                  <Text style={{ fontWeight: "800", fontSize: 17, color: colors.ink, marginTop: 8 }}>You're offline</Text>
                  <Muted style={{ textAlign: "center", marginTop: 4 }}>Go online to see nearby pickups and deliveries. Keep the app open so customers can track you.</Muted>
                </Card>
              ) : (
                <>
                  {mine.active.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {mine.active.map((t) => (
                        <Button key={t._id} title={t.orderNumber} small variant={t._id === selectedId ? "primary" : "secondary"} onPress={() => setSelectedId(t._id)} style={{ marginRight: 8 }} />
                      ))}
                    </ScrollView>
                  )}

                  <LeafletMap
                    style={{ height: selected ? 320 : 240, marginBottom: 14 }}
                    markers={markers}
                    route={myPos && selected ? road : null}
                    fitKey={`${selected?._id}|${selected?.status}|${myPos ? "gps" : "nogps"}|${road ? "r" : ""}`}
                  />

                  {selected && action && (
                    <Card style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <View style={{ flex: 1 }}>
                          <Muted>{selected.leg === "pickup" ? "PICKUP" : "DELIVERY"} · {selected.orderNumber}</Muted>
                          <Text style={{ fontSize: 19, fontWeight: "800", color: colors.ink, marginTop: 2 }}>{action.go}</Text>
                        </View>
                        <StatusChip status={selected.status} />
                      </View>
                      <Text style={{ color: colors.ink, marginTop: 12 }}>
                        📍 {action.dest === "store" ? `${config?.store?.name || "Store"} - ${config?.store?.address || ""}` : selected.pickupAddress}
                      </Text>
                      {selected.customer && (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                          <Muted>{selected.customer.name}</Muted>
                          <Button title={selected.customer.phone} icon="call" small variant="secondary" onPress={() => Linking.openURL(`tel:${selected.customer.phone}`)} />
                        </View>
                      )}
                      {selected.notes ? <Muted style={{ marginTop: 8 }}>“{selected.notes}”</Muted> : null}
                      {selected.status === "out_for_delivery" && (
                        <Text style={{ backgroundColor: "#FFF1CC", color: colors.ink, fontWeight: "800", padding: 10, borderRadius: radius.md, marginTop: 10, overflow: "hidden" }}>
                          Collect cash: {money(selected.totalAmount)}
                        </Text>
                      )}
                      {destination && (
                        <View style={{ flexDirection: "row", marginTop: 12 }}>
                          <Button title="Open in Google Maps" icon="navigate" variant="secondary" small onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=two_wheeler`)} />
                        </View>
                      )}
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, marginTop: 14, paddingTop: 14 }}>
                        <Muted style={{ marginBottom: 10 }}>{action.hint}</Muted>
                        {action.needsOtp && (
                          <TextInput
                            value={otp}
                            onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 4))}
                            keyboardType="number-pad"
                            maxLength={4}
                            placeholder="••••"
                            placeholderTextColor="#9AA6C3"
                            style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, textAlign: "center", fontSize: 26, fontWeight: "800", letterSpacing: 10, paddingVertical: 10, marginBottom: 12, color: colors.ink }}
                          />
                        )}
                        <Button title={action.label} onPress={advance} loading={busyId === selected._id} />
                      </View>
                    </Card>
                  )}

                  <H2 style={{ marginBottom: 10 }}>Available tasks ({available.length})</H2>
                  {available.length === 0 && <Card style={{ marginBottom: 14 }}><Muted style={{ textAlign: "center" }}>No open tasks right now. New ones appear instantly.</Muted></Card>}
                  {available.map((t) => (
                    <Card key={`${t.orderId}-${t.leg}`} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "800", color: colors.brandDark }}>{t.leg === "pickup" ? "Pickup" : "Delivery"}{t.express ? "  ⚡ Express" : ""}</Text>
                        <Text style={{ fontWeight: "800", color: colors.success, fontSize: 17 }}>{money(t.payout)}</Text>
                      </View>
                      <Text numberOfLines={2} style={{ color: colors.ink, marginTop: 8 }}>{t.address}</Text>
                      <Muted style={{ marginTop: 4 }}>
                        {t.toFirstStopKm != null ? `${t.toFirstStopKm} km to first stop · ` : ""}{t.tripKm} km trip
                      </Muted>
                      <Button title="Accept task" onPress={() => accept(t)} loading={busyId === t.orderId} style={{ marginTop: 12 }} />
                    </Card>
                  ))}

                  {mine.history.length > 0 && (
                    <>
                      <H2 style={{ marginTop: 10, marginBottom: 10 }}>Recent</H2>
                      <Card>
                        {mine.history.map((h, i) => (
                          <View key={h._id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={{ fontWeight: "700", color: colors.ink }}>{h.orderNumber}</Text>
                              <Muted numberOfLines={1}>{h.pickupAddress}</Muted>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 4 }}>
                              <StatusChip status={h.status} />
                              <Muted>{timeOnly(h.updatedAt)}</Muted>
                            </View>
                          </View>
                        ))}
                      </Card>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
