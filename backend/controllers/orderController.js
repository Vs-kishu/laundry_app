const crypto = require("crypto");
const { z } = require("zod");
const Order = require("../models/Order");
const Service = require("../models/Service");
const Store = require("../models/Store");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const C = require("../config/constants");
const { haversineKm } = require("../utils/geo");
const { transition } = require("../utils/orderService");
const { serializeOrder } = require("../utils/orderView");
const { STATUSES, TERMINAL, CUSTOMER_CANCELLABLE, ADMIN_TRANSITIONS } = require("../utils/orderFlow");
const { notifyOrder } = require("../realtime/socket");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const round2 = (n) => Math.round(n * 100) / 100;
const otp = () => String(crypto.randomInt(1000, 10000));

const createOrderSchema = z.object({
  items: z
    .array(z.object({ serviceId: objectId, quantity: z.coerce.number().min(0.5).max(100) }))
    .min(1, "Add at least one service")
    .max(20),
  pickupAddress: z.string().trim().min(5, "Enter a complete address").max(300),
  pickupLocation: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }),
  pickupType: z.enum(["express", "scheduled"]).default("scheduled"),
  pickupDate: z.string().optional(),
  pickupSlot: z.string().optional(),
  notes: z.string().trim().max(300).optional().default(""),
});

const assignSchema = z.object({ leg: z.enum(["pickup", "delivery"]), partnerId: objectId });
const statusSchema = z.object({ status: z.enum(STATUSES) });

// Owner/partner/admin populated fields used when serialising.
const POPULATE_PARTNERS = [
  { path: "pickupPartner", select: "name phone partner.vehicleType partner.vehicleNumber partner.location" },
  { path: "deliveryPartner", select: "name phone partner.vehicleType partner.vehicleNumber partner.location" },
];

const isoDay = (d) => d.toISOString().slice(0, 10);

// @route POST /api/orders
const createOrder = asyncHandler(async (req, res) => {
  const { items, pickupAddress, pickupLocation, pickupType, pickupDate, pickupSlot, notes } = req.body;

  // Service area
  const store = await Store.getCurrent();
  const km = haversineKm(store.location, pickupLocation);
  if (km > store.serviceRadiusKm) {
    return res.status(400).json({
      message: `Sorry, that address is ${km.toFixed(1)} km from our store. We currently deliver within ${store.serviceRadiusKm} km.`,
    });
  }

  // When
  let date;
  let slot;
  if (pickupType === "express") {
    date = new Date();
    slot = `Express - within ${C.EXPRESS_ETA_MINUTES} min`;
  } else {
    if (!pickupDate || !pickupSlot) {
      return res.status(400).json({ message: "Pick a date and time slot for a scheduled pickup" });
    }
    date = new Date(`${pickupDate}T00:00:00.000Z`);
    const today = new Date(`${isoDay(new Date())}T00:00:00.000Z`);
    const limit = new Date(today.getTime() + 14 * 86400000);
    if (Number.isNaN(date.getTime()) || date < today || date > limit) {
      return res.status(400).json({ message: "Choose a pickup date within the next 14 days" });
    }
    if (!C.SLOTS.includes(pickupSlot)) return res.status(400).json({ message: "Invalid time slot" });
    slot = pickupSlot;
  }

  // Prices always come from the DB so the client can't tamper with them.
  const merged = new Map();
  for (const it of items) merged.set(it.serviceId, (merged.get(it.serviceId) || 0) + it.quantity);
  const services = await Service.find({ _id: { $in: [...merged.keys()] }, isActive: true }).lean();
  if (services.length !== merged.size) {
    return res.status(400).json({ message: "One of the selected services is no longer available" });
  }

  // per-item services are counted in whole pieces; only kg-based ones may be fractional
  const fractionalItem = services.find((s) => s.unit === "item" && !Number.isInteger(merged.get(String(s._id))));
  if (fractionalItem) {
    return res.status(400).json({ message: `${fractionalItem.name} is charged per item - use a whole number` });
  }

  const orderItems = services.map((s) => {
    const quantity = merged.get(String(s._id));
    return {
      service: s._id,
      serviceName: s.name,
      quantity,
      unit: s.unit,
      pricePerUnit: s.pricePerUnit,
      subtotal: round2(s.pricePerUnit * quantity),
    };
  });
  const subtotal = round2(orderItems.reduce((sum, i) => sum + i.subtotal, 0));
  const deliveryFee = subtotal >= C.FREE_DELIVERY_ABOVE ? 0 : C.DELIVERY_FEE;
  const expressFee = pickupType === "express" ? C.EXPRESS_FEE : 0;

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    pickupAddress,
    pickupLocation,
    pickupType,
    pickupDate: date,
    pickupSlot: slot,
    notes,
    subtotal,
    deliveryFee,
    expressFee,
    totalAmount: round2(subtotal + deliveryFee + expressFee),
    pickupOtp: otp(),
    deliveryOtp: otp(),
    timeline: [{ status: "placed", at: new Date() }],
  });

  notifyOrder(order);
  res.status(201).json(serializeOrder(order, req.user));
});

// @route GET /api/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate(POPULATE_PARTNERS)
    .lean();
  res.json(orders.map((o) => serializeOrder(o, req.user)));
});

// @route GET /api/orders/:id (owner, admin, or the assigned partner)
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .select("+pickupOtp +deliveryOtp")
    .populate("user", "name email phone")
    .populate(POPULATE_PARTNERS)
    .lean();
  if (!order) return res.status(404).json({ message: "Order not found" });

  const uid = String(req.user._id);
  const allowed =
    req.user.role === "admin" ||
    String(order.user._id) === uid ||
    [order.pickupPartner, order.deliveryPartner].some((p) => p && String(p._id) === uid);
  if (!allowed) return res.status(403).json({ message: "Not authorized to view this order" });

  res.json(serializeOrder(order, req.user));
});

// @route GET /api/orders?status=&page=&limit= (admin)
const getAllOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = {};
  if (req.query.status === "open") filter.status = { $nin: TERMINAL };
  else if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("user", "name email phone")
      .populate(POPULATE_PARTNERS)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    orders: orders.map((o) => serializeOrder(o, req.user)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

// @route PUT /api/orders/:id/cancel (owner)
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await transition(
    { _id: req.params.id, user: req.user._id, status: { $in: CUSTOMER_CANCELLABLE } },
    "cancelled"
  );
  if (!order) {
    return res.status(409).json({ message: "This order can't be cancelled any more" });
  }
  notifyOrder(order);
  res.json(serializeOrder(order, req.user));
});

// @route PUT /api/orders/:id/status (admin) - store-side steps and cancellations
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id).select("status");
  if (!order) return res.status(404).json({ message: "Order not found" });

  const allowed =
    status === "cancelled" ? !TERMINAL.includes(order.status) : ADMIN_TRANSITIONS[order.status]?.includes(status);
  if (!allowed) {
    return res.status(400).json({ message: `Can't move an order from "${order.status}" to "${status}"` });
  }

  const updated = await transition({ _id: order._id, status: order.status }, status);
  if (!updated) return res.status(409).json({ message: "Order changed, please refresh" });
  notifyOrder(updated);
  res.json(serializeOrder(updated, req.user));
});

// @route PUT /api/orders/:id/assign (admin) - manual partner assignment / reassignment
const assignPartner = asyncHandler(async (req, res) => {
  const { leg, partnerId } = req.body;
  const partner = await User.findOne({
    _id: partnerId,
    role: "partner",
    "partner.verificationStatus": "approved",
  }).select("_id");
  if (!partner) return res.status(400).json({ message: "Partner not found or not approved" });

  const cfg =
    leg === "pickup"
      ? { from: ["placed", "pickup_assigned"], to: "pickup_assigned", field: "pickupPartner" }
      : { from: ["ready", "delivery_assigned"], to: "delivery_assigned", field: "deliveryPartner" };

  const previous = await Order.findById(req.params.id).select(cfg.field);
  const updated = await transition({ _id: req.params.id, status: { $in: cfg.from } }, cfg.to, {
    [cfg.field]: partner._id,
  });
  if (!updated) return res.status(409).json({ message: `Order isn't waiting for a ${leg} partner` });

  // Make sure the previously assigned partner stops receiving location updates for this order.
  if (previous?.[cfg.field]) notifyOrder({ ...updated.toObject(), [cfg.field]: previous[cfg.field] });
  notifyOrder(updated);
  res.json(serializeOrder(updated, req.user));
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  cancelOrder,
  updateOrderStatus,
  assignPartner,
  createOrderSchema,
  assignSchema,
  statusSchema,
  POPULATE_PARTNERS,
};
