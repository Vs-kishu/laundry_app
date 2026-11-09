const mongoose = require("mongoose");

const paymentAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    checkout: { type: mongoose.Schema.Types.Mixed, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, default: undefined, unique: true, sparse: true },
    status: { type: String, enum: ["creating", "pending", "processing", "paid", "failed"], default: "creating" },
    processingAt: { type: Date, default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentAttempt", paymentAttemptSchema);
