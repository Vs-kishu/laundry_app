import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import api, { errMsg } from "../api";
import { Alert, Button, Card, H1, H2, Muted } from "../components/ui";
import { API_URL } from "../config";
import { colors, money, radius, timeOnly } from "../theme";

const EMPTY_DETAILS = { method: "upi", upiId: "", accountHolder: "", accountNumber: "", ifsc: "" };

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSummary = useCallback(async () => {
    const { data } = await api.get("/partner/payout");
    setSummary(data);
    if (data.payoutDetails) setDetails({ ...EMPTY_DETAILS, ...data.payoutDetails });
  }, []);

  useEffect(() => {
    if (user.role === "partner") loadSummary().catch((e) => setError(errMsg(e)));
  }, [user.role, loadSummary]);

  const saveDetails = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    const payload = details.method === "upi"
      ? { method: "upi", upiId: details.upiId }
      : { method: "bank", accountHolder: details.accountHolder, accountNumber: details.accountNumber, ifsc: details.ifsc };
    try {
      const { data } = await api.put("/partner/payout-details", payload);
      setDetails({ ...EMPTY_DETAILS, ...data.payoutDetails });
      setNotice("Payout details saved.");
      await loadSummary();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    backgroundColor: colors.surface,
    marginTop: 6,
  };

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
          {[
            ["Name", user.name],
            ["Email", user.email],
            ["Mobile", user.phone],
            ...(user.role === "partner" ? [["Vehicle", `${user.partner?.vehicleType || ""} ${user.partner?.vehicleNumber || ""}`]] : []),
          ].map(([label, value]) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Muted>{label}</Muted>
              <Text style={{ color: colors.ink, fontWeight: "600" }}>{value}</Text>
            </View>
          ))}
        </Card>

        {user.role === "partner" && (
          <>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {[
                ["Pending payout", summary?.pending?.amount || 0],
                ["Paid", summary?.paid?.amount || 0],
              ].map(([label, amount]) => (
                <Card key={label} style={{ flex: 1, padding: 14 }}>
                  <Muted>{label}</Muted>
                  <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "800", marginTop: 4 }}>{money(amount)}</Text>
                </Card>
              ))}
            </View>

            <Card style={{ marginBottom: 16 }}>
              <H2>Payout method</H2>
              <Muted style={{ marginTop: 4 }}>Earn 10% of the final order total per completed leg. The admin pays these earnings manually to your UPI or bank account.</Muted>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <Button title="UPI ID" small variant={details.method === "upi" ? "primary" : "secondary"} onPress={() => setDetails((current) => ({ ...current, method: "upi" }))} />
                <Button title="Bank account" small variant={details.method === "bank" ? "primary" : "secondary"} onPress={() => setDetails((current) => ({ ...current, method: "bank" }))} />
              </View>
              {details.method === "upi" ? (
                <>
                  <Muted style={{ marginTop: 14 }}>UPI ID</Muted>
                  <TextInput value={details.upiId} onChangeText={(upiId) => setDetails({ ...details, upiId })} autoCapitalize="none" autoCorrect={false} placeholder="name@bank" placeholderTextColor="#9AA6C3" style={inputStyle} />
                </>
              ) : (
                <>
                  <Muted style={{ marginTop: 14 }}>Account holder name</Muted>
                  <TextInput value={details.accountHolder} onChangeText={(accountHolder) => setDetails({ ...details, accountHolder })} autoCapitalize="words" placeholder="Name on bank account" placeholderTextColor="#9AA6C3" style={inputStyle} />
                  <Muted style={{ marginTop: 10 }}>Account number</Muted>
                  <TextInput value={details.accountNumber} onChangeText={(accountNumber) => setDetails({ ...details, accountNumber: accountNumber.replace(/\D/g, "").slice(0, 20) })} keyboardType="number-pad" placeholder="8–20 digits" placeholderTextColor="#9AA6C3" style={inputStyle} />
                  <Muted style={{ marginTop: 10 }}>IFSC code</Muted>
                  <TextInput value={details.ifsc} onChangeText={(ifsc) => setDetails({ ...details, ifsc: ifsc.toUpperCase() })} autoCapitalize="characters" autoCorrect={false} maxLength={11} placeholder="ABCD0123456" placeholderTextColor="#9AA6C3" style={inputStyle} />
                </>
              )}
              {summary?.payoutDetails?.method === "upi" && (
                <Muted style={{ marginTop: 10 }}>Saved UPI ID: {summary.payoutDetails.upiId}</Muted>
              )}
              {summary?.payoutDetails?.method === "bank" && (
                <Muted style={{ marginTop: 10 }}>
                  Saved account ending {summary.payoutDetails.accountNumber?.slice(-4) || "—"} · {summary.payoutDetails.ifsc}
                </Muted>
              )}
              {error ? <Alert>{error}</Alert> : null}
              {notice ? <Alert tone="success">{notice}</Alert> : null}
              <Button title={busy ? "Saving…" : "Save payout details"} onPress={saveDetails} loading={busy} style={{ marginTop: 14 }} />
            </Card>

            <H2 style={{ marginBottom: 10 }}>Earning history</H2>
            {summary?.earnings?.length === 0 && <Card><Muted>No completed task earnings yet.</Muted></Card>}
            {summary?.earnings?.map((earning) => (
              <Card key={earning._id} style={{ marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>{earning.order?.orderNumber || "Order"} · {earning.leg} leg</Text>
                  <Muted style={{ marginTop: 4 }}>{timeOnly(earning.earnedAt)} · {earning.status === "paid" ? `Paid · ${earning.payoutReference}` : "Pending admin payout"}</Muted>
                </View>
                <Text style={{ color: colors.ink, fontWeight: "800" }}>{money(earning.amount)}</Text>
              </Card>
            ))}
          </>
        )}

        <Button title="Log out" variant="danger" icon="log-out" onPress={logout} />
        <Muted style={{ textAlign: "center", marginTop: 20 }}>Server: {API_URL}</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}
