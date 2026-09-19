const crypto = require("crypto");
const mongoose = require("mongoose");
const { STATUSES } = require("../utils/orderFlow");

const orderItemSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.5 },
    unit: { type: String, required: true },
    pricePerUnit: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const pointSchema = new mongoose.Schema(
  { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true, validate: (a) => a.length > 0 },

    // Clothes are collected from and returned to the same address.
    pickupAddress: { type: String, required: true },
    pickupLocation: { type: pointSchema, required: true },
    pickupType: { type: String, enum: ["express", "scheduled"], default: "scheduled" },
    pickupDate: { type: Date, required: true },
    pickupSlot: { type: String, required: true },
    notes: { type: String, default: "", maxlength: 300 },

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    expressFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    status: { type: String, enum: STATUSES, default: "placed" },
    paymentMethod: { type: String, enum: ["cod"], default: "cod" },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },

    pickupPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Handover codes: the customer reads them out to the partner (like Zepto/Blinkit).
    pickupOtp: { type: String, select: false },
    deliveryOtp: { type: String, select: false },

    timeline: [{ _id: false, status: { type: String, enum: STATUSES }, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ pickupPartner: 1, status: 1 });
orderSchema.index({ deliveryPartner: 1, status: 1 });

orderSchema.pre("validate", function (next) {
  if (!this.orderNumber) {
    this.orderNumber = "LP-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
