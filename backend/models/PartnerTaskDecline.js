const mongoose = require("mongoose");

const partnerTaskDeclineSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leg: { type: String, enum: ["pickup", "delivery"], required: true },
  },
  { timestamps: true }
);

partnerTaskDeclineSchema.index({ order: 1, partner: 1, leg: 1 }, { unique: true });
partnerTaskDeclineSchema.index({ partner: 1, leg: 1, createdAt: -1 });

module.exports = mongoose.model("PartnerTaskDecline", partnerTaskDeclineSchema);
