// Demo data for showcasing the app: 1 admin, 3 riders, 3 customers and 8 orders in every state.
//
//   npm run seed:demo -- --yes        create (idempotent - existing demo users are kept)
//   npm run seed:demo -- --remove --yes   delete everything this script created
//
// Passwords are generated randomly and printed once (or set DEMO_PASSWORD for all demo users).
// The admin password comes from SEED_ADMIN_PASSWORD, or is generated if the admin is created here.
// Everything is tagged (@demo.laundrypoint.app emails, LP-DEMO- order numbers) so it is easy to remove.

require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Service = require("./models/Service");
const Store = require("./models/Store");
const Order = require("./models/Order");
const C = require("./config/constants");

const args = process.argv.slice(2);
const YES = args.includes("--yes");
const REMOVE = args.includes("--remove");
const DOMAIN = "@demo.laundrypoint.app";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@laundrypoint.app";

const strongPassword = () => crypto.randomBytes(9).toString("base64url") + "!9";
const otp = () => String(crypto.randomInt(1000, 10000));
const round2 = (n) => Math.round(n * 100) / 100;

const RIDERS = [
  { name: "Rahul Kumar", phone: "9000000101", vehicleType: "scooter", vehicleNumber: "DL8SAB1234", licenseNumber: "DL0420190011223", status: "approved", online: true },
  { name: "Amit Verma", phone: "9000000102", vehicleType: "bike", vehicleNumber: "DL3CAB9999", licenseNumber: "DL0120180099887", status: "approved", online: false },
  { name: "Sanjay Yadav", phone: "9000000103", vehicleType: "ev", vehicleNumber: "DL1EVX4521", licenseNumber: "DL0620210044556", status: "pending", online: false },
];
const CUSTOMERS = [
  { name: "Priya Sharma", phone: "9000000201" },
  { name: "Arjun Mehta", phone: "9000000202" },
  { name: "Neha Kapoor", phone: "9000000203" },
];

const FLOW = ["placed", "pickup_assigned", "picked_up", "at_store", "in_progress", "ready", "delivery_assigned", "out_for_delivery", "delivered"];

// offsets (km east, km north) from the store, so demo orders always fall inside the service area
const km2deg = (store, dE, dN) => ({
  lat: store.location.lat + dN / 110.574,
  lng: store.location.lng + dE / (111.32 * Math.cos((store.location.lat * Math.PI) / 180)),
});

async function remove() {
  const users = await User.find({ email: new RegExp(`${DOMAIN.replace(".", "\\.")}$`) }).select("_id");
  const orders = await Order.deleteMany({ orderNumber: /^LP-DEMO-/ });
  const u = await User.deleteMany({ _id: { $in: users.map((x) => x._id) } });
  console.log(`Removed ${orders.deletedCount} demo orders and ${u.deletedCount} demo users.`);
}

async function ensureUser(data, out) {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    out.push({ role: data.role, email: data.email, password: "(unchanged - already existed)" });
    return existing;
  }
  const password = process.env.DEMO_PASSWORD || strongPassword();
  const user = await User.create({ ...data, password });
  out.push({ role: data.role, email: data.email, phone: data.phone, password });
  return user;
}

async function create() {
  const creds = [];
  const store = (await Store.findOne().lean()) || C.DEFAULT_STORE;
  const services = await Service.find({ isActive: true }).lean();
  if (!services.length) throw new Error("No services found - run `npm run seed` first.");
  const svc = (name) => services.find((s) => s.name === name) || services[0];

  // admin: create if missing; if SEED_ADMIN_PASSWORD is given, (re)set it
  let admin = await User.findOne({ email: ADMIN_EMAIL }).select("+password");
  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD || strongPassword();
    admin = await User.create({ name: "Laundry Point Admin", email: ADMIN_EMAIL, password, phone: "9000000001", role: "admin" });
    creds.push({ role: "admin", email: ADMIN_EMAIL, phone: "9000000001", password });
  } else if (process.env.SEED_ADMIN_PASSWORD) {
    admin.password = process.env.SEED_ADMIN_PASSWORD;
    await admin.save();
    creds.push({ role: "admin", email: ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD + "  (password reset)" });
  } else {
    creds.push({ role: "admin", email: ADMIN_EMAIL, password: "(unchanged - already existed)" });
  }

  const riders = [];
  for (const [i, r] of RIDERS.entries()) {
    const near = km2deg(store, (i - 1) * 1.2, 0.8 * i);
    riders.push(
      await ensureUser(
        {
          name: r.name, email: `rider${i + 1}${DOMAIN}`, phone: r.phone, role: "partner",
          partner: {
            vehicleType: r.vehicleType, vehicleNumber: r.vehicleNumber, licenseNumber: r.licenseNumber,
            verificationStatus: r.status, isOnline: r.online,
            location: r.online ? { ...near, updatedAt: new Date() } : undefined,
          },
        },
        creds
      )
    );
  }
  const customers = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    customers.push(await ensureUser({ name: c.name, email: `customer${i + 1}${DOMAIN}`, phone: c.phone, role: "customer", address: "Demo Colony, near " + store.name }, creds));
  }

  if (await Order.exists({ orderNumber: /^LP-DEMO-/ })) {
    console.log("Demo orders already exist - skipping orders (run with --remove first to recreate).");
    return creds;
  }

  const [r1, r2] = riders;
  const [c1, c2, c3] = customers;
  const H = 3600e3;

  // [customer, items, offset(km e,n), address, type, status, pickupRider, deliveryRider, hoursAgo, notes]
  const plan = [
    [c1, [["Wash & Fold", 4], ["Iron Only", 3]], [1.8, 2.2], "Flat 12, Green Apartments, Colony A", "scheduled", "delivered", r1, r2, 52, "Please call on arrival"],
    [c2, [["Wash & Iron", 3], ["Dry Cleaning", 2]], [-2.5, 1.0], "House 45, Lane 3, Colony B", "express", "delivered", r2, r1, 27, "Gate code 4321"],
    [c3, [["Wash & Fold", 6]], [3.4, -1.6], "B-14, Sunrise Apartments, Colony C", "scheduled", "delivered", r1, r1, 76, ""],
    [c1, [["Dry Cleaning", 3], ["Wash & Fold", 2]], [1.8, 2.2], "Flat 12, Green Apartments, Colony A", "express", "in_progress", r1, null, 3, ""],
    [c2, [["Wash & Iron", 5]], [-2.5, 1.0], "House 45, Lane 3, Colony B", "scheduled", "ready", r2, null, 1.5, "Leave with security"],
    [c3, [["Wash & Fold", 3.5], ["Iron Only", 5]], [3.4, -1.6], "B-14, Sunrise Apartments, Colony C", "scheduled", "placed", null, null, 0.4, "Tomorrow morning please"],
    [c1, [["Wash & Fold", 2]], [1.8, 2.2], "Flat 12, Green Apartments, Colony A", "express", "placed", null, null, 0.1, ""],
    [c2, [["Dry Cleaning", 1]], [-2.5, 1.0], "House 45, Lane 3, Colony B", "scheduled", "cancelled", null, null, 30, "Changed my mind"],
  ];

  const tasksDone = new Map(); // rider id -> completed legs
  const bump = (r) => r && tasksDone.set(String(r._id), (tasksDone.get(String(r._id)) || 0) + 1);
  const tomorrow = new Date(Date.now() + 86400e3);

  for (const [n, [cust, items, off, addr, type, status, pr, dr, hoursAgo, notes]] of plan.entries()) {
    const createdAt = new Date(Date.now() - hoursAgo * H);
    const orderItems = items.map(([name, quantity]) => {
      const s = svc(name);
      return { service: s._id, serviceName: s.name, quantity, unit: s.unit, pricePerUnit: s.pricePerUnit, subtotal: round2(s.pricePerUnit * quantity) };
    });
    const subtotal = round2(orderItems.reduce((a, i) => a + i.subtotal, 0));
    const deliveryFee = subtotal >= C.FREE_DELIVERY_ABOVE ? 0 : C.DELIVERY_FEE;
    const expressFee = type === "express" ? C.EXPRESS_FEE : 0;

    // timeline: walk the flow up to `status`, ~20 min apart
    const steps = status === "cancelled" ? ["placed", "cancelled"] : FLOW.slice(0, FLOW.indexOf(status) + 1);
    const timeline = steps.map((st, i) => ({ status: st, at: new Date(createdAt.getTime() + i * 20 * 60e3) }));

    const done = FLOW.indexOf(status);
    if (done >= FLOW.indexOf("at_store")) bump(pr); // pickup leg completed
    if (status === "delivered") bump(dr); // delivery leg completed

    const doc = new Order({
      orderNumber: `LP-DEMO-${String(n + 1).padStart(3, "0")}`,
      user: cust._id,
      items: orderItems,
      pickupAddress: addr,
      pickupLocation: km2deg(store, off[0], off[1]),
      pickupType: type,
      pickupDate: type === "express" ? createdAt : tomorrow,
      pickupSlot: type === "express" ? `Express - within ${C.EXPRESS_ETA_MINUTES} min` : "10:00 AM - 12:00 PM",
      notes,
      subtotal, deliveryFee, expressFee,
      totalAmount: round2(subtotal + deliveryFee + expressFee),
      status,
      paymentStatus: status === "delivered" ? "paid" : "pending",
      pickupPartner: pr?._id || null,
      deliveryPartner: dr?._id || null,
      pickupOtp: otp(),
      deliveryOtp: otp(),
      timeline,
      createdAt,
      updatedAt: timeline[timeline.length - 1].at,
    });
    await doc.save({ timestamps: false });
  }

  for (const r of [r1, r2]) {
    const n = tasksDone.get(String(r._id)) || 0;
    await User.updateOne({ _id: r._id }, { $set: { "partner.completedTasks": n, "partner.earnings": n * C.PARTNER_PAYOUT_PER_TASK } });
  }
  console.log(`Created ${plan.length} demo orders in all states (delivered, cleaning, ready, placed, cancelled).`);
  return creds;
}

(async () => {
  if (!YES) {
    console.error("Refusing to write without --yes. This script writes to the database in MONGO_URI.");
    process.exit(1);
  }
  await connectDB();
  const { host, name } = mongoose.connection;
  console.log(`Database: ${name} @ ${host}`);
  if (REMOVE) await remove();
  else {
    const creds = await create();
    console.log("\nLOGINS (shown once - store them safely):");
    console.table(creds);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
