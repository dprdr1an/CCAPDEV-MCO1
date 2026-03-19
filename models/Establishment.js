const mongoose = require("mongoose");

const EstablishmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },

    // optional fields (nice for BeanThere)
    hasWifi: { type: Boolean, default: false },
    hasSockets: { type: Boolean, default: false },
    hasAircon: { type: Boolean, default: false },

    imageUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Establishment", EstablishmentSchema);