const User = require("../models/User");

exports.registerAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

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

exports.registerUser = async (req, res) => {
  try {
    console.log(req.body);
    const { name, email, password } = req.body;
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

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Please provide email and password" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res
        .status(404)
        .json({ success: false, error: "Invalid credentials" });
    }

    res
      .status(200)
      .json({
        success: true,
        token: user.getSignedJwtToken(),
        role: user.role,
      });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
