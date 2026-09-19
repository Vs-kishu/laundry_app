const { z } = require("zod");
const Service = require("../models/Service");
const asyncHandler = require("../utils/asyncHandler");

const base = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300),
  pricePerUnit: z.coerce.number().positive().max(100000),
  unit: z.enum(["kg", "item"]),
  category: z.enum(["wash_fold", "dry_clean", "iron_only", "wash_iron"]),
};
const createServiceSchema = z.object({
  ...base,
  description: base.description.optional().default(""),
  unit: base.unit.default("kg"),
  category: base.category.default("wash_fold"),
});
const updateServiceSchema = z.object({ ...base, isActive: z.boolean() }).partial();

// @route GET /api/services
const getServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ category: 1, name: 1 }).lean();
  res.set("Cache-Control", "public, max-age=60");
  res.json(services);
});

// @route POST /api/services (admin)
const createService = asyncHandler(async (req, res) => {
  res.status(201).json(await Service.create(req.body));
});

// @route PUT /api/services/:id (admin) - only whitelisted fields, validated by updateServiceSchema
const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) return res.status(404).json({ message: "Service not found" });
  Object.assign(service, req.body);
  res.json(await service.save());
});

// @route DELETE /api/services/:id (admin) - soft delete so old orders keep their history
const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, { isActive: false });
  if (!service) return res.status(404).json({ message: "Service not found" });
  res.json({ message: "Service removed" });
});

module.exports = {
  getServices,
  createService,
  updateService,
  deleteService,
  createServiceSchema,
  updateServiceSchema,
};
