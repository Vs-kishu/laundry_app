const { z } = require("zod");
const Order = require("../models/Order");
const User = require("../models/User");
const Store = require("../models/Store");
const asyncHandler = require("../utils/asyncHandler");
const C = require("../config/constants");
const { haversineKm } = require("../utils/geo");
const { transition } = require("../utils/orderService");
const { serializeOrder } = require("../utils/orderView");
const { PICKUP_ACTIVE, DELIVERY_ACTIVE } = require("../utils/orderFlow");
const { notifyOrder, notifyPartnerChanged } = require("../realtime/socket");
const { POPULATE_PARTNERS } = require("./orderController");

const statusSchema = z.object({ online: z.boolean() });
const acceptSchema = z.object({ leg: z.enum(["pickup", "delivery"]) });
const advanceSchema = z.object({ otp: z.string().trim().regex(/^\d{4}$/, "OTP must be 4 digits").optional() });

const mineFilter = (partnerId) => ({
  $or: [
    { pickupPartner: partnerId, status: { $in: PICKUP_ACTIVE } },
    { deliveryPartner: partnerId, status: { $in: DELIVERY_ACTIVE } },
  ],
});

// @route PUT /api/partner/status
const setOnline = asyncHandler(async (req, res) => {
  const { online } = req.body;
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

  const [store, pickups, deliveries] = await Promise.all([
    Store.getCurrent(),
    Order.find({ status: "placed", pickupLocation: { $exists: true } }).sort({ createdAt: 1 }).limit(20).lean(),
    Order.find({ status: "ready", deliveryPartner: null, pickupLocation: { $exists: true } }).sort({ updatedAt: 1 }).limit(20).lean(),
  ]);
  const here = req.user.partner.location?.lat != null ? req.user.partner.location : null;

  const toTask = (o, leg) => {
    // pickup: partner goes to the customer first; delivery: partner goes to the store first
    const firstStop = leg === "pickup" ? o.pickupLocation : store.location;
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
      toFirstStopKm: here ? Math.round(haversineKm(here, firstStop) * 10) / 10 : null,
      payout: C.PARTNER_PAYOUT_PER_TASK,
      createdAt: o.createdAt,
    };
  };

  const tasks = [...pickups.map((o) => toTask(o, "pickup")), ...deliveries.map((o) => toTask(o, "delivery"))];
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

  const activeCount = await Order.countDocuments(mineFilter(req.user._id));
  if (activeCount >= C.MAX_ACTIVE_TASKS_PER_PARTNER) {
    return res.status(409).json({ message: `You can hold ${C.MAX_ACTIVE_TASKS_PER_PARTNER} active tasks at a time` });
  }

  const { leg } = req.body;
  const order =
    leg === "pickup"
      ? await transition({ _id: req.params.orderId, status: "placed", pickupPartner: null }, "pickup_assigned", {
          pickupPartner: req.user._id,
        })
      : await transition({ _id: req.params.orderId, status: "ready", deliveryPartner: null }, "delivery_assigned", {
          deliveryPartner: req.user._id,
        });

  if (!order) return res.status(409).json({ message: "Too late - another partner already took this task" });

  notifyOrder(order);
  const full = await Order.findById(order._id).populate("user", "name phone").populate(POPULATE_PARTNERS).lean();
  res.json(serializeOrder(full, req.user));
});

// @route POST /api/partner/tasks/:orderId/advance
// pickup_assigned -> picked_up (needs pickup OTP) -> at_store
// delivery_assigned -> out_for_delivery -> delivered (needs delivery OTP)
const advanceTask = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const order = await Order.findOne({ _id: req.params.orderId, ...mineFilter(uid) }).select("+pickupOtp +deliveryOtp");
  if (!order) return res.status(404).json({ message: "Task not found" });

  const { otp } = req.body;
  const guard = { _id: order._id, status: order.status };
  let updated;
  let completedLeg = false;

  switch (order.status) {
    case "pickup_assigned":
      if (otp !== order.pickupOtp) return res.status(400).json({ message: "Incorrect pickup OTP" });
      updated = await transition(guard, "picked_up");
      break;
    case "picked_up":
      updated = await transition(guard, "at_store");
      completedLeg = true;
      break;
    case "delivery_assigned":
      updated = await transition(guard, "out_for_delivery");
      break;
    case "out_for_delivery":
      if (otp !== order.deliveryOtp) return res.status(400).json({ message: "Incorrect delivery OTP" });
      updated = await transition(guard, "delivered", { paymentStatus: "paid" }); // cash collected at the door
      completedLeg = true;
      break;
    default:
      return res.status(400).json({ message: "Nothing to advance" });
  }
  if (!updated) return res.status(409).json({ message: "Task changed, please refresh" });

  if (completedLeg) {
    await User.updateOne(
      { _id: uid },
      { $inc: { "partner.completedTasks": 1, "partner.earnings": C.PARTNER_PAYOUT_PER_TASK } }
    );
  }
  notifyOrder(updated);
  const full = await Order.findById(updated._id).populate("user", "name phone").populate(POPULATE_PARTNERS).lean();
  res.json(serializeOrder(full, req.user));
});

module.exports = {
  setOnline,
  getAvailableTasks,
  getMyTasks,
  acceptTask,
  advanceTask,
  statusSchema,
  acceptSchema,
  advanceSchema,
};
