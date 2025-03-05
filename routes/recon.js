// routes/reconciliation.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getReconciliations,
  getReconciliation,
  createReconciliation,
  assignReconciliation,
  addMeeting,
  updateMeeting,
  addShaykhNotes,
  completeReconciliation,
  addFeedback,
  cancelReconciliation,
  getUserReconciliations,
  getShaykhAssignments,
} = require("../controllers/reconController");

// Get all reconciliations - admin and shaykh only
router.get("/", protect, authorize("admin", "shaykh"), getReconciliations);

// Get user's reconciliations
router.get("/my-cases", protect, getUserReconciliations);

// Get shaykh's assigned reconciliations
router.get(
  "/my-assignments",
  protect,
  authorize("shaykh"),
  getShaykhAssignments
);
router.get("/:id", protect, getReconciliation);

// Get single reconciliation case

// Create reconciliation request
router.post("/", protect, createReconciliation);

// Assign reconciliation to shaykh
router.put("/assign/:id", protect, authorize("admin"), assignReconciliation);

// Add meeting to reconciliation
router.post("/meetings/:id", protect, addMeeting);

// Update meeting
router.put("/meetings/:id/:meetingId", protect, updateMeeting);

// Add shaykh notes
router.put("/notes/:id", protect, addShaykhNotes);

// Complete reconciliation with outcome
router.put("/complete/:id", protect, completeReconciliation);

// Add feedback
router.post("/feedback/:id", protect, addFeedback);

// Cancel reconciliation
router.put("/cancel/:id", protect, cancelReconciliation);

module.exports = router;
