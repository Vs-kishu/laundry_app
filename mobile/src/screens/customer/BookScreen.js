import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api, { errMsg } from "../../api";
import { useAuth } from "../../AuthContext";
import { useStoreConfig } from "../../hooks";
import { haversineKm } from "../../geo";
import LocationPicker from "../../components/LocationPicker";
import { Alert, Button, Card, Chip, Field, H2, Muted } from "../../components/ui";
import { colors, money, radius } from "../../theme";

const ICON = { wash_fold: "water", wash_iron: "shirt", dry_clean: "sparkles", iron_only: "flame" };

const isoDay = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const dayLabel = (offset) =>
  offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : new Date(isoDay(offset) + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

function slotStartHour(slot) {
  const m = slot.match(/^(\d{1,2}):\d{2}\s*(AM|PM)/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[2].toUpperCase() === "PM") h += 12;
  return h;
}

const Section = ({ n, title, children }) => (
  <Card style={{ marginBottom: 14 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{n}</Text>
      </View>
      <H2>{title}</H2>
    </View>
    {children}
  </Card>
);

export default function BookScreen({ navigation }) {
  const { user } = useAuth();
  const config = useStoreConfig();
  const [services, setServices] = useState(null);
  const [qty, setQty] = useState({});
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(user?.address || "");
  const [type, setType] = useState("express");
  const [dayOffset, setDayOffset] = useState(0);
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data)).catch((e) => { setServices([]); setError(errMsg(e)); });
  }, []);

  const slots = useMemo(() => {
    const now = new Date().getHours();
    return (config?.slots || []).map((s) => ({ label: s, disabled: dayOffset === 0 && slotStartHour(s) <= now }));
  }, [config, dayOffset]);

  useEffect(() => {
    if (slots.length && !slots.find((s) => s.label === slot && !s.disabled)) setSlot(slots.find((s) => !s.disabled)?.label || "");
  }, [slots, slot]);

  const step = (s) => (s.unit === "kg" ? 0.5 : 1);
  const change = (s, delta) => setQty((q) => ({ ...q, [s._id]: Math.max(0, Math.min(100, Math.round(((q[s._id] || 0) + delta) * 10) / 10)) }));

  const selected = (services || []).filter((s) => qty[s._id] > 0);
  const subtotal = selected.reduce((a, s) => a + s.pricePerUnit * qty[s._id], 0);
  const fees = config?.fees;
  const deliveryFee = !selected.length || !fees ? 0 : subtotal >= fees.freeDeliveryAbove ? 0 : fees.delivery;
  const expressFee = type === "express" && selected.length && fees ? fees.express : 0;
  const total = subtotal + deliveryFee + expressFee;

  const distanceKm = location && config?.store ? haversineKm(config.store.location, location) : null;
  const outOfArea = distanceKm != null && distanceKm > config.store.serviceRadiusKm;

  const submit = async () => {
    setError("");
    if (!selected.length) return setError("Add at least one item to your order.");
    if (!location) return setError("Drop a pin on the map so our partner can find you.");
    if (outOfArea) return setError("That location is outside our delivery area.");
    if (address.trim().length < 5) return setError("Enter a complete address (flat, building, landmark).");
    if (type === "scheduled" && !slot) return setError("Pick a time slot.");
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders", {
        items: selected.map((s) => ({ serviceId: s._id, quantity: qty[s._id] })),
        pickupAddress: address.trim(),
        pickupLocation: location,
        pickupType: type,
        ...(type === "scheduled" ? { pickupDate: isoDay(dayOffset), pickupSlot: slot } : {}),
        notes,
      });
      navigation.replace("Tracking", { id: data._id });
    } catch (e) {
      setError(errMsg(e, "Couldn't place your order."));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {config?.fallback && <Alert tone="warn">Can't load store settings - showing default slots. Check the backend.</Alert>}

          <Section n="1" title="Choose your items">
            {services === null && <Muted>Loading services…</Muted>}
            {(services || []).map((s) => {
              const q = qty[s._id] || 0;
              return (
                <View key={s._id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginBottom: 10, borderRadius: radius.md, borderWidth: 1, borderColor: q ? colors.brand : colors.line, backgroundColor: q ? "#F1F6FF" : colors.surface }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={ICON[s.category] || "shirt"} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: colors.ink }}>{s.name}</Text>
                    <Muted>{money(s.pricePerUnit)} / {s.unit}</Muted>
                  </View>
                  {q === 0 ? (
                    <Button title="Add" small variant="secondary" onPress={() => change(s, step(s))} />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, borderRadius: 99, padding: 3 }}>
                      <Pressable onPress={() => change(s, -step(s))} hitSlop={6} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="remove" size={18} color="#fff" />
                      </Pressable>
                      <Text style={{ color: "#fff", fontWeight: "800", minWidth: 46, textAlign: "center" }}>{q} {s.unit}</Text>
                      <Pressable onPress={() => change(s, step(s))} hitSlop={6} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="add" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </Section>

          <Section n="2" title="Where should we pick up?">
            <LocationPicker
              value={location}
              store={config?.store}
              onChange={({ address: a, ...p }) => {
                setLocation(p);
                if (a) setAddress(a);
              }}
            />
            {outOfArea && (
              <View style={{ marginTop: 12 }}>
                <Alert tone="warn">Your pin is {distanceKm.toFixed(1)} km from our store. We deliver within {config.store.serviceRadiusKm} km - move the pin closer.</Alert>
              </View>
            )}
            <View style={{ marginTop: 14 }}>
              <Field label="Full address" value={address} onChangeText={setAddress} multiline placeholder="Flat / house no., building, street, landmark" />
            </View>
          </Section>

          <Section n="3" title="When?">
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                ["express", "flash", "Express", `~${config?.expressEtaMinutes || 45} min${fees ? ` · +${money(fees.express)}` : ""}`],
                ["scheduled", "time", "Schedule", "Pick a slot"],
              ].map(([id, icon, title, sub]) => (
                <Pressable key={id} onPress={() => setType(id)} style={{ flex: 1, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: type === id ? colors.brand : colors.line, backgroundColor: type === id ? "#F1F6FF" : colors.surface }}>
                  <Ionicons name={icon} size={20} color={type === id ? colors.brand : colors.muted} />
                  <Text style={{ fontWeight: "800", color: colors.ink, marginTop: 6 }}>{title}</Text>
                  <Muted>{sub}</Muted>
                </Pressable>
              ))}
            </View>

            {type === "scheduled" && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 8 }}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {[0, 1, 2, 3, 4, 5, 6].map((o) => <Chip key={o} label={dayLabel(o)} active={dayOffset === o} onPress={() => setDayOffset(o)} />)}
                </ScrollView>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginVertical: 8 }}>Time slot</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {slots.map((s) => <Chip key={s.label} label={s.label} active={slot === s.label} disabled={s.disabled} onPress={() => setSlot(s.label)} />)}
                </View>
              </View>
            )}

            <View style={{ marginTop: 14 }}>
              <Field label="Note for the partner (optional)" value={notes} onChangeText={setNotes} maxLength={300} placeholder="e.g. gate code, call on arrival" />
            </View>
          </Section>

          <Card>
            <H2 style={{ marginBottom: 10 }}>Order summary</H2>
            {selected.length === 0 ? <Muted>Your basket is empty.</Muted> : (
              <>
                {selected.map((s) => (
                  <View key={s._id} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Muted>{s.name} × {qty[s._id]} {s.unit}</Muted>
                    <Text style={{ fontWeight: "600", color: colors.ink }}>{money(s.pricePerUnit * qty[s._id])}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 4 }}>
                  <Muted>Delivery</Muted>
                  <Text style={{ color: deliveryFee ? colors.ink : colors.success, fontWeight: "700" }}>{deliveryFee ? money(deliveryFee) : "FREE"}</Text>
                </View>
                {expressFee > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Muted>Express pickup</Muted><Text style={{ color: colors.ink }}>{money(expressFee)}</Text>
                  </View>
                )}
              </>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 10 }}>
              <Text style={{ fontWeight: "800", color: colors.ink }}>Total</Text>
              <Text style={{ fontWeight: "800", fontSize: 20, color: colors.ink }}>{money(total)}</Text>
            </View>
            <Muted style={{ marginTop: 4 }}>Pay on delivery.</Muted>
          </Card>
        </ScrollView>

        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg }}>
          {error ? <Alert>{error}</Alert> : null}
          <Button title={`Confirm ${type === "express" ? "express " : ""}pickup · ${money(total)}`} onPress={submit} loading={submitting} disabled={outOfArea} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
