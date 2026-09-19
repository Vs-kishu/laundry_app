const express = require("express");
const router = express.Router();
const c = require("../controllers/serviceController");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.get("/", c.getServices);
router.post("/", protect, adminOnly, validate(c.createServiceSchema), c.createService);
router.put("/:id", protect, adminOnly, validate(c.updateServiceSchema), c.updateService);
router.delete("/:id", protect, adminOnly, c.deleteService);

module.exports = router;
