import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import api, { errMsg } from "../../api";
import { useAuth } from "../../AuthContext";
import { useStoreConfig } from "../../hooks";
import { haversineKm } from "../../geo";
import LocationPicker from "../../components/LocationPicker";
import { Alert, Button, Card, Chip, Field, H2, Muted } from "../../components/ui";
import { colors, money, radius } from "../../theme";

const ICON = { wash_fold: "water", wash_iron: "shirt", dry_clean: "sparkles", iron_only: "flame" };

const paymentPage = (checkout) => {
  const options = JSON.stringify({
    key: checkout.keyId,
    amount: checkout.amount,
    currency: checkout.currency,
    name: checkout.name,
    description: checkout.description,
    order_id: checkout.orderId,
    prefill: checkout.prefill,
    method: { upi: true },
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><p>Opening secure payment…</p><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>const options=${options};options.handler=response=>window.ReactNativeWebView.postMessage(JSON.stringify({type:"success",response}));options.modal={ondismiss:()=>window.ReactNativeWebView.postMessage(JSON.stringify({type:"dismissed"}))};const rzp=new Razorpay(options);rzp.on("payment.failed",e=>window.ReactNativeWebView.postMessage(JSON.stringify({type:"failed",message:e.error.description})));rzp.open();</script></body></html>`;
};

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
  const [gpsGranted, setGpsGranted] = useState(false);
  const [address, setAddress] = useState(user?.address || "");
  const [type, setType] = useState("express");
  const [dayOffset, setDayOffset] = useState(0);
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [offerError, setOfferError] = useState("");
  const [offerBusy, setOfferBusy] = useState(false);
  const [availableOffers, setAvailableOffers] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data)).catch((e) => { setServices([]); setError(errMsg(e)); });
    api.get("/offers").then(({ data }) => setAvailableOffers(data)).catch((e) => setOfferError(errMsg(e, "Couldn't load current offers.")));
    api.get("/wallet").then(({ data }) => setWalletBalance(data.balance)).catch(() => {});
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
  const basketKey = JSON.stringify({ type, items: selected.map((s) => [s._id, qty[s._id]]) });
  const currentOffer = appliedOffer?.basketKey === basketKey ? appliedOffer : null;
  const fees = config?.fees;
  const deliveryFee = !selected.length || !fees ? 0 : subtotal >= fees.freeDeliveryAbove ? 0 : fees.delivery;
  const expressFee = type === "express" && selected.length && fees ? fees.express : 0;
  const total = subtotal - (currentOffer?.discountAmount || 0) + deliveryFee + expressFee;
  useEffect(() => {
    if (walletBalance < total) setUseWallet(false);
  }, [walletBalance, total]);

  const distanceKm = location && config?.store ? haversineKm(config.store.location, location) : null;
  const outOfArea = distanceKm != null && distanceKm > config.store.serviceRadiusKm;

  const applyCoupon = async () => {
    setOfferError("");
    setOfferBusy(true);
    try {
      const { data } = await api.post("/offers/validate", {
        couponCode,
        items: selected.map((s) => ({ serviceId: s._id, quantity: qty[s._id] })),
        pickupType: type,
      });
      setAppliedOffer({ ...data, basketKey });
      setCouponCode(data.offer.code);
    } catch (e) {
      setAppliedOffer(null);
      setOfferError(errMsg(e, "That offer could not be applied."));
    } finally {
      setOfferBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!selected.length) return setError("Add at least one item to your order.");
    if (!gpsGranted) return setError("Enable your device location and use your current location before continuing.");
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
        useWallet,
        couponCode: currentOffer?.offer?.code || "",
        ...(type === "scheduled" ? { pickupDate: isoDay(dayOffset), pickupSlot: slot } : {}),
        notes,
      });
      if (data.paidByWallet) {
        navigation.replace("Tracking", { id: data.order._id });
        return;
      }
      if (!data.keyId) {
        throw new Error("Razorpay key ID is missing from the backend response. Set RAZORPAY_KEY_ID on the backend and restart or redeploy the API.");
      }
      setCheckout(data);
      setSubmitting(false);
    } catch (e) {
      setError(errMsg(e, "Couldn't place your order."));
      setSubmitting(false);
    }
  };

  const onPaymentMessage = async (event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      setError("Could not read the payment response. Please retry checkout.");
      setCheckout(null);
      return;
    }
    if (message.type === "dismissed") {
      setCheckout(null);
      return;
    }
    if (message.type === "failed") {
      setError(message.message || "Payment failed. Please try again.");
      setCheckout(null);
      return;
    }
    if (message.type === "success") {
      try {
        const { data: order } = await api.post("/orders/payment/verify", message.response);
        setCheckout(null);
        navigation.replace("Tracking", { id: order._id });
      } catch (e) {
        setError(errMsg(e, "Payment verification failed. Contact support before paying again."));
        setCheckout(null);
      }
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
              onGpsChange={setGpsGranted}
              onChange={({ address: a, ...p }) => {
                setLocation(p);
                if (a) setAddress(a);
              }}
            />
            <Muted style={{ marginTop: 8 }}>{gpsGranted ? "GPS enabled. Adjust the pin to your exact pickup point." : "Enable GPS and use your current location to continue."}</Muted>
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
                {currentOffer && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Muted>Offer ({currentOffer.offer.code})</Muted><Text style={{ color: colors.success, fontWeight: "700" }}>−{money(currentOffer.discountAmount)}</Text>
                  </View>
                )}
              </>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
              <TextInput value={couponCode} onChangeText={(value) => setCouponCode(value.toUpperCase())} placeholder="Offer code" autoCapitalize="characters" style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink }} />
              <Button title={offerBusy ? "Checking…" : "Apply"} small variant="secondary" onPress={applyCoupon} loading={offerBusy} disabled={!couponCode || !selected.length} />
            </View>
            {currentOffer ? <Pressable onPress={() => { setAppliedOffer(null); setCouponCode(""); }}><Text style={{ marginTop: 6, color: colors.danger, fontWeight: "700" }}>Remove offer</Text></Pressable> : null}
            {offerError ? <View style={{ marginTop: 8 }}><Alert>{offerError}</Alert></View> : null}
            {availableOffers.length > 0 && <View style={{ marginTop: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.soft }}>
              <Text style={{ color: colors.ink, fontWeight: "800", marginBottom: 4 }}>Current offers</Text>
              {availableOffers.map((offer) => <Text key={offer._id} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{offer.code} — {offer.title}</Text>)}
            </View>}
            {selected.length > 0 && (
              walletBalance >= total ? (
                <Pressable onPress={() => setUseWallet((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.soft }}>
                  <Ionicons name={useWallet ? "checkbox" : "square-outline"} size={21} color={colors.brand} />
                  <View><Text style={{ color: colors.ink, fontWeight: "700" }}>Pay with wallet</Text><Muted>Available: {money(walletBalance)}</Muted></View>
                </Pressable>
              ) : (
                <Muted style={{ marginTop: 10 }}>Wallet balance: {money(walletBalance)}. Add funds in Account to pay the full amount by wallet.</Muted>
              )
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 10 }}>
              <Text style={{ fontWeight: "800", color: colors.ink }}>Total</Text>
              <Text style={{ fontWeight: "800", fontSize: 20, color: colors.ink }}>{money(total)}</Text>
            </View>
            <Muted style={{ marginTop: 4 }}>Pay securely online. Select UPI QR in Razorpay checkout when available.</Muted>
          </Card>
        </ScrollView>

        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg }}>
          {error ? <Alert>{error}</Alert> : null}
          <Button title={useWallet ? `Pay ${money(total)} from wallet` : `Pay ${money(total)} and confirm`} onPress={submit} loading={submitting} disabled={outOfArea} />
        </View>
      </KeyboardAvoidingView>
      <Modal visible={!!checkout} animationType="slide" onRequestClose={() => setCheckout(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
            <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 17 }}>Secure payment</Text>
            <Pressable onPress={() => setCheckout(null)} accessibilityLabel="Close payment">
              <Ionicons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          {checkout && <WebView source={{ html: paymentPage(checkout) }} onMessage={onPaymentMessage} javaScriptEnabled domStorageEnabled />}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
