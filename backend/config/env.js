// Fail fast on missing configuration instead of crashing later with a vague error.
const isProd = process.env.NODE_ENV === "production";

function validateEnv() {
  const missing = ["MONGO_URI", "JWT_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (isProd && process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET must be at least 32 characters in production");
    process.exit(1);
  }
  const paymentKeys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
  if (isProd && [...paymentKeys, "RAZORPAY_WEBHOOK_SECRET"].some((key) => !process.env[key])) {
    console.error("Production requires RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET");
    process.exit(1);
  }
  if (paymentKeys.some((key) => process.env[key]) && paymentKeys.some((key) => !process.env[key])) {
    console.error("Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable online payments");
    process.exit(1);
  }
}

// CLIENT_URL may hold several origins, comma separated.
const clientOrigins = () =>
  (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = { validateEnv, clientOrigins, isProd };
