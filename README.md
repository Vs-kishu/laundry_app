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

The admin portal is available at `/admin` (sign in at `/admin/login`). Customers must allow
location access and use their current GPS location to book; delivery partners must allow GPS
before going online. Deploy over HTTPS so browsers can grant geolocation permission.

Orders are paid online through Razorpay before they are created; customers may instead pay
from their wallet when its balance covers the full order. Razorpay checkout enables UPI, where
the payment provider may offer a QR option depending on merchant/account settings. Set `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` in the backend environment, starting with Razorpay test credentials;
enable automatic payment capture in the Razorpay account. Configure a Razorpay webhook for
`POST /api/orders/payment/webhook` using the `payment.captured` event, and set its signing
secret as `RAZORPAY_WEBHOOK_SECRET`.
The backend creates and verifies payment orders; do not put the secret in frontend/mobile
configuration. Customers can add money to their wallet online and review wallet transactions.
Partner task earnings are credited to the partner wallet immediately when each pickup or delivery
leg is completed. Partner withdrawals are not enabled yet. The admin portal's Wallet ledger tab shows payment entries, partner earnings,
and outstanding customer/partner wallet balances. Wallet updates use MongoDB transactions, so
configure MongoDB as a replica set (MongoDB Atlas already supports this).
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
