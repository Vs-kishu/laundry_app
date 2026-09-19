const { isProd } = require("../config/env");

const notFound = (req, res) => res.status(404).json({ message: "Route not found" });

// Centralised error handling so controllers can just throw / let rejections bubble up.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid id" });
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first?.message || "Validation failed" });
  }
  if (err.code === 11000) return res.status(409).json({ message: "An account with this email already exists" });
  if (err.message === "CORS blocked") return res.status(403).json({ message: "Origin not allowed" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Malformed JSON body" });

  console.error(err);
  res.status(err.status || 500).json({ message: isProd ? "Something went wrong" : err.message });
};

module.exports = { notFound, errorHandler };
