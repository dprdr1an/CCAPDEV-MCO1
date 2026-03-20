const mongoose = require("mongoose");

const EstablishmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    handle: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    location: { type: String, required: true, trim: true },

    hasWifi: { type: Boolean, default: false },
    hasSockets: { type: Boolean, default: false },
    hasAircon: { type: Boolean, default: false },

    imageUrl: { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Establishment", EstablishmentSchema);