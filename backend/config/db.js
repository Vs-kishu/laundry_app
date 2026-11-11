const mongoose = require("mongoose");

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGO_URI) {
    const error = new Error("MONGO_URI is not configured");
    error.code = "CONFIGURATION_ERROR";
    throw error;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 8000,
    }).then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn.connection;
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  return connectionPromise;
};

module.exports = connectDB;
