const { z } = require("zod");
const Order = require("../models/Order");
const User = require("../models/User");
const PartnerEarning = require("../models/PartnerEarning");
const asyncHandler = require("../utils/asyncHandler");
const { notifyPartnerChanged, notifyUser } = require("../realtime/socket");

const verificationSchema = z.object({ status: z.enum(["approved", "rejected", "pending"]) });
const payoutSchema = z.object({
  payoutReference: z.string().trim().min(3, "Enter the bank/UPI transfer reference").max(120),
});

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
  const partners = await User.find(filter).select("-partner.payoutDetails").sort({ createdAt: -1 }).limit(200).lean();
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

const getPartnerEarnings = asyncHandler(async (req, res) => {
  const filter = {};
  if (["pending", "paid"].includes(req.query.status)) filter.status = req.query.status;
  const [totals, earnings] = await Promise.all([
    PartnerEarning.aggregate([
      { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    PartnerEarning.find(filter)
      .sort({ status: 1, earnedAt: -1 })
      .limit(500)
      .populate({ path: "partner", select: "name email phone partner.payoutDetails" })
      .populate("order", "orderNumber totalAmount")
      .populate("paidBy", "name")
      .lean(),
  ]);
  const summary = Object.fromEntries(totals.map(({ _id, amount, count }) => [_id, { amount, count }]));
  res.json({
    pending: summary.pending || { amount: 0, count: 0 },
    paid: summary.paid || { amount: 0, count: 0 },
    earnings,
  });
});

const markPartnerEarningPaid = asyncHandler(async (req, res) => {
  const earning = await PartnerEarning.findById(req.params.id).populate({
    path: "partner",
    select: "partner.payoutDetails",
  });
  if (!earning) return res.status(404).json({ message: "Partner earning not found" });
  if (earning.status !== "pending") return res.status(409).json({ message: "This earning has already been paid" });
  const details = earning.partner?.partner?.payoutDetails;
  if (!details || (details.method === "upi" && !details.upiId) ||
      (details.method === "bank" && (!details.accountHolder || !details.accountNumber || !details.ifsc))) {
    return res.status(409).json({ message: "The partner must add valid UPI or bank payout details before settlement" });
  }
  const updated = await PartnerEarning.findOneAndUpdate(
    { _id: earning._id, status: "pending" },
    { $set: { status: "paid", payoutReference: req.body.payoutReference, paidAt: new Date(), paidBy: req.user._id } },
    { new: true }
  )
    .populate({ path: "partner", select: "name email phone partner.payoutDetails" })
    .populate("order", "orderNumber totalAmount")
    .populate("paidBy", "name")
    .lean();
  if (!updated) return res.status(409).json({ message: "This earning has already been paid" });
  notifyUser(earning.partner._id, "partner:earnings", { earningId: String(earning._id), status: "paid" });
  res.json(updated);
});

module.exports = {
  getStats,
  listPartners,
  setVerification,
  verificationSchema,
  payoutSchema,
  getPartnerEarnings,
  markPartnerEarningPaid,
};
