const express = require("express");
const router = express.Router();
const c = require("../controllers/adminController");
const offers = require("../controllers/offerController");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.use(protect, adminOnly);

router.get("/stats", c.getStats);
router.get("/partners", c.listPartners);
router.get("/wallet", c.getWalletLedger);
router.put("/partners/:id/verification", validate(c.verificationSchema), c.setVerification);
router.get("/offers", offers.listAllOffers);
router.post("/offers", validate(offers.createOfferSchema), offers.createOffer);
router.put("/offers/:id", validate(offers.updateOfferSchema), offers.updateOffer);
router.delete("/offers/:id", offers.deleteOffer);

module.exports = router;
