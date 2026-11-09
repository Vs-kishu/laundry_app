// Run with: npm run seed
// Populates services, the store, demo customer/staff accounts, and an admin account.
// Existing users are never overwritten. In production, set SEED_ADMIN_EMAIL /
// SEED_ADMIN_PASSWORD and SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD.

require("dotenv").config();
const connectDB = require("./config/db");
const Service = require("./models/Service");
const Store = require("./models/Store");
const User = require("./models/User");
const Offer = require("./models/Offer");
const { DEFAULT_STORE } = require("./config/constants");

const services = [
  { name: "Wash & Fold", description: "Everyday clothes washed, dried, and neatly folded.", pricePerUnit: 49, unit: "kg", category: "wash_fold" },
  { name: "Wash & Iron", description: "Clothes washed and pressed, ready to wear.", pricePerUnit: 69, unit: "kg", category: "wash_iron" },
  { name: "Dry Cleaning", description: "For delicate fabrics, suits, and formal wear.", pricePerUnit: 150, unit: "item", category: "dry_clean" },
  { name: "Iron Only", description: "Already clean clothes, pressed and crisp.", pricePerUnit: 20, unit: "item", category: "iron_only" },
];

const offers = [
  { title: "Welcome 15% Off", code: "WELCOME15", type: "percentage", value: 15, minimumSubtotal: 149, maximumDiscount: 100 },
  { title: "Laundry Saver", code: "BULK10", type: "quantity", value: 10, discountKind: "percentage", minimumQuantity: 5, minimumSubtotal: 200, maximumDiscount: 150 },
  { title: "Ironing BOGO", code: "BOGOIRON", type: "bogo", value: 100, minimumSubtotal: 40 },
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
    for (const offer of offers) {
      await Offer.updateOne({ code: offer.code }, { $setOnInsert: offer }, { upsert: true });
    }
    console.log("Offers seeded");

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

    const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || (!isProd && "superadmin@laundrypoint.local");
    const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || (!isProd && "SuperAdmin@12345");
    if (superAdminEmail && superAdminPassword) {
      const r = await ensureUser({
        name: "Laundry Point Super Admin",
        email: superAdminEmail,
        password: superAdminPassword,
        phone: "9999999998",
        role: "super_admin",
      });
      console.log(r.created ? `Super admin created: ${superAdminEmail}` : `Super admin already exists: ${superAdminEmail}`);
    } else {
      console.log("Skipped super admin: set SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD");
    }

    if (!isProd) {
      const customer = await ensureUser({
        name: "Demo Customer",
        email: "customer@laundrypoint.local",
        password: "Customer@12345",
        phone: "9999999997",
        role: "customer",
      });
      console.log(customer.created ? "Demo customer created: customer@laundrypoint.local" : "Demo customer already exists");

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
