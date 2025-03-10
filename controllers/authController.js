const User = require("../models/User");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const bcrypt = require('bcryptjs');

  exports.registerUser = async (req, res) => {
    try {
      console.log(req.body);
      const { name, email, password } = req.body;
  
      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, error: "Email already exists" });
      }
  
      const user = await User.create({
        username: name,
        email,
        password,
        role: "user",
      });
  
      res.status(201).json({ success: true, user });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
  
  exports.registerAdmin = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, error: "Email already exists" });
      }
  
      const user = await User.create({
        email,
        password,
        role: "admin",
      });
  
      res.status(201).json({ success: true, user });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
  

exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" });

    res.status(200).json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ success: false, error: "Please provide email and password" });
//     }

//     const user = await User.findOne({ email }).select("+password");

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Invalid credentials" });
//     }

//     const isMatch = await user.matchPassword(password);

//     if (!isMatch) {
//       return res
//         .status(404)
//         .json({ success: false, error: "Invalid credentials" });
//     }

//     res
//       .status(200)
//       .json({
//         success: true,
//         token: user.getSignedJwtToken(),
//         role: user.role,
//       });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// authController.js - Login function fix
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Login attempt for email: ${email}`);

    // Validate email and password
    if (!email || !password) {
      console.log('Missing email or password');
      return res
        .status(400)
        .json({ success: false, error: "Please provide email and password" });
    }

    // Make sure to explicitly select the password field for comparison
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      console.log(`User not found for email: ${email}`);
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    console.log(`User found: ${user._id}, has password: ${!!user.password}`);
    
    // Check if password matches
    console.log('Attempting to compare passwords');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match result: ${isMatch}`);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // Create token
    const token = user.getSignedJwtToken();

    // Remove password from response
    const userResponse = {
      _id: user._id,
      email: user.email,
      role: user.role,
    };

    console.log('Login successful');
    res.status(200).json({
      success: true,
      token,
      user: userResponse
    });
  } catch (err) {
    console.error("Login error details:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    console.log(req.user);
    const user = await User.findById(req.user._id);

    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Please provide an email address" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const resetToken = crypto.randomBytes(20).toString("hex");

    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/resetpassword/${resetToken}`;
    
    const message = `You are receiving this email because you requested a password reset.
Please click on the following link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

    await sendEmail({
      to: user.email,
      subject: "Password Reset Token",
      text: message,
    });

    res.status(200).json({ success: true, data: "Email sent" });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    // Get the token from the URL parameter
    const resetToken = req.params.resetToken;
    
    // Hash the token to compare with the stored hashed token
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    
    // Find the user with the valid token (and not expired)
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
    
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid or expired token" });
    }
    
    // Check if a new password is provided
    if (!req.body.password) {
      return res.status(400).json({ success: false, error: "Please provide a new password" });
    }
    
    // Update the password and clear the reset token fields
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    res.status(200).json({ success: true, data: "Password updated successfully" });
  } catch (err) {
    console.error("Error in resetPassword:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};