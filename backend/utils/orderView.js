const { PICKUP_ACTIVE, DELIVERY_ACTIVE, destinationFor } = require("./orderFlow");

const id = (v) => String(v?._id || v || "");

const partnerBrief = (p) =>
  p && p._id
    ? {
        _id: p._id,
        name: p.name,
        phone: p.phone,
        vehicleType: p.partner?.vehicleType,
        vehicleNumber: p.partner?.vehicleNumber,
        location: p.partner?.location?.lat != null ? p.partner.location : null,
      }
    : null;

// Builds the JSON a given viewer is allowed to see. This is the single place that decides
// who gets OTPs and customer contact details, so controllers never leak raw documents.
function serializeOrder(order, viewer) {
  const o = order.toObject ? order.toObject() : order;
  const isOwner = id(o.user) === String(viewer._id);
  const isAdmin = viewer.role === "admin";
  const activeLeg = PICKUP_ACTIVE.includes(o.status) ? "pickup" : DELIVERY_ACTIVE.includes(o.status) ? "delivery" : null;
  const activePartner = activeLeg === "pickup" ? o.pickupPartner : activeLeg === "delivery" ? o.deliveryPartner : null;
  const isAssignedPartner = viewer.role === "partner" && id(activePartner) === String(viewer._id);

  const out = {
    _id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    leg: activeLeg,
    destination: destinationFor(o.status) || null,
    items: o.items,
    pickupAddress: o.pickupAddress,
    pickupLocation: o.pickupLocation,
    pickupType: o.pickupType,
    pickupDate: o.pickupDate,
    pickupSlot: o.pickupSlot,
    notes: o.notes,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    expressFee: o.expressFee,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    timeline: o.timeline,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    partner: partnerBrief(activePartner),
  };

  if (o.user?.name && (isAdmin || isAssignedPartner)) {
    out.customer = { name: o.user.name, phone: o.user.phone, email: isAdmin ? o.user.email : undefined };
  }
  if (isAdmin) {
    out.pickupPartner = partnerBrief(o.pickupPartner) || null;
    out.deliveryPartner = partnerBrief(o.deliveryPartner) || null;
  }

  // Handover codes are for the customer only.
  if (isOwner) {
    const otp = {};
    if (["placed", "pickup_assigned"].includes(o.status) && o.pickupOtp) otp.pickup = o.pickupOtp;
    if (["ready", "delivery_assigned", "out_for_delivery"].includes(o.status) && o.deliveryOtp) {
      otp.delivery = o.deliveryOtp;
    }
    out.otp = otp;
  }

  return out;
}

module.exports = { serializeOrder, partnerBrief };
