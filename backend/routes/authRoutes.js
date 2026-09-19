const express = require("express");
const router = express.Router();
const c = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimit");

router.post("/signup", authLimiter, validate(c.signupSchema), c.signup);
router.post("/partner/signup", authLimiter, validate(c.partnerSignupSchema), c.partnerSignup);
router.post("/login", authLimiter, validate(c.loginSchema), c.login);
router.get("/me", protect, c.getProfile);
router.put("/me", protect, validate(c.profileSchema), c.updateProfile);

module.exports = router;
