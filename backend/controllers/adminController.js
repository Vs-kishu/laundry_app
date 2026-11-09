const { z } = require("zod");
const Order = require("../models/Order");
const User = require("../models/User");
const WalletTransaction = require("../models/WalletTransaction");
const asyncHandler = require("../utils/asyncHandler");
const { notifyPartnerChanged, notifyUser } = require("../realtime/socket");

const verificationSchema = z.object({ status: z.enum(["approved", "rejected", "pending"]) });

// @route GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [byStatus, revenueToday, partnersOnline, partnersPending] = await Promise.all([
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: "delivered", paymentStatus: "paid", updatedAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: "partner", "partner.isOnline": true }),
    User.countDocuments({ role: "partner", "partner.verificationStatus": "pending" }),
  ]);

  res.json({
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    deliveredToday: revenueToday[0]?.count || 0,
    revenueToday: revenueToday[0]?.total || 0,
    partnersOnline,
    partnersPending,
  });
});

// @route GET /api/admin/partners?status=
const listPartners = asyncHandler(async (req, res) => {
  const filter = { role: "partner" };
  if (["pending", "approved", "rejected"].includes(req.query.status)) {
    filter["partner.verificationStatus"] = req.query.status;
  }
  const partners = await User.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json(partners);
});

// @route PUT /api/admin/partners/:id/verification
const setVerification = asyncHandler(async (req, res) => {
  const partner = await User.findOneAndUpdate(
    { _id: req.params.id, role: "partner" },
    {
      $set: {
        "partner.verificationStatus": req.body.status,
        // a partner who isn't approved can't stay online
        ...(req.body.status !== "approved" ? { "partner.isOnline": false } : {}),
      },
    },
    { new: true }
  ).lean();
  if (!partner) return res.status(404).json({ message: "Partner not found" });
  notifyPartnerChanged(partner._id);
  notifyUser(partner._id, "partner:verification", { status: partner.partner.verificationStatus });
  res.json(partner);
});

const getWalletLedger = asyncHandler(async (_req, res) => {
  const [transactions, incoming, partnerEarnings, customerBalances, partnerBalances] = await Promise.all([
    WalletTransaction.find({ accountType: "platform" }).sort({ createdAt: -1 }).limit(100).populate("order", "orderNumber").lean(),
    WalletTransaction.aggregate([
      { $match: { accountType: "platform", direction: "credit", type: { $in: ["order_payment", "wallet_topup"] } } },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    WalletTransaction.aggregate([
      { $match: { accountType: "platform", type: "partner_earning", direction: "debit" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: "customer", walletBalance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$walletBalance" } } },
    ]),
    User.aggregate([
      { $match: { role: "partner", walletBalance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$walletBalance" } } },
    ]),
  ]);
  res.json({
    incoming: Object.fromEntries(incoming.map((row) => [row._id, { total: row.total, count: row.count }])),
    partnerEarnings: partnerEarnings[0]?.total || 0,
    customerWalletLiability: customerBalances[0]?.total || 0,
    partnerWalletLiability: partnerBalances[0]?.total || 0,
    transactions,
  });
});

module.exports = { getStats, listPartners, setVerification, verificationSchema, getWalletLedger };
