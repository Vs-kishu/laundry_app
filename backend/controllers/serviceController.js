const Service = require("../models/Service");

// @desc  Get all active services
// @route GET /api/services
const getServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ category: 1 });
    return res.json(services);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while fetching services" });
  }
};

// @desc  Create a new service (admin only)
// @route POST /api/services
const createService = async (req, res) => {
  try {
    const { name, description, pricePerUnit, unit, category } = req.body;

    if (!name || !pricePerUnit) {
      return res.status(400).json({ message: "Name and price are required" });
    }

    const service = await Service.create({
      name,
      description,
      pricePerUnit,
      unit,
      category,
    });

    return res.status(201).json(service);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while creating service" });
  }
};

// @desc  Update a service (admin only)
// @route PUT /api/services/:id
const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    Object.assign(service, req.body);
    const updated = await service.save();
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while updating service" });
  }
};

// @desc  Delete (deactivate) a service (admin only)
// @route DELETE /api/services/:id
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.isActive = false;
    await service.save();
    return res.json({ message: "Service removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error while deleting service" });
  }
};

module.exports = { getServices, createService, updateService, deleteService };
