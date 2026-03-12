const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" },
    title: { type: String, default: "Member" },
    avatar: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);