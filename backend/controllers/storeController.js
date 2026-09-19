const { z } = require("zod");
const Store = require("../models/Store");
const asyncHandler = require("../utils/asyncHandler");
const C = require("../config/constants");

const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().min(5).max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  location: z
    .object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) })
    .optional(),
  serviceRadiusKm: z.coerce.number().min(1).max(100).optional(),
});

// @route GET /api/store - public config the booking UI needs (store pin, slots, fees)
const getStore = asyncHandler(async (req, res) => {
  const store = await Store.getCurrent();
  res.set("Cache-Control", "public, max-age=60");
  res.json({
    store: {
      name: store.name,
      address: store.address,
      phone: store.phone,
      location: store.location,
      serviceRadiusKm: store.serviceRadiusKm,
    },
    slots: C.SLOTS,
    fees: { delivery: C.DELIVERY_FEE, freeDeliveryAbove: C.FREE_DELIVERY_ABOVE, express: C.EXPRESS_FEE },
    expressEtaMinutes: C.EXPRESS_ETA_MINUTES,
  });
});

// @route PUT /api/store (admin)
const updateStore = asyncHandler(async (req, res) => {
  const current = (await Store.findOne()) || new Store(C.DEFAULT_STORE);
  Object.assign(current, req.body);
  await current.save();
  Store.clearCache();
  res.json(current);
});

module.exports = { getStore, updateStore, updateStoreSchema };
