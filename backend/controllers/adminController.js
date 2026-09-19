const { z } = require("zod");
const Order = require("../models/Order");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { notifyPartnerChanged } = require("../realtime/socket");

const verificationSchema = z.object({ status: z.enum(["approved", "rejected", "pending"]) });

// @route GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [byStatus, revenueToday, partnersOnline, partnersPending] = await Promise.all([
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: "delivered", updatedAt: { $gte: startOfDay } } },
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
  res.json(partner);
});

module.exports = { getStats, listPartners, setVerification, verificationSchema };
