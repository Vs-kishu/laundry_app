// Order status presentation shared by customer, partner and admin screens.
export const STATUS_META = {
  placed: { label: "Order placed", short: "Placed", tone: "bg-sun/25 text-ink" },
  pickup_assigned: { label: "Pickup partner assigned", short: "Pickup assigned", tone: "bg-brand/15 text-link" },
  picked_up: { label: "Picked up", short: "Picked up", tone: "bg-brand/15 text-link" },
  at_store: { label: "Reached our store", short: "At store", tone: "bg-aqua/20 text-ink" },
  in_progress: { label: "Being cleaned", short: "Cleaning", tone: "bg-aqua/20 text-ink" },
  ready: { label: "Ready for delivery", short: "Ready", tone: "bg-success/15 text-success" },
  delivery_assigned: { label: "Delivery partner assigned", short: "Delivery assigned", tone: "bg-brand/15 text-link" },
  out_for_delivery: { label: "Out for delivery", short: "On the way", tone: "bg-brand/15 text-link" },
  delivered: { label: "Delivered", short: "Delivered", tone: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled", short: "Cancelled", tone: "bg-danger/15 text-danger" },
};

// Timeline shown on the tracking page
export const TIMELINE_STEPS = [
  "placed",
  "pickup_assigned",
  "picked_up",
  "at_store",
  "in_progress",
  "ready",
  "delivery_assigned",
  "out_for_delivery",
  "delivered",
];

export const ACTIVE_STATUSES = TIMELINE_STEPS.filter((s) => s !== "delivered");
export const LIVE_STATUSES = ["pickup_assigned", "picked_up", "delivery_assigned", "out_for_delivery"];

// The big headline on the tracking screen, Zepto/Blinkit style.
export function headlineFor(order, live) {
  const name = order.partner?.name?.split(" ")[0] || "Your partner";
  const eta = live?.etaMinutes ? ` - ${live.etaMinutes} min away` : "";
  switch (order.status) {
    case "placed":
      return { title: "Finding a pickup partner", sub: "Hang tight, this usually takes under a minute." };
    case "pickup_assigned":
      return { title: `${name} is coming to pick up${eta}`, sub: "Share the pickup OTP when they arrive." };
    case "picked_up":
      return { title: `Heading to our store${eta}`, sub: "Your clothes are on their way to be cleaned." };
    case "at_store":
      return { title: "Your clothes reached the store", sub: "We're about to start cleaning." };
    case "in_progress":
      return { title: "Your clothes are being cleaned", sub: "Fresh and folded soon." };
    case "ready":
      return { title: "Clean and ready!", sub: "Finding a delivery partner near the store." };
    case "delivery_assigned":
      return { title: `${name} is heading to the store`, sub: "They'll pick up your clean clothes next." };
    case "out_for_delivery":
      return { title: `${name} is on the way${eta}`, sub: "Share the delivery OTP at your door." };
    case "delivered":
      return { title: "Delivered - enjoy fresh clothes", sub: "Thanks for choosing Laundry Point." };
    case "cancelled":
      return { title: "Order cancelled", sub: "You can place a new order anytime." };
    default:
      return { title: STATUS_META[order.status]?.label || order.status, sub: "" };
  }
}

export const CUSTOMER_CANCELLABLE_UI = ["placed", "pickup_assigned"];
