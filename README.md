# Laundry Point

Doorstep laundry with Zepto/Blinkit-style live tracking: customer books, a delivery partner
picks up (home to store), the store cleans, a partner delivers (store to home) - all on a live map.

- **frontend/** Next.js 14 (App Router), Tailwind, Leaflet, Socket.IO client
- **mobile/** Expo React Native app for customers and drivers (see mobile/README.md)
- **backend/** Express, MongoDB (Mongoose), Socket.IO, zod validation

## Run locally

```bash
# backend
cd backend                              # configure .env.local
npm install && npm run seed && npm run dev

# frontend
cd frontend                             # configure .env.local if needed
npm install && npm run dev
```

`npm run seed` creates services, the store (default: Connaught Place, Delhi - change it via
`STORE_LAT/STORE_LNG` or `PUT /api/store`), and in development:

| Role             | Email                           | Password         |
|------------------|---------------------------------|------------------|
| Super admin      | superadmin@laundrypoint.local   | `SuperAdmin@12345` |
| Admin            | admin@laundrypoint.local        | Admin@12345      |
| Normal user      | customer@laundrypoint.local     | Customer@12345   |
| Delivery partner | rider@laundrypoint.local        | Rider@12345      |

Existing accounts are never overwritten. In production, configure `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` and `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`; demo
customer and delivery-partner accounts are only created outside production. Both admin roles
use the admin console at `/admin`.

## Deploying the backend to Vercel

The backend serverless handler connects to MongoDB before processing each request and reuses the
connection across warm invocations. Configure `MONGO_URI`, a `JWT_SECRET` of at least 32 characters,
and `CLIENT_URL` in the backend Vercel project's Environment Variables, then redeploy. Use the root
`vercel.json` when the Vercel project root is this repository, or `backend/vercel.json` when its
Root Directory is `backend`. Check `/api/health` after deployment; `degraded` means MongoDB is not
connected.

To add five approved nearby delivery partners for testing, first confirm `MONGO_URI` points to your
intended non-production database, then run `cd backend && npm run seed:partners -- --yes`.
The script uses the database configured by `MONGO_URI`, only creates `testrider1`–`testrider5` demo
accounts, and prints their generated passwords once. Set `DEMO_PASSWORD` before running to use a
shared password. These are demo accounts; do not use them in production.

The admin portal is available at `/admin` (sign in at `/admin/login`). Customers must allow
location access and use their current GPS location to book; delivery partners must allow GPS
before going online. Deploy over HTTPS so browsers can grant geolocation permission.

Orders use a manual UPI payment flow. A super admin uploads the merchant QR image and sets the UPI ID
in Dashboard → UPI settings. Customers scan the QR or open a UPI app, pay the order total, and submit
the transaction reference. An admin verifies the transfer before the order enters the pickup queue;
rejected references can be corrected and resubmitted. UPI settings are stored in MongoDB and served
to customers as public payment details, so do not upload private account documents.

Partners earn 10% of the final paid order total for each completed leg: pickup
earnings are recorded when items are handed over at the store, and delivery earnings after the
customer confirms delivery with their OTP. Partners can save a UPI ID or bank account in Earnings
& payouts. Admins manually send pending payouts using those details and record the transfer
reference in Dashboard → Partner payouts. This payout flow does not transfer money automatically.
Task completion and its earning record are saved in one MongoDB transaction, so configure MongoDB
as a replica set (MongoDB Atlas already supports this).
Offers (percentage, fixed amount, BOGO for item-based services, and quantity
threshold discounts) are managed from Dashboard → Offers. `npm run seed` adds `WELCOME15`,
`BULK10`, and `BOGOIRON` starter offers without overwriting existing offers.

Order, partner, and task changes are delivered live in the signed-in web and mobile apps;
web browsers can also show desktop alerts after permission is granted. These are live
connection notifications, not background push delivery when an app is closed.

## Roles and flow

- **Customer** `/book`, `/orders`, `/orders/:id` (live map, ETA, OTPs)
- **Partner** `/partner/signup` -> admin approves -> `/partner` (online status is saved until manually switched off; refreshing does not take the partner offline; accept tasks with GPS enabled, navigate, OTP handover, GPS streamed over socket)
- **Admin** `/admin` (approve partners, run store steps, assign/cancel, stats)

`payment_pending (UPI reference submitted) -> placed (admin verifies payment) -> pickup_assigned ->
picked_up (pickup OTP) -> at_store -> in_progress -> ready ->
delivery_assigned -> out_for_delivery -> delivered (delivery OTP)`

Available pickup/delivery offers are shown to online partners with a fresh GPS fix whose distance
to that task's first pickup stop is within the store's configured service radius. A partner can
accept or decline; declining hides only that task leg from that partner, leaving it available to
other in-range partners.

## Testing the tracking without a bike

In dev builds the partner page has a **"simulate GPS"** button that moves the partner toward the
current destination. Or use Chrome DevTools > Sensors to override location.

## Before going live

- Map tiles: the default OpenStreetMap server is fair-use only; set `NEXT_PUBLIC_MAP_TILE_URL` to a provider key. Routing (OSRM demo) and address search (Nominatim) are also public demo services - swap for your own/paid ones at scale (`frontend/lib/geo.js`).
- Set `NEXT_PUBLIC_SITE_URL` (canonical URLs, sitemap, OG) and `CLIENT_URL` (CORS, comma-separated).
- Socket.IO keeps in-memory state: with more than one backend instance add the Redis adapter and sticky sessions.
- Orders require upfront UPI payment and manual admin verification. Partner "verification" is manual admin approval of typed details - add document upload/KYC before onboarding real riders.
- JWT lives in localStorage; move to httpOnly cookies if you want stronger XSS protection.
