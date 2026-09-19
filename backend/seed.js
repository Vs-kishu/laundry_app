// Run with: npm run seed
// Populates services, the store, an admin account and a demo delivery partner.
// Existing users are never overwritten. Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
// (required in production) to choose the admin credentials.

require("dotenv").config();
const connectDB = require("./config/db");
const Service = require("./models/Service");
const Store = require("./models/Store");
const User = require("./models/User");
const { DEFAULT_STORE } = require("./config/constants");

const services = [
  { name: "Wash & Fold", description: "Everyday clothes washed, dried, and neatly folded.", pricePerUnit: 49, unit: "kg", category: "wash_fold" },
  { name: "Wash & Iron", description: "Clothes washed and pressed, ready to wear.", pricePerUnit: 69, unit: "kg", category: "wash_iron" },
  { name: "Dry Cleaning", description: "For delicate fabrics, suits, and formal wear.", pricePerUnit: 150, unit: "item", category: "dry_clean" },
  { name: "Iron Only", description: "Already clean clothes, pressed and crisp.", pricePerUnit: 20, unit: "item", category: "iron_only" },
];

const isProd = process.env.NODE_ENV === "production";

async function ensureUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return { created: false };
  await User.create(data);
  return { created: true };
}

const seedData = async () => {
  try {
    await connectDB();

    // upsert by name so re-running never wipes prices you edited
    for (const s of services) await Service.updateOne({ name: s.name }, { $setOnInsert: s }, { upsert: true });
    console.log("Services seeded");

    if (!(await Store.exists({}))) {
      await Store.create(DEFAULT_STORE);
      console.log("Store created - edit its location in the admin dashboard or via PUT /api/store");
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL || (!isProd && "admin@laundrypoint.local");
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || (!isProd && "Admin@12345");
    if (adminEmail && adminPassword) {
      const r = await ensureUser({
        name: "Laundry Point Admin",
        email: adminEmail,
        password: adminPassword,
        phone: "9999999999",
        role: "admin",
      });
      console.log(r.created ? `Admin created: ${adminEmail}` : `Admin already exists: ${adminEmail}`);
    } else {
      console.log("Skipped admin: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
    }

    if (!isProd) {
      const r = await ensureUser({
        name: "Demo Rider",
        email: "rider@laundrypoint.local",
        password: "Rider@12345",
        phone: "9888888888",
        role: "partner",
        partner: {
          vehicleType: "scooter",
          vehicleNumber: "DL01AB1234",
          licenseNumber: "DL0420200012345",
          verificationStatus: "approved",
        },
      });
      console.log(r.created ? "Demo partner created: rider@laundrypoint.local" : "Demo partner already exists");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
