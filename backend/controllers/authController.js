const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { notifyPartnerChanged } = require("../realtime/socket");

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ---- validation schemas ----
const email = z.string().trim().toLowerCase().email("Enter a valid email");
const password = z.string().min(8, "Use at least 8 characters").max(72);
// Stored as digits only (last 10 for numbers with a country code) so +91 98765 43210 == 9876543210.
const normalizePhone = (v) => {
  const d = String(v).replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
};
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,15}$/, "Enter a valid mobile number")
  .transform(normalizePhone);

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password,
  phone,
  address: z.string().trim().max(300).optional().default(""),
});

const partnerSignupSchema = signupSchema.omit({ address: true }).extend({
  vehicleType: z.enum(["bike", "scooter", "cycle", "ev"]),
  vehicleNumber: z.string().trim().min(4, "Enter your vehicle number").max(20),
  licenseNumber: z.string().trim().min(5, "Enter your driving licence / ID number").max(30),
});

// Log in with either email or mobile number (`email` accepted for older clients).
const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, "Enter your email or mobile number").optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Enter your password"),
  })
  .refine((v) => v.identifier || v.email, { message: "Enter your email or mobile number", path: ["identifier"] });

const findByIdentifier = (raw) => {
  const id = raw.trim();
  if (id.includes("@")) return User.findOne({ email: id.toLowerCase() }).select("+password");
  const digits = normalizePhone(id);
  return User.findOne({ phone: { $in: [digits, id] } }).select("+password");
};

// Friendly duplicate check for both identifiers.
async function duplicateMessage(emailAddr, phoneNum) {
  if (await User.exists({ email: emailAddr })) return "An account with this email already exists";
  if (await User.exists({ phone: phoneNum })) return "An account with this mobile number already exists";
  return null;
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional(),
  address: z.string().trim().max(300).optional(),
});

// ---- helpers ----
const userPayload = (u, withToken = false) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  address: u.address,
  ...(u.role === "partner" && u.partner
    ? {
        partner: {
          verificationStatus: u.partner.verificationStatus,
          isOnline: u.partner.isOnline,
          vehicleType: u.partner.vehicleType,
          vehicleNumber: u.partner.vehicleNumber,
          completedTasks: u.partner.completedTasks,
          earnings: u.partner.earnings,
        },
      }
    : {}),
  ...(withToken ? { token: generateToken(u._id) } : {}),
});

// @route POST /api/auth/signup
const signup = asyncHandler(async (req, res) => {
  const dup = await duplicateMessage(req.body.email, req.body.phone);
  if (dup) return res.status(400).json({ message: dup });
  // role is never taken from the request body
  const user = await User.create({ ...req.body, role: "customer" });
  res.status(201).json(userPayload(user, true));
});

// @route POST /api/auth/partner/signup - creates a partner awaiting admin approval
const partnerSignup = asyncHandler(async (req, res) => {
  const { vehicleType, vehicleNumber, licenseNumber, ...rest } = req.body;
  const dup = await duplicateMessage(rest.email, rest.phone);
  if (dup) return res.status(400).json({ message: dup });
  const user = await User.create({
    ...rest,
    role: "partner",
    partner: { vehicleType, vehicleNumber, licenseNumber, verificationStatus: "pending" },
  });
  notifyPartnerChanged(user._id);
  res.status(201).json(userPayload(user, true));
});

// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const user = await findByIdentifier(req.body.identifier || req.body.email);
  if (user && (await user.matchPassword(req.body.password))) {
    return res.json(userPayload(user, true));
  }
  res.status(401).json({ message: "Invalid email/mobile number or password" });
});

// @route GET /api/auth/me
const getProfile = (req, res) => res.json(userPayload(req.user));

// @route PUT /api/auth/me
const updateProfile = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json(userPayload(req.user));
});

module.exports = {
  signup,
  partnerSignup,
  login,
  getProfile,
  updateProfile,
  signupSchema,
  partnerSignupSchema,
  loginSchema,
  profileSchema,
};
