const { z } = require("zod");
const Service = require("../models/Service");
const Offer = require("../models/Offer");
const asyncHandler = require("../utils/asyncHandler");
const { findOffer, calculateDiscount, round2 } = require("../utils/offerPricing");
const C = require("../config/constants");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id");
const itemsSchema = z.array(z.object({
  serviceId: objectId,
  quantity: z.coerce.number().min(0.5).max(100),
})).min(1).max(20);

const offerFields = {
  title: z.string().trim().min(2).max(100),
  code: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_-]+$/).transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed", "bogo", "quantity"]),
  value: z.coerce.number().positive().max(100000),
  discountKind: z.enum(["percentage", "fixed"]).default("percentage"),
  minimumQuantity: z.coerce.number().min(0).default(0),
  minimumSubtotal: z.coerce.number().min(0).default(0),
  maximumDiscount: z.coerce.number().positive().nullable().optional().default(null),
  startsAt: z.coerce.date().nullable().optional().default(null),
  endsAt: z.coerce.date().nullable().optional().default(null),
  isActive: z.boolean().default(true),
};
const offerObjectSchema = z.object(offerFields);
const validateOfferValues = (value, ctx) => {
  if (value.type === "bogo" && value.value !== 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "BOGO offers give one eligible item free; value must be 100" });
  }
  if ((value.type === "percentage" || (value.type === "quantity" && value.discountKind === "percentage")) && value.value > 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage discounts cannot exceed 100%" });
  }
  if (value.startsAt && value.endsAt && value.startsAt >= value.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after the start date" });
  }
};
const createOfferSchema = offerObjectSchema.superRefine(validateOfferValues);
const updateOfferSchema = offerObjectSchema.partial().superRefine(validateOfferValues);
const validateOfferSchema = z.object({
  couponCode: z.string().trim().min(1).max(24),
  items: itemsSchema,
  pickupType: z.enum(["express", "scheduled"]).default("scheduled"),
});

async function priceOffer(couponCode, inputItems, pickupType) {
  const merged = new Map();
  for (const item of inputItems) merged.set(item.serviceId, (merged.get(item.serviceId) || 0) + item.quantity);
  const services = await Service.find({ _id: { $in: [...merged.keys()] }, isActive: true }).lean();
  if (services.length !== merged.size) return { error: "One of the selected services is no longer available" };
  const items = services.map((service) => {
    const quantity = merged.get(String(service._id));
    if (service.unit === "item" && !Number.isInteger(quantity)) return null;
    return { quantity, unit: service.unit, pricePerUnit: service.pricePerUnit, subtotal: round2(quantity * service.pricePerUnit) };
  });
  if (items.some((item) => item === null)) return { error: "Item-based services must use whole quantities" };

  const subtotal = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
  const found = await findOffer(couponCode);
  if (found.error) return found;
  const result = calculateDiscount(found.offer, items, subtotal);
  if (result.error) return result;
  const deliveryFee = subtotal >= C.FREE_DELIVERY_ABOVE ? 0 : C.DELIVERY_FEE;
  const expressFee = pickupType === "express" ? C.EXPRESS_FEE : 0;
  return {
    offer: { title: found.offer.title, code: found.offer.code, type: found.offer.type },
    subtotal,
    discountAmount: result.discount,
    deliveryFee,
    expressFee,
    totalAmount: round2(subtotal - result.discount + deliveryFee + expressFee),
  };
}

const listActiveOffers = asyncHandler(async (_req, res) => {
  const now = new Date();
  const offers = await Offer.find({ isActive: true, $and: [
    { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
    { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
  ] }).select("title code type value discountKind minimumQuantity minimumSubtotal maximumDiscount").lean();
  res.json(offers);
});

const validateOffer = asyncHandler(async (req, res) => {
  const result = await priceOffer(req.body.couponCode, req.body.items, req.body.pickupType);
  if (result.error) return res.status(400).json({ message: result.error });
  res.json(result);
});

const listAllOffers = asyncHandler(async (_req, res) => {
  res.json(await Offer.find().sort({ createdAt: -1 }).lean());
});

const createOffer = asyncHandler(async (req, res) => {
  res.status(201).json(await Offer.create(req.body));
});

const updateOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!offer) return res.status(404).json({ message: "Offer not found" });
  res.json(offer);
});

const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!offer) return res.status(404).json({ message: "Offer not found" });
  res.json({ message: "Offer disabled" });
});

module.exports = {
  listActiveOffers,
  validateOffer,
  listAllOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  createOfferSchema,
  updateOfferSchema,
  validateOfferSchema,
  priceOffer,
};
