const mongoose = require("mongoose");
const { DEFAULT_STORE } = require("../config/constants");

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    serviceRadiusKm: { type: Number, default: 15, min: 1 },
  },
  { timestamps: true }
);

// The app runs a single store; cache it briefly because sockets and orders read it constantly.
let cache = { at: 0, doc: null };
storeSchema.statics.getCurrent = async function () {
  if (cache.doc && Date.now() - cache.at < 60_000) return cache.doc;
  const doc = (await this.findOne().lean()) || DEFAULT_STORE;
  cache = { at: Date.now(), doc };
  return doc;
};
storeSchema.statics.clearCache = () => {
  cache = { at: 0, doc: null };
};

module.exports = mongoose.model("Store", storeSchema);
