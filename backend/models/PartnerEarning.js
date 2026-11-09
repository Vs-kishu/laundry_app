const mongoose = require("mongoose");

const partnerEarningSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leg: { type: String, enum: ["pickup", "delivery"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    payoutReference: { type: String, trim: true, maxlength: 120 },
    earnedAt: { type: Date, default: Date.now },
    paidAt: Date,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

partnerEarningSchema.index({ order: 1, leg: 1 }, { unique: true });
partnerEarningSchema.index({ partner: 1, status: 1, earnedAt: -1 });

module.exports = mongoose.model("PartnerEarning", partnerEarningSchema);
