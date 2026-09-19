// Real-time layer (Socket.IO).
//
// Rooms
//   user:<id>     private notifications for one user (customer, partner, admin)
//   order:<id>    live partner location for one order (owner, admin and assigned partner may join)
//   partners      approved partners: "a new task exists" broadcasts
//   admin         admin dashboards
//
// Events (server -> client)
//   order:update      { orderId, status }                      refetch the order
//   partner:location  { orderId, lat, lng, heading, etaMinutes, distanceKm, at }
//   tasks:changed     {}                                       partners refetch available tasks
//   partner:update    { partnerId }                            admin refetches partners
//
// Events (client -> server)
//   order:join / order:leave   (orderId, ack)
//   partner:location           { lat, lng, heading? }
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");
const Store = require("../models/Store");
const { clientOrigins } = require("../config/env");
const { haversineKm, etaMinutes, validCoord } = require("../utils/geo");
const { PICKUP_ACTIVE, DELIVERY_ACTIVE, destinationFor } = require("../utils/orderFlow");

let io = null;

const MIN_PING_MS = 800; // ignore faster pings than this per socket
const PERSIST_MS = 15_000; // how often the last known location is written to MongoDB
const CACHE_MS = 15_000; // how long a partner's active-order list is cached

const activeCache = new Map(); // partnerId -> { at, orders }

async function activeOrdersFor(partnerId) {
  const hit = activeCache.get(partnerId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.orders;

  const orders = await Order.find({
    $or: [
      { pickupPartner: partnerId, status: { $in: PICKUP_ACTIVE } },
      { deliveryPartner: partnerId, status: { $in: DELIVERY_ACTIVE } },
    ],
  })
    .select("status pickupLocation")
    .lean();

  activeCache.set(partnerId, { at: Date.now(), orders });
  return orders;
}

const invalidatePartner = (partnerId) => partnerId && activeCache.delete(String(partnerId));

async function canJoinOrder(user, orderId) {
  const order = await Order.findById(orderId).select("user pickupPartner deliveryPartner").lean();
  if (!order) return false;
  if (user.role === "admin") return true;
  const uid = String(user._id);
  return [order.user, order.pickupPartner, order.deliveryPartner].some((x) => x && String(x) === uid);
}

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: clientOrigins(), credentials: true },
    maxHttpBufferSize: 1e4,
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id).select("name role partner.verificationStatus").lean();
      if (!user) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user._id}`);
    if (user.role === "admin") socket.join("admin");
    if (user.role === "partner" && user.partner?.verificationStatus === "approved") socket.join("partners");

    socket.on("order:join", async (orderId, ack) => {
      try {
        const ok = typeof orderId === "string" && (await canJoinOrder(user, orderId));
        if (ok) socket.join(`order:${orderId}`);
        if (typeof ack === "function") ack({ ok });
      } catch {
        if (typeof ack === "function") ack({ ok: false });
      }
    });

    socket.on("order:leave", (orderId) => {
      if (typeof orderId === "string") socket.leave(`order:${orderId}`);
    });

    socket.on("partner:location", async (data) => {
      if (user.role !== "partner" || user.partner?.verificationStatus !== "approved") return;

      const now = Date.now();
      if (now - (socket.data.lastPing || 0) < MIN_PING_MS) return;
      socket.data.lastPing = now;

      const point = { lat: Number(data?.lat), lng: Number(data?.lng) };
      if (!validCoord(point)) return;
      const heading = Number.isFinite(Number(data?.heading)) ? Number(data.heading) : null;

      try {
        if (now - (socket.data.lastPersist || 0) > PERSIST_MS) {
          socket.data.lastPersist = now;
          User.updateOne(
            { _id: user._id },
            { $set: { "partner.location": { ...point, updatedAt: new Date() } } }
          ).catch((e) => console.error("persist location failed", e.message));
        }

        const orders = await activeOrdersFor(String(user._id));
        if (!orders.length) return;
        const store = await Store.getCurrent();

        for (const order of orders) {
          const target = destinationFor(order.status) === "store" ? store.location : order.pickupLocation;
          const distanceKm = haversineKm(point, target);
          io.to(`order:${order._id}`).emit("partner:location", {
            orderId: String(order._id),
            ...point,
            heading,
            distanceKm: Math.round(distanceKm * 100) / 100,
            etaMinutes: etaMinutes(distanceKm),
            at: now,
          });
        }
      } catch (e) {
        console.error("partner:location failed", e.message);
      }
    });

    socket.on("disconnect", async () => {
      if (user.role !== "partner") return;
      try {
        const remaining = await io.in(`user:${user._id}`).fetchSockets();
        if (remaining.length) return;
        // Don't drop a partner who is mid-delivery; they can reconnect.
        const active = await Order.exists({
          $or: [
            { pickupPartner: user._id, status: { $in: PICKUP_ACTIVE } },
            { deliveryPartner: user._id, status: { $in: DELIVERY_ACTIVE } },
          ],
        });
        if (!active) {
          await User.updateOne({ _id: user._id }, { $set: { "partner.isOnline": false } });
          notifyPartnerChanged(user._id);
        }
      } catch (e) {
        console.error("disconnect cleanup failed", e.message);
      }
    });
  });

  return io;
}

// ---- server-side emit helpers (safe no-ops before init) ----

function notifyOrder(order) {
  if (!io) return;
  const payload = { orderId: String(order._id), status: order.status };
  let target = io.to(`order:${order._id}`).to(`user:${order.user?._id || order.user}`).to("admin");
  if (order.pickupPartner) target = target.to(`user:${order.pickupPartner?._id || order.pickupPartner}`);
  if (order.deliveryPartner) target = target.to(`user:${order.deliveryPartner?._id || order.deliveryPartner}`);
  target.emit("order:update", payload);
  io.to("partners").emit("tasks:changed", {});
  invalidatePartner(order.pickupPartner?._id || order.pickupPartner);
  invalidatePartner(order.deliveryPartner?._id || order.deliveryPartner);
}

function notifyPartnerChanged(partnerId) {
  if (io) io.to("admin").emit("partner:update", { partnerId: String(partnerId) });
}

module.exports = { init, notifyOrder, notifyPartnerChanged, invalidatePartner };
