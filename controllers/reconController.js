// controllers/reconciliationController.js
const Reconciliation = require("../models/Reconciliation");
const User = require("../models/User");

// @desc    Get all reconciliation cases
// @route   GET /api/reconciliations
// @access  Protected (admin, shaykh)
exports.getReconciliations = async (req, res) => {
  try {
    let query = {};

    // Apply filters if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // If shaykh, only show their assigned cases
    if (req.user.role === "shaykh") {
      query.assignedShaykh = req.user.id;
    }

    const reconciliations = await Reconciliation.find(query)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reconciliations.length,
      reconciliations,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get single reconciliation case
// @route   GET /api/reconciliations/:id
// @access  Protected
exports.getReconciliation = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .populate({
        path: "feedback.user",
        select: "username email firstName lastName role",
      });

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    res.status(200).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create reconciliation request
// @route   POST /api/reconciliations
// @access  Protected
exports.createReconciliation = async (req, res) => {
  try {
    const { husband, wife, issueDescription, additionalInformation } = req.body;

    const reconciliation = await Reconciliation.create({
      user: req.user.id,
      husband,
      wife,
      issueDescription,
      additionalInformation,
    });

    res.status(201).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Assign reconciliation to shaykh
// @route   PUT /api/reconciliations/:id/assign
// @access  Protected (admin)
exports.assignReconciliation = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    // Only admin can assign
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to assign reconciliation cases",
      });
    }

    // Validate shaykh exists
    const { shaykhId } = req.body;
    if (!shaykhId) {
      return res
        .status(400)
        .json({ success: false, error: "Please provide a shaykh ID" });
    }

    const shaykh = await User.findById(shaykhId);
    if (!shaykh || shaykh.role !== "shaykh") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid shaykh ID" });
    }

    // Update reconciliation
    reconciliation.assignedShaykh = shaykhId;
    reconciliation.status = "assigned";

    await reconciliation.save();

    // Return populated reconciliation
    const updatedReconciliation = await Reconciliation.findById(
      reconciliation._id
    ).populate({
      path: "assignedShaykh",
      select: "username email firstName lastName",
    });

    res
      .status(200)
      .json({ success: true, reconciliation: updatedReconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add a meeting to a reconciliation case
// @route   POST /api/reconciliations/:id/meetings
// @access  Protected (admin, assigned shaykh)
exports.addMeeting = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }


    const { date, time, location, notes } = req.body;

    reconciliation.meetings.push({
      date,
      time,
      location,
      notes,
      status: "scheduled",
    });

    // Update status if this is the first meeting and status is assigned or pending
    if (
      reconciliation.status === "assigned" ||
      reconciliation.status === "pending"
    ) {
      reconciliation.status = "in-progress";
    }

    await reconciliation.save();

    res.status(200).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update meeting status
// @route   PUT /api/reconciliations/:id/meetings/:meetingId
// @access  Protected (admin, assigned shaykh)
exports.updateMeeting = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    // Only admin or assigned shaykh can update meetings
    if (
      req.user.role !== "admin" &&
      (!reconciliation.assignedShaykh ||
        reconciliation.assignedShaykh.toString() !== req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update meetings for this case",
      });
    }

    // Find the meeting
    const meeting = reconciliation.meetings.id(req.params.meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }

    const { status, completedNotes, date, time, location, notes } = req.body;

    // Update meeting fields
    if (status) meeting.status = status;
    if (completedNotes) meeting.completedNotes = completedNotes;
    if (date) meeting.date = date;
    if (time) meeting.time = time;
    if (location) meeting.location = location;
    if (notes) meeting.notes = notes;

    await reconciliation.save();

    res.status(200).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add shaykh notes to reconciliation
// @route   PUT /api/reconciliations/:id/notes
// @access  Protected (admin, assigned shaykh)
exports.addShaykhNotes = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    // Only admin or assigned shaykh can add notes
    if (
      req.user.role !== "admin" &&
      (!reconciliation.assignedShaykh ||
        reconciliation.assignedShaykh.toString() !== req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to add notes to this case",
      });
    }

    const { notes } = req.body;

    if (!notes) {
      return res
        .status(400)
        .json({ success: false, error: "Notes content is required" });
    }

    reconciliation.shaykhNotes = notes;
    await reconciliation.save();

    res.status(200).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Complete reconciliation with outcome
// @route   PUT /api/reconciliations/:id/complete
// @access  Protected (admin, assigned shaykh)
exports.completeReconciliation = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    // Only admin or assigned shaykh can complete
    if (
      req.user.role !== "admin" &&
      (!reconciliation.assignedShaykh ||
        reconciliation.assignedShaykh.toString() !== req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to complete this case",
      });
    }

    const { outcome, outcomeDetails } = req.body;

    if (!outcome || (outcome !== "resolved" && outcome !== "unresolved")) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Valid outcome (resolved/unresolved) is required",
        });
    }

    // Update reconciliation
    reconciliation.outcome = outcome;
    reconciliation.status = outcome; // Set status based on outcome

    if (outcomeDetails) {
      reconciliation.outcomeDetails = outcomeDetails;
    }

    await reconciliation.save();

    res.status(200).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add feedback to reconciliation
// @route   POST /api/reconciliations/:id/feedback
// @access  Protected
exports.addFeedback = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    const { comment } = req.body;

    if (!comment) {
      return res
        .status(400)
        .json({ success: false, error: "Comment is required" });
    }

    reconciliation.feedback.push({
      comment,
      user: req.user.id,
    });

    await reconciliation.save();

    // Return with populated feedback
    const updatedReconciliation = await Reconciliation.findById(
      reconciliation._id
    ).populate({
      path: "feedback.user",
      select: "username email firstName lastName role",
    });

    res
      .status(200)
      .json({ success: true, reconciliation: updatedReconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Cancel reconciliation
// @route   PUT /api/reconciliations/:id/cancel
// @access  Protected (admin, user who created it)
exports.cancelReconciliation = async (req, res) => {
  try {
    const reconciliation = await Reconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res
        .status(404)
        .json({ success: false, error: "Reconciliation case not found" });
    }

    // Only admin or the user who created the case can cancel
    if (
      req.user.role !== "admin" &&
      reconciliation.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to cancel this case",
      });
    }

    // Cannot cancel if already resolved or unresolved
    if (
      reconciliation.status === "resolved" ||
      reconciliation.status === "unresolved"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Cannot cancel a completed reconciliation case",
        });
    }

    reconciliation.status = "cancelled";
    if (req.body.reason) {
      reconciliation.adminNotes = req.body.reason;
    }

    await reconciliation.save();

    res.status(200).json({ success: true, reconciliation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get user reconciliations
// @route   GET /api/reconciliations/my-cases
// @access  Protected
exports.getUserReconciliations = async (req, res) => {
  try {
    const reconciliations = await Reconciliation.find({ user: req.user.id })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: reconciliations.length, reconciliations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get shaykh assigned reconciliations
// @route   GET /api/reconciliations/my-assignments
// @access  Protected (shaykh)
exports.getShaykhAssignments = async (req, res) => {
  try {
    // Only shaykh can access this route
    if (req.user.role !== "shaykh") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access assigned reconciliation cases",
      });
    }

    const reconciliations = await Reconciliation.find({
      assignedShaykh: req.user.id,
      status: { $in: ["assigned", "in-progress", "resolved", "unresolved"] },
    })
      .populate({
        path: "user",
        select: "username email",
      })
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ success: true, count: reconciliations.length, reconciliations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
