const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  username: String,
  establishmentName: String,
  rating: Number,
  reviewText: String,
  tags: [String],
  datePosted: String,
  photoUrl: String,
  ownerReply: {
    text: { type: String, default: "" },
    repliedAt: { type: Date, default: null }
  },
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  likedBy: [String],
  dislikedBy: [String],  
  replies: [
    {
      username: String,
      text: String,
      date: String,
      reviewId: mongoose.Schema.Types.ObjectId,
      establishmentName: String
    }
  ]
});

module.exports = mongoose.model("Review", ReviewSchema);