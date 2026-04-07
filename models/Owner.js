const mongoose = require("mongoose");

const OwnerSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },

    
    establishmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Establishment",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Owner", OwnerSchema);