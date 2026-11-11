const app = require("./app");
const connectDB = require("./config/db");
const { validateEnv } = require("./config/env");

module.exports = async (req, res) => {
  try {
    validateEnv();
    await connectDB();
    return app(req, res);
  } catch (error) {
    const requestId = req.headers["x-vercel-id"] || "unavailable";
    console.error("API initialization failed", {
      requestId,
      name: error.name,
      code: error.code,
      message: error.message,
    });
    const configurationError = error.code === "CONFIGURATION_ERROR";
    res.status(503).json({
      message: configurationError
        ? "Backend configuration is incomplete. Check MONGO_URI and JWT_SECRET in Vercel Environment Variables, then redeploy."
        : "Database connection failed. Check MONGO_URI, database credentials, and MongoDB Atlas network access.",
      requestId,
    });
  }
};
