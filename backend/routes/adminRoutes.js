const express = require("express");
const router = express.Router();
const c = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.use(protect, adminOnly);

router.get("/stats", c.getStats);
router.get("/partners", c.listPartners);
router.put("/partners/:id/verification", validate(c.verificationSchema), c.setVerification);

module.exports = router;
