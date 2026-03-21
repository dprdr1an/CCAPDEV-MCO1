const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const session = require("express-session");

const connectDB = require("./config/db");
const Review = require("./models/Review");
const User = require("./models/User");
const Establishment = require("./models/Establishment");
const Owner = require("./models/Owner");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(session({
  secret: "beanthere-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true
  }
}));

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
    if (!est) return res.status(404).json({ message: "Cafe not found" });
    res.json(est);
  } catch (err) {
    res.status(500).send("Error fetching establishment");
  }
});

app.get("/reviews-by-cafe/:id", async (req, res) => {
  try {
    const est = await Establishment.findById(req.params.id);
    if (!est) return res.status(404).json([]);

    const reviews = await Review.find({
      establishmentName: { $regex: new RegExp(`^${est.name.trim()}$`, "i") }
    });

    res.json(reviews.map(r => ({
      ...r.toObject(),
      location: est.location || "",
      image: r.photoUrl || est.imageUrl || "apdev-tbv/cafe4.jpg"
    })));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching cafe reviews");
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
    const rawUsername = (username || "").trim();
    const normalizedUserUsername = rawUsername.startsWith("@")
      ? rawUsername
      : `@${rawUsername}`;

    // CHECK OWNER FIRST
    const owner = await Owner.findOne({ username: rawUsername, password });

    if (owner) {
      req.session.owner = {
        id: owner._id,
        username: owner.username
      };

      // clear user session if previously logged in as user
      req.session.user = null;

      if (rememberMe) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21; // 3 weeks
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

    // CHECK NORMAL USER SECOND
    const user = await User.findOne({ username: normalizedUserUsername, password });

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

    // clear owner session if previously logged in as owner
    req.session.owner = null;

    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 21; // 3 weeks
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
        const est = await Establishment.findOne({
          name: { $regex: new RegExp(`^${review.establishmentName.trim()}$`, "i") }
        });

            console.log("Review:", review.establishmentName);
            console.log("Matched:", est);

        return {
          ...review.toObject(),
          location: est?.location || "Location not available",
          image: est?.imageUrl || "apdev-tbv/cafe4.jpg",
          establishmentId: est?._id || null
        };
      })
    );

    res.json(enriched);
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

    const enriched = await Promise.all(
      reviews.map(async (review) => {
        const est = await Establishment.findOne({
          name: { $regex: new RegExp(`^${review.establishmentName.trim()}$`, "i") }
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
app.post('/reviews/:id/like', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  try {
    await Review.findByIdAndUpdate(req.params.id, {
      $inc: { likes: 1 }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error liking review");
  }
});
app.post('/reviews/:id/dislike', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  try {
    await Review.findByIdAndUpdate(req.params.id, {
      $inc: { dislikes: 1 }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error disliking review");
  }
});
app.post('/reviews/:id/reply', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  try {
    const review = await Review.findById(req.params.id);

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
app.get('/my-replies', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Login required");
  }

  const username = req.session.user.username;

  try {
    const reviews = await Review.find({
      "replies.username": username
    });

    const userReplies = [];

    reviews.forEach(review => {
      review.replies.forEach(reply => {
        if (reply.username === username) {
          userReplies.push({
            text: reply.text,
            date: reply.date,
            establishmentName: reply.establishmentName,
            reviewId: reply.reviewId
          });
        }
      });
    });

    res.json(userReplies);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching replies");
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