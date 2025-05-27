const express = require("express");
const router = express.Router();
const {
  getFatwas,
  getFatwa,
  createFatwa,
  assignFatwa,
  unassignFatwa,
  answerFatwa,
  deleteFatwa,
  getAssignedFatwas,
  getUserFatwas,
  addFeedback,
  approveFatwa,
  unapproveFatwa,
} = require("../controllers/fatwaController");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.get("/", getFatwas);
router.get("/user", protect, getUserFatwas);
router.get("/assigned", protect, authorize("shaykh"), getAssignedFatwas);
router.get("/:id", getFatwa);

router.post("/", protect, authorize("user", "admin"), createFatwa);

// Admin and Shaykh routes
router.put("/:id/assign", protect, authorize("shaykh", "admin"), assignFatwa);
router.put("/:id/unassign", protect, authorize("admin"), unassignFatwa);
router.put("/:id/answer", protect, authorize("shaykh", "admin"), answerFatwa);
router.put("/approve/:id", protect, authorize("admin"), approveFatwa);
router.put("/:id/unapprove", protect, authorize("admin"), unapproveFatwa);
router.put("/:id/feedback", protect, authorize("user"), addFeedback);
router.delete("/:id", protect, authorize("admin"), deleteFatwa);

module.exports = router;
