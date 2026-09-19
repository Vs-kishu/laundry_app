require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { validateEnv } = require("./config/env");
validateEnv();

const connectDB = require("./config/db");
const app = require("./app");
const realtime = require("./realtime/socket");

const server = http.createServer(app);
realtime.init(server);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Laundry Point API + sockets listening on port ${PORT}`));
});

// Graceful shutdown so deploys don't drop in-flight requests.
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
