const mongoose = require("mongoose");

const walletTopUpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 100 },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, default: undefined, unique: true, sparse: true },
    paymentReference: { type: String, default: undefined, unique: true, sparse: true },
    status: { type: String, enum: ["creating", "pending", "processing", "paid", "failed"], default: "creating" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTopUp", walletTopUpSchema);
