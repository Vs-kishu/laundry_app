const mongoose = require("mongoose");

const paymentSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ["primary"], default: "primary", unique: true },
    upiId: { type: String, required: true, trim: true, lowercase: true },
    qrImageData: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentSettings", paymentSettingsSchema);
