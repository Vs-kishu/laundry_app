const express = require("express");
const router = express.Router();
const c = require("../controllers/storeController");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.get("/", c.getStore);
router.put("/", protect, adminOnly, validate(c.updateStoreSchema), c.updateStore);

module.exports = router;
