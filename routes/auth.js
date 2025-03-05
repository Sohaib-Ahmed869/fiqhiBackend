const express = require("express");
const router = express.Router();
const {
  registerUser,
  login,
  registerAdmin,
  getUserProfile
} = require("../controllers/authController");

const {protect} = require("../middleware/auth");

// Public routes
router.post("/register", registerUser);
router.post("/login", login);
router.post("/register-admin", registerAdmin);
router.get("/profile", protect, getUserProfile);

module.exports = router;
