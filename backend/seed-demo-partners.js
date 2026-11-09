require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Store = require("./models/Store");
const C = require("./config/constants");

const DOMAIN = "@demo.laundrypoint.app";
const YES = process.argv.includes("--yes");
const strongPassword = () => crypto.randomBytes(9).toString("base64url") + "!9";

const km2deg = (store, eastKm, northKm) => ({
  lat: store.location.lat + northKm / 110.574,
  lng: store.location.lng + eastKm / (111.32 * Math.cos((store.location.lat * Math.PI) / 180)),
});

async function seedPartners() {
  const store = (await Store.findOne().lean()) || C.DEFAULT_STORE;
  const output = [];
  for (let i = 1; i <= 5; i += 1) {
    const email = `testrider${i}${DOMAIN}`;
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== "partner") throw new Error(`Refusing to overwrite non-partner demo account ${email}`);
      output.push({ email, password: "(unchanged - already existed)" });
      continue;
    }

    const password = process.env.DEMO_PASSWORD || strongPassword();
    const nearStore = km2deg(store, i * 0.8, (i % 3) * 0.9);
    await User.create({
      name: `Test Delivery Partner ${i}`,
      email,
      password,
      phone: `90000003${String(i).padStart(2, "0")}`,
      role: "partner",
      partner: {
        vehicleType: ["bike", "scooter", "ev", "bike", "scooter"][i - 1],
        vehicleNumber: `DL9T${String(i).padStart(2, "0")}AB`,
        licenseNumber: `TESTDL2026${String(i).padStart(4, "0")}`,
        verificationStatus: "approved",
        isOnline: true,
        location: { ...nearStore, updatedAt: new Date() },
      },
    });
    output.push({ email, password });
  }
  console.table(output);
  console.log("Created or found five approved test partners. Set DEMO_PASSWORD to use one shared password.");
}

(async () => {
  if (!YES) {
    console.error("Refusing to write without --yes. This script creates demo partner accounts in the database configured by MONGO_URI.");
    process.exit(1);
  }
  await connectDB();
  const { host, name } = mongoose.connection;
  console.log(`Database: ${name} @ ${host}`);
  await seedPartners();
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect();
  process.exit(1);
});
