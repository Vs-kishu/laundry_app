const express = require("express");
const router = express.Router();
const c = require("../controllers/paymentController");

router.get("/config", c.getPaymentConfig);

module.exports = router;
