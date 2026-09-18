// Run with: node seed.js
// Populates the database with some starter laundry services.

require("dotenv").config();
const connectDB = require("./config/db");
const Service = require("./models/Service");

const services = [
  {
    name: "Wash & Fold",
    description: "Everyday clothes washed, dried, and neatly folded.",
    pricePerUnit: 49,
    unit: "kg",
    category: "wash_fold",
  },
  {
    name: "Wash & Iron",
    description: "Clothes washed and pressed, ready to wear.",
    pricePerUnit: 69,
    unit: "kg",
    category: "wash_iron",
  },
  {
    name: "Dry Cleaning",
    description: "For delicate fabrics, suits, and formal wear.",
    pricePerUnit: 150,
    unit: "item",
    category: "dry_clean",
  },
  {
    name: "Iron Only",
    description: "Already clean clothes, pressed and crisp.",
    pricePerUnit: 20,
    unit: "item",
    category: "iron_only",
  },
];

const seedData = async () => {
  try {
    await connectDB();
    await Service.deleteMany({});
    await Service.insertMany(services);
    console.log("Services seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
