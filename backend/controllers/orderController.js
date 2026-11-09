const crypto = require("crypto");
const mongoose = require("mongoose");
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
const PaymentAttempt = require("../models/PaymentAttempt");
const WalletTopUp = require("../models/WalletTopUp");
const { priceOffer } = require("./offerController");
const { razorpayRequest } = require("../utils/razorpay");
const { addWalletEntry } = require("../utils/wallet");
const { completeWalletTopUp } = require("./walletController");

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
  couponCode: z.string().trim().max(24).optional().default(""),
  useWallet: z.boolean().optional().default(false),
});
const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
});

const assignSchema = z.object({ leg: z.enum(["pickup", "delivery"]), partnerId: objectId });
const statusSchema = z.object({ status: z.enum(STATUSES) });

// Owner/partner/admin populated fields used when serialising.
const POPULATE_PARTNERS = [
  { path: "pickupPartner", select: "name phone partner.vehicleType partner.vehicleNumber partner.location" },
  { path: "deliveryPartner", select: "name phone partner.vehicleType partner.vehicleNumber partner.location" },
];

const isoDay = (d) => d.toISOString().slice(0, 10);

async function cancelAndRefundWallet(filter) {
  const session = await mongoose.startSession();
  let updated = null;
  try {
    await session.withTransaction(async () => {
      const current = await Order.findOne(filter).session(session);
      if (!current) return;
      updated = await transition({ ...filter, status: current.status }, "cancelled", {}, { session });
      if (
        !updated ||
        !CUSTOMER_CANCELLABLE.includes(current.status) ||
        current.paymentMethod !== "wallet" ||
        current.paymentStatus !== "paid"
      ) return;

      await User.updateOne({ _id: current.user }, { $inc: { walletBalance: current.totalAmount } }, { session });
      await Order.updateOne({ _id: current._id }, { $set: { paymentStatus: "refunded" } }, { session });
      updated.paymentStatus = "refunded";
      await addWalletEntry({
        accountType: "customer",
        user: current.user,
        type: "wallet_refund",
        direction: "credit",
        amount: current.totalAmount,
        reference: `customer-wallet-refund:${current._id}`,
        order: current._id,
        description: `Wallet refund for ${current.orderNumber}`,
      }, session);
      await addWalletEntry({
        accountType: "platform",
        type: "wallet_refund",
        direction: "debit",
        amount: current.totalAmount,
        reference: `platform-wallet-refund:${current._id}`,
        order: current._id,
        description: `Wallet refund for ${current.orderNumber}`,
      }, session);
    });
  } finally {
    await session.endSession();
  }
  return updated;
}

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
  const discount = req.body.couponCode
    ? await priceOffer(req.body.couponCode, items, pickupType)
    : { discountAmount: 0 };
  if (discount.error) return res.status(400).json({ message: discount.error });
  const deliveryFee = subtotal >= C.FREE_DELIVERY_ABOVE ? 0 : C.DELIVERY_FEE;
  const expressFee = pickupType === "express" ? C.EXPRESS_FEE : 0;
  const checkout = {
    user: req.user._id,
    items: orderItems,
    pickupAddress,
    pickupLocation,
    pickupType,
    pickupDate: date,
    pickupSlot: slot,
    notes,
    subtotal,
    discountAmount: discount.discountAmount,
    couponCode: req.body.couponCode ? req.body.couponCode.toUpperCase() : "",
    deliveryFee,
    expressFee,
    totalAmount: round2(subtotal - discount.discountAmount + deliveryFee + expressFee),
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    pickupOtp: otp(),
    deliveryOtp: otp(),
    timeline: [{ status: "placed", at: new Date() }],
  };
  const amount = Math.round(checkout.totalAmount * 100);
  if (amount < 100) return res.status(400).json({ message: "Order total must be at least ₹1" });

  if (req.body.useWallet) {
    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        const debited = await User.updateOne(
          { _id: req.user._id, walletBalance: { $gte: checkout.totalAmount } },
          { $inc: { walletBalance: -checkout.totalAmount } },
          { session }
        );
        if (!debited.modifiedCount) {
          const error = new Error("Your wallet balance is not enough to pay for this order.");
          error.statusCode = 400;
          throw error;
        }
        [order] = await Order.create(
          [{ ...checkout, paymentMethod: "wallet", paymentStatus: "paid" }],
          { session }
        );
        await addWalletEntry({
          accountType: "customer",
          user: req.user._id,
          type: "order_payment",
          direction: "debit",
          amount: checkout.totalAmount,
          reference: `customer-order:${order._id}`,
          order: order._id,
          description: `Payment for ${order.orderNumber}`,
        }, session);
        await addWalletEntry({
          accountType: "platform",
          type: "order_payment",
          direction: "credit",
          amount: checkout.totalAmount,
          reference: `platform-wallet-order:${order._id}`,
          order: order._id,
          description: `Wallet payment for ${order.orderNumber}`,
        }, session);
      });
    } finally {
      await session.endSession();
    }
    notifyOrder(order);
    return res.status(201).json({ paidByWallet: true, order: serializeOrder(order, req.user) });
  }

  const attempt = await PaymentAttempt.create({
    user: req.user._id,
    checkout,
    amount,
    status: "creating",
  });
  try {
    const razorpayOrder = await razorpayRequest("POST", "/v1/orders", {
      amount,
      currency: "INR",
      receipt: String(attempt._id),
      notes: { attemptId: String(attempt._id), userId: String(req.user._id) },
    });
    attempt.razorpayOrderId = razorpayOrder.id;
    attempt.status = "pending";
    await attempt.save();
    res.status(201).json({
      attemptId: String(attempt._id),
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: "Laundry Point",
      description: "Laundry pickup and delivery",
      prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone },
    });
  } catch (error) {
    attempt.status = "failed";
    await attempt.save();
    throw error;
  }
});

async function completePaymentAttempt(attempt, paymentId) {
  if (attempt.order) {
    const existing = await Order.findById(attempt.order);
    if (existing) return { order: existing, created: false };
  }
  const claimed = await PaymentAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: { $in: ["pending", "processing"] },
      $or: [{ status: "pending" }, { processingAt: { $lt: new Date(Date.now() - 120000) } }],
    },
    { $set: { status: "processing", processingAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    const fresh = await PaymentAttempt.findById(attempt._id);
    if (fresh?.order) {
      const existing = await Order.findById(fresh.order);
      if (existing) return { order: existing, created: false };
    }
    const existing = await Order.findOne({ paymentReference: paymentId });
    return existing ? { order: existing, created: false } : { busy: true };
  }

  try {
    const payment = await razorpayRequest("GET", `/v1/payments/${encodeURIComponent(paymentId)}`);
    if (
      payment.status !== "captured" ||
      payment.order_id !== attempt.razorpayOrderId ||
      payment.amount !== attempt.amount ||
      payment.currency !== attempt.currency
    ) {
      await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: "pending", processingAt: null } });
      return { notCaptured: true };
    }
    const session = await mongoose.startSession();
    let order;
    let created = false;
    try {
      await session.withTransaction(async () => {
        order = await Order.findOne({ paymentReference: paymentId }).session(session);
        created = !order;
        if (!order) {
          [order] = await Order.create(
            [{ ...attempt.checkout, paymentReference: paymentId }],
            { session }
          );
          await addWalletEntry({
            accountType: "platform",
            type: "order_payment",
            direction: "credit",
            amount: attempt.amount / 100,
            reference: `platform-order:${paymentId}`,
            order: order._id,
            paymentReference: paymentId,
            description: `Online payment for ${order.orderNumber}`,
          }, session);
        }
        await PaymentAttempt.updateOne(
          { _id: attempt._id },
          { $set: { status: "paid", order: order._id, processingAt: null } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
    notifyOrder(order);
    return { order, created };
  } catch (error) {
    await PaymentAttempt.updateOne({ _id: attempt._id }, { $set: { status: "pending", processingAt: null } });
    throw error;
  }
}

const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const attempt = await PaymentAttempt.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id });
  if (!attempt) return res.status(404).json({ message: "Payment checkout not found" });
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest();
  const provided = Buffer.from(razorpay_signature, "hex");
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(400).json({ message: "Payment signature is invalid" });
  }
  const result = await completePaymentAttempt(attempt, razorpay_payment_id);
  if (result.busy) return res.status(409).json({ message: "Payment is already being verified. Please refresh your orders shortly." });
  if (result.notCaptured) return res.status(402).json({ message: "Payment has not been captured. Complete payment and try again." });
  res.status(result.created ? 201 : 200).json(serializeOrder(result.order, req.user));
});

const paymentWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get("x-razorpay-signature") || "";
  if (!secret || !req.rawBody) return res.status(503).json({ message: "Payment webhook is not configured" });
  const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(400).json({ message: "Invalid payment webhook signature" });
  }
  if (req.body.event !== "payment.captured") return res.json({ received: true });

  const entity = req.body.payload?.payment?.entity;
  if (!entity?.id || !entity?.order_id) return res.status(400).json({ message: "Payment webhook payload is incomplete" });
  const topUp = await WalletTopUp.findOne({ razorpayOrderId: entity.order_id });
  if (topUp) {
    const result = await completeWalletTopUp(topUp, entity);
    if (result.notCaptured) return res.status(503).json({ message: "Wallet payment capture is still being processed" });
    return res.json({ received: true });
  }
  const attempt = await PaymentAttempt.findOne({ razorpayOrderId: entity.order_id });
  if (!attempt) return res.json({ received: true });
  const result = await completePaymentAttempt(attempt, entity.id);
  if (result.busy || result.notCaptured) return res.status(503).json({ message: "Payment capture is still being processed" });
  res.json({ received: true });
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
    ["admin", "super_admin"].includes(req.user.role) ||
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
  const order = await cancelAndRefundWallet({
    _id: req.params.id,
    user: req.user._id,
    status: { $in: CUSTOMER_CANCELLABLE },
  });
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

  const updated = status === "cancelled"
    ? await cancelAndRefundWallet({ _id: order._id, status: order.status })
    : await transition({ _id: order._id, status: order.status }, status);
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
  verifyPaymentSchema,
  verifyPayment,
  paymentWebhook,
  assignSchema,
  statusSchema,
  POPULATE_PARTNERS,
};
