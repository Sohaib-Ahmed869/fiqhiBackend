const User = require("../../models/User");

exports.registerShaykh = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      yearsOfExperience,
      educationalInstitution,
      phoneNumber,
      address,
    } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: "Email already in use. Please use a different email address." 
      });
    }
    
    const user = await User.create({
      username: "shaykh" + Math.floor(Math.random() * 1000),
      firstName,
      lastName,
      email,
      password,
      yearsOfExperience,
      educationalInstitution,
      phoneNumber,
      address,
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
    
    res.status(200).json({ success: true, message: "Shaykh deleted successfully" });
  } catch (err) {
    console.error("Error deleting shaykh:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete shaykh. Please try again." 
    });
  }
};
