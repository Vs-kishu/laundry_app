const crypto = require("crypto");
const mongoose = require("mongoose");
const { z } = require("zod");
const User = require("../models/User");
const WalletTransaction = require("../models/WalletTransaction");
const WalletTopUp = require("../models/WalletTopUp");
const asyncHandler = require("../utils/asyncHandler");
const { razorpayRequest } = require("../utils/razorpay");
const { addWalletEntry } = require("../utils/wallet");

const topUpSchema = z.object({ amount: z.coerce.number().int().min(100).max(500000) });
const signatureSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
});

const getWallet = asyncHandler(async (req, res) => {
  const [transactions, user] = await Promise.all([
    WalletTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    User.findById(req.user._id).select("walletBalance partner.earnings").lean(),
  ]);
  res.json({
    balance: user?.walletBalance || 0,
    lifetimeEarnings: user?.partner?.earnings || 0,
    transactions,
  });
});

const createTopUp = asyncHandler(async (req, res) => {
  const topUp = await WalletTopUp.create({ user: req.user._id, amount: req.body.amount });
  try {
    const razorpayOrder = await razorpayRequest("POST", "/v1/orders", {
      amount: topUp.amount,
      currency: topUp.currency,
      receipt: String(topUp._id),
      notes: { type: "wallet_topup", topUpId: String(topUp._id), userId: String(req.user._id) },
    });
    topUp.razorpayOrderId = razorpayOrder.id;
    topUp.status = "pending";
    await topUp.save();
    res.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: "Laundry Point Wallet",
      description: "Add funds to your wallet",
      prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone },
    });
  } catch (error) {
    topUp.status = "failed";
    await topUp.save();
    throw error;
  }
});

async function completeWalletTopUp(topUp, payment) {
  if (
    !payment?.id ||
    payment.status !== "captured" ||
    payment.order_id !== topUp.razorpayOrderId ||
    payment.amount !== topUp.amount ||
    payment.currency !== topUp.currency
  ) {
    return { notCaptured: true };
  }

  const session = await mongoose.startSession();
  let completed = false;
  try {
    await session.withTransaction(async () => {
      const current = await WalletTopUp.findById(topUp._id).session(session);
      if (!current) return;
      if (current.status === "paid") return;
      if (current.status !== "pending" && current.status !== "processing") return;

      const changed = await WalletTopUp.updateOne(
        { _id: current._id, status: { $in: ["pending", "processing"] } },
        { $set: { status: "processing", paymentReference: payment.id } },
        { session }
      );
      if (!changed.modifiedCount) return;

      await User.updateOne({ _id: current.user }, { $inc: { walletBalance: current.amount / 100 } }, { session });
      await addWalletEntry({
        accountType: "customer",
        user: current.user,
        type: "wallet_topup",
        direction: "credit",
        amount: current.amount / 100,
        reference: `customer-topup:${current._id}`,
        paymentReference: payment.id,
        description: "Wallet top-up",
      }, session);
      await addWalletEntry({
        accountType: "platform",
        type: "wallet_topup",
        direction: "credit",
        amount: current.amount / 100,
        reference: `platform-topup:${current._id}`,
        paymentReference: payment.id,
        description: "Customer wallet top-up",
      }, session);
      await WalletTopUp.updateOne({ _id: current._id }, { $set: { status: "paid" } }, { session });
      completed = true;
    });
  } finally {
    await session.endSession();
  }
  return { completed };
}

const verifyTopUp = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const topUp = await WalletTopUp.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id });
  if (!topUp) return res.status(404).json({ message: "Wallet top-up was not found" });
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest();
  const provided = Buffer.from(razorpay_signature, "hex");
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(400).json({ message: "Payment signature is invalid" });
  }
  const payment = await razorpayRequest("GET", `/v1/payments/${encodeURIComponent(razorpay_payment_id)}`);
  const result = await completeWalletTopUp(topUp, payment);
  if (result.notCaptured) return res.status(402).json({ message: "Wallet top-up payment has not been captured." });
  const user = await User.findById(req.user._id).select("walletBalance").lean();
  res.json({ balance: user?.walletBalance || 0 });
});

module.exports = { getWallet, createTopUp, verifyTopUp, topUpSchema, signatureSchema, completeWalletTopUp };
