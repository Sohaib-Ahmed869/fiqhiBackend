// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("Error getting user profile:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    // Build update object
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email;
    if (phone) updateFields.phoneNumber = phone;

    // If email is being updated, check if already exists
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user.id },
      });
      if (existingUser) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Email already in use by another account",
          });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// @desc    Change user password
// @route   PUT /api/users/password
// userController.js - Fixed changePassword function
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Please provide current and new passwords",
        });
    }
    
    // Find user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Current password is incorrect" });
    }
    
    // IMPORTANT: Let the mongoose pre-save hook handle the password hashing
    // Instead of manually hashing it here
    user.password = newPassword;
    
    // Save the user - this will trigger the pre-save hook to hash the password
    await user.save();
    
    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
// @desc    Update user settings
// @route   PUT /api/users/settings
// @access  Private
exports.updateUserSettings = async (req, res) => {
  try {
    const { language, emailNotifications, pushNotifications, darkMode } =
      req.body;

    // Build settings object
    const settings = {};
    if (language !== undefined) settings.language = language;
    if (emailNotifications !== undefined)
      settings.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined)
      settings.pushNotifications = pushNotifications;
    if (darkMode !== undefined) settings.darkMode = darkMode;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { settings } },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.status(200).json({
      success: true,
      settings: user.settings,
    });
  } catch (err) {
    console.error("Error updating user settings:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
