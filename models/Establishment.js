const mongoose = require("mongoose");

const EstablishmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    handle: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    location: { type: String, required: true, trim: true },

    imageUrl: { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Establishment", EstablishmentSchema);