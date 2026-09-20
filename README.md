# Laundry Point

Doorstep laundry with Zepto/Blinkit-style live tracking: customer books, a delivery partner
picks up (home to store), the store cleans, a partner delivers (store to home) - all on a live map.

- **frontend/** Next.js 14 (App Router), Tailwind, Leaflet, Socket.IO client
- **mobile/** Expo React Native app for customers and drivers (see mobile/README.md)
- **backend/** Express, MongoDB (Mongoose), Socket.IO, zod validation

## Run locally

```bash
# backend
cd backend && cp .env.example .env      # set JWT_SECRET
npm install && npm run seed && npm run dev

# frontend
cd frontend && cp .env.example .env.local
npm install && npm run dev
```

`npm run seed` creates services, the store (default: Connaught Place, Delhi - change it via
`STORE_LAT/STORE_LNG` or `PUT /api/store`), and in development:

| Role     | Email                       | Password       |
|----------|-----------------------------|----------------|
| Admin    | admin@laundrypoint.local    | Admin@12345    |
| Partner  | rider@laundrypoint.local    | Rider@12345    |

In production the seed only creates an admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Roles and flow

- **Customer** `/book`, `/orders`, `/orders/:id` (live map, ETA, OTPs)
- **Partner** `/partner/signup` -> admin approves -> `/partner` (go online, accept tasks, navigate, OTP handover, GPS streamed over socket)
- **Admin** `/admin` (approve partners, run store steps, assign/cancel, stats)

`placed -> pickup_assigned -> picked_up (pickup OTP) -> at_store -> in_progress -> ready ->
delivery_assigned -> out_for_delivery -> delivered (delivery OTP)`

## Testing the tracking without a bike

In dev builds the partner page has a **"simulate GPS"** button that moves the partner toward the
current destination. Or use Chrome DevTools > Sensors to override location.

## Before going live

- Map tiles: the default OpenStreetMap server is fair-use only; set `NEXT_PUBLIC_MAP_TILE_URL` to a provider key. Routing (OSRM demo) and address search (Nominatim) are also public demo services - swap for your own/paid ones at scale (`frontend/lib/geo.js`).
- Set `NEXT_PUBLIC_SITE_URL` (canonical URLs, sitemap, OG) and `CLIENT_URL` (CORS, comma-separated).
- Socket.IO keeps in-memory state: with more than one backend instance add the Redis adapter and sticky sessions.
- Payments are cash-on-delivery only. Partner "verification" is manual admin approval of typed details - add document upload/KYC before onboarding real riders.
- JWT lives in localStorage; move to httpOnly cookies if you want stronger XSS protection.
