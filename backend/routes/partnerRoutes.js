const express = require("express");
const router = express.Router();
const c = require("../controllers/partnerController");
const { protect, approvedPartner } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { otpLimiter } = require("../middleware/rateLimit");

router.use(protect, approvedPartner);

router.put("/status", validate(c.statusSchema), c.setOnline);
router.get("/tasks/available", c.getAvailableTasks);
router.get("/tasks/mine", c.getMyTasks);
router.post("/tasks/:orderId/accept", validate(c.acceptSchema), c.acceptTask);
router.post("/tasks/:orderId/advance", otpLimiter, validate(c.advanceSchema), c.advanceTask);

module.exports = router;
