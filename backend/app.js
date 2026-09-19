const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const mongoose = require("mongoose");
const { clientOrigins } = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1); // correct client IPs behind Render/Railway/Nginx for rate limiting
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const origins = clientOrigins();
app.use(
  cors({
    origin: (origin, cb) => (!origin || origins.includes(origin) ? cb(null, true) : cb(new Error("CORS blocked"))),
  })
);
app.use(compression());
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", uptime: Math.round(process.uptime()) });
});

app.use("/api", apiLimiter);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/services", require("./routes/serviceRoutes"));
app.use("/api/store", require("./routes/storeRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/partner", require("./routes/partnerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
