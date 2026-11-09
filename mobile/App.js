import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { AuthProvider, useAuth } from "./src/AuthContext";
import { LoginScreen, PartnerSignupScreen, SignupScreen } from "./src/screens/AuthScreens";
import HomeScreen from "./src/screens/customer/HomeScreen";
import BookScreen from "./src/screens/customer/BookScreen";
import OrdersScreen from "./src/screens/customer/OrdersScreen";
import TrackingScreen from "./src/screens/customer/TrackingScreen";
import DriverScreen from "./src/screens/driver/DriverScreen";
import AccountScreen from "./src/screens/AccountScreen";
import { Button, H1, Loader, Muted } from "./src/components/ui";
import { colors } from "./src/theme";
import { getSocket } from "./src/socket";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.brand, card: "#fff", text: colors.ink, border: colors.line } };

const tabOptions = (icons, tint) => ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: tint,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
  tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} size={size} color={color} />,
});

function CustomerTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions({ Home: "home", Orders: "receipt", Account: "person" }, colors.brand)}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions({ Tasks: "bicycle", Account: "person" }, colors.teal)}>
      <Tab.Screen name="Tasks" component={DriverScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

function AdminNotice() {
  const { logout } = useAuth();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.bg }}>
      <H1 style={{ textAlign: "center" }}>Admin is web-only</H1>
      <Muted style={{ textAlign: "center", marginVertical: 12 }}>Use the Laundry Point admin console in a browser to manage orders, drivers and the store.</Muted>
      <Button title="Log out" variant="secondary" onPress={logout} />
    </View>
  );
}

function AppRealtimeNotice() {
  const { token, user } = useAuth();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    if (!socket) return;
    let timer;
    const show = (message) => {
      setNotice(message);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(""), 6000);
    };
    const onOrder = ({ status }) => {
      const label = (status || "updated").replaceAll("_", " ");
      show(["admin", "super_admin"].includes(user?.role)
        ? `An order was ${label}.`
        : user?.role === "partner"
          ? `Your delivery task is ${label}.`
          : `Your order is ${label}.`);
    };
    const onTasks = () => show("New pickup or delivery task available.");
    const onVerification = ({ status }) => show(`Partner application ${status}.`);
    const onPartnerUpdate = () => show("A delivery partner's account or availability changed.");
    socket.on("order:update", onOrder);
    socket.on("tasks:changed", onTasks);
    socket.on("partner:verification", onVerification);
    socket.on("partner:update", onPartnerUpdate);
    return () => {
      clearTimeout(timer);
      socket.off("order:update", onOrder);
      socket.off("tasks:changed", onTasks);
      socket.off("partner:verification", onVerification);
      socket.off("partner:update", onPartnerUpdate);
    };
  }, [token, user?.role]);

  if (!notice) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 48, left: 16, right: 16, zIndex: 1000, backgroundColor: "#0B1B3A", borderRadius: 16, padding: 14, elevation: 8 }}>
      <Text style={{ color: "#fff", fontWeight: "700" }}>{notice}</Text>
    </View>
  );
}

const headerStyle = { headerTintColor: colors.ink, headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg } };

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="PartnerSignup" component={PartnerSignupScreen} />
      </Stack.Navigator>
    );
  }
  if (user.role === "partner") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
      </Stack.Navigator>
    );
  }
  if (user.role === "admin" || user.role === "super_admin") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Admin" component={AdminNotice} />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Book" component={BookScreen} options={{ title: "Book a pickup" }} />
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ title: "Track order" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
        <AppRealtimeNotice />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
