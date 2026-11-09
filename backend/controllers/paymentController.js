const { z } = require("zod");
const Order = require("../models/Order");
const PaymentSettings = require("../models/PaymentSettings");
const asyncHandler = require("../utils/asyncHandler");
const { notifyOrder } = require("../realtime/socket");
const { serializeOrder } = require("../utils/orderView");

const paymentSettingsSchema = z.object({
  upiId: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,64}@[a-z0-9.-]{2,64}$/, "Enter a valid UPI ID"),
  qrImageData: z.string().min(1, "Upload a QR image").max(1_500_000),
});

const paymentReferenceSchema = z.object({
  paymentUtr: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,50}$/, "Enter a valid UPI transaction reference"),
});

const paymentReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional().default(""),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && value.note.length < 3) {
    context.addIssue({ code: "custom", path: ["note"], message: "Give the customer a reason to retry payment" });
  }
});

function isQrImageData(value) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1_000_000) return false;
  if (match[1] === "png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

const getPaymentConfig = asyncHandler(async (_req, res) => {
  const settings = await PaymentSettings.findOne({ key: "primary" }).select("upiId qrImageData").lean();
  res.set("Cache-Control", "no-store");
  res.json({ upiId: settings?.upiId || "", qrImageData: settings?.qrImageData || "" });
});

const updatePaymentConfig = asyncHandler(async (req, res) => {
  if (!isQrImageData(req.body.qrImageData)) {
    return res.status(400).json({ message: "Upload a valid PNG, JPEG, or WebP QR image up to 1 MB" });
  }
  const settings = await PaymentSettings.findOneAndUpdate(
    { key: "primary" },
    { $set: { upiId: req.body.upiId, qrImageData: req.body.qrImageData, updatedBy: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).select("upiId qrImageData updatedAt");
  res.json(settings);
});

const listPendingPayments = asyncHandler(async (_req, res) => {
  const orders = await Order.find({ status: "payment_pending", paymentStatus: "submitted" })
    .sort({ updatedAt: 1 })
    .limit(100)
    .populate("user", "name email phone")
    .lean();
  res.json(orders.map((order) => ({
    _id: order._id,
    orderNumber: order.orderNumber,
    customer: order.user,
    totalAmount: order.totalAmount,
    paymentUtr: order.paymentUtr,
    submittedAt: order.updatedAt,
    items: order.items,
  })));
});

const reviewPayment = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  const update = decision === "approved"
    ? {
        $set: {
          paymentStatus: "paid",
          status: "placed",
          paymentReviewedAt: new Date(),
          paymentReviewedBy: req.user._id,
        },
        $unset: { paymentReviewNote: 1 },
        $push: { timeline: { status: "placed", at: new Date() } },
      }
    : {
        $set: { paymentStatus: "pending", paymentReviewNote: note },
        $unset: { paymentUtr: 1 },
      };
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: "payment_pending", paymentStatus: "submitted" },
    update,
    { new: true }
  )
    .populate("user", "name email phone")
    .lean();
  if (!order) return res.status(409).json({ message: "Payment was already reviewed or the order is no longer awaiting verification" });
  notifyOrder(order);
  res.json(serializeOrder(order, req.user));
});

const submitPaymentReference = asyncHandler(async (req, res) => {
  let order;
  try {
    order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        status: "payment_pending",
        paymentStatus: "pending",
      },
      { $set: { paymentStatus: "submitted", paymentUtr: req.body.paymentUtr }, $unset: { paymentReviewNote: 1 } },
      { new: true }
    );
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.paymentUtr) {
      return res.status(409).json({ message: "This transaction reference has already been submitted" });
    }
    throw error;
  }
  if (!order) return res.status(409).json({ message: "This order is not awaiting a payment reference" });
  notifyOrder(order);
  res.json(serializeOrder(order, req.user));
});

module.exports = {
  getPaymentConfig,
  updatePaymentConfig,
  listPendingPayments,
  reviewPayment,
  submitPaymentReference,
  paymentSettingsSchema,
  paymentReferenceSchema,
  paymentReviewSchema,
};
