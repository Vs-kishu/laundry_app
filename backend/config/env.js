// Fail fast on missing configuration instead of crashing later with a vague error.
const isProd = process.env.NODE_ENV === "production";

function validateEnv() {
  const missing = ["MONGO_URI", "JWT_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    const error = new Error(`Missing required environment variables: ${missing.join(", ")}`);
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  if (isProd && process.env.JWT_SECRET.length < 32) {
    const error = new Error("JWT_SECRET must be at least 32 characters in production");
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
}

// CLIENT_URL may hold several origins, comma separated.
const clientOrigins = () =>
  (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = { validateEnv, clientOrigins, isProd };
