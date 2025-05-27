// controllers/fatwaController.js
const Fatwa = require("../models/Fatwa");
const User = require("../models/User");

// @desc    Get all fatwas
// @route   GET /fatwas
// @access  Public/Protected based on role
exports.getFatwas = async (req, res) => {
  try {
    let query = {};

    // Apply filters if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Get all fatwas with user and assigned shaykh details
    const fatwas = await Fatwa.find(query)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedTo",
        select: "username email name role",
      })
      .populate({
        path: "answeredBy",
        select: "username email name role",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, fatwas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get single fatwa
// @route   GET /fatwas/:id
// @access  Public/Protected based on role
exports.getFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedTo",
        select: "username email name role",
      })
      .populate({
        path: "answeredBy",
        select: "username email name role",
      });

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    res.status(200).json({ success: true, fatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create new fatwa
// @route   POST /fatwas
// @access  Protected (user, admin)
exports.createFatwa = async (req, res) => {
  try {
    const { title, question, priority, privacy, category } = req.body;

    // Create fatwa with user ID from JWT
    const fatwa = await Fatwa.create({
      title,
      question,
      user: req.user.id,
      priority: priority || "not-urgent",
      privacy: privacy || "not-confidential",
      category: category || "other",
    });

    res.status(201).json({ success: true, fatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Assign fatwa to shaykh
// @route   PUT /fatwas/:id/assign
// @access  Protected (admin, shaykh)
exports.assignFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Only admin and shaykhs can assign
    if (req.user.role !== "admin" && req.user.role !== "shaykh") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to assign fatwas",
      });
    }

    const shaykhId = req.body.shaykhId;

    console.log("Assigning fatwa:", fatwa._id, "to shaykh:", shaykhId);
    // If shaykhId is provided, assign to that shaykh
    if (shaykhId !== "Unassigned") {
      // If admin is assigning to a shaykh, verify the shaykh exists
      const shaykh = await User.findById(shaykhId);
      if (!shaykh || shaykh.role !== "shaykh") {
        return res.status(400).json({
          success: false,
          error: "Invalid shaykh assignment",
        });
      }

      fatwa.status = "assigned";
      fatwa.assignedTo = shaykhId;
    } else {
      // If no shaykhId provided, unassign (set to pending)
      fatwa.status = "pending";
      fatwa.assignedTo = null;
    }

    await fatwa.save();

    const updatedFatwa = await Fatwa.findById(fatwa._id).populate({
      path: "assignedTo",
      select: "username email name role",
    });

    res.status(200).json({ success: true, fatwa: updatedFatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.unassignFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Only admin can unassign
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to unassign fatwas",
      });
    }

    fatwa.status = "pending";
    fatwa.assignedTo = null;
    fatwa.assignedAt = null;

    await fatwa.save();

    res.status(200).json({ success: true, fatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// @desc    Answer a fatwa
// @route   PUT /fatwas/:id/answer
// @access  Protected (shaykh)
exports.answerFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Admin can answer any fatwa, shaykh can only answer assigned ones
    if (req.user.role === "admin") {
      // Admin can answer any fatwa
    } else if (req.user.role === "shaykh") {
      // Check if the fatwa is assigned to this shaykh
      if (
        fatwa.assignedTo.toString() !== req.user.id ||
        fatwa.status !== "assigned"
      ) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to answer this fatwa",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        error: "Not authorized to answer fatwas",
      });
    }

    // Update fatwa
    fatwa.status = "answered";
    fatwa.answer = req.body.answer;
    fatwa.answeredBy = req.user.id;
    fatwa.answeredAt = Date.now();

    await fatwa.save();

    const updatedFatwa = await Fatwa.findById(fatwa._id).populate({
      path: "answeredBy",
      select: "username email name role",
    });

    res.status(200).json({ success: true, fatwa: updatedFatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// @desc    Approve a fatwa (admin review of answered fatwa)
// @route   PUT /fatwas/:id/approve
// @access  Protected (admin)
exports.approveFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Only admin can approve
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to approve fatwas",
      });
    }

    // Check if fatwa is in answered state
    if (fatwa.status !== "answered") {
      return res.status(400).json({
        success: false,
        error: "Only answered fatwas can be approved",
      });
    }

    // Add admin comment if provided
    if (req.body.comment) {
      fatwa.feedback.push({
        comment: req.body.comment,
        date: Date.now(),
      });
    }

    // Update status
    fatwa.status = "approved";
    fatwa.approvedBy = req.user.id;
    fatwa.approvedAt = Date.now();

    await fatwa.save();

    res.status(200).json({ success: true, fatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Unapprove/reject a fatwa
// @route   PUT /fatwas/:id/unapprove
// @access  Protected (admin)
exports.unapproveFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Only admin can unapprove
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to unapprove fatwas",
      });
    }

    // Check if fatwa is in answered state
    if (fatwa.status !== "answered") {
      return res.status(400).json({
        success: false,
        error: "Only answered fatwas can be unapproved",
      });
    }

    // Add feedback for the shaykh
    if (!req.body.comment) {
      return res.status(400).json({
        success: false,
        error: "Feedback comment is required when unapproving",
      });
    }

    fatwa.feedback.push({
      comment: req.body.comment,
      date: Date.now(),
    });

    // Change status back to assigned so shaykh can revise
    fatwa.status = "assigned";

    await fatwa.save();

    res.status(200).json({ success: true, fatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Delete a fatwa
// @route   DELETE /fatwas/:id
// @access  Protected (admin)
exports.deleteFatwa = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Only admin can delete
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete fatwas",
      });
    }

    await fatwa.remove();

    res.status(200).json({ success: true, message: "Fatwa deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get fatwas assigned to logged in shaykh
// @route   GET /fatwas/assigned
// @access  Protected (shaykh)
exports.getAssignedFatwas = async (req, res) => {
  try {
    // Only shaykhs can access this route
    if (req.user.role !== "shaykh" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access assigned fatwas",
      });
    }

    const fatwas = await Fatwa.find({
      assignedTo: req.user.id,
      status: { $in: ["assigned", "answered", "approved"] },
    })
      .populate({
        path: "user",
        select: "username email",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, fatwas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get fatwas created by logged in user
// @route   GET /fatwas/user
// @access  Protected (user)
exports.getUserFatwas = async (req, res) => {
  try {
    const fatwas = await Fatwa.find({ user: req.user.id })
      .populate({
        path: "assignedTo",
        select: "username email name",
      })
      .populate({
        path: "answeredBy",
        select: "username email name",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, fatwas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add feedback to a fatwa
// @route   POST /fatwas/:id/feedback
// @access  Protected (user, admin, shaykh)
exports.addFeedback = async (req, res) => {
  try {
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Check if user has permission to add feedback
    const isOwner = fatwa.user.toString() === req.user.id;
    const isAssigned =
      fatwa.assignedTo && fatwa.assignedTo.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAssigned && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to add feedback to this fatwa",
      });
    }

    // Add feedback
    fatwa.feedback.push({
      comment: req.body.comment,
      date: Date.now(),
    });

    await fatwa.save();

    res.status(200).json({ success: true, fatwa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.approveFatwa = async (req, res) => {
  try {
    console.log("Approve Fatwa");
    const fatwa = await Fatwa.findById(req.params.id);

    if (!fatwa) {
      return res.status(404).json({ success: false, error: "Fatwa not found" });
    }

    // Only admin can approve
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to approve fatwas",
      });
    }

    // Check if fatwa is in answered state
    if (fatwa.status !== "answered") {
      return res.status(400).json({
        success: false,
        error: "Only answered fatwas can be approved",
      });
    }

    // Add admin comment if provided
    if (req.body.comment) {
      fatwa.feedback.push({
        comment: req.body.comment,
        date: Date.now(),
      });
    }

    // Update status
    fatwa.status = "approved";
    fatwa.approvedBy = req.user.id;
    fatwa.approvedAt = Date.now();

    await fatwa.save();

    res.status(200).json({ success: true, fatwa });
  } catch (err) {
    console.log("Error approving fatwa:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
