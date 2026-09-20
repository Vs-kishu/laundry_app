export const colors = {
  bg: "#F7FAFF",
  surface: "#FFFFFF",
  soft: "#ECF3FF",
  ink: "#0B1B3A",
  muted: "#56648A",
  line: "#E0E7F4",
  brand: "#2F6BFF",
  brandDark: "#1E4FD8",
  aqua: "#12C2B5",
  sun: "#FFC93C",
  danger: "#DC3545",
  success: "#109664",
  navy: "#0B1B3A",
  teal: "#0B6E6A",
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const shadow = {
  shadowColor: "#0B1B3A",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const STATUS_META = {
  placed: { label: "Order placed", short: "Placed", bg: "#FFF1CC", fg: "#0B1B3A" },
  pickup_assigned: { label: "Pickup partner assigned", short: "Pickup assigned", bg: "#DCE8FF", fg: "#1E4FD8" },
  picked_up: { label: "Picked up", short: "Picked up", bg: "#DCE8FF", fg: "#1E4FD8" },
  at_store: { label: "Reached our store", short: "At store", bg: "#D5F5F2", fg: "#0B1B3A" },
  in_progress: { label: "Being cleaned", short: "Cleaning", bg: "#D5F5F2", fg: "#0B1B3A" },
  ready: { label: "Ready for delivery", short: "Ready", bg: "#D6F2E6", fg: "#109664" },
  delivery_assigned: { label: "Delivery partner assigned", short: "Delivery assigned", bg: "#DCE8FF", fg: "#1E4FD8" },
  out_for_delivery: { label: "Out for delivery", short: "On the way", bg: "#DCE8FF", fg: "#1E4FD8" },
  delivered: { label: "Delivered", short: "Delivered", bg: "#D6F2E6", fg: "#109664" },
  cancelled: { label: "Cancelled", short: "Cancelled", bg: "#FBE0E3", fg: "#DC3545" },
};

export const TIMELINE_STEPS = [
  "placed", "pickup_assigned", "picked_up", "at_store", "in_progress", "ready", "delivery_assigned", "out_for_delivery", "delivered",
];
export const ACTIVE_STATUSES = TIMELINE_STEPS.filter((s) => s !== "delivered");
export const LIVE_STATUSES = ["pickup_assigned", "picked_up", "delivery_assigned", "out_for_delivery"];

export function headlineFor(order, live) {
  const name = order.partner?.name?.split(" ")[0] || "Your partner";
  const eta = live?.etaMinutes ? ` - ${live.etaMinutes} min away` : "";
  switch (order.status) {
    case "placed": return { title: "Finding a pickup partner", sub: "Hang tight, this usually takes under a minute." };
    case "pickup_assigned": return { title: `${name} is coming to pick up${eta}`, sub: "Share the pickup OTP when they arrive." };
    case "picked_up": return { title: `Heading to our store${eta}`, sub: "Your clothes are on their way to be cleaned." };
    case "at_store": return { title: "Your clothes reached the store", sub: "We're about to start cleaning." };
    case "in_progress": return { title: "Your clothes are being cleaned", sub: "Fresh and folded soon." };
    case "ready": return { title: "Clean and ready!", sub: "Finding a delivery partner near the store." };
    case "delivery_assigned": return { title: `${name} is heading to the store`, sub: "They'll pick up your clean clothes next." };
    case "out_for_delivery": return { title: `${name} is on the way${eta}`, sub: "Share the delivery OTP at your door." };
    case "delivered": return { title: "Delivered - enjoy fresh clothes", sub: "Thanks for choosing Laundry Point." };
    case "cancelled": return { title: "Order cancelled", sub: "You can place a new order anytime." };
    default: return { title: STATUS_META[order.status]?.label || order.status, sub: "" };
  }
}

export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const timeOnly = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const shortDate = (d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
export const itemsSummary = (items) => items.map((i) => `${i.serviceName} × ${i.quantity} ${i.unit}`).join(", ");
