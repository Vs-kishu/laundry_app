const Order = require("../models/Order");

// Atomic status change: the filter must still match at write time, so two partners
// accepting the same task (or a double-click) can never both succeed.
// Returns the updated order, or null when the filter no longer matches.
function transition(filter, to, set = {}) {
  return Order.findOneAndUpdate(
    filter,
    { $set: { status: to, ...set }, $push: { timeline: { status: to, at: new Date() } } },
    { new: true }
  );
}

module.exports = { transition };
