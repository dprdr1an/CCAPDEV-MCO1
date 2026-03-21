const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  establishmentName: { type: String, required: true, trim: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  reviewText: { type: String, required: true, trim: true },
  tags: { type: [String], default: [] },
  datePosted: { type: String, default: "" },
  photoUrl: { type: String, default: "" },

  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] },
  dislikedBy: { type: [String], default: [] },

  replies: [
    {
      username: String,
      text: String,
      date: String,
      reviewId: mongoose.Schema.Types.ObjectId,
      establishmentName: String
    }
  ],

  ownerReply: {
    text: { type: String, default: "" },
    repliedAt: { type: Date, default: null }
  }
});

module.exports = mongoose.model("Review", ReviewSchema);