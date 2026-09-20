import { StatusBar } from "expo-status-bar";
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
  if (user.role === "admin") {
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
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
