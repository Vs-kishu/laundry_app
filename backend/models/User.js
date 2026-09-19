const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const partnerSchema = new mongoose.Schema(
  {
    vehicleType: { type: String, enum: ["bike", "scooter", "cycle", "ev"], default: "bike" },
    vehicleNumber: { type: String, trim: true, uppercase: true },
    licenseNumber: { type: String, trim: true, uppercase: true },
    // New partners must be approved by an admin before they can go online.
    verificationStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    isOnline: { type: Boolean, default: false },
    location: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },
    completedTasks: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, "Password is required"], minlength: 6, select: false },
    phone: { type: String, required: [true, "Phone number is required"], trim: true },
    role: { type: String, enum: ["customer", "partner", "admin"], default: "customer" },
    address: { type: String, default: "" },
    partner: { type: partnerSchema, default: undefined },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 });
userSchema.index({ role: 1, "partner.verificationStatus": 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);
