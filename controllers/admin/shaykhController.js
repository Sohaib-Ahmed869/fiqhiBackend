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

    await shaykh.remove();

    res.status(200).json({ success: true, message: "Shaykh deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
