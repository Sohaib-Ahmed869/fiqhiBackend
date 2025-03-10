// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const {
  registerUser,
  login,
  registerAdmin,
  getUserProfile,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Public routes
router.post("/register", registerUser);
router.post("/login", login);
router.post("/register-admin", registerAdmin);
router.get("/profile", protect, getUserProfile);
router.post("/forgotpassword", forgotPassword);
router.put("/resetpassword/:resetToken", resetPassword);

module.exports = router;
