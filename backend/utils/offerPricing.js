const Offer = require("../models/Offer");

const round2 = (n) => Math.round(n * 100) / 100;

async function findOffer(code) {
  const offer = await Offer.findOne({ code: String(code || "").trim().toUpperCase(), isActive: true }).lean();
  if (!offer) return { error: "Offer code is invalid or inactive" };
  const now = new Date();
  if (offer.startsAt && now < offer.startsAt) return { error: "This offer is not active yet" };
  if (offer.endsAt && now > offer.endsAt) return { error: "This offer has expired" };
  return { offer };
}

function calculateDiscount(offer, items, subtotal) {
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (subtotal < offer.minimumSubtotal) return { error: `Order subtotal must be at least ₹${offer.minimumSubtotal}` };

  let discount = 0;
  if (offer.type === "percentage") {
    discount = subtotal * Math.min(offer.value, 100) / 100;
  } else if (offer.type === "fixed") {
    discount = offer.value;
  } else if (offer.type === "bogo") {
    discount = items.reduce(
      (sum, item) => sum + (item.unit === "item" ? Math.floor(item.quantity / 2) * item.pricePerUnit : 0),
      0
    );
    if (!discount) return { error: "This buy-one-get-one offer applies to item-based services only" };
  } else {
    if (quantity < offer.minimumQuantity) return { error: `Add at least ${offer.minimumQuantity} units to use this offer` };
    discount = offer.discountKind === "percentage"
      ? subtotal * Math.min(offer.value, 100) / 100
      : offer.value;
  }

  discount = Math.min(discount, subtotal);
  if (offer.maximumDiscount != null) discount = Math.min(discount, offer.maximumDiscount);
  return { discount: round2(discount) };
}

module.exports = { findOffer, calculateDiscount, round2 };
