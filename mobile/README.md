# Laundry Point - mobile app (Expo / React Native)

One app for **customers** and **delivery partners**; the account role decides which screens you see.
Admins use the web console. It talks to the same backend (`../backend`) and live-tracking sockets.

## Run it

```bash
# 1. backend must be running and reachable on your network (port 5000)
cd ../backend && npm run dev

# 2. app
cd mobile && npm install && npx expo start
```

Scan the QR code with **Expo Go** (phone and computer on the same Wi-Fi). The app derives the
backend address from the machine running `expo start`. Android emulator: `10.0.2.2:5000` is used
automatically. If Windows Firewall blocks it, allow Node.js on private networks.

For production set `EXPO_PUBLIC_API_URL=https://your-api/api` (HTTPS).

## Test accounts (after `npm run seed` in backend)

| Role     | Login                     | Password    |
|----------|---------------------------|-------------|
| Driver   | rider@laundrypoint.local  | Rider@12345 |
| Customer | sign up in the app        |             |

Log in with **email or mobile number**.

## What's inside

- Customer: home, book (items, map pin, express/scheduled), orders, live tracking (map, ETA, OTPs, timeline, cancel)
- Driver: online toggle, live GPS streaming, accept tasks, navigate (Google Maps), OTP handover, earnings
- Maps are Leaflet + OpenStreetMap in a WebView, so no Google/Apple map keys are needed

## Build an installable app

```bash
npm i -g eas-cli && eas login
eas build --platform android --profile preview   # APK you can share
```

## Known limits

- Driver GPS is streamed while the app is open in the foreground (screen kept awake). Background
  tracking needs a native build with background-location permission.
- No push notifications yet (updates arrive live while the app is open).
- OSM tiles / OSRM / Nominatim are public demo services; swap them for paid ones at scale.
