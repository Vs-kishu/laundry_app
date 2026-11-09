const express = require("express");
const router = express.Router();
const c = require("../controllers/offerController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.get("/", c.listActiveOffers);
router.post("/validate", protect, restrictTo("customer"), validate(c.validateOfferSchema), c.validateOffer);

module.exports = router;
