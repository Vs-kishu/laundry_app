const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;

const make = (windowMs, limit, message, keyGenerator) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message },
    ...(keyGenerator ? { keyGenerator } : {}),
  });

// General API protection.
const apiLimiter = make(60_000, 300, "Too many requests, please slow down");
// Brute-force protection for login / signup.
const authLimiter = make(15 * 60_000, 30, "Too many attempts, please try again in a few minutes");
// OTP guessing: keyed per partner account rather than per IP (users share mobile carrier IPs).
const otpLimiter = make(60_000, 10, "Too many OTP attempts, wait a minute", (req) => req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip));

module.exports = { apiLimiter, authLimiter, otpLimiter };
