const express = require("express");
const router = express.Router();
const c = require("../controllers/adminController");
const offers = require("../controllers/offerController");
const { protect, adminOnly, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const payments = require("../controllers/paymentController");

router.use(protect, adminOnly);

router.get("/stats", c.getStats);
router.get("/partners", c.listPartners);
router.get("/partner-earnings", c.getPartnerEarnings);
router.put("/partner-earnings/:id/pay", validate(c.payoutSchema), c.markPartnerEarningPaid);
router.get("/pending-payments", payments.listPendingPayments);
router.put("/orders/:id/payment-review", validate(payments.paymentReviewSchema), payments.reviewPayment);
router.put("/payment-settings", restrictTo("super_admin"), validate(payments.paymentSettingsSchema), payments.updatePaymentConfig);
router.put("/partners/:id/verification", validate(c.verificationSchema), c.setVerification);
router.get("/offers", offers.listAllOffers);
router.post("/offers", validate(offers.createOfferSchema), offers.createOffer);
router.put("/offers/:id", validate(offers.updateOfferSchema), offers.updateOffer);
router.delete("/offers/:id", offers.deleteOffer);

module.exports = router;
