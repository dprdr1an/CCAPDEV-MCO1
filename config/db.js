// config/db.js
const mongoose = require("mongoose");

async function connectDB() {
  try {
    const uri =
  "mongodb+srv://beanthere:ACESbeanthere123@beanthere.6chdrq1.mongodb.net/beanthere?retryWrites=true&w=majority";

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB connected (Atlas via IPs, no SRV)");
  } catch (err) {
    console.error("❌ MongoDB connection error:");
    console.error(err);
    process.exit(1);
  }
}

module.exports = connectDB;