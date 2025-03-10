// routes/marriage.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getMarriages,
  getMarriage,
  createReservation,
  createCertificate,
  assignMarriage,
  addMeeting,
  updateMeeting,
  uploadCertificate,
  completeMarriage,
  addFeedback,
  cancelMarriage,
  getUserMarriages,
  getShaykhAssignments,
  getCertificateUrl,
  generateCertificate,
  downloadCertificate,
} = require("../controllers/marriageController");
const { certificateUpload } = require("../config/s3");

// Get all marriages - admin and shaykh only
router.get("/", protect, authorize("admin", "shaykh"), getMarriages);

// Get user's marriages
router.get("/my-marriages", protect, getUserMarriages);
// Get shaykh's assigned marriages
router.get(
  "/my-assignments",
  protect,
  authorize("shaykh"),
  getShaykhAssignments
);
router.get("/:id", protect, getMarriage);

// Get certificate URL (signed URL for S3)
router.get("/certificate-url/:id", protect, getCertificateUrl);
// Get single marriage

// Create marriage reservation
router.post("/reservation", protect, createReservation);

// Create marriage certificate request
router.post("/certificate", protect, createCertificate);

// Assign marriage to shaykh
router.put("/assign/:id", protect, authorize("admin"), assignMarriage);

// Add meeting to marriage
router.post("/meetings/:id", protect, addMeeting);

// Update meeting
router.put("/meetings/:id/:meetingId", protect, updateMeeting);

// Upload certificate file
router.put(
  "/upload-certificate/:id",
  protect,
  authorize("admin", "shaykh"),
  certificateUpload.single("certificate"), // Use multer S3 middleware here
  uploadCertificate
);

// Complete marriage
router.put("/complete/:id", protect, completeMarriage);

// Add feedback
router.post("/feedback/:id", protect, addFeedback);

// Cancel marriage
router.put("/cancel/:id", protect, cancelMarriage);

// Replace the upload-certificate route with generate-certificate
router.post(
  "/generate-certificate/:id",
  protect,
  authorize("admin", "shaykh"),
  generateCertificate
);

// Add download route
router.get("/download-certificate/:id", protect, downloadCertificate);

module.exports = router;
