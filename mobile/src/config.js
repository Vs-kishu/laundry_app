import Constants from "expo-constants";

// Where the Laundry Point backend lives.
//  - Set EXPO_PUBLIC_API_URL (e.g. https://api.yourdomain.com/api) for production builds.
//  - In development we reuse the IP of the machine running `expo start`, so a phone on the same
//    Wi-Fi reaches your backend on port 5000 automatically. (Android emulator falls back to 10.0.2.2.)
const fromEnv = process.env.EXPO_PUBLIC_API_URL;

function devServer() {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:5000` : "http://10.0.2.2:5000";
}

export const SERVER_URL = fromEnv ? fromEnv.replace(/\/api\/?$/, "") : devServer();
export const API_URL = `${SERVER_URL}/api`;
