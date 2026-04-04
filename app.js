const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");

const connectDB = require("./config/db");
const Review = require("./models/Review");
const User = require("./models/User");
const Establishment = require("./models/Establishment");
const Owner = require("./models/Owner");

const app = express();

function normalizeUsername(username) {
  const raw = (username || "").trim();
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function isValidUsername(username) {
  return /^@[A-Za-z0-9_]{3,20}$/.test(username);
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 50;
}

function isValidFullName(fullName) {
  return typeof fullName === "string" && fullName.trim().length >= 2 && fullName.trim().length <= 60;
}

function isValidOptionalText(text, maxLength) {
  return typeof text === "string" && text.length <= maxLength;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(
  session({
    secret: "beanthere-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true
    }
  })
);

// serve your frontend
app.use(express.static("bean there"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "bean there" });
});

/* =========================
   ESTABLISHMENT ROUTES
========================= */

app.get("/establishments", async (req, res) => {
  try {
    const ests = await Establishment.find();
    res.json(ests);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching establishments");
  }
});

app.get("/establishments/:id", async (req, res) => {
  try {
    const est = await Establishment.findById(req.params.id);
    if (!est) {
      return res.status(404).json({ message: "Cafe not found" });
    }
    res.json(est);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching establishment");
  }
});

app.get("/owner-establishment", async (req, res) => {
  try {
    if (!req.session.owner) {
      return res.status(401).json({ message: "Owner not logged in" });
    }

    const owner = await Owner.findById(req.session.owner.id).populate("establishmentId");

    if (!owner || !owner.establishmentId) {
      return res.status(404).json({ message: "Establishment not found" });
    }

    res.json(owner.establishmentId);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching owner establishment" });
  }
});

/* =========================
   AUTH ROUTES
========================= */

app.get("/session-owner", (req, res) => {
  if (!req.session.owner) {
    return res.status(401).json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    owner: req.session.owner
  });
});

app.post("/update-cafe", async (req, res) => {
  try {
    if (!req.session.owner) {
      return res.status(401).json({ message: "Owner not logged in" });
    }
    const owner = await Owner.findById(req.session.owner.id);
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }
    const { bio, imageUrl } = req.body;
    const updatedCafe = await Establishment.findByIdAndUpdate(
      owner.establishmentId,
      {
        bio: bio || "",
        ...(imageUrl ? { imageUrl } : {})
      },
      { new: true }
    );
    if (!updatedCafe) {
      return res.status(404).json({ message: "Establishment not found" });
    }
    res.json({ message: "Cafe updated successfully", cafe: updatedCafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating cafe" });
  }
});

// SIGN UP
app.post("/signup", async (req, res) => {
  try {
    let { fullName, username, password, bio, title, avatar } = req.body;

    fullName = (fullName || "").trim();
    username = normalizeUsername(username);
    password = password || "";
    bio = (bio || "").trim();
    title = (title || "").trim();

    if (!isValidFullName(fullName)) {
      return res.status(400).send("Full name must be 2 to 60 characters.");
    }

    if (!isValidUsername(username)) {
      return res.status(400).send("Username must start with @ and be 3 to 20 characters using only letters, numbers, and underscores.");
    }

    if (!isValidPassword(password)) {
      return res.status(400).send("Password must be 6 to 50 characters.");
    }

    if (!isValidOptionalText(bio, 160)) {
      return res.status(400).send("Bio must be 160 characters or less.");
    }

    if (!isValidOptionalText(title, 50)) {
      return res.status(400).send("Job title must be 50 characters or less.");
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send("Username already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      username,
      password: hashedPassword,
      bio: bio || "No bio added yet.",
      title: title || "Member",
      avatar: avatar || ""
    });

    await newUser.save();
    res.send("Sign up successful");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error signing up");
  }
});

// LOG IN
app.post("/login", async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    const normalizedUsername = normalizeUsername(username);
    const cleanPassword = password || "";

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({ message: "Invalid username format." });
    }

    if (!isValidPassword(cleanPassword)) {
      return res.status(400).json({ message: "Invalid password format." });
    }

    const owner = await Owner.findOne({ username: normalizedUsername });

    if (owner && await bcrypt.compare(cleanPassword, owner.password)) {
      req.session.owner = {
        id: owner._id,
        username: owner.username
      };

      req.session.user = null;

      if (rememberMe) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21;
      } else {
        req.session.cookie.expires = false;
        req.session.cookie.maxAge = null;
      }

      return res.json({
        role: "owner",
        message: "Owner login successful",
        username: owner.username
      });
    }

    const user = await User.findOne({ username: normalizedUsername });

    if (!user || !(await bcrypt.compare(cleanPassword, user.password))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    req.session.user = {
      id: user._id,
      fullName: user.fullName,
      username: user.username,
      bio: user.bio,
      title: user.title,
      avatar: user.avatar
    };

    req.session.owner = null;

    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21;
    } else {
      req.session.cookie.expires = false;
      req.session.cookie.maxAge = null;
    }

    res.json({
      role: "user",
      message: "Login successful",
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error logging in");
  }
});

// CHECK CURRENT SESSION USER
app.get("/session-user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

// CHECK CURRENT SESSION OWNER
app.get("/session-owner", (req, res) => {
  if (!req.session.owner) {
    return res.status(401).json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    owner: req.session.owner
  });
});

// LOG OUT
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error logging out");
    }

    res.clearCookie("connect.sid");
    res.send("Logged out successfully");
  });
});

/* =========================
   REVIEW ROUTES
========================= */

// GET ALL REVIEWS
app.get("/reviews", async (req, res) => {
  try {
    const reviews = await Review.find();

    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const rawName = (review.establishmentName || "").trim();
        const safeName = rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const est = await Establishment.findOne({
          name: { $regex: new RegExp(`^${safeName}$`, "i") }
        });

        return {
          ...review.toObject(),
          location: est?.location || "Location not available",
          image: est?.imageUrl || "apdev-tbv/cafe4.jpg",
          establishmentId: est?._id || null,
          likes: review.likes || 0,
          dislikes: review.dislikes || 0,
          likedBy: review.likedBy || [],
          dislikedBy: review.dislikedBy || [],
          replies: review.replies || []
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching reviews");
  }
});

// GET REVIEWS BY CAFE
app.get("/reviews-by-cafe/:id", async (req, res) => {
  try {
    const est = await Establishment.findById(req.params.id);
    if (!est) {
      return res.status(404).json([]);
    }

    const safeName = est.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const reviews = await Review.find({
      establishmentName: { $regex: new RegExp(`^${safeName}$`, "i") }
    });

    res.json(
      reviews.map((r) => ({
        ...r.toObject(),
        location: est.location || "",
        image: r.photoUrl || est.imageUrl || "apdev-tbv/cafe4.jpg"
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching cafe reviews");
  }
});

// GET MY REVIEWS
app.get("/my-reviews", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const reviews = await Review.find({
      username: req.session.user.username
    });

    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const safeName = (review.establishmentName || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const est = await Establishment.findOne({
          name: { $regex: new RegExp(`^${safeName}$`, "i") }
        });

        return {
          ...review.toObject(),
          location: est?.location || "Location not available",
          image: est?.imageUrl || "apdev-tbv/cafe4.jpg"
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching user reviews");
  }
});

// ADD REVIEW
app.post("/add-review", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send("Not logged in");
    }

    const { establishmentName, rating, reviewText, tags, datePosted, photoUrl } = req.body;

    const newReview = new Review({
      username: req.session.user.username,
      establishmentName,
      rating,
      reviewText,
      tags: tags ? tags.split(",") : [],
      datePosted,
      ownerReply: {
        text: "",
        repliedAt: null
      },
      photoUrl: photoUrl || "",
      likes: 0,
      dislikes: 0,
      replies: []
    });

    await newReview.save();
    res.send("Review added successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding review");
  }
});

// EDIT REVIEW
app.post("/edit-review", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const { reviewId, reviewText, rating, tags } = req.body;

    const updatedReview = await Review.findOneAndUpdate(
      {
        _id: reviewId,
        username: req.session.user.username
      },
      {
        reviewText,
        rating,
        tags: Array.isArray(tags) ? tags : []
      },
      { new: true }
    );

    if (!updatedReview) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({
      message: "Review updated successfully",
      review: updatedReview
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating review" });
  }
});

// OWNER REPLY TO REVIEW
app.post("/reply-review", async (req, res) => {
  try {
    if (!req.session.owner) {
      return res.status(401).json({ message: "Owner not logged in" });
    }

    const { reviewId, replyText } = req.body;

    if (!reviewId || !replyText) {
      return res.status(400).json({ message: "Missing reviewId or replyText" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const updated = await Review.findByIdAndUpdate(
      reviewId,
      {
        $push: {
          replies: {
            username: req.session.owner.username,
            text: replyText,
            date: new Date().toLocaleDateString(),
            reviewId: reviewId,
            establishmentName: review.establishmentName,
            role: "owner" // 🔥 THIS is the key
          }
        }
      },
      { new: true }
    );

    res.json({ message: "Reply saved", review: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving reply" });
  }
});

// LIKE REVIEW
app.post("/reviews/:id/like", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  const username = req.session.user.username;

  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).send("Review not found");
    }

    const alreadyLiked = review.likedBy?.includes(username);

    if (alreadyLiked) {
      await Review.findByIdAndUpdate(req.params.id, {
        $inc: { likes: -1 },
        $pull: { likedBy: username }
      });
    } else {
      await Review.findByIdAndUpdate(req.params.id, {
        $inc: {
          likes: 1,
          dislikes: review.dislikedBy?.includes(username) ? -1 : 0
        },
        $addToSet: { likedBy: username },
        $pull: { dislikedBy: username }
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error liking review");
  }
});

// DISLIKE REVIEW
app.post("/reviews/:id/dislike", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  const username = req.session.user.username;

  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).send("Review not found");
    }

    const alreadyDisliked = review.dislikedBy?.includes(username);

    if (alreadyDisliked) {
      await Review.findByIdAndUpdate(req.params.id, {
        $inc: { dislikes: -1 },
        $pull: { dislikedBy: username }
      });
    } else {
      await Review.findByIdAndUpdate(req.params.id, {
        $inc: {
          dislikes: 1,
          likes: review.likedBy?.includes(username) ? -1 : 0
        },
        $addToSet: { dislikedBy: username },
        $pull: { likedBy: username }
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error disliking review");
  }
});

// USER REPLY TO A REVIEW
app.post("/reviews/:id/reply", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).send("Review not found");
    }

    const reply = {
      username: req.session.user.username,
      text: req.body.text,
      date: new Date().toLocaleDateString(),
      reviewId: review._id,
      establishmentName: review.establishmentName
    };

    await Review.findByIdAndUpdate(req.params.id, {
      $push: { replies: reply }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error replying");
  }
});

// GET CURRENT USER'S REPLIES
app.get('/my-replies', async (req, res) => {
  if (!req.session.user) return res.status(401).send("Login required");
  try {
    const reviews = await Review.find({ "replies.username": req.session.user.username });
    const userReplies = [];
    reviews.forEach(review => {
      review.replies.forEach(reply => {
        if (reply.username === req.session.user.username) {
          userReplies.push({
            text: reply.text,
            date: reply.date,
            establishmentName: reply.establishmentName,
            reviewId: review._id,   // always use the parent review's _id directly
            replyToUser: review.username,
            image: review.photoUrl || ""
          });
        }
      });
    });
    res.json(userReplies);
  } catch (err) { res.status(500).send("Error fetching replies"); }
});

/* =========================
   PROFILE ROUTES
========================= */

app.post("/update-profile", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    let { fullName, username, bio, title, avatar } = req.body;

    fullName = (fullName || "").trim();
    username = normalizeUsername(username);
    bio = (bio || "").trim();
    title = (title || "").trim();

    if (!isValidFullName(fullName)) {
      return res.status(400).json({
        message: "Full name must be 2 to 60 characters."
      });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({ message: "Username must start with @ and be 3 to 20 characters using only letters, numbers, and underscores." });
    }

    if (!isValidOptionalText(bio, 160)) {
      return res.status(400).json({ message: "Bio must be 160 characters or less." });
    }

    if (!isValidOptionalText(title, 50)) {
      return res.status(400).json({ message: "Job title must be 50 characters or less." });
    }

    const existingUser = await User.findOne({
      username,
      _id: { $ne: req.session.user.id }
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user.id,
      {
        fullName,
        username,
        bio: bio || "",
        title: title || "Member",
        ...(avatar !== undefined ? { avatar } : {})
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    req.session.user = {
      id: updatedUser._id,
      fullName: updatedUser.fullName,
      username: updatedUser.username,
      bio: updatedUser.bio,
      title: updatedUser.title,
      avatar: updatedUser.avatar
    };

    res.json({
      message: "Profile updated successfully",
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

app.delete("/delete-reply", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const { reviewId, text } = req.body;

    if (!reviewId || !text) {
      return res.status(400).json({ message: "Missing reviewId or text" });
    }

    const updated = await Review.findOneAndUpdate(
      {
        _id: reviewId,
        replies: {
          $elemMatch: {
            text: text,
            username: req.session.user.username
          }
        }
      },
      {
        $pull: {
          replies: {
            text: text,
            username: req.session.user.username
          }
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Reply not found or already deleted" });
    }

    res.json({ message: "Reply deleted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting reply" });
  }
});

const PORT = 3000;

// start server after DB connection
(async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
})();