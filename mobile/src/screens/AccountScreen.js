import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useAuth } from "../AuthContext";
import api, { errMsg } from "../api";
import { Alert, Button, Card, H1, Muted } from "../components/ui";
import { API_URL } from "../config";
import { colors, money, radius } from "../theme";

export default function AccountScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("500");
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWallet = useCallback(async () => {
    const { data } = await api.get("/wallet");
    setWallet(data);
  }, []);
  useEffect(() => {
    if (user?.role === "customer" || user?.role === "partner") loadWallet().catch((e) => setError(errMsg(e)));
  }, [user?.role, loadWallet]);

  const startTopUp = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/wallet/topups", { amount: Math.round(Number(amount) * 100) });
      if (!data.keyId) {
        throw new Error("Razorpay key ID is missing from the backend response. Set RAZORPAY_KEY_ID on the backend and restart or redeploy the API.");
      }
      setCheckout(data);
    } catch (e) {
      setError(errMsg(e, "Could not start wallet top-up."));
    } finally {
      setBusy(false);
    }
  };

  const onPaymentMessage = async (event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      setError("Could not read the payment response. Please refresh your wallet.");
      setCheckout(null);
      return;
    }
    if (message.type === "dismissed") return setCheckout(null);
    if (message.type === "failed") {
      setError(message.message || "Payment failed. Please try again.");
      setCheckout(null);
      return;
    }
    if (message.type === "success") {
      try {
        await api.post("/wallet/topups/verify", message.response);
        await Promise.all([loadWallet(), refreshUser()]);
        setCheckout(null);
      } catch (e) {
        setError(errMsg(e, "Payment verification failed. Refresh your wallet before retrying."));
        setCheckout(null);
      }
    }
  };

  const paymentPage = checkout ? `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><p>Opening secure payment…</p><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>const options=${JSON.stringify({
    key: checkout.keyId,
    amount: checkout.amount,
    currency: checkout.currency,
    name: checkout.name,
    description: checkout.description,
    order_id: checkout.orderId,
    prefill: checkout.prefill,
    method: { upi: true },
  }).replace(/</g, "\\u003c")};options.handler=response=>window.ReactNativeWebView.postMessage(JSON.stringify({type:"success",response}));options.modal={ondismiss:()=>window.ReactNativeWebView.postMessage(JSON.stringify({type:"dismissed"}))};const rzp=new Razorpay(options);rzp.on("payment.failed",e=>window.ReactNativeWebView.postMessage(JSON.stringify({type:"failed",message:e.error.description})));rzp.open();</script></body></html>` : "";
  const rows = [
    ["Name", user.name],
    ["Email", user.email],
    ["Mobile", user.phone],
    ...(user.role === "partner" ? [["Vehicle", `${user.partner?.vehicleType || ""} ${user.partner?.vehicleNumber || ""}`]] : []),
  ];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
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
      {(user.role === "customer" || user.role === "partner") && (
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 18 }}>Wallet</Text>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 28, marginTop: 6 }}>{money(wallet?.balance ?? user.walletBalance ?? 0)}</Text>
          {user.role === "partner" ? (
            <Muted style={{ marginTop: 4 }}>Partner earnings are credited immediately after a task leg is completed. Withdrawals are not enabled yet.</Muted>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
              <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Amount in rupees" style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink }} />
              <Button title={busy ? "Starting…" : "Add funds"} small onPress={startTopUp} loading={busy} disabled={Number(amount) < 1 || Number(amount) > 5000} />
            </View>
          )}
          {error ? <View style={{ marginTop: 10 }}><Alert>{error}</Alert></View> : null}
          <Muted style={{ marginTop: 8 }}>UPI QR may be selected in the secure Razorpay checkout when available.</Muted>
          {wallet?.transactions?.slice(0, 5).map((transaction) => (
            <View key={transaction._id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8 }}>
              <Muted>{transaction.description}</Muted>
              <Text style={{ color: transaction.direction === "credit" ? colors.success : colors.ink, fontWeight: "700" }}>{transaction.direction === "credit" ? "+" : "−"}{money(transaction.amount)}</Text>
            </View>
          ))}
        </Card>
      )}
      <Button title="Log out" variant="danger" icon="log-out" onPress={logout} />
      <Muted style={{ textAlign: "center", marginTop: 20 }}>Server: {API_URL}</Muted>
      </ScrollView>
      <Modal visible={!!checkout} animationType="slide" onRequestClose={() => setCheckout(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
            <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 17 }}>Secure wallet top-up</Text>
            <Pressable onPress={() => setCheckout(null)} accessibilityLabel="Close payment"><Text style={{ color: colors.ink, fontSize: 26 }}>×</Text></Pressable>
          </View>
          {checkout ? <WebView source={{ html: paymentPage }} onMessage={onPaymentMessage} javaScriptEnabled domStorageEnabled /> : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
