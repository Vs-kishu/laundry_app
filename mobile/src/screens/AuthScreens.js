import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gradient } from "../components/Gradient";
import Logo from "../components/Logo";
import { Alert, Button, Chip, Field, H1, Muted } from "../components/ui";
import { errMsg } from "../api";
import { useAuth } from "../AuthContext";
import { colors } from "../theme";

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <Gradient>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: "center", marginVertical: 18 }}>
              <Logo size={46} light />
            </View>
            <View style={{ backgroundColor: "#fff", borderRadius: 28, padding: 22 }}>
              <H1>{title}</H1>
              <Muted style={{ marginTop: 4, marginBottom: 20 }}>{subtitle}</Muted>
              {children}
            </View>
            <View style={{ marginTop: 18, alignItems: "center", gap: 10 }}>{footer}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Gradient>
  );
}

const Link = ({ text, onPress }) => (
  <Pressable onPress={onPress} hitSlop={8}>
    <Text style={{ color: "#fff", fontWeight: "700", textDecorationLine: "underline" }}>{text}</Text>
  </Pressable>
);

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (e) {
      setError(errMsg(e, "Invalid email/mobile number or password."));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in with your email or mobile number."
      footer={
        <>
          <Text style={{ color: "#fff" }}>New here?</Text>
          <Link text="Create an account" onPress={() => navigation.navigate("Signup")} />
          <Link text="Become a delivery partner" onPress={() => navigation.navigate("PartnerSignup")} />
        </>
      }
    >
      <Field label="Email or mobile number" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com or 98765 43210" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
      {error ? <Alert>{error}</Alert> : null}
      <Button title="Log in" onPress={submit} loading={loading} disabled={!identifier || !password} />
    </AuthLayout>
  );
}

export function SignupScreen({ navigation }) {
  const { signup } = useAuth();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await signup({ ...f, email: f.email.trim() });
    } catch (e) {
      setError(errMsg(e));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Book pickups in seconds once you're set up."
      footer={<><Text style={{ color: "#fff" }}>Already have an account?</Text><Link text="Log in" onPress={() => navigation.navigate("Login")} /></>}
    >
      <Field label="Full name" value={f.name} onChangeText={set("name")} />
      <Field label="Email" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Mobile number" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder="98765 43210" />
      <Field label="Password (8+ characters)" value={f.password} onChangeText={set("password")} secureTextEntry />
      {error ? <Alert>{error}</Alert> : null}
      <Button title="Create account" onPress={submit} loading={loading} />
    </AuthLayout>
  );
}

const VEHICLES = [["scooter", "Scooter"], ["bike", "Motorbike"], ["ev", "Electric"], ["cycle", "Bicycle"]];

export function PartnerSignupScreen({ navigation }) {
  const { partnerSignup } = useAuth();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", vehicleType: "scooter", vehicleNumber: "", licenseNumber: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await partnerSignup({ ...f, email: f.email.trim() });
    } catch (e) {
      setError(errMsg(e));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Become a partner"
      subtitle="Apply in two minutes. We verify your details before you can go online."
      footer={<><Text style={{ color: "#fff" }}>Already a partner?</Text><Link text="Log in" onPress={() => navigation.navigate("Login")} /></>}
    >
      <Field label="Full name" value={f.name} onChangeText={set("name")} />
      <Field label="Email" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Mobile number" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      <Field label="Password (8+ characters)" value={f.password} onChangeText={set("password")} secureTextEntry />
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Vehicle</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
        {VEHICLES.map(([v, l]) => <Chip key={v} label={l} active={f.vehicleType === v} onPress={() => set("vehicleType")(v)} />)}
      </View>
      <Field label="Vehicle number" value={f.vehicleNumber} onChangeText={set("vehicleNumber")} autoCapitalize="characters" placeholder="DL01AB1234" />
      <Field label="Licence / ID number" value={f.licenseNumber} onChangeText={set("licenseNumber")} autoCapitalize="characters" />
      {error ? <Alert>{error}</Alert> : null}
      <Button title="Submit application" onPress={submit} loading={loading} />
    </AuthLayout>
  );
}
