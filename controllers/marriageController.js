// controllers/marriageController.js
const Marriage = require("../models/Marriage");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");

const { certificateUpload } = require("../config/s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
// @desc    Get all marriages
// @route   GET /api/marriages
// @access  Protected (admin, shaykh)
exports.getMarriages = async (req, res) => {
  try {
    let query = {};

    // Apply filters if provided
    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    // If shaykh, only show their assigned marriages
    if (req.user.role === "shaykh") {
      query.assignedShaykh = req.user.id;
    }

    const marriages = await Marriage.find(query)
      .populate({
        path: "user",
        select: "username email",
      })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: marriages.length, marriages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get single marriage
// @route   GET /api/marriages/:id
// @access  Protected
exports.getMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id)
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

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create reservation request
// @route   POST /api/marriages/reservation
// @access  Protected
exports.createReservation = async (req, res) => {
  try {
    const {
      partnerOne,
      partnerTwo,
      preferredDate,
      preferredTime,
      preferredLocation,
      additionalInformation,
    } = req.body;

    const reservation = await Marriage.create({
      type: "reservation",
      user: req.user.id,
      partnerOne,
      partnerTwo,
      preferredDate,
      preferredTime,
      preferredLocation,
      additionalInformation,
    });

    res.status(201).json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create certificate request
// @route   POST /api/marriages/certificate
// @access  Protected
exports.createCertificate = async (req, res) => {
  try {
    const {
      partnerOne,
      partnerTwo,
      marriageDate,
      marriagePlace,
      witnesses,
      additionalInformation,
    } = req.body;

    const certificate = await Marriage.create({
      type: "certificate",
      user: req.user.id,
      partnerOne,
      partnerTwo,
      marriageDate,
      marriagePlace,
      witnesses,
      additionalInformation,
    });

    res.status(201).json({ success: true, certificate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Assign marriage to shaykh
// @route   PUT /api/marriages/:id/assign
// @access  Protected (admin)
exports.assignMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only admin can assign
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Not authorized to assign marriages",
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

    // Update marriage
    marriage.assignedShaykh = shaykhId;
    marriage.status = "assigned";

    await marriage.save();

    // Return populated marriage
    const updatedMarriage = await Marriage.findById(marriage._id).populate({
      path: "assignedShaykh",
      select: "username email firstName lastName",
    });

    res.status(200).json({ success: true, marriage: updatedMarriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add a meeting to a marriage reservation
// @route   POST /api/marriages/:id/meetings
// @access  Protected (admin, assigned shaykh)
exports.addMeeting = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only admin or assigned shaykh can add meetings

    // Only for reservation type
    if (marriage.type !== "reservation") {
      return res.status(400).json({
        success: false,
        error: "Meetings can only be added to reservations",
      });
    }

    const { date, time, location, notes } = req.body;

    marriage.meetings.push({
      date,
      time,
      location,
      notes,
      status: "scheduled",
    });

    // Update status if this is the first meeting
    if (marriage.status === "assigned" || marriage.status === "pending") {
      marriage.status = "in-progress";
    }

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update meeting status
// @route   PUT /api/marriages/:id/meetings/:meetingId
// @access  Protected (admin, assigned shaykh)
exports.updateMeeting = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Find the meeting
    const meeting = marriage.meetings.id(req.params.meetingId);
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

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Modified upload certificate function using multer
exports.uploadCertificate = async (req, res) => {
  try {
    // Debug logs to see what we're getting
    console.log("File upload request received");
    console.log("req.file:", req.file);
    console.log("req.body:", req.body);

    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Only for certificate type
    if (marriage.type !== "certificate") {
      return res.status(400).json({
        success: false,
        error: "File can only be uploaded for certificate requests",
      });
    }

    // Check if file was uploaded successfully
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded or file upload failed",
      });
    }

    // Update marriage record with S3 file information
    marriage.certificateFile = req.file.key;
    marriage.certificateFileUrl =
      req.file.location ||
      `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.file.key}`;

    // Get certificate number from body
    marriage.certificateNumber = req.body.certificateNumber;
    marriage.certificateIssuedDate = new Date();
    marriage.status = "completed";

    await marriage.save();

    res.status(200).json({
      success: true,
      marriage,
      fileInfo: {
        key: req.file.key,
        location: req.file.location,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (err) {
    console.error("Error in uploadCertificate:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// Get certificate URL function remains mostly the same
exports.getCertificateUrl = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Check permissions
    if (
      req.user.role !== "admin" &&
      marriage.assignedShaykh &&
      marriage.assignedShaykh.toString() !== req.user.id &&
      marriage.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access this certificate",
      });
    }

    // Check if marriage has a certificate file
    if (!marriage.certificateFile) {
      return res
        .status(404)
        .json({ success: false, error: "No certificate file found" });
    }

    // Generate a signed URL (valid for 15 minutes)
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: marriage.certificateFile,
    });

    try {
      // Create presigned URL that expires in 15 minutes (900 seconds)
      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 900,
      });
      res.status(200).json({ success: true, downloadUrl: signedUrl });
    } catch (signedUrlError) {
      console.error("Error generating signed URL:", signedUrlError);
      return res
        .status(500)
        .json({ success: false, error: "Error generating download URL" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// @desc    Complete marriage reservation
// @route   PUT /api/marriages/:id/complete
// @access  Protected (admin, assigned shaykh)
exports.completeMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Mark as completed and add notes
    marriage.status = "completed";
    if (req.body.notes) {
      marriage.adminNotes = req.body.notes;
    }

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Add feedback to marriage
// @route   POST /api/marriages/:id/feedback
// @access  Protected
exports.addFeedback = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    const { comment } = req.body;

    if (!comment) {
      return res
        .status(400)
        .json({ success: false, error: "Comment is required" });
    }

    marriage.feedback.push({
      comment,
      user: req.user.id,
    });

    await marriage.save();

    // Return with populated feedback
    const updatedMarriage = await Marriage.findById(marriage._id).populate({
      path: "feedback.user",
      select: "username email firstName lastName role",
    });

    res.status(200).json({ success: true, marriage: updatedMarriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Cancel marriage
// @route   PUT /api/marriages/:id/cancel
// @access  Protected (admin, user who created it)
exports.cancelMarriage = async (req, res) => {
  try {
    const marriage = await Marriage.findById(req.params.id);

    if (!marriage) {
      return res
        .status(404)
        .json({ success: false, error: "Marriage record not found" });
    }

    // Cannot cancel if already completed
    if (marriage.status === "completed") {
      return res
        .status(400)
        .json({ success: false, error: "Cannot cancel a completed marriage" });
    }

    marriage.status = "cancelled";
    if (req.body.reason) {
      marriage.adminNotes = req.body.reason;
    }

    await marriage.save();

    res.status(200).json({ success: true, marriage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get user marriages
// @route   GET /api/marriages/my-marriages
// @access  Protected
exports.getUserMarriages = async (req, res) => {
  try {
    const marriages = await Marriage.find({ user: req.user.id })
      .populate({
        path: "assignedShaykh",
        select: "username email firstName lastName",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: marriages.length, marriages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get shaykh assigned marriages
// @route   GET /api/marriages/my-assignments
// @access  Protected (shaykh)
exports.getShaykhAssignments = async (req, res) => {
  try {
    console.log("here");
    // Only shaykh can access this route
    if (req.user.role !== "shaykh") {
      console.log("here2");
      return res.status(403).json({
        success: false,
        error: "Not authorized to access assigned marriages",
      });
    }

    const marriages = await Marriage.find({
      assignedShaykh: req.user.id,
      status: { $in: ["assigned", "in-progress"] },
    })
      .populate({
        path: "user",
        select: "username email",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: marriages.length, marriages });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
