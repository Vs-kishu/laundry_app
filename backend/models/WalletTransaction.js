const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    accountType: { type: String, enum: ["customer", "partner", "platform"], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: ["wallet_topup", "order_payment", "partner_earning", "wallet_refund"],
      required: true,
    },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    reference: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    paymentReference: { type: String, default: "" },
    description: { type: String, required: true, maxlength: 160 },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ accountType: 1, createdAt: -1 });
walletTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
