const { z } = require("zod");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");
const Store = require("../models/Store");
const asyncHandler = require("../utils/asyncHandler");
const C = require("../config/constants");
const { haversineKm } = require("../utils/geo");
const { transition } = require("../utils/orderService");
const { serializeOrder } = require("../utils/orderView");
const { PICKUP_ACTIVE, DELIVERY_ACTIVE } = require("../utils/orderFlow");
const { notifyOrder, notifyPartnerChanged, notifyUser } = require("../realtime/socket");
const { POPULATE_PARTNERS } = require("./orderController");
const PartnerEarning = require("../models/PartnerEarning");
const PartnerTaskDecline = require("../models/PartnerTaskDecline");

const statusSchema = z.object({
  online: z.boolean(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
}).refine((value) => !value.online || value.location, {
  message: "Enable location services and share your current location before going online",
  path: ["location"],
});
const acceptSchema = z.object({ leg: z.enum(["pickup", "delivery"]) });
const declineSchema = z.object({ leg: z.enum(["pickup", "delivery"]) });
const advanceSchema = z.object({ otp: z.string().trim().regex(/^\d{4}$/, "OTP must be 4 digits").optional() });
const payoutDetailsSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("upi"),
    upiId: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,64}@[a-z0-9.-]{2,64}$/, "Enter a valid UPI ID"),
  }),
  z.object({
    method: z.literal("bank"),
    accountHolder: z.string().trim().min(2).max(80),
    accountNumber: z.string().trim().regex(/^\d{8,20}$/, "Enter a valid bank account number"),
    ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
  }),
]);

const mineFilter = (partnerId) => ({
  $or: [
    { pickupPartner: partnerId, status: { $in: PICKUP_ACTIVE } },
    { deliveryPartner: partnerId, status: { $in: DELIVERY_ACTIVE } },
  ],
});

const hasFreshLocation = (partner) => {
  const updatedAt = partner.location?.updatedAt?.getTime?.();
  return Boolean(updatedAt && Date.now() - updatedAt <= 60000);
};
const payoutFor = (totalAmount) => Math.round(totalAmount * C.PARTNER_EARNING_PERCENT) / 100;
const firstStopFor = (order, leg, store) => leg === "pickup" ? order.pickupLocation : store.location;

const isLocationInRange = (location, target, radiusKm) =>
  location?.lat != null && location?.lng != null && haversineKm(location, target) <= radiusKm;

const taskIsInRange = (order, leg, partner, store) => {
  return isLocationInRange(partner.location, firstStopFor(order, leg, store), store.serviceRadiusKm);
};

const pickupTaskFilter = (partner, radiusKm) => {
  const { lat, lng } = partner.location;
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 1e-8));
  const minLat = Math.max(-90, lat - latDelta);
  const maxLat = Math.min(90, lat + latDelta);
  const filter = {
    status: "placed",
    paymentStatus: "paid",
    pickupPartner: null,
    pickupLocation: { $exists: true },
    "pickupLocation.lat": { $gte: minLat, $lte: maxLat },
  };

  if (lngDelta < 180 && minLat > -90 && maxLat < 90) {
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;
    if (minLng < -180) {
      filter.$or = [
        { "pickupLocation.lng": { $gte: minLng + 360 } },
        { "pickupLocation.lng": { $lte: maxLng } },
      ];
    } else if (maxLng > 180) {
      filter.$or = [
        { "pickupLocation.lng": { $gte: minLng } },
        { "pickupLocation.lng": { $lte: maxLng - 360 } },
      ];
    } else {
      filter["pickupLocation.lng"] = { $gte: minLng, $lte: maxLng };
    }
  }
  return filter;
};

const getPayoutSummary = asyncHandler(async (req, res) => {
  const [totals, earnings] = await Promise.all([
    PartnerEarning.aggregate([
      { $match: { partner: req.user._id } },
      { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    PartnerEarning.find({ partner: req.user._id })
      .sort({ earnedAt: -1 })
      .limit(100)
      .populate("order", "orderNumber totalAmount")
      .lean(),
  ]);
  const summary = Object.fromEntries(totals.map(({ _id, amount, count }) => [_id, { amount, count }]));
  res.json({
    payoutDetails: req.user.partner.payoutDetails || null,
    pending: summary.pending || { amount: 0, count: 0 },
    paid: summary.paid || { amount: 0, count: 0 },
    earnings,
  });
});

const updatePayoutDetails = asyncHandler(async (req, res) => {
  const { method, ...details } = req.body;
  req.user.partner.payoutDetails = { method, ...details };
  await req.user.save();
  res.json({ payoutDetails: req.user.partner.payoutDetails.toObject() });
});

// @route PUT /api/partner/status
const setOnline = asyncHandler(async (req, res) => {
  const { online } = req.body;
  if (online) {
    req.user.partner.location = { ...req.body.location, updatedAt: new Date() };
  }
  if (!online && (await Order.exists(mineFilter(req.user._id)))) {
    return res.status(409).json({ message: "Finish your active tasks before going offline" });
  }
  req.user.partner.isOnline = online;
  await req.user.save();
  notifyPartnerChanged(req.user._id);
  res.json({ isOnline: online });
});

// @route GET /api/partner/tasks/available
const getAvailableTasks = asyncHandler(async (req, res) => {
  if (!req.user.partner.isOnline) return res.json([]);
  if (!hasFreshLocation(req.user.partner)) return res.json([]);

  const store = await Store.getCurrent();
  const canReachStore = isLocationInRange(req.user.partner.location, store.location, store.serviceRadiusKm);
  const [pickups, deliveries, declined] = await Promise.all([
    Order.find(pickupTaskFilter(req.user.partner, store.serviceRadiusKm)).sort({ createdAt: 1 }).lean(),
    canReachStore
      ? Order.find({ status: "ready", paymentStatus: "paid", deliveryPartner: null, pickupLocation: { $exists: true } }).sort({ updatedAt: 1 }).lean()
      : [],
    PartnerTaskDecline.find({ partner: req.user._id }).select("order leg").lean(),
  ]);
  const declinedKeys = new Set(declined.map((item) => `${item.order}:${item.leg}`));
  const here = req.user.partner.location;

  const toTask = (o, leg) => {
    const firstStop = firstStopFor(o, leg, store);
    const toFirstStopKm = haversineKm(here, firstStop);
    return {
      orderId: o._id,
      orderNumber: o.orderNumber,
      leg,
      express: o.pickupType === "express",
      slot: o.pickupSlot,
      address: o.pickupAddress,
      location: o.pickupLocation,
      itemCount: o.items.length,
      tripKm: Math.round(haversineKm(store.location, o.pickupLocation) * 10) / 10,
      toFirstStopKm: Math.round(toFirstStopKm * 10) / 10,
      rangeKm: store.serviceRadiusKm,
      payout: payoutFor(o.totalAmount),
      createdAt: o.createdAt,
    };
  };

  const tasks = [
    ...pickups.filter((o) => !declinedKeys.has(`${o._id}:pickup`) && taskIsInRange(o, "pickup", req.user.partner, store)).map((o) => toTask(o, "pickup")),
    ...deliveries.filter((o) => !declinedKeys.has(`${o._id}:delivery`) && taskIsInRange(o, "delivery", req.user.partner, store)).map((o) => toTask(o, "delivery")),
  ];
  // express first, then oldest first
  tasks.sort((a, b) => Number(b.express) - Number(a.express) || new Date(a.createdAt) - new Date(b.createdAt));
  res.json(tasks);
});

// @route GET /api/partner/tasks/mine
const getMyTasks = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const [active, history] = await Promise.all([
    Order.find(mineFilter(uid)).sort({ updatedAt: -1 }).populate("user", "name phone").populate(POPULATE_PARTNERS).lean(),
    Order.find({
      $or: [{ pickupPartner: uid }, { deliveryPartner: uid }],
      status: { $nin: [...PICKUP_ACTIVE, ...DELIVERY_ACTIVE] },
    })
      .sort({ updatedAt: -1 })
      .limit(15)
      .select("orderNumber status pickupAddress totalAmount updatedAt")
      .lean(),
  ]);
  res.json({ active: active.map((o) => serializeOrder(o, req.user)), history });
});

// @route POST /api/partner/tasks/:orderId/accept
const acceptTask = asyncHandler(async (req, res) => {
  if (!req.user.partner.isOnline) return res.status(409).json({ message: "Go online to accept tasks" });
  if (!hasFreshLocation(req.user.partner)) {
    return res.status(409).json({ message: "Live location has stopped. Re-enable location and wait for a fresh GPS fix before accepting tasks." });
  }

  const activeCount = await Order.countDocuments(mineFilter(req.user._id));
  if (activeCount >= C.MAX_ACTIVE_TASKS_PER_PARTNER) {
    return res.status(409).json({ message: `You can hold ${C.MAX_ACTIVE_TASKS_PER_PARTNER} active tasks at a time` });
  }

  const { leg } = req.body;
  const store = await Store.getCurrent();
  const openFilter = leg === "pickup"
    ? { _id: req.params.orderId, status: "placed", paymentStatus: "paid", pickupPartner: null }
    : { _id: req.params.orderId, status: "ready", paymentStatus: "paid", deliveryPartner: null };
  const candidate = await Order.findOne(openFilter).select("pickupLocation");
  if (!candidate) return res.status(409).json({ message: "This task is no longer available" });
  if (await PartnerTaskDecline.exists({ order: candidate._id, partner: req.user._id, leg })) {
    return res.status(409).json({ message: "You already declined this task" });
  }
  if (!taskIsInRange(candidate, leg, req.user.partner, store)) {
    return res.status(409).json({ message: "This task is outside your current service range" });
  }
  const order =
    leg === "pickup"
      ? await transition({ _id: req.params.orderId, status: "placed", paymentStatus: "paid", pickupPartner: null }, "pickup_assigned", {
          pickupPartner: req.user._id,
        })
      : await transition({ _id: req.params.orderId, status: "ready", paymentStatus: "paid", deliveryPartner: null }, "delivery_assigned", {
          deliveryPartner: req.user._id,
        });

  if (!order) return res.status(409).json({ message: "Too late - another partner already took this task" });

  notifyOrder(order);
  const full = await Order.findById(order._id).populate("user", "name phone").populate(POPULATE_PARTNERS).lean();
  res.json(serializeOrder(full, req.user));
});

const declineTask = asyncHandler(async (req, res) => {
  const { leg } = req.body;
  if (!req.user.partner.isOnline) return res.status(409).json({ message: "Go online to respond to tasks" });
  if (!hasFreshLocation(req.user.partner)) {
    return res.status(409).json({ message: "Live location has stopped. Re-enable location and wait for a fresh GPS fix before declining tasks." });
  }

  const store = await Store.getCurrent();
  const openFilter = leg === "pickup"
    ? { _id: req.params.orderId, status: "placed", paymentStatus: "paid", pickupPartner: null }
    : { _id: req.params.orderId, status: "ready", paymentStatus: "paid", deliveryPartner: null };
  const order = await Order.findOne(openFilter).select("pickupLocation");
  if (!order) return res.status(409).json({ message: "This task is no longer available" });
  if (!taskIsInRange(order, leg, req.user.partner, store)) {
    return res.status(409).json({ message: "This task is outside your current service range" });
  }

  try {
    await PartnerTaskDecline.updateOne(
      { order: order._id, partner: req.user._id, leg },
      { $setOnInsert: { order: order._id, partner: req.user._id, leg } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  notifyUser(req.user._id, "tasks:changed");
  res.json({ declined: true });
});

// @route POST /api/partner/tasks/:orderId/advance
// pickup_assigned -> picked_up (needs pickup OTP) -> at_store
// delivery_assigned -> out_for_delivery -> delivered (needs delivery OTP)
const advanceTask = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  if (!req.user.partner.isOnline || !hasFreshLocation(req.user.partner)) {
    return res.status(409).json({ message: "Enable location and wait for a fresh GPS fix before updating tasks." });
  }
  const order = await Order.findOne({ _id: req.params.orderId, paymentStatus: "paid", ...mineFilter(uid) }).select("+pickupOtp +deliveryOtp");
  if (!order) return res.status(404).json({ message: "Task not found" });

  const { otp } = req.body;
  const guard = { _id: order._id, status: order.status };
  let updated;
  let completedLeg = false;
  let nextStatus;

  switch (order.status) {
    case "pickup_assigned":
      if (otp !== order.pickupOtp) return res.status(400).json({ message: "Incorrect pickup OTP" });
      nextStatus = "picked_up";
      break;
    case "picked_up":
      nextStatus = "at_store";
      completedLeg = true;
      break;
    case "delivery_assigned":
      nextStatus = "out_for_delivery";
      break;
    case "out_for_delivery":
      if (otp !== order.deliveryOtp) return res.status(400).json({ message: "Incorrect delivery OTP" });
      nextStatus = "delivered";
      completedLeg = true;
      break;
    default:
      return res.status(400).json({ message: "Nothing to advance" });
  }
  if (completedLeg) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        updated = await transition(guard, nextStatus, {}, { session });
        if (!updated) {
          const error = new Error("Task changed, please refresh");
          error.statusCode = 409;
          throw error;
        }
        await User.updateOne(
          { _id: uid },
          { $inc: { "partner.completedTasks": 1 } },
          { session }
        );
        await PartnerEarning.create([{
          order: order._id,
          partner: uid,
          leg: order.status === "picked_up" ? "pickup" : "delivery",
          amount: payoutFor(order.totalAmount),
          status: "pending",
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    notifyUser(uid, "partner:earnings", { orderId: String(order._id), leg: order.status === "picked_up" ? "pickup" : "delivery" });
  } else {
    updated = await transition(guard, nextStatus);
  }
  if (!updated) return res.status(409).json({ message: "Task changed, please refresh" });
  notifyOrder(updated);
  const full = await Order.findById(updated._id).populate("user", "name phone").populate(POPULATE_PARTNERS).lean();
  res.json(serializeOrder(full, req.user));
});

module.exports = {
  setOnline,
  getPayoutSummary,
  updatePayoutDetails,
  getAvailableTasks,
  getMyTasks,
  acceptTask,
  declineTask,
  advanceTask,
  statusSchema,
  acceptSchema,
  declineSchema,
  advanceSchema,
  payoutDetailsSchema,
};
