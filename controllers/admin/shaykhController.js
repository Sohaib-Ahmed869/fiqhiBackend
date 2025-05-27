const User = require("../../models/User");
const RegistrationToken = require("../../models/RegisterationToken");
const crypto = require("crypto");

// Generate registration token
exports.generateRegistrationToken = async (req, res) => {
  try {
    const { expiryDays = 7 } = req.body;

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Calculate expiry date
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const registrationToken = await RegistrationToken.create({
      token,
      expiresAt,
      createdBy: req.user.id,
    });

    // Generate the registration URL
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const registrationUrl = `${baseUrl}/register-shaykh/${token}`;

    res.status(201).json({
      success: true,
      token: registrationToken,
      registrationUrl,
      expiresAt,
    });
  } catch (err) {
    console.error("Error generating registration token:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all registration tokens
exports.getRegistrationTokens = async (req, res) => {
  try {
    const tokens = await RegistrationToken.find()
      .populate("createdBy", "firstName lastName email")
      .populate("usedBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tokens });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete/revoke registration token
exports.revokeRegistrationToken = async (req, res) => {
  try {
    const token = await RegistrationToken.findByIdAndDelete(req.params.id);

    if (!token) {
      return res.status(404).json({ success: false, error: "Token not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Token revoked successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
exports.registerShaykh = async (req, res) => {
  try {
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

    // Check if email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already in use. Please use a different email address.",
      });
    }

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

    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getShaykhs = async (req, res) => {
  try {
    const shaykhs = await User.find({ role: "shaykh" });

    res.status(200).json({ success: true, shaykhs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteShaykh = async (req, res) => {
  try {
    const shaykh = await User.findById(req.params.id);

    if (!shaykh) {
      return res
        .status(404)
        .json({ success: false, error: "Shaykh not found" });
    }

    // Check if the user is actually a shaykh
    if (shaykh.role !== "shaykh") {
      return res
        .status(400)
        .json({ success: false, error: "User is not a shaykh" });
    }

    // Use deleteOne() instead of remove()
    await User.deleteOne({ _id: req.params.id });

    res
      .status(200)
      .json({ success: true, message: "Shaykh deleted successfully" });
  } catch (err) {
    console.error("Error deleting shaykh:", err);
    res.status(500).json({
      success: false,
      error: "Failed to delete shaykh. Please try again.",
    });
  }
};
