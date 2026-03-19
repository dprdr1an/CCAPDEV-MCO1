const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const session = require("express-session");

const connectDB = require("./config/db");
const Review = require("./models/Review");
const User = require("./models/User");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "beanthere-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true
  }
}));

// serve your frontend
app.use(express.static("bean there"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "bean there" });
});

/* =========================
   AUTH ROUTES
========================= */

// SIGN UP
app.post("/signup", async (req, res) => {
  try {
    const { fullName, username, password, bio, title, avatar } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send("Username already exists.");
    }

    const newUser = new User({
      fullName,
      username,
      password,
      bio: bio || "",
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

    const user = await User.findOne({ username, password });
    if (!user) {
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

    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21; // 3 weeks
    } else {
      req.session.cookie.expires = false;
      req.session.cookie.maxAge = null;
    }

    res.json({
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
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching reviews");
  }
});

app.get("/my-reviews", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const reviews = await Review.find({
      username: req.session.user.username
    });

    res.json(reviews);
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

    const { establishmentName, rating, reviewText, tags, datePosted } = req.body;

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
      photoUrl: ""
    });

    await newReview.save();
    res.send("Review added successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding review");
  }
});
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

app.post("/update-profile", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const { username, bio, title, avatar } = req.body;

    const normalizedUsername = username && username.startsWith("@")
      ? username
      : `@${(username || "").replace(/^@/, "")}`;

    // check if another user already uses this username
    const existingUser = await User.findOne({
      username: normalizedUsername,
      _id: { $ne: req.session.user.id }
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user.id,
      {
        username: normalizedUsername,
        bio: bio || "",
        title: title || "Member",
        ...(avatar ? { avatar } : {})
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // update session too
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
const PORT = 3000;

// start server after DB connection
(async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();