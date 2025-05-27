const User = require("../models/User");
const RegistrationToken = require("../models/RegisterationToken");

// Verify registration token
exports.verifyRegistrationToken = async (req, res) => {
  try {
    const { token } = req.params;

    const registrationToken = await RegistrationToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!registrationToken) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired registration token",
      });
    }

    res.status(200).json({
      success: true,
      message: "Token is valid",
      expiresAt: registrationToken.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Register Shaykh with token
exports.registerShaykhWithToken = async (req, res) => {
  try {
    const { token } = req.params;
    const {
      firstName,
      lastName,
      email,
      password,
      yearsOfExperience,
      phoneNumber,
      address,
      about,
      whereWork,
    } = req.body;

    // Verify token
    const registrationToken = await RegistrationToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!registrationToken) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired registration token",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already in use. Please use a different email address.",
      });
    }

    // Create the shaykh
    const user = await User.create({
      username: "shaykh" + Math.floor(Math.random() * 1000),
      firstName,
      lastName,
      email,
      password,
      yearsOfExperience,
      phoneNumber,
      address,
      about,
      whereWork,
      role: "shaykh",
    });

    // Mark token as used
    registrationToken.isUsed = true;
    registrationToken.usedBy = user._id;
    registrationToken.usedAt = new Date();
    await registrationToken.save();

    res.status(201).json({
      success: true,
      message: "Shaykh registered successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
