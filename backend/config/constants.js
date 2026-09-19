// Business rules shared by controllers, sockets and the public /api/store endpoint.
const num = (v, d) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

module.exports = {
  SLOTS: [
    "8:00 AM - 10:00 AM",
    "10:00 AM - 12:00 PM",
    "12:00 PM - 2:00 PM",
    "2:00 PM - 4:00 PM",
    "4:00 PM - 6:00 PM",
    "6:00 PM - 8:00 PM",
  ],
  DELIVERY_FEE: num(process.env.DELIVERY_FEE, 29),
  FREE_DELIVERY_ABOVE: num(process.env.FREE_DELIVERY_ABOVE, 299),
  EXPRESS_FEE: num(process.env.EXPRESS_FEE, 39),
  EXPRESS_ETA_MINUTES: num(process.env.EXPRESS_ETA_MINUTES, 45),
  PARTNER_PAYOUT_PER_TASK: num(process.env.PARTNER_PAYOUT_PER_TASK, 30),
  MAX_ACTIVE_TASKS_PER_PARTNER: num(process.env.MAX_ACTIVE_TASKS_PER_PARTNER, 3),
  // Fallback used only until an admin/seed creates the Store document.
  DEFAULT_STORE: {
    name: "Laundry Point Store",
    address: "Connaught Place, New Delhi, Delhi 110001",
    location: { lat: num(process.env.STORE_LAT, 28.6315), lng: num(process.env.STORE_LNG, 77.2167) },
    serviceRadiusKm: num(process.env.SERVICE_RADIUS_KM, 15),
    phone: "",
  },
};
