const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    serviceName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    pricePerUnit: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (arr) => arr.length > 0,
    },
    pickupAddress: {
      type: String,
      required: true,
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    pickupSlot: {
      type: String,
      required: true, // e.g. "9:00 AM - 11:00 AM"
    },
    notes: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "placed",
        "picked_up",
        "in_progress",
        "ready",
        "delivered",
        "cancelled",
      ],
      default: "placed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
