const express = require("express");
const router = express.Router();
const c = require("../controllers/walletController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.use(protect);
router.get("/", restrictTo("customer", "partner"), c.getWallet);
router.post("/topups", restrictTo("customer"), validate(c.topUpSchema), c.createTopUp);
router.post("/topups/verify", restrictTo("customer"), validate(c.signatureSchema), c.verifyTopUp);

module.exports = router;
