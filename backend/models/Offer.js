const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 24 },
    type: { type: String, enum: ["percentage", "fixed", "bogo", "quantity"], required: true },
    value: { type: Number, required: true, min: 0 },
    discountKind: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    minimumQuantity: { type: Number, default: 0, min: 0 },
    minimumSubtotal: { type: Number, default: 0, min: 0 },
    maximumDiscount: { type: Number, default: null, min: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Offer", offerSchema);
