const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    pricePerUnit: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      enum: ["kg", "item"],
      default: "kg",
    },
    category: {
      type: String,
      enum: ["wash_fold", "dry_clean", "iron_only", "wash_iron"],
      default: "wash_fold",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
