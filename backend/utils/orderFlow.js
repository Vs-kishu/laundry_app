// Order lifecycle.
//
//  placed -> (partner accepts pickup) pickup_assigned -> (pickup OTP) picked_up -> (arrives) at_store
//  at_store -> (admin) in_progress -> (admin) ready -> (partner accepts delivery) delivery_assigned
//  delivery_assigned -> (leaves store) out_for_delivery -> (delivery OTP) delivered
//
// `cancelled` is reachable from placed / pickup_assigned (customer) or any open state (admin).
const STATUSES = [
  "placed",
  "pickup_assigned",
  "picked_up",
  "at_store",
  "in_progress",
  "ready",
  "delivery_assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const PICKUP_ACTIVE = ["pickup_assigned", "picked_up"];
const DELIVERY_ACTIVE = ["delivery_assigned", "out_for_delivery"];
const TERMINAL = ["delivered", "cancelled"];
const CUSTOMER_CANCELLABLE = ["placed", "pickup_assigned"];

// Statuses an admin may move an order to manually, keyed by the current status.
const ADMIN_TRANSITIONS = {
  at_store: ["in_progress"],
  in_progress: ["ready"],
};

// Where the assigned partner is heading for a given status.
const destinationFor = (status) =>
  ({
    pickup_assigned: "customer",
    picked_up: "store",
    delivery_assigned: "store",
    out_for_delivery: "customer",
  })[status];

module.exports = {
  STATUSES,
  PICKUP_ACTIVE,
  DELIVERY_ACTIVE,
  TERMINAL,
  CUSTOMER_CANCELLABLE,
  ADMIN_TRANSITIONS,
  destinationFor,
};
