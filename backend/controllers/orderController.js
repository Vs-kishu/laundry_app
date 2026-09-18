const Order = require("../models/Order");
const Service = require("../models/Service");

// @desc  Create a new booking
// @route POST /api/orders
const createOrder = async (req, res) => {
  try {
    const { items, pickupAddress, pickupDate, pickupSlot, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Please add at least one service to your order" });
    }
    if (!pickupAddress || !pickupDate || !pickupSlot) {
      return res.status(400).json({ message: "Pickup address, date, and time slot are required" });
    }

    // Rebuild items server-side from DB prices so the client can't tamper with pricing
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const service = await Service.findById(item.serviceId);
      if (!service || !service.isActive) {
        return res.status(400).json({ message: `Service not found or unavailable: ${item.serviceId}` });
      }
      const subtotal = service.pricePerUnit * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        service: service._id,
        serviceName: service.name,
        quantity: item.quantity,
        unit: service.unit,
        pricePerUnit: service.pricePerUnit,
        subtotal,
      });
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      pickupAddress,
      pickupDate,
      pickupSlot,
      notes,
      totalAmount,
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while creating order" });
  }
};

// @desc  Get logged-in user's own orders
// @route GET /api/orders/my
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while fetching orders" });
  }
};

// @desc  Get a single order by id (owner or admin)
// @route GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("user", "name email phone");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isOwner = order.user._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    return res.json(order);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while fetching order" });
  }
};

// @desc  Get all orders (admin only)
// @route GET /api/orders
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while fetching orders" });
  }
};

// @desc  Update order status (admin only)
// @route PUT /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["placed", "picked_up", "in_progress", "ready", "delivered", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    await order.save();
    return res.json(order);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while updating order" });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
};
