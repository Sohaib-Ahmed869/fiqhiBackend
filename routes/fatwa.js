const express = require("express");
const router = express.Router();
const {
  getFatwas,
  getFatwa,
  createFatwa,
  assignFatwa,
  answerFatwa,
  deleteFatwa,
  getAssignedFatwas,
  getUserFatwas,
  addFeedback, 
  approveFatwa
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
router.put("/:id/answer", protect, authorize("shaykh"), answerFatwa);
router.put("/approve/:id", protect, authorize("admin"), approveFatwa);
router.put("/:id/feedback", protect, authorize("user"), addFeedback);
router.delete("/:id", protect, authorize("admin"), deleteFatwa);

module.exports = router;
