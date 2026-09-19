const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

// Verifies the JWT and attaches the user to the request.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Not authorized, invalid or expired token" });
  }

  const user = await User.findById(decoded.id);
  if (!user) return res.status(401).json({ message: "User not found" });

  req.user = user;
  next();
});

// Restricts a route to the given roles - use after `protect`.
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    return res.status(403).json({ message: "You don't have access to this resource" });
  };

const adminOnly = restrictTo("admin");

// Partner routes that change state require an admin-approved account.
const approvedPartner = (req, res, next) => {
  if (req.user?.role !== "partner") {
    return res.status(403).json({ message: "Delivery partner access required" });
  }
  if (req.user.partner?.verificationStatus !== "approved") {
    return res.status(403).json({ message: "Your partner account is awaiting approval" });
  }
  next();
};

module.exports = { protect, restrictTo, adminOnly, approvedPartner };
