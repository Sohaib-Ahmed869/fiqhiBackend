// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getUserProfile,
  updateUserProfile,
  changePassword,
  updateUserSettings,
} = require("../controllers/userController");

// Protected routes
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/password", protect, changePassword);
router.put("/settings", protect, updateUserSettings);

module.exports = router;
