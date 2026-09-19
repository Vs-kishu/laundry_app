const express = require("express");
const router = express.Router();
const c = require("../controllers/orderController");
const { protect, adminOnly, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.post("/", protect, restrictTo("customer"), validate(c.createOrderSchema), c.createOrder);
router.get("/my", protect, restrictTo("customer"), c.getMyOrders);
router.get("/", protect, adminOnly, c.getAllOrders);
router.get("/:id", protect, c.getOrderById);
router.put("/:id/cancel", protect, restrictTo("customer"), c.cancelOrder);
router.put("/:id/status", protect, adminOnly, validate(c.statusSchema), c.updateOrderStatus);
router.put("/:id/assign", protect, adminOnly, validate(c.assignSchema), c.assignPartner);

module.exports = router;
